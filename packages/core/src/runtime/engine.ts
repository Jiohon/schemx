/**
 * Runtime 引擎
 *
 * RuntimeEngine 是 core 对外使用的运行时装配入口，负责装配 compiler、
 * scheduler、runtime node factory，以及后续迁移进入 `engine/` 的各类
 * 具体执行器，并向适配层暴露 runtime tree 与已解析 schema 投影。
 *
 * 注意：`runtime/engine.ts` 不承载 field/dynamic prop/dependency/validation
 * 的具体业务执行逻辑；这些逻辑会逐步收敛到 `packages/core/src/engine/`。
 *
 * @module core/runtime/engine
 */

import { RuntimeTreeCompiler } from "../compiler/runtimeTreeCompiler"
import { createFormRuntimeContext } from "../core"
import { createRuntimeScheduler, DependencyScheduler } from "../scheduler"

import { buildRuntimeFieldIndex, normalizeNamePath } from "./fieldIndex"
import { createRuntimeGraph } from "./graph"
import { RuntimeIdleTracker } from "./idle"
import { RuntimeNodeFactory } from "./nodeFactory"
import { projectRuntimeNodes } from "./projection"

import type {
  NamePath,
  SchemxField,
  SchemxInstance,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  Values,
} from "../types"
import type { FieldRuntimeNode, RuntimeFieldDefaults, RuntimeNode } from "./types"

/**
 * RuntimeEngine 生命周期回调。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeEngineOptions<T extends Values = Values> {
  /** 字段 resolved props 的全局默认值，例如 Vue Form 级 readonly/disabled */
  fieldDefaults?: RuntimeFieldDefaults<T>
  /** 字段节点挂载时触发 */
  onFieldMount?: (node: FieldRuntimeNode<T>) => void
  /** 字段 resolved props 更新时触发 */
  onFieldUpdate?: (node: FieldRuntimeNode<T>) => void
  /** 字段节点卸载时触发 */
  onFieldUnmount?: (node: FieldRuntimeNode<T>) => void
}

/**
 * 表单运行时引擎。
 *
 * @typeParam T - 表单值类型
 */
export class RuntimeEngine<T extends Values = Values> {
  /** dependency 脏队列调度器 */
  private readonly scheduler: DependencyScheduler<T>

  /** runtime 通用调度器，承载 dynamic prop 等 engine 任务 */
  private readonly runtimeScheduler = createRuntimeScheduler()

  /** schema 到 runtime tree 的编译器 */
  private readonly compiler: RuntimeTreeCompiler<T>

  /** runtime 异步任务 pending + scheduler 空闲状态追踪器 */
  private readonly idleTracker: RuntimeIdleTracker<T>

  /** runtime tree ownership 与结构版本 */
  private readonly graph = createRuntimeGraph<T>()

  /** 字段 schema 查询缓存对应的 runtime 版本 */
  private fieldSchemaMapRevision = -1

  /** 按规范化字段路径建立的字段 schema 查询缓存 */
  private fieldSchemaMap = new Map<string, SchemxResolvedBaseField<T>>()

  /**
   * 创建 RuntimeEngine。
   *
   * @param schemas - 已过滤的 raw schemas
   * @param form - 当前表单实例，供 dependency renderer 和响应式 effect 使用
   */
  constructor(
    schemas: SchemxField<T>[],
    form: SchemxInstance<T>,
    options: RuntimeEngineOptions<T> = {}
  ) {
    this.scheduler = new DependencyScheduler<T>(this.runtimeScheduler)
    this.idleTracker = new RuntimeIdleTracker<T>(this.scheduler, this.runtimeScheduler)

    // FormRuntimeContext 是 runtime 与 createForm 的边界，避免 engine 直接感知 store/validator。
    const context = createFormRuntimeContext(form, options)

    const nodeFactory = new RuntimeNodeFactory<T>({
      context,
      scheduler: this.scheduler,
      runtimeScheduler: this.runtimeScheduler,
      // 编译器与节点工厂互相协作：工厂负责创建节点，递归编译仍回到编译器。
      compileChildren: (...args) => this.compiler.compileChildren(...args),
      commitDependencySubtree: (node, nextChildren) => {
        this.graph.replaceSubtree(node, nextChildren)
      },
      onPendingChange: this.idleTracker.handlePendingChange,
      onTreeChange: this.bumpRevision,
    })

    const compiler = new RuntimeTreeCompiler<T>({
      nodeFactory,
    })

    this.compiler = compiler

    this.graph.setRoot(this.compiler.compileRoot(schemas))
  }

  /**
   * 当前 runtime tree 结构版本。
   *
   * @returns 每次 dependency subtree 变化后递增的版本号
   */
  get revision(): number {
    return this.graph.revision
  }

  /**
   * 获取 runtime root。
   *
   * 读取版本 signal 以便调用方在响应式 effect 中自动追踪 tree 变化。
   *
   * @returns runtime root 节点数组
   */
  getRoot(): RuntimeNode<T>[] {
    return this.graph.getRoot()
  }

  /**
   * 获取已解析 schema 投影。
   *
   * 这是从 runtime tree 派生出的只读视图：字段节点会输出自身 schema，
   * group 节点会递归输出已解析 children，dependency 节点不会出现在结果中，
   * 而是被其 renderer 产出的 subtree 替换。
   *
   * 注意：该方法不会修改 raw schemas。Raw Schema 保持 immutable，
   * dependency 的动态结果只存在于 runtime node subtree 中。
   *
   * @returns dependency 已展开后的标准 schema 列表
   */
  getResolvedSchemas(): SchemxResolvedField<T>[] {
    return projectRuntimeNodes(this.graph.getRoot())
  }

  /**
   * 获取已解析 runtime tree 中指定字段的 schema。
   *
   * 该查询只返回基础字段 schema；group 和 dependency 只作为结构容器被展开。
   * 主要用于字段级内部逻辑复用 runtime 已解析后的 schema 上下文。
   *
   * @param name - 字段路径
   * @returns 匹配的基础字段 schema，未找到时返回 undefined
   */
  getFieldSchema(name: NamePath<T>): SchemxResolvedBaseField<T> | undefined {
    const revision = this.graph.revision

    if (this.fieldSchemaMapRevision !== revision) {
      this.fieldSchemaMap = buildRuntimeFieldIndex(this.graph.getRoot())
      this.fieldSchemaMapRevision = revision
    }

    return this.fieldSchemaMap.get(normalizeNamePath(name))
  }

  /**
   * 判断 runtime 是否没有待执行 dependency 或字段动态属性解析。
   *
   * @returns 异步任务 pending 为 0 且 scheduler 空闲时返回 true
   */
  isIdle(): boolean {
    return this.idleTracker.isIdle()
  }

  /**
   * 等待 runtime 异步工作全部执行完成。
   *
   * @param timeout - 最大等待时间，默认 10000ms
   * @returns true 表示全部完成，false 表示超时
   */
  waitForIdle(timeout: number = 10000): Promise<boolean> {
    return this.idleTracker.waitForIdle(timeout)
  }

  /**
   * 销毁 runtime tree。
   *
   * 会递归释放所有 runtime 节点持有的 effect 和 subtree。
   */
  destroy(): void {
    this.graph.dispose()
    this.idleTracker.reset()
    this.scheduler.dispose()
    this.runtimeScheduler.dispose()
  }

  /**
   * 通知 runtime tree 结构发生变化。
   */
  private readonly bumpRevision = (): void => {
    this.graph.setRoot(this.graph.getRoot())
  }
}

/**
 * 创建 schema runtime 引擎。
 *
 * 统一项目内 runtime engine 的创建方式，避免调用方直接依赖 class 构造细节。
 *
 * @param schemas - 已过滤的 raw schemas
 * @param form - 当前表单实例
 * @param options - runtime 生命周期回调
 * @returns RuntimeEngine 实例
 */
export function createRuntimeEngine<T extends Values = Values>(
  schemas: SchemxField<T>[],
  form: SchemxInstance<T>,
  options: RuntimeEngineOptions<T> = {}
): RuntimeEngine<T> {
  return new RuntimeEngine<T>(schemas, form, options)
}
