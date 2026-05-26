/**
 * Fiber - 内部 graph 的结构节点。
 *
 * Fiber 不感知 schema、form、validation、renderer。
 * 只表达：
 * - 身份（id, key, type）
 * - 父子结构（parent, childFibers/subChildren）
 * - 所有权（scope）
 * - 生命周期（disposed）
 * - 表单内部资源（descriptor, fieldModel, dependencySlot）
 * - 领域资源作用域（fieldResourceScope, fieldDependenciesScope, dependencyResourceScope）
 *
 * @module core/graph/fiber
 */

import { Values } from "@/types"

import type { Scope } from "./scope"
import type {
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../descriptor/descriptor"
import type { DependencyEffectSlot } from "../field/dependencyEffect"
import type { FieldModel } from "../field/model"
import type { Signal } from "../reactivity"

/**
 * Runtime graph 支持的节点类型。
 */
export type FiberType = "root" | "field" | "group" | "dependency"

/**
 * 所有 Fiber 共享的结构字段。
 *
 * @remarks
 * `scope` 表示 Fiber 自身的完整生命周期；字段、dependency 等可重启资源应使用
 * 子 scope 表达更细的资源边界。
 */
interface BaseFiber {
  /** Runtime graph 内部的稳定节点 id。 */
  readonly id: number

  /** 用于 keyed reconcile 的描述符 key。 */
  readonly key: string

  /** 父 Fiber；root 没有父节点。 */
  parent: Fiber<any> | null

  /** Fiber 的顶层生命周期作用域。 */
  scope: Scope

  /** 是否已经进入销毁流程。 */
  disposed: Signal<boolean>

  /** 领域资源是否已经挂载。 */
  mounted: Signal<boolean>
}

/**
 * Runtime graph 的透明根节点。
 *
 * @remarks
 * Root 不对应任何 schema，只负责承载顶层 `childFibers`。
 */
export interface RootFiber extends BaseFiber {
  readonly type: "root"
  /** 顶层 runtime 子节点列表。 */
  childFibers: Fiber<any>[]
}

/**
 * 字段 Fiber，持有字段描述符、字段模型和字段相关资源作用域。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldFiber<TValues extends Values = Values> extends BaseFiber {
  readonly type: "field"
  descriptor: FieldDescriptor<TValues>
  /** 字段运行时模型；卸载字段主体资源后会被清空或重建。 */
  fieldModel: FieldModel<TValues> | null
  /** 字段模型、注册表、校验 effect 等字段主体资源的生命周期边界。 */
  fieldResourceScope: Scope | null
  /** 字段 `dependencies` effect 的独立生命周期边界。 */
  fieldDependenciesScope: Scope | null
}

/**
 * 分组 Fiber，只负责结构嵌套和布局语义。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface GroupFiber<TValues extends Values = Values> extends BaseFiber {
  readonly type: "group"
  descriptor: GroupDescriptor<TValues>
  /** 分组下的 runtime 子节点列表。 */
  childFibers: Fiber<TValues>[]
}

/**
 * Dependency Fiber，持有动态 renderer 的执行状态和产出的子树。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @remarks
 * Dependency 不使用 `childFibers`，renderer 返回的结构存放在 `subChildren`，
 * 以便和 group 的静态 children 语义区分开。
 */
export interface DependencyFiber<TValues extends Values = Values> extends BaseFiber {
  readonly type: "dependency"
  descriptor: DependencyDescriptor<TValues>
  /** renderer effect 的可观察执行状态。 */
  dependencySlot: DependencyEffectSlot | null
  /** 当前 renderer effect、trigger 订阅和 abort 清理的生命周期边界。 */
  dependencyResourceScope: Scope | null
  /** dependency renderer 产出的 runtime 子树。 */
  subChildren: Fiber<TValues>[]
}

/**
 * Runtime graph 中所有 Fiber 节点的联合类型。
 *
 * @typeParam TValues - 表单值类型。
 */
export type Fiber<TValues extends Values = Values> =
  | RootFiber
  | FieldFiber<TValues>
  | GroupFiber<TValues>
  | DependencyFiber<TValues>

/**
 * 除 root 外，所有带 descriptor 的 Fiber。
 *
 * @typeParam TValues - 表单值类型。
 */
export type DescribedFiber<TValues extends Values = Values> =
  | FieldFiber<TValues>
  | GroupFiber<TValues>
  | DependencyFiber<TValues>

/**
 * 可承载 runtime 子节点的 Fiber。
 *
 * @remarks
 * Root 和 Group 使用 `childFibers`，Dependency 使用 `subChildren`。
 *
 * @typeParam TValues - 表单值类型。
 */
export type ContainerFiber<TValues extends Values = Values> =
  | RootFiber
  | GroupFiber<TValues>
  | DependencyFiber<TValues>

/**
 * 判断 Fiber 是否带有表单描述符。
 *
 * @param fiber - 待判断的 runtime 节点。
 * @returns 非 root 节点时返回 true，并收窄为带 descriptor 的 Fiber。
 */
export function hasDescriptor(
  fiber: Fiber<any>
): fiber is FieldFiber<any> | GroupFiber<any> | DependencyFiber<any> {
  return fiber.type !== "root"
}

/**
 * 判断 Fiber 是否为字段 Fiber。
 *
 * @param fiber - 待判断的 runtime 节点。
 * @returns 字段节点时返回 true。
 */
export function isFieldFiber<TValues extends Values = Values>(
  fiber: Fiber<TValues>
): fiber is FieldFiber<TValues> {
  return fiber?.type === "field"
}

/**
 * 判断 Fiber 是否为分组 Fiber。
 *
 * @param fiber - 待判断的 runtime 节点。
 * @returns 分组节点时返回 true。
 */
export function isGroupFiber<TValues extends Values = Values>(
  fiber: Fiber<TValues>
): fiber is GroupFiber<TValues> {
  return fiber?.type === "group"
}

/**
 * 判断 Fiber 是否为 dependency Fiber。
 *
 * @param fiber - 待判断的 runtime 节点。
 * @returns dependency 节点时返回 true。
 */
export function isDependencyFiber<TValues extends Values = Values>(
  fiber: Fiber<TValues>
): fiber is DependencyFiber<TValues> {
  return fiber?.type === "dependency"
}

/**
 * 判断 Fiber 是否可以承载 runtime 子节点。
 *
 * @param fiber - 待判断的 runtime 节点。
 * @returns root、group 或 dependency 节点时返回 true。
 */
export function isContainerFiber<TValues extends Values = Values>(
  fiber: Fiber<TValues>
): fiber is ContainerFiber<TValues> {
  return fiber.type === "root" || fiber.type === "group" || fiber.type === "dependency"
}

/**
 * 读取容器 Fiber 的 runtime 子节点。
 *
 * @remarks
 * 这个 helper 隐藏了 `GroupFiber.childFibers` 与 `DependencyFiber.subChildren`
 * 的存储差异，调用方不需要把两种子树语义揉在一起处理。
 *
 * @param fiber - 容器节点。
 * @returns 当前 runtime 子节点数组。
 */
export function getChildFibers<TValues extends Values = Values>(
  fiber: ContainerFiber<TValues>
): Fiber<TValues>[] {
  if (fiber.type === "dependency") {
    return fiber.subChildren
  }

  return fiber.childFibers as Fiber<TValues>[]
}

/**
 * 替换容器 Fiber 的 runtime 子节点。
 *
 * @remarks
 * 仅用于 reconcile 提交结构结果；字段 Fiber 没有 runtime 子节点。
 *
 * @param fiber - 容器节点。
 * @param children - 下一组 runtime 子节点。
 */
export function setChildFibers<TValues extends Values = Values>(
  fiber: ContainerFiber<TValues>,
  children: Fiber<TValues>[]
): void {
  if (fiber.type === "dependency") {
    fiber.subChildren = children

    return
  }

  fiber.childFibers = children
}
