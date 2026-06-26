/**
 * T031 [US1] - Schema Graph Store
 *
 * 实现 SchemaGraphStore.apply(patches)，只持有结构、
 * 静态 schema、父子关系、顺序和 revision。
 *
 * @module core/schemaGraph/schemaGraphStore
 */

import type {
  SchemaGraphStore,
  SchemaGraphSnapshot,
  SchemaPatch,
  SchemaNodeRecord,
  NodeId,
  IdentifiedSchemaNode,
} from "./types"
import { ROOT_NODE_ID } from "./types"
import type { Values } from "../types/form"

/**
 * Schema Graph Store 实现。
 */
export class SchemaGraphStoreImpl<TValues extends Values = Values>
  implements SchemaGraphStore<TValues>
{
  private nodesById: Map<NodeId, SchemaNodeRecord<TValues>> = new Map()
  private childrenById: Map<NodeId, NodeId[]> = new Map()
  private parentById: Map<NodeId, NodeId> = new Map()
  private _revision = 0

  constructor() {
    // 初始化 root 节点（无 children）
    this.childrenById.set(ROOT_NODE_ID, [])
  }

  get snapshot(): SchemaGraphSnapshot<TValues> {
    // 返回不可变的视图
    return {
      nodesById: new Map(this.nodesById),
      childrenById: new Map(
        Array.from(this.childrenById.entries()).map(([k, v]) => [k, [...v]])
      ),
      parentById: new Map(this.parentById),
    }
  }

  get revision(): number {
    return this._revision
  }

  /**
   * 应用一组补丁。
   */
  apply(patches: readonly SchemaPatch<TValues>[]): void {
    if (patches.length === 0) {
      return
    }

    for (const patch of patches) {
      switch (patch.type) {
        case "insert":
          this.applyInsert(patch)
          break
        case "remove":
          this.applyRemove(patch)
          break
        case "move":
          this.applyMove(patch)
          break
        case "update_static":
          this.applyUpdateStatic(patch)
          break
        case "replace_children":
          this.applyReplaceChildren(patch)
          break
      }
    }

    this._revision++
  }

  /**
   * 应用插入补丁。
   */
  private applyInsert(
    patch: Extract<SchemaPatch<TValues>, { type: "insert" }>
  ): void {
    const { parentId, index, node } = patch

    // 确保父节点存在
    if (!this.childrenById.has(parentId)) {
      this.childrenById.set(parentId, [])
    }

    // 插入到父节点的 children 中
    const siblings = this.childrenById.get(parentId)!
    siblings.splice(index, 0, node.nodeId)

    // 递归添加节点及其子节点
    addNodeRecursive(
      node,
      this.nodesById,
      this.childrenById,
      this.parentById
    )
  }

  /**
   * 应用移除补丁。
   */
  private applyRemove(
    patch: Extract<SchemaPatch<TValues>, { type: "remove" }>
  ): void {
    removeNodeRecursive(
      patch.nodeId,
      this.nodesById,
      this.childrenById,
      this.parentById
    )
  }

  /**
   * 应用移动补丁。
   */
  private applyMove(
    patch: Extract<SchemaPatch<TValues>, { type: "move" }>
  ): void {
    const { nodeId, parentId, index } = patch
    const currentParentId = this.parentById.get(nodeId)

    if (!currentParentId) return

    // 从原位置移除
    const oldSiblings = this.childrenById.get(currentParentId)
    if (oldSiblings) {
      const oldIndex = oldSiblings.indexOf(nodeId)
      if (oldIndex !== -1) {
        oldSiblings.splice(oldIndex, 1)
      }
    }

    // 确保新父节点存在
    if (!this.childrenById.has(parentId)) {
      this.childrenById.set(parentId, [])
    }

    // 添加到新位置
    const newSiblings = this.childrenById.get(parentId)!
    newSiblings.splice(index, 0, nodeId)
    this.parentById.set(nodeId, parentId)
  }

  /**
   * 应用更新补丁。
   */
  private applyUpdateStatic(
    patch: Extract<SchemaPatch<TValues>, { type: "update_static" }>
  ): void {
    const { nodeId, node } = patch
    const existing = this.nodesById.get(nodeId)

    if (existing) {
      // 更新节点，增加 revision
      this.nodesById.set(nodeId, {
        ...node,
        revision: existing.revision + 1,
      })
    }
  }

  /**
   * 应用替换子节点补丁（用于 dynamic slot）。
   */
  private applyReplaceChildren(
    patch: Extract<SchemaPatch<TValues>, { type: "replace_children" }>
  ): void {
    const { parentId, children } = patch

    // 先移除旧的子节点
    const oldChildren = this.childrenById.get(parentId) || []
    for (const childId of [...oldChildren]) {
      removeNodeRecursive(
        childId,
        this.nodesById,
        this.childrenById,
        this.parentById
      )
    }

    // 添加新的子节点
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      // 更新子节点的 parentId 和 index
      const updatedChild = {
        ...child,
        parentId,
        index: i,
      }
      addNodeRecursive(
        updatedChild,
        this.nodesById,
        this.childrenById,
        this.parentById
      )
    }
  }

  getNode(nodeId: NodeId): SchemaNodeRecord<TValues> | undefined {
    return this.nodesById.get(nodeId)
  }

  getChildren(nodeId: NodeId): readonly NodeId[] {
    return this.childrenById.get(nodeId) || []
  }

  getParent(nodeId: NodeId): NodeId | undefined {
    return this.parentById.get(nodeId)
  }

  getAncestorPath(nodeId: NodeId): readonly NodeId[] {
    const path: NodeId[] = []
    let current: NodeId | undefined = nodeId
    while (current) {
      path.unshift(current)
      current = this.parentById.get(current)
    }
    return path
  }

  /**
   * 批量设置初始节点（用于首次加载）。
   */
  setInitialNodes(nodes: IdentifiedSchemaNode<TValues>[]): void {
    // 清空现有节点
    this.nodesById.clear()
    this.parentById.clear()
    for (const key of this.childrenById.keys()) {
      if (key !== ROOT_NODE_ID) {
        this.childrenById.delete(key)
      }
    }
    this.childrenById.set(ROOT_NODE_ID, [])

    // 添加新节点
    for (const node of nodes) {
      addNodeRecursive(
        node,
        this.nodesById,
        this.childrenById,
        this.parentById
      )
    }

    this._revision++
  }
}

/**
 * 将 identified 节点转换为 store 中的记录。
 */
function toNodeRecord<TValues extends Values>(
  node: IdentifiedSchemaNode<TValues>
): SchemaNodeRecord<TValues> {
  return {
    ...node,
    revision: 1,
  }
}

/**
 * 递归添加节点及其子节点。
 */
function addNodeRecursive<TValues extends Values>(
  node: IdentifiedSchemaNode<TValues>,
  nodesById: Map<NodeId, SchemaNodeRecord<TValues>>,
  childrenById: Map<NodeId, NodeId[]>,
  parentById: Map<NodeId, NodeId>
): void {
  const record = toNodeRecord(node)
  nodesById.set(node.nodeId, record)
  parentById.set(node.nodeId, node.parentId)

  // 确保父节点的 children 数组存在
  if (!childrenById.has(node.parentId)) {
    childrenById.set(node.parentId, [])
  }

  // 处理子节点
  if (node.kind === "group") {
    const childIds: NodeId[] = []
    for (const child of node.children) {
      childIds.push(child.nodeId)
      addNodeRecursive(child, nodesById, childrenById, parentById)
    }
    childrenById.set(node.nodeId, childIds)
  } else {
    childrenById.set(node.nodeId, [])
  }
}

/**
 * 递归移除节点及其子节点。
 */
function removeNodeRecursive<TValues extends Values>(
  nodeId: NodeId,
  nodesById: Map<NodeId, SchemaNodeRecord<TValues>>,
  childrenById: Map<NodeId, NodeId[]>,
  parentById: Map<NodeId, NodeId>
): void {
  const node = nodesById.get(nodeId)
  if (!node) return

  // 从父节点的 children 中移除
  const parentId = parentById.get(nodeId)
  if (parentId) {
    const siblings = childrenById.get(parentId)
    if (siblings) {
      const index = siblings.indexOf(nodeId)
      if (index !== -1) {
        siblings.splice(index, 1)
      }
    }
  }

  // 递归移除子节点
  const children = childrenById.get(nodeId) || []
  for (const childId of children) {
    removeNodeRecursive(childId, nodesById, childrenById, parentById)
  }

  // 清理当前节点
  nodesById.delete(nodeId)
  parentById.delete(nodeId)
  childrenById.delete(nodeId)
}

/**
 * 创建 SchemaGraphStore 实例。
 */
export function createSchemaGraphStore<
  TValues extends Values = Values
>(): SchemaGraphStore<TValues> {
  return new SchemaGraphStoreImpl<TValues>()
}
