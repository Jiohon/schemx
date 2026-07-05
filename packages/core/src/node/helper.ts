import type { Values } from "../types"

import {
  ContainerRuntimeNode,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
} from "./types"

export function isRootRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is RootRuntimeNode<TValues> {
  return node.type === "root"
}

export function isFieldRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is FieldRuntimeNode<TValues> {
  return node.type === "field"
}

export function isGroupRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is GroupRuntimeNode<TValues> {
  return node.type === "group"
}

export function isDependencyRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is DependencyRuntimeNode<TValues> {
  return node.type === "dependency"
}

export function isDescribedRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is DescribedRuntimeNode<TValues> {
  return node.type !== "root"
}

export function isContainerRuntimeNode<TValues extends Values>(
  node: RuntimeNode<TValues>
): node is ContainerRuntimeNode<TValues> {
  return node.type === "root" || node.type === "group" || node.type === "dependency"
}

export function getRuntimeNodeChildren<TValues extends Values>(
  node: RuntimeNode<TValues>
): readonly DescribedRuntimeNode<TValues>[] {
  return isContainerRuntimeNode(node) ? node.childNodes.value : []
}
