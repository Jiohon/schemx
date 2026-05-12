/**
 * Runtime 引擎
 *
 * Runtime 是 core 对外使用的运行时装配入口，负责装配 compiler、
 * scheduler、runtime node factory，以及后续迁移进入 `engine/` 的各类
 * 具体执行器，并向适配层暴露 runtime tree 与已解析 schema 列表。
 *
 * 注意：`runtime/createRuntime.ts` 不承载 dependencies/dependency/validation
 * 的具体业务执行逻辑；这些逻辑会逐步收敛到 `packages/core/src/engine/`。
 *
 * @module core/runtime/createRuntime
 */

import { cloneDeep } from "es-toolkit"

import { createRuntimeScheduler } from "../scheduler"
import {
  buildRuntimeFieldSchemaIndex,
  createResolvedSchemaList,
  normalizeNamePath,
} from "../utils"
import { filterSchemas } from "../utils/filterSchemas"

import { createFormRuntimeContext } from "./context"
import { createRuntimeGraph } from "./graph"
import { createRuntimeTreeBuilder } from "./runtimeTreeBuilder"

import type {
  FieldRuntimeNode,
  NamePath,
  RuntimeFieldDefaults,
  RuntimeNode,
  SchemxField,
  SchemxInstance,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  Values,
} from "../types"
import type { RuntimeTreeBuilder } from "./runtimeTreeBuilder"

/**
 * Runtime 生命周期回调。
 *
 * 定义 Runtime 实例的字段生命周期钩子，用于在字段挂载、更新、卸载时执行自定义逻辑。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const options: RuntimeOptions<FormValues> = {
 *   fieldDefaults: { readonly: false, disabled: false },
 *   onFieldMount: (node) => console.log('Mounted:', node.key),
 *   onFieldUpdate: (node) => console.log('Updated:', node.key),
 *   onFieldUnmount: (node) => console.log('Unmounted:', node.key),
 * }
 * ```
 */
export interface RuntimeOptions<T extends Values = Values> {
  /**
   * 字段 resolved props 的全局默认值。
   *
   * 例如 Vue Form 级 readonly/disabled，可被字段级配置覆盖。
   */
  fieldDefaults?: RuntimeFieldDefaults<T>
  /**
   * 字段节点挂载时触发。
   *
   * @param node - 挂载的字段运行时节点
   */
  onFieldMount?: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段 resolved props 更新时触发。
   *
   * @param node - 更新的字段运行时节点
   */
  onFieldUpdate?: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段节点卸载时触发。
   *
   * @param node - 卸载的字段运行时节点
   */
  onFieldUnmount?: (node: FieldRuntimeNode<T>) => void
}

/**
 * 表单运行时引擎。
 *
 * Runtime 是 core 对外使用的运行时装配入口，负责装配 compiler、scheduler、
 * runtime node factory，以及后续迁移进入 engine 的各类具体执行器，
 * 并向适配层暴露 runtime tree 与已解析 schema 列表。
 *
 * Runtime 不承载 dependencies/dependency/validation 的具体业务执行逻辑；
 * 这些逻辑收敛在 engine 目录下的各引擎模块中。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const runtime = new Runtime<FormValues>(schemas, form, {
 *   fieldDefaults: { readonly: false },
 *   onFieldMount: (node) => console.log('Mounted:', node.key),
 * })
 *
 * // 获取运行时树根节点
 * const root = runtime.getRoot()
 *
 * // 获取已解析的 schema 列表
 * const resolved = runtime.getResolvedSchemas()
 *
 * // 等待异步任务完成
 * await runtime.waitForIdle()
 *
 * // 销毁运行时
 * runtime.destroy()
 * ```
 */
export class Runtime<T extends Values = Values> {
  /**
   * 统一运行时调度器。
   *
   * 承载 dependency/dependencies/validation/cleanup 等 engine 任务。
   */
  private readonly scheduler = createRuntimeScheduler()

  /**
   * schema 到 runtime tree 的构建器。
   */
  private readonly treeBuilder: RuntimeTreeBuilder<T>

  /**
   * runtime tree ownership 与结构版本。
   */
  private readonly graph = createRuntimeGraph<T>()

  /**
   * 字段 schema 查询缓存对应的 runtime 版本。
   */
  private fieldSchemaMapRevision = -1

  /**
   * 按规范化字段路径建立的字段 schema 查询缓存。
   */
  private fieldSchemaMap = new Map<string, SchemxResolvedBaseField<T>>()

  /**
   * 创建 Runtime。
   *
   * 初始化运行时上下文、树构建器和图结构，并将过滤后的 schemas 编译为运行时树。
   *
   * @param schemas - 已过滤的 raw schemas
   * @param form - 当前表单实例，供 dependency renderer 和响应式 effect 使用
   * @param options - runtime 生命周期回调
   */
  constructor(
    schemas: SchemxField<T>[],
    form: SchemxInstance<T>,
    options: RuntimeOptions<T> = {}
  ) {
    // FormRuntimeContext 是 runtime 与 createForm 的边界，避免 engine 直接感知 store/validator。
    const context = createFormRuntimeContext(form, options)

    this.treeBuilder = createRuntimeTreeBuilder<T>({
      context,
      scheduler: this.scheduler,
      commitDependencySubtree: (node, nextChildren) => {
        this.graph.replaceSubtree(node, nextChildren)
      },
      onTreeChange: this.bumpRevision,
    })

    // Runtime: 过滤后的 raw schemas 编译为运行时树。
    const filteredSchemas = filterSchemas(schemas)

    // 开始编译 runtime tree，并设置到 graph 中。
    // 后续的 runtime tree 结构变更都通过 graph 的 replaceSubtree 来进行，
    this.graph.setRoot(this.treeBuilder.compileRoot(filteredSchemas))
  }

  /**
   * 获取当前 runtime tree 结构版本。
   *
   * 每次 dependency subtree 变化后版本号递增，可用于缓存失效判断。
   *
   * @returns 当前版本号
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
    console.log(cloneDeep(createResolvedSchemaList(this.graph.getRoot())))

    return createResolvedSchemaList(this.graph.getRoot())
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
      this.fieldSchemaMap = buildRuntimeFieldSchemaIndex(this.graph.getRoot())
      this.fieldSchemaMapRevision = revision
    }

    return this.fieldSchemaMap.get(normalizeNamePath(name))
  }

  /**
   * 判断 runtime 是否空闲。
   *
   * 当没有待执行的 dependency 或字段动态属性解析任务时返回 true。
   *
   * @returns 异步任务 pending 为 0 且 scheduler 空闲时返回 true
   */
  isIdle(): boolean {
    return this.scheduler.isIdle()
  }

  /**
   * 等待 runtime 异步工作全部执行完成。
   *
   * @param timeout - 最大等待时间，单位毫秒，默认 10000ms
   * @returns true 表示全部完成，false 表示超时
   */
  waitForIdle(timeout: number = 10000): Promise<boolean> {
    return this.scheduler.whenIdle(timeout)
  }

  /**
   * 销毁 runtime tree。
   *
   * 会递归释放所有 runtime 节点持有的 effect 和 subtree，
   * 并清理调度器中的待执行任务。
   */
  destroy(): void {
    this.graph.dispose()
    this.scheduler.dispose()
  }

  /**
   * 通知 runtime tree 结构发生变化。
   *
   * 递增图版本号，触发响应式更新。
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
 * @typeParam T - 表单值类型
 *
 * @param schemas - 已过滤的 raw schemas
 * @param form - 当前表单实例
 * @param options - runtime 生命周期回调
 * @returns Runtime 实例
 *
 * @example
 * ```ts
 * const runtime = createRuntime<FormValues>(schemas, form, {
 *   fieldDefaults: { readonly: false },
 *   onFieldMount: (node) => console.log('Mounted:', node.key),
 * })
 * ```
 */
export function createRuntime<T extends Values = Values>(
  schemas: SchemxField<T>[],
  form: SchemxInstance<T>,
  options: RuntimeOptions<T> = {}
): Runtime<T> {
  return new Runtime<T>(schemas, form, options)
}
