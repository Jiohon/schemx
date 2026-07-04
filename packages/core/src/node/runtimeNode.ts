/**
 * RuntimeNode 结构实现。
 *
 * RuntimeNode 只表达稳定身份、节点类型、父子结构和生命周期状态。
 * described node 持有当前 descriptor，其他领域资源暂由 RuntimeNodeResources 承载。
 *
 * @module core/node/runtimeNode
 */

import { createSignal } from "../reactivity"

import { createScope } from "./scope"

import type {
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
} from "./types"
import type { Values } from "../types"

export function createRootRuntimeNode<TValues extends Values = Values>(
  options: CreateRootRuntimeNodeOptions
): RootRuntimeNode<TValues> {
  return {
    id: 0,
    key: "schemx:root",
    type: "root",
    parent: null,
    dispose: options.dispose,
    mounted: createSignal(false),
    disposed: createSignal(false),
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
    viewState: null,
  }
}

export function createFieldRuntimeNode<TValues extends Values = Values>(
  options: CreateFieldRuntimeNodeOptions<TValues>
): FieldRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "field",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    fieldState: null,
    viewState: null,
    effectDispose: null,
  }
}

export function createGroupRuntimeNode<TValues extends Values = Values>(
  options: CreateGroupRuntimeNodeOptions<TValues>
): GroupRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "group",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    viewState: null,
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
  }
}

export function createDependencyRuntimeNode<TValues extends Values = Values>(
  options: CreateDependencyRuntimeNodeOptions<TValues>
): DependencyRuntimeNode<TValues> {
  return {
    id: options.id,
    key: options.key,
    type: "dependency",
    parent: options.parent ?? null,
    dispose: options.dispose ?? options.parent?.dispose.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    descriptor: null,
    viewState: null,
    effectState: null,
    dependencyDispose: null,
    childNodes: createSignal<readonly DescribedRuntimeNode<TValues>[]>([]),
  }
}
