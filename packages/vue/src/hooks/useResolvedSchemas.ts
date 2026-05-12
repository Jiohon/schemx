/**
 * useResolvedSchemas - Vue schema projection 桥接
 *
 * 将 core runtime 派生出的 resolved schemas 从 @preact/signals-core
 * effect 桥接到 Vue shallowRef，供表单主组件按 schema list 渲染。
 *
 * @module hooks/useResolvedSchemas
 */

import { onUnmounted, shallowRef } from "vue"
import type { ShallowRef } from "vue"

import { debounce } from "es-toolkit"

import type { SchemxInstance, SchemxResolvedField, Values } from "@schemx/core"

/**
 * 获取 dependency 已展开后的 schema projection。
 *
 * resolved schemas 不是 createForm 入参中的 raw schemas，而是 runtime tree
 * 的投影视图：dependency 节点会被 renderer 返回的 subtree 替换，group
 * children 也会递归更新。Raw Schema 仍保持 immutable。
 *
 * @typeParam T - 表单值类型
 * @param form - 当前表单实例
 * @returns resolved schemas shallowRef
 */
export function useResolvedSchemas<T extends Values = Values>(
  form: SchemxInstance<T>
): ShallowRef<SchemxResolvedField<T>[]> {
  const { getResolvedSchemas, getRuntimeRevision } = form.getInternalHooks()

  const resolvedSchemas = shallowRef<SchemxResolvedField<T>[]>([
    ...getResolvedSchemas(),
  ]) as ShallowRef<SchemxResolvedField<T>[]>

  const debounceGet = debounce(() => {
    console.log("object")
    resolvedSchemas.value = [...getResolvedSchemas()]
  }, 16)

  const disposeResolvedSchemasEffect = form.effect(() => {
    // getRuntimeRevision()
    // debounceGet()
    resolvedSchemas.value = [...getResolvedSchemas()]
  })

  onUnmounted(() => {
    disposeResolvedSchemasEffect()
  })

  return resolvedSchemas
}

export default useResolvedSchemas
