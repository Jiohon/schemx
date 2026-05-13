/**
 * Validation Engine。
 *
 * 负责 runtime field lifecycle 与 validator lifecycle 的桥接。它读取
 * FieldRuntime resolved props，决定何时注册、更新或清理 validator rules/errors。
 *
 * @module core/engine/validationEngine
 */

import { readFieldProps } from "../runtime"
import { setByPath } from "../utils"

import type { ValidationEngineOptions } from "./types"
import type { NamePath, SchemxBaseField, Values } from "../types"
import type { FieldRuntimeNode } from "../types"

/**
 * 校验引擎接口。
 *
 * 提供字段生命周期相关的校验操作方法。
 *
 * @typeParam T - 表单值类型
 */
export interface ValidationEngine<T extends Values = Values> {
  /**
   * 挂载字段时初始化校验。
   *
   * @param node - 字段运行时节点
   */
  mountField: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段属性更新时同步校验规则。
   *
   * @param node - 字段运行时节点
   */
  updateField: (node: FieldRuntimeNode<T>) => void
  /**
   * 卸载字段时清理校验状态。
   *
   * @param node - 字段运行时节点
   */
  unmountField: (node: FieldRuntimeNode<T>) => void
  /**
   * 手动同步字段校验状态。
   *
   * @param node - 字段运行时节点
   */
  syncFieldValidation: (node: FieldRuntimeNode<T>) => void
}

/**
 * 创建校验引擎。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 校验引擎配置选项
 * @returns 校验引擎实例
 */
export function createValidationEngine<T extends Values = Values>(
  options: ValidationEngineOptions<T>
): ValidationEngine<T> {
  /**
   * 注册 schema 中定义的校验规则。
   *
   * 先注销旧规则，再从 rulesRegistry 解析 schema.rules 并注册到 validator。
   *
   * @param schema - 字段 schema
   * @param defaultMessage - 默认错误提示文案
   */
  const registerSchemaRules = (
    schema: SchemxBaseField<T> | SchemxBaseField<T>,
    defaultMessage?: string
  ): void => {
    const { name } = schema

    // 先注销旧规则，避免重复注册。
    options.validator.unregisterRules(name)

    // 从 rulesRegistry 解析 schema.rules 为标准校验规则。
    const schemaRules = options.rulesRegistry.resolve(name, schema)

    if (schemaRules.length > 0) {
      options.validator.registerRules(name, schemaRules, defaultMessage)
    }
  }

  /**
   * 初始化字段值。
   *
   * 仅在 schema 声明了 initialValue 且字段当前无值时执行。
   * 同时更新 initialValues（用于 reset）和当前字段值。
   *
   * @param schema - 字段 schema
   */
  const initializeFieldValue = (schema: SchemxBaseField<T>): void => {
    // 没有 initialValue 声明则跳过。
    if (!Object.hasOwn(schema, "initialValue")) return

    // 字段已有值则不覆盖。
    if (options.getFieldSnapshot(schema.name) !== undefined) return

    // 构建 initialValues 片段并写入。
    const values = {} as Partial<T>
    setByPath(values, schema.name, schema.initialValue)

    // initialValues 用于 reset 时恢复初始状态。
    options.setInitialValues(values)

    // 写入当前字段值，触发响应式更新。
    options.setFieldValue(schema.name, schema.initialValue)
  }

  /**
   * 从运行时节点构建已解析的字段 schema。
   *
   * 合并静态 schema 和动态解析后的属性（visible/readonly/disabled/rules 等）。
   *
   * @param node - 字段运行时节点
   * @returns 已解析的字段 schema
   */
  const getRuntimeFieldSchema = (node: FieldRuntimeNode<T>): SchemxBaseField<T> => ({
    ...node.schema,
    ...readFieldProps(node.fieldRuntime),
    key: node.key,
  })

  /**
   * 同步字段校验状态。
   *
   * 根据字段的 visible/readonly/disabled/rules 状态决定：
   * - 不可见/只读/禁用/无规则：注销规则，清空错误
   * - 其他情况：注册规则
   *
   * @param node - 字段运行时节点
   */
  const syncFieldValidation = (node: FieldRuntimeNode<T>): void => {
    const schema = getRuntimeFieldSchema(node)

    // 判断是否有校验规则。
    const hasRules = Array.isArray(schema.rules)
      ? schema.rules.length > 0
      : !!schema.rules

    // 字段不可见、只读、禁用或无规则时，清理校验状态。
    if (schema.visible === false || schema.readonly || schema.disabled || !hasRules) {
      options.validator.unregisterRules(schema.name)
      options.validator.setFieldError(schema.name, [])

      return
    }

    // 确定默认错误提示文案。
    // 优先使用 componentProps.placeholder，其次是 schema.placeholder。
    // 注意：自动生成的 fallback placeholder 不作为默认错误文案，
    // 避免 required 规则重复报错。
    const defaultMessage =
      schema.componentProps?.placeholder ||
      (Object.hasOwn(node.schema, "placeholder") || node.schema.dependencies?.placeholder
        ? schema.placeholder
        : undefined)

    registerSchemaRules(schema, defaultMessage)
  }

  return {
    mountField: (node) => {
      // 挂载时：初始化值 + 同步校验规则。
      initializeFieldValue(node.schema)
      syncFieldValidation(node)
    },
    updateField: syncFieldValidation,
    unmountField: (node) => {
      const name = node.schema.name as NamePath<T>

      // 卸载时：注销规则 + 清空错误。
      options.validator.unregisterRules(name)
      options.validator.setFieldError(name, [])
    },
    syncFieldValidation,
  }
}
