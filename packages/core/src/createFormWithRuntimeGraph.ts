/**
 * T038 [US1] - 表单实例工厂 - 使用新的 Runtime Graph 实现
 *
 * 这个文件是 createForm 的新实现，使用 runtimeGraph 作为后端。
 * 目前它与旧的 createForm 并存，用于渐进式迁移。
 *
 * @module core/createFormWithRuntimeGraph
 */

import type { Values } from "./types/form"
import type { SchemxSchemasInput } from "./createSchemas"
import type { SchemxInstance } from "./types/form"
import { createRuntimeGraph } from "./runtimeGraph/createRuntimeGraph"
import { createFormFacade } from "./runtimeGraph/formFacade"

/**
 * 创建表单实例的配置项（简化版，使用 runtimeGraph）。
 */
export interface CreateFormOptions<TValues extends Values = Values> {
  /** schema 列表或可响应式更新的 schema source */
  schemas?: SchemxSchemasInput<TValues>
  /** 表单初始值 */
  initialValues?: Partial<TValues>
}

/**
 * 创建 Schemx 表单实例（使用新的 Runtime Graph 实现）。
 *
 * 这是 Phase 3 (US1) 的主要入口，提供与旧 createForm 相同的 API，
 * 但内部使用新的 runtime graph 架构。
 *
 * @param options - 表单配置项
 * @returns 表单实例
 *
 * @example
 * ```ts
 * const form = createFormWithRuntimeGraph({
 *   schemas: [
 *     { name: 'username', label: '用户名', componentType: 'input' },
 *     { name: 'email', label: '邮箱', componentType: 'input' }
 *   ],
 *   initialValues: { username: '', email: '' }
 * })
 *
 * // 与旧 API 相同的用法
 * form.setFieldValue('username', 'John')
 * const value = form.getFieldValue('username')
 * await form.validate()
 * ```
 */
export function createFormWithRuntimeGraph<TValues extends Values = Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  const runtimeGraph = createRuntimeGraph({
    jsonSchemas: options.schemas,
    initialValues: options.initialValues,
  })

  const facade = createFormFacade(runtimeGraph)
  return facade as unknown as SchemxInstance<TValues>
}
