/**
 * Validation Engine。
 *
 * 负责 runtime field lifecycle 与 validator lifecycle 的桥接。它读取
 * FieldRuntime resolved props，决定何时注册、更新或清理 validator rules/errors。
 *
 * @module core/engine/validationEngine
 */

import { readFieldRuntimeProps } from "../field"
import { setByPath } from "../utils"

import type { ValidationEngineOptions } from "./types"
import type {
  NamePath,
  SchemxBaseField,
  SchemxResolvedBaseField,
  Values,
} from "../types"
import type { FieldRuntimeNode } from "../runtime"

export interface ValidationEngine<T extends Values = Values> {
  mountField: (node: FieldRuntimeNode<T>) => void
  updateField: (node: FieldRuntimeNode<T>) => void
  unmountField: (node: FieldRuntimeNode<T>) => void
  syncFieldValidation: (node: FieldRuntimeNode<T>) => void
}

export function createValidationEngine<T extends Values = Values>(
  options: ValidationEngineOptions<T>
): ValidationEngine<T> {
  const registerSchemaRules = (
    schema: SchemxBaseField<T> | SchemxResolvedBaseField<T>,
    defaultMessage?: string
  ): void => {
    const { name } = schema

    options.validator.unregisterRules(name)

    const schemaRules = options.rulesRegistry.resolve(name, schema)

    if (schemaRules.length > 0) {
      options.validator.registerRules(name, schemaRules, defaultMessage)
    }
  }

  const initializeFieldValue = (schema: SchemxBaseField<T>): void => {
    if (!Object.hasOwn(schema, "initialValue")) return
    if (options.getFieldSnapshot(schema.name) !== undefined) return

    const values = {} as Partial<T>
    setByPath(values, schema.name, schema.initialValue)

    options.setInitialValues(values)
    options.setFieldValue(schema.name, schema.initialValue)
  }

  const getRuntimeFieldSchema = (
    node: FieldRuntimeNode<T>
  ): SchemxResolvedBaseField<T> => ({
    ...node.schema,
    ...readFieldRuntimeProps(node.fieldRuntime),
    key: node.key,
  })

  const syncFieldValidation = (node: FieldRuntimeNode<T>): void => {
    const schema = getRuntimeFieldSchema(node)
    const hasRules = Array.isArray(schema.rules)
      ? schema.rules.length > 0
      : !!schema.rules

    if (
      schema.visible === false ||
      schema.readonly ||
      schema.disabled ||
      !hasRules
    ) {
      options.validator.unregisterRules(schema.name)
      options.validator.setFieldError(schema.name, [])

      return
    }

    const defaultMessage =
      schema.componentProps?.placeholder ||
      // 自动生成的 fallback placeholder 不作为默认错误文案，避免 required 规则重复报错。
      (Object.hasOwn(node.schema, "placeholder") || node.schema.dependencies?.placeholder
        ? schema.placeholder
        : undefined)

    registerSchemaRules(schema, defaultMessage)
  }

  return {
    mountField: (node) => {
      initializeFieldValue(node.schema)
      syncFieldValidation(node)
    },
    updateField: syncFieldValidation,
    unmountField: (node) => {
      const name = node.schema.name as NamePath<T>

      options.validator.unregisterRules(name)
      options.validator.setFieldError(name, [])
    },
    syncFieldValidation,
  }
}
