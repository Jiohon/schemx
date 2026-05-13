/**
 * Runtime children 增量对账。
 *
 * 根据稳定 key 比较旧节点和新 schema，决定复用、创建或销毁节点。
 * 这是 React Fiber reconciler 模式的简化实现，用于支持 schema 的增量更新。
 *
 * @module core/runtime/reconcile
 */

import { getRuntimeNodeKey } from "./identity"

import type { RuntimeNode, SchemxField, Values } from "../types"

/**
 * 编译节点的上下文信息。
 *
 * @typeParam T - 表单值类型
 */
export interface CompileNodeContext<T extends Values = Values> {
  /**
   * 父级 runtime node；root children 使用 null。
   */
  parent: RuntimeNode<T> | null
  /**
   * 身份生成使用的归属路径。
   */
  ownerPath: string
  /**
   * schema 在同级中的位置，仅作为 fallback 身份的一部分。
   */
  index: number
}

/**
 * 对账子节点的配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface ReconcileChildrenOptions<T extends Values> {
  /**
   * 编译单个节点的回调函数。
   *
   * @param schema - 运行时 schema
   * @param context - 编译上下文
   * @param existing - 可复用的旧节点（可选）
   * @returns 编译后的节点
   */
  compileNode: (
    schema: SchemxField<T>,
    context: CompileNodeContext<T>,
    existing?: RuntimeNode<T>
  ) => RuntimeNode<T>
}

/**
 * 按稳定 key 对账 children runtime nodes。
 *
 * 对账算法：
 * 1. 为旧节点建立 key → node 的索引
 * 2. 遍历新 schema，按 key 查找可复用的旧节点
 * 3. 调用 compileNode 创建或更新节点
 * 4. 释放未被复用的旧节点
 *
 * 这种算法保证了：
 * - 稳定 key 的节点会被复用，保留运行时状态
 * - key 变化的节点会被重建
 * - 不再存在的节点会被清理
 *
 * @typeParam T - 表单值类型
 *
 * @param previous - 旧节点列表
 * @param schemas - 新 schema 列表
 * @param parent - 父节点
 * @param ownerPath - 所有者路径
 * @param options - 对账配置选项
 * @returns 对账后的节点列表
 *
 * @example
 * ```ts
 * const nextNodes = reconcileChildren(
 *   previousNodes,
 *   newSchemas,
 *   parentNode,
 *   'root',
 *   {
 *     compileNode: (schema, context, existing) => {
 *       if (existing && canReuse(existing, schema)) {
 *         updateNode(existing, schema)
 *         return existing
 *       }
 *       existing?.dispose()
 *       return createNode(schema, context)
 *     }
 *   }
 * )
 * ```
 */
export function reconcileChildren<T extends Values>(
  previous: RuntimeNode<T>[],
  schemas: SchemxField<T>[],
  parent: RuntimeNode<T> | null,
  ownerPath: string,
  options: ReconcileChildrenOptions<T>
): RuntimeNode<T>[] {
  // 旧节点先建索引，新 schema 逐个消费；未被消费的旧节点最后统一销毁。
  const previousByKey = new Map(previous.map((node) => [node.key, node]))

  const nextNodes = schemas.map((schema, index) => {
    const key = getRuntimeNodeKey(schema, ownerPath, index)
    const existing = previousByKey.get(key)

    // 从索引中移除，表示该节点已被消费。
    previousByKey.delete(key)

    return options.compileNode(
      schema,
      {
        parent,
        ownerPath,
        index,
      },
      existing
    )
  })

  // 释放未被消费的旧节点。
  for (const stale of previousByKey.values()) {
    // 新 schema 列表中已不存在的节点必须释放，防止 dependency watcher 残留。
    stale.dispose()
  }

  return nextNodes
}
