/**
 * Schema compiler 实现。
 *
 * @module core/compiler/createCompile
 */

import {
  createDependencyDescriptor,
  createDescriptor,
  createFieldDescriptor,
  createGroupDescriptor,
} from "../descriptor"
import { maybeUseSchemxContext, withSchemxContext } from "../schemxContext"
import {
  isBaseSchema,
  isDependencySchema,
  isGroupSchema,
  normalizeSchemas,
} from "../utils"

import {
  CompileError,
  type Compile,
  type CompileCache,
  type CompileOptions,
} from "./types"
import type { FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { NamePath, SchemxInstance, Values } from "../types"
import type { SchemxField } from "../types/schema"

/**
 * 创建一个初始 compiler 缓存。
 *
 * @returns 初始 CompileCache，version 从 0 开始。
 */
function createCompileCache<TValues extends Values = Values>(): CompileCache<TValues> {
  return {
    version: 0,
    entries: new WeakMap(),
  }
}

/**
 * 创建 schema compiler。
 *
 * 每个 compiler 实例维护自己的 descriptor cache。调用方通过 `invalidate()`
 * 失效缓存，而不是直接操作缓存版本。
 *
 * @param options - 编译选项。
 * @returns schema compiler 门面。
 */
export function createCompile<TValues extends Values = Values>(
  options: Partial<CompileOptions<TValues>> = {}
): Compile<TValues> {
  const compileOptions: CompileOptions<TValues> = {
    defaultProps: options.defaultProps ?? {},
    formInstance: options.formInstance ?? ({} as SchemxInstance<TValues>),
  }
  const compileCache = createCompileCache<TValues>()

  /**
   * 将 schema 列表编译为 descriptor 列表。
   *
   * 在已有 SchemxContext 时直接编译，否则用一个回退 context 包裹执行。
   *
   * @param schemas - 待编译的 schema 列表。
   * @param parentKey - 父级 descriptor key，用于生成嵌套 key。
   * @returns 编译后的 descriptor 列表。
   */
  function toDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey = ""
  ): FormDescriptor<TValues>[] {
    if (maybeUseSchemxContext<TValues>()) {
      return compileDescriptors(schemas, parentKey)
    }

    return withSchemxContext(createFallbackCompileContext(), () =>
      compileDescriptors(schemas, parentKey)
    )
  }

  /**
   * 实际执行 schema 到 descriptor 的编译。
   *
   * 逐个 schema 查缓存命中则复用，否则按类型生成 descriptor，遇到 group 递归
   * 编译子级，并把新条目写回缓存。
   *
   * @param schemas - 待编译的 schema 列表。
   * @param parentKey - 父级 descriptor key。
   * @returns 编译后的 descriptor 列表。
   * @throws CompileError - dependency schema 缺少非空 trigger 字段时抛出。
   */
  function compileDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey = ""
  ): FormDescriptor<TValues>[] {
    const descriptors: FormDescriptor<TValues>[] = []

    const normalized = normalizeSchemas([...schemas])

    for (let i = 0; i < normalized.length; i++) {
      const schema = normalized[i]

      let descriptor: FormDescriptor<TValues> | undefined = undefined

      const cached = compileCache.entries.get(schema)

      if (cached && cached.version === compileCache.version) {
        descriptors.push(cached.descriptor)
        continue
      }

      if (isBaseSchema(schema)) {
        descriptor = createFieldDescriptor<TValues>({
          schema,
          parentKey,
        })
      } else if (isGroupSchema(schema)) {
        descriptor = createGroupDescriptor<TValues>({
          schema,
          index: i,
          parentKey,
        })

        if (schema.children.length > 0) {
          ;(
            descriptor as unknown as { children: FormDescriptor<TValues>[] }
          ).children = toDescriptors(schema.children, descriptor.key)
        }
      } else if (isDependencySchema(schema)) {
        descriptor = createDependencyDescriptor<TValues>({
          schema,
          parentKey,
        })
      }

      compileCache.entries.set(schema, {
        version: compileCache.version,
        descriptor: descriptor!,
      })

      descriptors.push(descriptor!)
    }

    return descriptors
  }

  /**
   * 在缺少调用方 context 时构建回退 SchemxContext。
   *
   * @returns 由 compileOptions 衍生的最小 SchemxContext。
   */
  function createFallbackCompileContext(): SchemxContext<TValues> {
    return {
      defaultProps: compileOptions.defaultProps,
      instance: compileOptions.formInstance,
    } as SchemxContext<TValues>
  }

  /** 获取当前缓存版本号。 */
  function getCacheVersion() {
    return compileCache.version
  }

  /** 递增缓存版本号，使所有现有缓存条目失效。 */
  function invalidate(): void {
    compileCache.version++
  }

  /** 获取当前缓存版本号。 */
  function getVersion(): number {
    return compileCache.version
  }

  return {
    cache: compileCache,
    getCacheVersion,
    toDescriptors,
    invalidate,
    getVersion,
  }
}
