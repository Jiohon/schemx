/**
 * Schemx form 实例级运行时上下文。
 *
 * 该 context 表达的是 form instance scope，不是 schema subtree scope。
 */

import type { Compile } from "./compiler/types"
import type { FormDescriptor } from "./descriptor"
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
