/**
 * Schemx form 实例级外部上下文。
 *
 * `schemxContext.Provider()` 只负责在 `createForm()` 初始化调用栈内提供值。
 * `CreateForm` 会在构造阶段捕获该值并固化到当前 form runtime context 中，
 * 后续 runtime node、dependency effect、lifecycle hook 等内部逻辑通过
 * `schemxContext.useContext()` 读取同一个实例级快照。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 */

import { createContext } from "./context"

import type { Compile } from "./compiler/types"
import type { FormDescriptor } from "./descriptor"
import type { FieldRegistry } from "./field"
import type { LifecycleBus } from "./lifecycle"
import type {
  ContainerRuntimeNode,
  RuntimeNode,
  RuntimeNodeResourceContext,
} from "./node"
import type { Scheduler } from "./scheduler"
import type { SchemxDefaultProps, SchemxFormApi, SchemxInstance, Values } from "./types"

/**
 * `createForm()` 内部运行时上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享实例级服务。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxContext<TValues extends Values = Values> {
  /**
   * schema 编译默认选项，供 root 与 dependency 子树复用。
   */
  defaultProps: SchemxDefaultProps
  /**
   * 表单实例公开 API。
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * 传递给动态 renderer 的表单 API 子集。
   */
  readonly formApi: SchemxFormApi<TValues>
  /**
   * 当前表单实例的 schema 编译门面。
   */
  readonly compile: Compile<TValues>
  /**
   * 运行时异步调度器。
   */
  readonly scheduler: Scheduler
  /**
   * runtime node 生命周期事件总线。
   */
  readonly lifecycleBus: LifecycleBus<RuntimeNode<TValues>>
  /**
   * 字段 RuntimeNode 到字段模型的注册表。
   */
  readonly fieldRegistry: FieldRegistry<TValues>
  /**
   * RuntimeNode 之外的领域资源注册表与跨节点查询索引。
   */
  readonly nodeResources: RuntimeNodeResourceContext<TValues>
  /**
   * 唯一子节点提交边界。
   *
   * @param parent - 接收子节点的容器 RuntimeNode。
   * @param descriptors - 新一轮编译得到的子 descriptor 列表。
   */
  commitChildren(
    parent: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void
}

type SchemxContextEntry = {
  readonly type: "runtime"
  readonly value: SchemxContext<Values>
}

const schemxContextStore = createContext<SchemxContextEntry>("SchemxContext")

/**
 * 在指定函数执行期间提供当前 form runtime context。
 *
 * @param context - 当前 `createForm()` 实例组装出的运行时上下文。
 * @param run - 需要读取当前运行时上下文的同步函数。
 *
 * @returns `run` 的返回值。
 */
export function withSchemxContext<TValues extends Values, TResult>(
  context: SchemxContext<TValues>,
  run: () => TResult
): TResult {
  return schemxContextStore.Provider(
    {
      type: "runtime",
      value: context as SchemxContext<Values>,
    },
    run
  )
}

/**
 * 读取当前 form runtime context。
 *
 * 只能在 `withSchemxContext()` 的同步调用栈内使用。
 *
 * @returns 当前 form runtime context。
 */
export function useSchemxContext<
  TValues extends Values = Values,
>(): SchemxContext<TValues> {
  const current = schemxContextStore.tryUseContext()

  if (current?.type !== "runtime") {
    throw new Error("[schemx] Form runtime context has not been provided.")
  }

  return current.value as SchemxContext<TValues>
}

/**
 * 尝试读取当前 form runtime context。
 *
 * 和 `useSchemxContext()` 不同，当前调用栈没有 context 时会返回 undefined。
 *
 * @returns 当前 form runtime context；不存在时返回 undefined。
 */
export function maybeUseSchemxContext<TValues extends Values = Values>():
  | SchemxContext<TValues>
  | undefined {
  const current = schemxContextStore.tryUseContext()

  if (current?.type !== "runtime") {
    return undefined
  }

  return current.value as SchemxContext<TValues>
}
