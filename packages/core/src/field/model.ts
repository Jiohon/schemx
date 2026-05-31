/**
 * FieldModel - 字段呈现态。
 *
 * FieldModel 只回答“这个字段当前应该怎么呈现”，不持有字段值、name、
 * descriptor、validation 或 lifecycle scope。
 *
 * @module core/field/model
 */

import { createSignal } from "../reactivity"

import type { FieldDescriptor } from "../descriptor"
import type { FieldFiber } from "../graph"
import type { Signal } from "../reactivity"
import type { SchemxComponentProps, SchemxRules, Values } from "../types"
import { defaultConfig } from "@/defaultConfig"

/**
 * 字段呈现态。
 */
export interface FieldModel<TValues extends Values = Values> {
  /** 是否可见 */
  visible: Signal<boolean>

  /** 是否禁用 */
  disabled: Signal<boolean>

  /** 是否只读 */
  readonly: Signal<boolean>

  /** 是否必填 */
  required: Signal<boolean>

  /** 字段标签，用于校验错误消息等场景 */
  label: Signal<string>

  /** 校验规则 */
  rules: Signal<SchemxRules | SchemxRules[]>

  /** 占位提示文本 */
  placeholder: Signal<string>

  /** 传递给渲染组件的属性 */
  componentProps: Signal<SchemxComponentProps<TValues>>
}

/**
 * 创建字段呈现态模型。
 *
 * @param descriptor - 字段 descriptor，提供呈现态初始值。
 * @returns 新创建的 FieldModel。
 */
export function createFieldModel<TValues extends Values = Values>(
  descriptor: FieldDescriptor<TValues>
): FieldModel<TValues> {
  const schema = descriptor.schema

  return {
    visible: createSignal(schema.visible || defaultConfig.visible),
    disabled: createSignal(schema.disabled || defaultConfig.disabled),
    readonly: createSignal(schema.readonly || defaultConfig.readonly),
    required: createSignal(schema.required || defaultConfig.required),
    label: createSignal(schema.label || ""),
    rules: createSignal(schema.rules || []),
    placeholder: createSignal(schema.placeholder || defaultConfig.placeholder),
    componentProps: createSignal({
      ...(schema.componentProps || {}),
    }),
  }
}

/**
 * 用 descriptor 静态 schema 刷新字段呈现态 baseline。
 *
 * @param model - 需要更新的字段模型。
 * @param descriptor - 最新字段 descriptor。
 */
export function updateFieldModel<TValues extends Values = Values>(
  model: FieldModel<TValues>,
  descriptor: FieldDescriptor<TValues>
): void {
  const schema = descriptor.schema

  model.visible.value = schema.visible || defaultConfig.visible
  model.disabled.value = schema.disabled || defaultConfig.disabled
  model.readonly.value = schema.readonly || defaultConfig.readonly
  model.required.value = schema.required || defaultConfig.required
  model.label.value = schema.label || ""
  model.rules.value = schema.rules || []
  model.placeholder.value = schema.placeholder || defaultConfig.placeholder
  model.componentProps.value = schema.componentProps || {}
}
