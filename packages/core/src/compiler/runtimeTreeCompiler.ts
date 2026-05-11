/**
 * Runtime tree 编译器。
 *
 * 负责把规范化后的 schema 转换为 runtime nodes，并按稳定 key 复用旧节点。
 * compiler 层只做结构决策；signal/effect、dependency renderer 执行和字段生命周期
 * 都放在 runtime 层，避免编译阶段产生副作用。
 *
 * @module core/compiler/runtimeTreeCompiler
 */

import { isBaseSchema, isDependencySchema, isGroupSchema } from "../utils"

import { getRuntimeNodeKey } from "./identity"
import { normalizeSchemas } from "./normalize"
import { reconcileChildren } from "./reconcile"
import { staticValidateSchemas } from "./staticValidate"

import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
  RuntimeSchema,
} from "../runtime/types"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"
import type { CompileNodeContext } from "./reconcile"

export interface RuntimeNodeFactoryLike<T extends Values> {
  createFieldNode: (
    schema: SchemxBaseField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ) => FieldRuntimeNode<T>
  updateFieldNode: (
    node: FieldRuntimeNode<T>,
    schema: SchemxBaseField<T>,
    parent: RuntimeNode<T> | null
  ) => void
  createGroupNode: (
    schema: SchemxGroupField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ) => GroupRuntimeNode<T>
  updateGroupNode: (
    node: GroupRuntimeNode<T>,
    schema: SchemxGroupField<T>,
    parent: RuntimeNode<T> | null,
    key: string
  ) => void
  createDependencyNode: (
    schema: SchemxDependencyField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ) => DependencyRuntimeNode<T>
  updateDependencyNode: (
    node: DependencyRuntimeNode<T>,
    schema: SchemxDependencyField<T>,
    parent: RuntimeNode<T> | null
  ) => void
}

export interface RuntimeTreeCompilerOptions<T extends Values> {
  nodeFactory: RuntimeNodeFactoryLike<T>
}

/**
 * 内部 schema runtime 编译器。
 */
export class RuntimeTreeCompiler<T extends Values = Values> {
  constructor(private readonly options: RuntimeTreeCompilerOptions<T>) {}

  /**
   * 编译根 schema 列表。
   *
   * 入口处先 normalize + static validate，后续 reconcile 只处理稳定的 runtime 输入。
   */
  compileRoot(rawSchemas: SchemxField<T>[]): RuntimeNode<T>[] {
    const normalized = normalizeSchemas(rawSchemas)

    staticValidateSchemas(normalized)

    return this.compileChildren([], normalized, null, "root")
  }

  /**
   * 编译 children，并通过 runtime key 复用旧节点。
   */
  compileChildren(
    previous: RuntimeNode<T>[],
    schemas: RuntimeSchema<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ): RuntimeNode<T>[] {
    return reconcileChildren(previous, schemas, parent, ownerPath, {
      compileNode: this.compileNode,
    })
  }

  private readonly compileNode = (
    schema: RuntimeSchema<T>,
    context: CompileNodeContext<T>,
    existing?: RuntimeNode<T>
  ): RuntimeNode<T> => {
    const key = getRuntimeNodeKey(schema, context.ownerPath, context.index)

    // 类型和 key 都匹配时复用节点，只更新 schema/parent，保留节点上的运行时状态。
    if (existing && existing.type === "field" && isBaseSchema(schema)) {
      this.options.nodeFactory.updateFieldNode(
        existing,
        schema,
        context.parent
      )

      return existing
    }

    if (existing && existing.type === "group" && isGroupSchema(schema)) {
      this.options.nodeFactory.updateGroupNode(
        existing,
        schema,
        context.parent,
        key
      )

      return existing
    }

    if (existing && existing.type === "dependency" && isDependencySchema(schema)) {
      this.options.nodeFactory.updateDependencyNode(
        existing,
        schema,
        context.parent
      )

      return existing
    }

    // 类型变化或身份变化时释放旧节点，避免旧 effect/subtree 泄漏。
    existing?.dispose()

    if (isDependencySchema(schema)) {
      return this.options.nodeFactory.createDependencyNode(
        schema,
        key,
        context.parent
      )
    }

    if (isGroupSchema(schema)) {
      return this.options.nodeFactory.createGroupNode(
        schema,
        key,
        context.parent
      )
    }

    return this.options.nodeFactory.createFieldNode(
      schema as SchemxBaseField<T>,
      key,
      context.parent
    )
  }
}
