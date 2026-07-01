/**
 * RuntimeNode 结构实现。
 *
 * RuntimeNode 只表达稳定身份、节点类型、父子结构和生命周期状态。
 * descriptor、runtimeState、viewState、dependencySlot 等领域资源不挂在 node 上。
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
  RuntimeNode,
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
    scope: options.scope,
    mounted: createSignal(false),
    disposed: createSignal(false),
    childNodes: [],
  }
}

export function getChildRuntimeNodes<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): readonly DescribedRuntimeNode<TValues>[] {
  switch (node.type) {
    case "root":
    case "group":
      return node.childNodes
    case "dependency":
      return node.childNodes
    case "field":
      return []
  }
}

export function setChildRuntimeNodes<TValues extends Values = Values>(
  node: RuntimeNode<TValues>,
  children: DescribedRuntimeNode<TValues>[]
): void {
  switch (node.type) {
    case "root":
    case "group":
      node.childNodes = children

      return
    case "dependency":
      node.childNodes = children

      return
    case "field":
      return
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
    scope: options.scope ?? options.parent?.scope.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
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
    scope: options.scope ?? options.parent?.scope.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    childNodes: [],
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
    scope: options.scope ?? options.parent?.scope.child() ?? createScope(),
    mounted: createSignal(false),
    disposed: createSignal(false),
    childNodes: [],
  }
}
