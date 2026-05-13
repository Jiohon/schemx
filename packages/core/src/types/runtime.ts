/**
 * Runtime 节点核心结构定义。
 *
 * 将不可变的 Raw Schema 编译为可变的运行时树节点。
 *
 * 设计原则：
 *
 * - RuntimeNode 负责"树结构、节点身份、生命周期"
 * - FieldRuntime 负责"字段状态"（→ ./field）
 * - DependencyRuntime 负责"动态 subtree 执行状态"（→ ./dependency）
 * - DisposeBag 负责"资源释放契约"（→ ./dispose）
 * - RuntimeNode 不直接面向 UI 暴露，框架层应该通过 Runtime facade / Renderer Adapter 消费
 *
 * @module core/types/runtime
 */

import type { SchemxDependenciesStaticProps } from "./dependencies"
import type { DisposeBag, DisposeCallback, DisposeSubscription } from "./dispose"
import type { Values } from "./form"
import type { ReactiveSignal } from "../reactivity"
import type {
  SchemxComponentProps,
  SchemxDependencyField,
  SchemxGroupField,
} from "./schema"
import type { SchemxBaseField } from "./schema"

// ---------------------------------------------------------------------------
// 字段已解析属性
// ---------------------------------------------------------------------------

/**
 * 字段运行时默认属性。
 *
 * 合并策略：
 * - `readonly` / `disabled`
 *   default props 作为初始值，schema 静态配置优先级更高，dependencies engine 结果最终覆盖
 */
export type RuntimeFieldDefaultProps<T extends Values = Values> = Partial<
  Pick<SchemxDependenciesStaticProps<T>, "readonly" | "disabled">
>

/**
 * 字段运行时默认属性来源。
 */
export type RuntimeFieldDefaults<T extends Values = Values> =
  | RuntimeFieldDefaultProps<T>
  | ((schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>)

// ---------------------------------------------------------------------------
// 基础枚举与工具类型
// ---------------------------------------------------------------------------

/**
 * Runtime 节点类型。
 */
export type RuntimeNodeType = "field" | "group" | "dependency"

/**
 * per-computation 竞态防护容器。
 *
 * 每个异步属性计算（disabled、visible、required、componentProps 等）
 * 应各自持有独立的 version，避免多个并发 async 计算互相推进同一个 version
 * 导致过期结果误判为最新结果。
 *
 * 使用约定：
 * - 每次发起新一轮计算时，先执行 `++computation.version` 捕获当前版本号
 * - 计算完成时比对版本号，不一致则丢弃结果
 * - `abortController` 在新一轮计算开始时 abort 上一轮（适用于 fetch 类副作用）
 *
 * @typeParam T - 计算结果类型
 */
export interface ReactiveComputation<T> {
  /**
   * 当前版本号。
   *
   * 每次发起新计算时自增，用于丢弃过期异步结果。
   */
  version: number

  /**
   * 计算结果信号。
   */
  value: ReactiveSignal<T>

  /**
   * 当前飞行中请求的 AbortController。
   *
   * 发起新一轮计算前，应先 abort 上一轮。
   * 仅在计算涉及 fetch 等可取消副作用时有效。
   * 对于纯同步计算，此字段可忽略。
   */
  abortController: AbortController | null

  /**
   * 释放当前计算持有的所有响应式资源（effect、computed 订阅等）。
   */
  dispose: () => void
}

// ---------------------------------------------------------------------------
// RuntimeNodeBase
// ---------------------------------------------------------------------------

/**
 * Runtime 节点公共字段。
 *
 * RuntimeNodeBase 只保存节点级别的信息：
 *
 * - 节点身份
 * - 父子关系
 * - 生命周期状态
 * - DisposeBag
 *
 * 不应该在这里放字段属性、校验状态、dependency 执行状态等业务状态。
 *
 * ## Dispose 语义
 *
 * `dispose()` 是**级联操作**，调用时会：
 *
 * 1. 递归 dispose 所有子节点（先子后父）
 * 2. 执行当前节点 `disposeBag` 中注册的所有清理函数
 * 3. 将 `disposed` signal 置为 true，通知所有订阅方（如 Renderer Adapter）
 *
 * 若只需释放当前节点自身资源而不递归子树，请调用 `disposeSelf()`。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeNodeBase<T extends Values = Values> {
  /**
   * 节点类型。
   */
  type: RuntimeNodeType

  /**
   * 运行时自增 id。
   *
   * 主要用于：
   * - 调试
   * - devtools
   * - 框架层 key fallback
   */
  id: number

  /**
   * 稳定身份 key。
   *
   * 推荐由 ownerPath + schema identity 生成。
   *
   * 用于：
   * - runtime node reuse
   * - subtree diff
   * - renderer adapter key
   */
  key: string

  /**
   * 父节点。
   *
   * root 节点为 null。
   */
  parent: RuntimeNode<T> | null

  /**
   * 节点是否处于挂载状态。
   */
  mounted: boolean

  /**
   * 节点是否等待 scheduler 刷新。
   */
  dirty: boolean

  /**
   * 节点是否已销毁。
   *
   * 使用响应式 signal，供 Renderer Adapter 订阅 dispose 事件，
   * 在节点销毁时自动卸载对应的 UI 组件，无需轮询或手动检查。
   *
   * @example
   * ```ts
   * // Renderer Adapter 内
   * effect(() => {
   *   if (node.disposed.value) {
   *     unmountComponent(node.id)
   *   }
   * })
   * ```
   */
  disposed: ReactiveSignal<boolean>

  /**
   * 当前节点持有的 effect、runner、resolver、watcher 等释放函数集合。
   *
   * 所有 node-scoped reactive resource 都必须注册到 disposeBag。
   */
  disposeBag: DisposeBag

  /**
   * 注册一个在节点 dispose 时执行的回调。
   *
   * 供 Renderer Adapter 等外部消费方注册清理逻辑，
   * 无需订阅 `disposed` signal，也无需在外部维护 effect。
   *
   * @returns DisposeSubscription 句柄，可提前取消注册
   *
   * @example
   * ```ts
   * const sub = node.onDispose(() => unmountComponent(node.id))
   * // 如需提前取消：
   * sub.unsubscribe()
   * ```
   */
  onDispose: (callback: DisposeCallback) => DisposeSubscription

  /**
   * 只释放当前节点自身持有的资源，**不递归子树**。
   *
   * 适用场景：
   * - 手动管理子节点生命周期时
   * - runtime graph replace subtree 时，先 dispose 自身 watcher，再处理子节点
   *
   * 正常情况下优先使用 `dispose()`。
   */
  disposeSelf: () => void

  /**
   * 级联释放当前节点及其完整子树持有的所有订阅和运行时资源。
   *
   * 执行顺序（先子后父）：
   *
   * 1. 递归调用所有子节点的 `dispose()`
   * 2. 执行 `disposeBag` 中注册的所有清理函数
   * 3. 将 `disposed` 置为 true
   *
   * dispose 后节点不可再使用。任何对已 disposed 节点的操作
   * 应在调用方通过检查 `disposed.value` 进行防护。
   */
  dispose: () => void
}

// ---------------------------------------------------------------------------
// FieldRuntime
// ---------------------------------------------------------------------------

/**
 * 字段运行时状态容器。
 *
 * @typeParam T - 表单值类型
 */
export interface FieldRuntime<T extends Values = Values> {
  /**
   * 字段是否可见。
   *
   * 使用独立 computation 容器，支持 async visible 计算防竞态。
   *
   * ## visible=false 时的值语义
   *
   * 默认行为（可通过 schema 配置覆盖）：
   * - `keepValueWhenHidden: false`：字段隐藏时其值从 form data 中移除，submit 时不携带
   * - `validateWhenHidden: false`：字段隐藏时跳过校验
   */
  visible: ReactiveComputation<boolean>

  /**
   * 字段是否只读。
   */
  readonly: ReactiveComputation<boolean>

  /**
   * 字段是否禁用。
   */
  disabled: ReactiveComputation<boolean>

  /**
   * 字段是否必填。
   */
  required: ReactiveComputation<boolean>

  /**
   * 字段占位符。
   *
   * 通常为纯同步计算，直接使用 signal。
   * 若业务场景需要 async placeholder（如 i18n 异步加载），
   * 可将此字段升级为 ReactiveComputation<string>。
   */
  placeholder: ReactiveSignal<string>

  /**
   * 组件透传属性。
   *
   * componentProps 是最常见的 async dependencies 来源（如远程加载 options），
   * 使用独立 computation 容器防竞态。
   */
  componentProps: ReactiveComputation<SchemxComponentProps<T>>

  /**
   * 字段校验规则。
   *
   * rules 支持动态计算（如根据其他字段值切换校验规则），使用独立 computation 容器。
   */
  rules: ReactiveComputation<SchemxBaseField<T>["rules"] | undefined>
}

// ---------------------------------------------------------------------------
// FieldRuntimeNode
// ---------------------------------------------------------------------------

/**
 * 基础字段节点。
 *
 * FieldRuntimeNode 负责承载：
 *
 * - 字段节点身份
 * - 字段 schema
 * - 字段 runtime state
 *
 * 它对应最终可渲染的表单字段。
 */
export interface FieldRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "field"

  /**
   * 字段原始 schema。
   *
   * schema 应视为 immutable input，不应在 runtime 中直接修改。
   */
  schema: SchemxBaseField<T>

  /**
   * 字段运行时状态。
   */
  fieldRuntime: FieldRuntime<T>
}

// ---------------------------------------------------------------------------
// GroupRuntimeNode
// ---------------------------------------------------------------------------

/**
 * 分组节点。
 *
 * 对应 `componentType: "group"`。
 *
 * GroupRuntimeNode 只负责承载静态 children 的运行时子树。
 * children 在 compile 阶段确定，不会在运行时动态增减。
 * 若需要动态 children，应使用 DependencyRuntimeNode。
 */
export interface GroupRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "group"

  /**
   * 分组原始 schema。
   */
  schema: SchemxGroupField<T>

  /**
   * 分组运行时子节点。
   *
   * 静态子树，compile 后不变。
   */
  children: RuntimeNode<T>[]
}

// ---------------------------------------------------------------------------
// DependencyRuntime
// ---------------------------------------------------------------------------

/**
 * Dependency 运行时状态容器。
 *
 * @typeParam T - 表单值类型
 */
export interface DependencyRuntime<T extends Values = Values> {
  /**
   * async renderer 版本号。
   *
   * 每次 `run()` 开始时自增，async renderer 完成时比对版本号，
   * 不一致则丢弃结果（配合 AbortController 使用）。
   */
  version: number

  /**
   * 当前飞行中的 AbortController。
   *
   * 每次新 `run()` 开始时，先 abort 上一个 controller，
   * 再创建新的 AbortController 传入 renderer。
   * 用于中断 fetch 类副作用，避免竞态写入。
   */
  abortController: AbortController | null

  /**
   * renderer 是否执行中。
   */
  loading: ReactiveSignal<boolean>

  /**
   * renderer 抛出的最近一次错误。
   *
   * null 表示无错误。
   * 使用 `Error` 类型而非 `unknown`，鼓励调用方在 renderer 内捕获并规范化错误。
   * 若需保留原始 throw 值，可使用 `{ cause: unknown }` 包装后再赋值。
   */
  error: ReactiveSignal<Error | null>

  /**
   * 响应式子树信号。
   *
   * 每次 subtree replace 完成（新 subtree commit）后更新。
   * 供 Renderer Adapter 订阅 subtree 变化并重新渲染。
   *
   * 注意：此 signal 更新时，旧 subtree 尚未 dispose（dispose 在 signal 更新之后执行）。
   * Renderer Adapter 不应在此 signal 变化时同步访问旧 subtree 节点。
   */
  subtree: ReactiveSignal<RuntimeNode<T>[]>

  /**
   * 执行 dependency renderer，增量编译返回的 subtree，并按生命周期契约完成替换。
   *
   * 注意：
   *
   * - `run` 不应由外部业务直接调用
   * - `run` 由 dependency engine / scheduler 调度
   * - `run` 内部负责：
   *   1. 自增 version，创建新 AbortController，abort 上一个
   *   2. 执行 renderer（传入 AbortSignal）
   *   3. 版本校验（结果回来后比对 version，过期则丢弃）
   *   4. compiler 编译新 subtree
   *   5. 新 subtree 内 field 初始化
   *   6. 嵌套 dependency queueJob（在新 subtree commit 之后）
   *   7. commit subtree signal
   *   8. dispose 旧 subtree（先子后父）
   */
  run: () => Promise<void>
}

// ---------------------------------------------------------------------------
// DependencyRuntimeNode
// ---------------------------------------------------------------------------

/**
 * 依赖节点。
 *
 * DependencyRuntimeNode 是 runtime tree 中的一个结构节点。
 *
 * 它自己不对应 UI 字段，而是一个动态 subtree container。
 * `children` 反映当前已 commit 到 runtime graph 的子树快照，
 * 与 `dependencyRuntime.subtree` signal 保持同步。
 */
export interface DependencyRuntimeNode<
  T extends Values = Values,
> extends RuntimeNodeBase<T> {
  type: "dependency"

  /**
   * dependency 原始 schema。
   */
  schema: SchemxDependencyField<T>

  /**
   * 当前已提交到 runtime graph 的 dependency 子树。
   *
   * 此字段是 `dependencyRuntime.subtree.value` 的同步镜像，
   * 供需要同步遍历 runtime tree 的逻辑（如 form.getValues、全量 validate）使用，
   * 无需订阅 signal。
   */
  children: RuntimeNode<T>[]

  /**
   * dependency 执行状态。
   */
  dependencyRuntime: DependencyRuntime<T>
}

// ---------------------------------------------------------------------------
// 联合类型
// ---------------------------------------------------------------------------

/**
 * Runtime 节点联合类型。
 */
export type RuntimeNode<T extends Values = Values> =
  | FieldRuntimeNode<T>
  | GroupRuntimeNode<T>
  | DependencyRuntimeNode<T>
