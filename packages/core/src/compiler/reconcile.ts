/**
 * Runtime children 增量对账。
 *
 * 根据稳定 key 比较旧节点和新 schema，决定复用、创建或销毁节点。
 *
 * @module core/compiler/reconcile
 */

import { getRuntimeNodeKey } from "./identity"

import type { RuntimeNode, RuntimeSchema } from "../runtime/types"
import type { Values } from "../types"

export interface CompileNodeContext<T extends Values> {
  /** 父级 runtime node；root children 使用 null */
  parent: RuntimeNode<T> | null
  /** 身份生成使用的归属路径 */
  ownerPath: string
  /** schema 在同级中的位置，仅作为 fallback 身份的一部分 */
  index: number
}

export interface ReconcileChildrenOptions<T extends Values> {
  compileNode: (
    schema: RuntimeSchema<T>,
    context: CompileNodeContext<T>,
    existing?: RuntimeNode<T>
  ) => RuntimeNode<T>
}

/**
 * 按稳定 key 对账 children runtime nodes。
 */
export function reconcileChildren<T extends Values>(
  previous: RuntimeNode<T>[],
  schemas: RuntimeSchema<T>[],
  parent: RuntimeNode<T> | null,
  ownerPath: string,
  options: ReconcileChildrenOptions<T>
): RuntimeNode<T>[] {
  // 旧节点先建索引，新 schema 逐个消费；未被消费的旧节点最后统一销毁。
  const previousByKey = new Map(previous.map((node) => [node.key, node]))

  const nextNodes = schemas.map((schema, index) => {
    const key = getRuntimeNodeKey(schema, ownerPath, index)
    const existing = previousByKey.get(key)

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

  for (const stale of previousByKey.values()) {
    // 新 schema 列表中已不存在的节点必须释放，防止 dependency watcher 残留。
    stale.dispose()
  }

  return nextNodes
}
