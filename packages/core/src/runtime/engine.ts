/**
 * Runtime 引擎
 *
 * RuntimeEngine 是 core 对外使用的运行时入口，负责持有 runtime tree、
 * 编译 schema、等待 dependency idle，并在 Stage A 中把 runtime tree
 * 暂时展开回 schema list 供现有 Vue 适配层消费。
 *
 * @module core/runtime/engine
 */

import { signal } from "@preact/signals-core"

import { RuntimeCompiler } from "./compiler"
import { RuntimeScheduler } from "./scheduler"

import type {
  SchemxBaseField,
  SchemxField,
  SchemxInstance,
  SchemxResolvedField,
  Values,
} from "../types"
import type { RuntimeNode } from "./types"

/**
 * RuntimeEngine 生命周期回调。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeEngineOptions<T extends Values = Values> {
  /** field node 挂载时触发 */
  onFieldMount?: (schema: SchemxBaseField<T>) => void
  /** field node 卸载时触发 */
  onFieldUnmount?: (schema: SchemxBaseField<T>) => void
}

/**
 * 表单运行时引擎。
 *
 * @typeParam T - 表单值类型
 */
export class RuntimeEngine<T extends Values = Values> {
  /** dependency dirty queue 调度器 */
  private readonly scheduler = new RuntimeScheduler<T>()

  /** schema -> runtime tree 编译器 */
  private readonly compiler: RuntimeCompiler<T>

  /** runtime tree 结构版本，用于让 getResolvedSchemas/getRoot 建立响应式依赖 */
  private readonly revisionSignal = signal(0)

  /** 正在执行中的 dependency renderer 数量 */
  private pendingCount = 0

  /** runtime root 节点列表 */
  private root: RuntimeNode<T>[] = []

  /**
   * 创建 RuntimeEngine。
   *
   * @param schemas - 已过滤的 raw schemas
   * @param form - 当前表单实例，供 dependency renderer 和 effect 使用
   */
  constructor(
    schemas: SchemxField<T>[],
    private readonly form: SchemxInstance<T>,
    options: RuntimeEngineOptions<T> = {}
  ) {
    this.compiler = new RuntimeCompiler<T>({
      form,
      scheduler: this.scheduler,
      onPendingChange: this.handlePendingChange,
      onTreeChange: this.bumpRevision,
      onFieldMount: options.onFieldMount,
      onFieldUnmount: options.onFieldUnmount,
    })

    this.root = this.compiler.compileRoot(schemas)
  }

  /**
   * 当前 runtime tree 结构版本。
   *
   * @returns 每次 dependency subtree 变化后递增的版本号
   */
  get revision(): number {
    return this.revisionSignal.value
  }

  /**
   * 获取 runtime root。
   *
   * 读取 revisionSignal 以便调用方在 signal effect 中自动追踪 tree 变化。
   *
   * @returns runtime root 节点数组
   */
  getRoot(): RuntimeNode<T>[] {
    void this.revisionSignal.value

    return this.root
  }

  /**
   * 获取已解析 schema projection。
   *
   * 这是从 runtime tree 派生出的只读视图：field node 会输出自身
   * schema，group node 会递归输出已解析 children，dependency node 不会
   * 出现在结果中，而是被其 renderer 产出的 subtree 替换。
   *
   * 注意：该方法不会修改 raw schemas。Raw Schema 保持 immutable，
   * dependency 的动态结果只存在于 runtime node subtree 中。
   *
   * @returns dependency 已展开后的标准 schema 列表
   */
  getResolvedSchemas(): SchemxResolvedField<T>[] {
    void this.revisionSignal.value

    return this.flattenNodes(this.root)
  }

  /**
   * 判断 runtime 是否没有待执行 dependency。
   *
   * @returns pending renderer 为 0 且 scheduler 空闲时返回 true
   */
  isIdle(): boolean {
    return this.pendingCount === 0 && this.scheduler.isIdle()
  }

  /**
   * 等待 runtime dependency 全部执行完成。
   *
   * @param timeout - 最大等待时间，默认 10000ms
   * @returns true 表示全部完成，false 表示超时
   */
  waitForIdle(timeout: number = 10000): Promise<boolean> {
    if (this.isIdle()) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const start = Date.now()

      const check = () => {
        if (this.isIdle()) {
          resolve(true)

          return
        }

        if (Date.now() - start >= timeout) {
          resolve(false)

          return
        }

        setTimeout(check, 16)
      }

      setTimeout(check, 0)
    })
  }

  /**
   * 销毁 runtime tree。
   *
   * 会递归释放所有 runtime node 持有的 effect 和 subtree。
   */
  destroy(): void {
    this.root.forEach((node) => node.dispose())
    this.root = []
    this.pendingCount = 0
    this.bumpRevision()
  }

  /**
   * 维护 dependency renderer pending 数量。
   *
   * @param delta - 增量，run 开始为 1，结束为 -1
   */
  private readonly handlePendingChange = (delta: number): void => {
    this.pendingCount = Math.max(0, this.pendingCount + delta)
  }

  /**
   * 通知 runtime tree 结构发生变化。
   */
  private readonly bumpRevision = (): void => {
    this.revisionSignal.value += 1
  }

  /**
   * 将 runtime tree 展开为现有 UI 可消费的 schema list。
   *
   * dependency node 不出现在结果中，只展开其 subtree。
   *
   * @param nodes - 要展开的 runtime 节点数组
   * @returns 标准 schema 列表
   */
  private flattenNodes(nodes: RuntimeNode<T>[]): SchemxResolvedField<T>[] {
    const result: SchemxResolvedField<T>[] = []

    for (const node of nodes) {
      if (node.type === "field") {
        result.push({ ...node.schema, key: node.key })
      } else if (node.type === "group") {
        result.push({
          ...node.schema,
          children: this.flattenNodes(node.children),
          key: node.key,
        })
      } else if (node.children.length > 0) {
        result.push(...this.flattenNodes(node.children))
      }
    }

    return result
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
