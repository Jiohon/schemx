/**
 * Dependency 运行时类型定义。
 *
 * Dependency 本质是 Reactive Schema Factory：监听依赖字段、执行 renderer、
 * 生成 schema subtree、编译并替换自己的 runtime children。
 *
 * @module core/types/dependency
 */

import type { ReactiveSignal } from "../reactivity"
import type { SchemxDependencyField } from "./schema"
import type { Values } from "./form"
import type { RuntimeNodeBase, RuntimeNode } from "./runtime"

// ---------------------------------------------------------------------------
// SubtreeReplacement
// ---------------------------------------------------------------------------

/**
 * Subtree 替换操作描述。
 *
 * 描述一次 dependency renderer 执行后的 subtree 变更，
 * 供 runtime graph 执行 replace 操作。
 */
export interface SubtreeReplacement<T extends Values = Values> {
  /**
   * 新编译完成的子树节点列表。
   */
  incoming: RuntimeNode<T>[]

  /**
   * 被替换下来、等待 dispose 的旧子树节点列表。
   *
   * 旧子树 dispose 应在新子树 commit 到 runtime graph 之后执行，
   * 顺序：先子后父。
   */
  outgoing: RuntimeNode<T>[]
}

// ---------------------------------------------------------------------------
// DependencyRuntime
// ---------------------------------------------------------------------------

/**
 * Dependency 运行时状态容器。
 *
 * DependencyRuntime 只保存 dependency 的执行状态，不保存节点身份和父子关系。
 *
 * dependency 本质是 Reactive Schema Factory：
 *
 * - 监听依赖字段变化
 * - 执行 renderer
 * - 生成 schema subtree
 * - 编译并替换自己的 runtime children
 *
 * ## Subtree 替换生命周期契约
 *
 * 每次 `run()` 完成后，subtree 替换按以下顺序执行：
 *
 * 1. 新 subtree 完成编译（compiler 阶段）
 * 2. 新 subtree 内所有 field 完成初始化（FieldRuntime 初始化阶段）
 * 3. 若新 subtree 内发现嵌套 dependency B，仅创建 B 的 RuntimeNode 并注册依赖，
 *    `queueJob(B.initialRun)` 推迟到步骤 5 之后执行
 * 4. 新 subtree commit 到 runtime graph（`subtree` signal 更新）
 * 5. 旧 subtree 所有节点按先子后父顺序 dispose
 * 6. B.initialRun 在 scheduler 下一轮执行
 *
 * 此顺序保证：
 * - B 读取 deps 时，同一 subtree 内的 field 已完成初始化
 * - 旧 subtree dispose 不会污染新 subtree 的响应式状态
 * - Renderer Adapter 拿到的 subtree signal 变化时，新子树已就绪
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
// 类型守卫
// ---------------------------------------------------------------------------

/**
 * 判断节点是否为依赖节点。
 */
export function isDependencyRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is DependencyRuntimeNode<T> {
  return node.type === "dependency"
}
