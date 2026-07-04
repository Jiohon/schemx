import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  RuntimeDependencyIndex,
  RuntimeFieldIndex,
  RuntimeNodeId,
  RuntimeNodeResourceContext,
} from "./types"
import type { NamePath, Values } from "../types"

/**
 * 创建 RuntimeNode 之外的领域资源注册表。
 *
 * 资源通过 `RuntimeNodeId` 关联，资源表是事实存储，不承载领域逻辑。
 * 创建逻辑仍留在各领域模块中，调用方在明确边界内直接读写对应 Map。
 */
export function createRuntimeResources<
  TValues extends Values = Values,
>(): RuntimeNodeResourceContext<TValues> {
  return {
    nodes: new Map(),
    fieldIndex: createRuntimeFieldIndex(),
    dependencyIndex: createRuntimeDependencyIndex(),
  }
}

/**
 * 删除某个节点在所有资源表中的记录。
 *
 * 一致性清理 helper：避免调用方在移除节点时遗漏某张资源表。
 * 不负责领域资源自身的 dispose，那由各领域 scope 在卸载时处理。
 */
export function deleteNodeResources<TValues extends Values>(
  resources: RuntimeNodeResourceContext<TValues>,
  nodeId: RuntimeNodeId
): void {
  resources.nodes.delete(nodeId)
}

function createRuntimeFieldIndex<TValues extends Values>(): RuntimeFieldIndex<TValues> {
  const nodesByName = new Map<NamePath<TValues>, FieldRuntimeNode<TValues>>()

  const unregister = (node: FieldRuntimeNode<TValues>): void => {
    const descriptor = node.descriptor

    if (descriptor?.type === "field") {
      const current = nodesByName.get(descriptor.name)

      if (current === node) {
        nodesByName.delete(descriptor.name)
      }
    }

    for (const [name, current] of nodesByName) {
      if (current === node) {
        nodesByName.delete(name)
      }
    }
  }

  return {
    register(node) {
      const descriptor = node.descriptor

      if (descriptor?.type !== "field") {
        return
      }

      nodesByName.set(descriptor.name, node)
    },
    unregister,
    getByName(name) {
      return nodesByName.get(name)
    },
    getByPath(path) {
      return nodesByName.get(path)
    },
  }
}

function createRuntimeDependencyIndex<TValues extends Values>(): RuntimeDependencyIndex<TValues> {
  const triggerFieldsByNode = new Map<
    DependencyRuntimeNode<TValues>,
    readonly NamePath<TValues>[]
  >()
  const nodesByTriggerField = new Map<
    NamePath<TValues>,
    DependencyRuntimeNode<TValues>[]
  >()

  const unregister = (node: DependencyRuntimeNode<TValues>): void => {
    const triggerFields = triggerFieldsByNode.get(node) ?? []

    for (const triggerField of triggerFields) {
      const nodes = nodesByTriggerField.get(triggerField)

      if (!nodes) {
        continue
      }

      const nextNodes = nodes.filter((current) => current !== node)

      if (nextNodes.length > 0) {
        nodesByTriggerField.set(triggerField, nextNodes)
      } else {
        nodesByTriggerField.delete(triggerField)
      }
    }

    triggerFieldsByNode.delete(node)
  }

  return {
    register(node) {
      const descriptor = node.descriptor

      if (descriptor?.type !== "dependency") {
        return
      }

      unregister(node)
      triggerFieldsByNode.set(node, descriptor.triggerFields)

      for (const triggerField of descriptor.triggerFields) {
        const nodes = nodesByTriggerField.get(triggerField) ?? []

        if (!nodes.includes(node)) {
          nodesByTriggerField.set(triggerField, [...nodes, node])
        }
      }
    },
    unregister,
    getByTriggerField(name) {
      return nodesByTriggerField.get(name) ?? []
    },
    getTriggerFields(node) {
      return triggerFieldsByNode.get(node) ?? []
    },
  }
}
