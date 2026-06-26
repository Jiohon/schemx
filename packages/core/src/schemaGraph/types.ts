/**
 * Schema Graph - 类型定义
 *
 * 定义 Schema 规范化、身份解析、Patch 结构和 Schema Graph Store 所需的类型。
 *
 * @module core/schemaGraph/types
 */

import type {
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
} from "../types/schema"
import type { Values } from "../types/form"
import type { SchemxSchemasInput as SchemxJsonSchemas } from "../createSchemas"
import type { SchemaInputError } from "../runtimeGraph/types"

/**
 * Node ID - 节点唯一标识符。
 */
export type NodeId = string

/**
 * Root Node ID - 根节点固定标识符。
 */
export const ROOT_NODE_ID: NodeId = "root"

/**
 * Normalized Schema Node - 规范化后的 schema 节点。
 *
 * 从 jsonSchemas 输入解析而来，尚未分配身份。
 */
export type NormalizedSchemaNode<TValues extends Values = Values> =
  | NormalizedFieldNode<TValues>
  | NormalizedGroupNode<TValues>
  | NormalizedDynamicSlotNode<TValues>

/**
 * Normalized Field Node - 规范化后的字段节点。
 */
export interface NormalizedFieldNode<TValues extends Values = Values> {
  readonly kind: "field"
  /** 显式 key（如果提供） */
  readonly key?: string
  /** 字段路径 */
  readonly name: keyof TValues
  /** 静态 schema（不含动态覆盖） */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /** 字段依赖配置（如果有） */
  readonly dependencies?: FieldDependencies<TValues>
}

/**
 * Normalized Group Node - 规范化后的分组节点。
 */
export interface NormalizedGroupNode<TValues extends Values = Values> {
  readonly kind: "group"
  /** 显式 key（如果提供） */
  readonly key?: string
  /** 分组静态 schema */
  readonly staticSchema: SchemxResolvedGroupField<TValues>
  /** 分组子节点 */
  readonly children: NormalizedSchemaNode<TValues>[]
}

/**
 * Normalized Dynamic Slot Node - 规范化后的动态子树槽位节点。
 */
export interface NormalizedDynamicSlotNode<TValues extends Values = Values> {
  readonly kind: "dynamic_slot"
  /** 显式 key（如果提供） */
  readonly key?: string
  /** 依赖的字段路径 */
  readonly to: readonly (keyof TValues)[]
  /** 动态子树渲染器 */
  readonly renderer: DynamicSlotRenderer<TValues>
}

/**
 * Field Dependencies - 字段依赖配置。
 */
export interface FieldDependencies<TValues extends Values = Values> {
  /** 触发字段 */
  readonly triggerFields?: readonly (keyof TValues)[]
  /** 动态可见性 */
  readonly visible?: (values: TValues) => boolean
  /** 动态禁用 */
  readonly disabled?: (values: TValues) => boolean
  /** 动态必填 */
  readonly required?: (values: TValues) => boolean
  /** 动态校验规则 */
  readonly rules?: (values: TValues) => unknown
  /** 动态组件属性 */
  readonly componentProps?: (values: TValues) => Record<string, unknown>
  /** 副作用触发器（保留兼容） */
  readonly trigger?: (values: TValues) => void
}

/**
 * Dynamic Slot Renderer - 动态子树渲染器。
 *
 * @param values - 当前表单值
 * @param formApi - 表单 API
 * @param context - 渲染上下文（含 AbortSignal）
 * @returns 新的 schema children
 */
export type DynamicSlotRenderer<TValues extends Values = Values> = (
  values: TValues,
  formApi: unknown,
  context: { abortSignal: AbortSignal }
) => SchemxJsonSchemas<TValues> | Promise<SchemxJsonSchemas<TValues>>

/**
 * 已分配身份的基础字段（extension of NormalizedIdentifiedBase）。
 */
interface IdentifiedBase {
  /** 稳定的节点 ID */
  readonly nodeId: NodeId
  /** 父节点 ID */
  readonly parentId: NodeId
  /** 在父节点中的索引位置 */
  readonly index: number
}

/**
 * Identified Field Node - 已分配身份的字段节点。
 */
export interface IdentifiedFieldNode<TValues extends Values = Values>
  extends NormalizedFieldNode<TValues>, IdentifiedBase {}

/**
 * Identified Group Node - 已分配身份的分组节点。
 * children 递归使用 IdentifiedSchemaNode。
 */
export interface IdentifiedGroupNode<TValues extends Values = Values>
  extends Omit<NormalizedGroupNode<TValues>, "children">, IdentifiedBase {
  readonly children: IdentifiedSchemaNode<TValues>[]
}

/**
 * Identified Dynamic Slot Node - 已分配身份的动态插槽节点。
 */
export interface IdentifiedDynamicSlotNode<TValues extends Values = Values>
  extends NormalizedDynamicSlotNode<TValues>, IdentifiedBase {}

/**
 * Identified Schema Node - 已分配身份的 schema 节点。
 *
 * 包含稳定的 nodeId，用于 schema replacement 时的复用判断。
 */
export type IdentifiedSchemaNode<TValues extends Values = Values> =
  | IdentifiedFieldNode<TValues>
  | IdentifiedGroupNode<TValues>
  | IdentifiedDynamicSlotNode<TValues>

/**
 * Schema Node Record - Schema Graph Store 中存储的节点记录。
 */
export type SchemaNodeRecord<TValues extends Values = Values> = (
  | (IdentifiedFieldNode<TValues> & { readonly revision: number })
  | (IdentifiedGroupNode<TValues> & { readonly revision: number })
  | (IdentifiedDynamicSlotNode<TValues> & { readonly revision: number })
)

/**
 * Schema Patch - Schema 结构变更补丁。
 */
export type SchemaPatch<TValues extends Values = Values> =
  | InsertPatch<TValues>
  | RemovePatch
  | MovePatch
  | UpdateStaticPatch<TValues>
  | ReplaceChildrenPatch<TValues>

/**
 * Insert Patch - 插入节点补丁。
 */
export interface InsertPatch<TValues extends Values = Values> {
  readonly type: "insert"
  /** 父节点 ID */
  readonly parentId: NodeId
  /** 插入位置 */
  readonly index: number
  /** 要插入的节点 */
  readonly node: IdentifiedSchemaNode<TValues>
}

/**
 * Remove Patch - 删除节点补丁。
 */
export interface RemovePatch {
  readonly type: "remove"
  /** 要删除的节点 ID */
  readonly nodeId: NodeId
}

/**
 * Move Patch - 移动节点补丁。
 */
export interface MovePatch {
  readonly type: "move"
  /** 要移动的节点 ID */
  readonly nodeId: NodeId
  /** 新的父节点 ID */
  readonly parentId: NodeId
  /** 新位置 */
  readonly index: number
}

/**
 * Update Static Patch - 更新静态 schema 补丁。
 */
export interface UpdateStaticPatch<TValues extends Values = Values> {
  readonly type: "update_static"
  /** 要更新的节点 ID */
  readonly nodeId: NodeId
  /** 新的节点（已分配身份） */
  readonly node: IdentifiedSchemaNode<TValues>
}

/**
 * Replace Children Patch - 替换子节点补丁。
 *
 * 用于 Dynamic Slot 的局部子树替换。
 */
export interface ReplaceChildrenPatch<TValues extends Values = Values> {
  readonly type: "replace_children"
  /** 父节点 ID（通常是 dynamic slot） */
  readonly parentId: NodeId
  /** 新的子节点列表（已分配身份） */
  readonly children: IdentifiedSchemaNode<TValues>[]
}

/**
 * Schema Graph Snapshot - Schema Graph 的快照状态。
 */
export interface SchemaGraphSnapshot<TValues extends Values = Values> {
  /** 所有节点，按 ID 索引 */
  readonly nodesById: ReadonlyMap<NodeId, SchemaNodeRecord<TValues>>
  /** 父子关系，父节点 ID -> 子节点 ID 列表 */
  readonly childrenById: ReadonlyMap<NodeId, readonly NodeId[]>
  /** 父关系，子节点 ID -> 父节点 ID */
  readonly parentById: ReadonlyMap<NodeId, NodeId>
}

/**
 * Schema Graph Store - Schema 结构事实存储。
 *
 * 只拥有结构、静态 schema、父子关系、顺序和结构 revision。
 * 不负责字段值、动态属性、校验或视图。
 */
export interface SchemaGraphStore<TValues extends Values = Values> {
  /**
   * 获取当前快照。
   */
  readonly snapshot: SchemaGraphSnapshot<TValues>

  /**
   * 应用一组补丁。
   *
   * @param patches - 要应用的补丁列表
   */
  apply(patches: readonly SchemaPatch<TValues>[]): void

  /**
   * 获取单个节点。
   *
   * @param nodeId - 节点 ID
   * @returns 节点记录（如果存在）
   */
  getNode(nodeId: NodeId): SchemaNodeRecord<TValues> | undefined

  /**
   * 获取节点的子节点 ID 列表。
   *
   * @param nodeId - 节点 ID
   * @returns 子节点 ID 列表
   */
  getChildren(nodeId: NodeId): readonly NodeId[]

  /**
   * 获取节点的父节点 ID。
   *
   * @param nodeId - 节点 ID
   * @returns 父节点 ID（如果有）
   */
  getParent(nodeId: NodeId): NodeId | undefined

  /**
   * 获取从 root 到指定节点的路径。
   *
   * @param nodeId - 节点 ID
   * @returns 节点 ID 路径（从 root 开始）
   */
  getAncestorPath(nodeId: NodeId): readonly NodeId[]
}

/**
 * Schema Compile Result - Schema 编译结果。
 */
export interface SchemaCompileResult<TValues extends Values = Values> {
  /** 规范化后的根节点列表 */
  readonly normalizedNodes: NormalizedSchemaNode<TValues>[]
  /** 输入错误（如果有） */
  readonly errors: readonly SchemaInputError[]
}

/**
 * Schema Diff Result - Schema 比较结果。
 */
export interface SchemaDiffResult<TValues extends Values = Values> {
  /** 补丁列表 */
  readonly patches: readonly SchemaPatch<TValues>[]
  /** 诊断信息 */
  readonly diagnostics: {
    /** 新增节点数 */
    readonly insertedCount: number
    /** 删除节点数 */
    readonly removedCount: number
    /** 复用节点数 */
    readonly reusedCount: number
  }
}
