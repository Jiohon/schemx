/**
 * Schema compiler 类型定义。
 *
 * @module core/compiler/types
 */

import type { FormDescriptor } from "../descriptor/types"
import type {
  NamePath,
  SchemxDefaultProps,
  SchemxField,
  SchemxInstance,
  Values,
} from "../types"

/**
 * 编译器选项。
 */
export interface CompileOptions<TValues extends Values> {
  /**
   * 表单级默认配置。
   *
   * 这些配置会作为 schema 编译和字段呈现态的默认值，字段自身配置优先级更高。
   */
  defaultProps: SchemxDefaultProps
  /** Form 表单实例方法。 */
  formInstance: SchemxInstance<TValues>
}

/**
 * Schema 编译缓存。
 *
 * 以 schema 对象引用为键缓存对应 descriptor，让未变化的 schema 在多次编译间
 * 复用同一 descriptor 引用。配合 reconciler.updateNode 的引用相等短路，
 * 可以让 effectiveSchema computed、dependency renderer 等下游副作用跳过未变字段。
 *
 * 缓存通过 `version` 失效：defaultProps 等编译选项变化时调用方 bump version，
 * 后续编译会跳过所有缓存条目。
 */
export interface CompileCache<TValues extends Values = Values> {
  version: number
  entries: WeakMap<
    SchemxField<TValues>,
    { version: number; descriptor: FormDescriptor<TValues> }
  >
}

/**
 * Schema compiler 门面。
 *
 * 封装 descriptor cache 与失效版本，让调用方不直接操作 cache 结构。
 */
export interface Compile<TValues extends Values = Values> {
  /** 当前 compiler 实例持有的 descriptor 引用缓存。 */
  readonly cache: CompileCache<TValues>
  /** 获取当前缓存版本号。 */
  getCacheVersion(): number
  /** 将 schema 列表编译为 descriptor 列表，并复用未失效的缓存条目。 */
  toDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey?: string
  ): FormDescriptor<TValues>[]
  /** 失效当前 compiler 实例的缓存。 */
  invalidate(): void
  /** 获取当前缓存版本号。 */
  getVersion(): number
}

/**
 * 编译错误。
 */
class CompileErrorImpl extends Error {
  /** Schema key（如果可提取）。 */
  readonly schemaKey?: string

  /** Schema name path。 */
  readonly schemaName?: NamePath

  /**
   * @param message - 错误信息。
   * @param schema - 触发错误的 schema，用于提取 name 和 key 附加到错误实例。
   */
  constructor(message: string, schema?: any) {
    super(message)
    this.name = "CompileError"

    if (schema && "name" in schema) {
      this.schemaName = schema.name as NamePath
    }

    if (schema && "key" in schema && schema.key) {
      this.schemaKey = schema.key
    }
  }
}

/**
 * CompileError 运行时构造器。
 */
export const CompileError = CompileErrorImpl
