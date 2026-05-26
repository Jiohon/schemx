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
import type { FieldFiber, Scope } from "../graph"
import type { Signal } from "../reactivity"
import type { SchemxComponentProps, SchemxRules, Values } from "../types"

/**
 * 从 FieldFiber 资源中读取 FieldModel。
 *
 * @param fiber - 字段 runtime 节点。
 * @returns 当前字段模型；字段资源尚未挂载时返回 null。
 */
export function getFieldModelResource<TValues extends Values = Values>(
  fiber: FieldFiber<TValues>
): FieldModel<TValues> | null {
  return fiber.fieldModel
}

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
    visible: createSignal(schema.visible ?? true),
    disabled: createSignal(schema.disabled ?? false),
    readonly: createSignal(schema.readonly ?? false),
    required: createSignal(schema.required ?? false),
    rules: createSignal(descriptor.validation.rules ?? []),
    placeholder: createSignal(schema.placeholder ?? ""),
    componentProps: createSignal(schema.componentProps ?? {}),
  }
}

/**
 * 挂载字段呈现态到 Fiber。
 *
 * @param fiber - 字段 runtime 节点。
 * @param descriptor - 字段 descriptor，提供呈现态初始值。
 * @param _scope - 预留资源作用域参数，保持挂载签名一致。
 * @returns 已挂载到 fiber 的 FieldModel。
 */
export function mountFieldModel<TValues extends Values = Values>(
  fiber: FieldFiber<TValues>,
  descriptor: FieldDescriptor<TValues>,
  _scope: Scope = fiber.scope
): FieldModel<TValues> {
  const model = createFieldModel(descriptor)

  fiber.fieldModel = model

  return model
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

  model.visible.value = schema.visible ?? true
  model.disabled.value = schema.disabled ?? false
  model.readonly.value = schema.readonly ?? false
  model.required.value = schema.required ?? false
  model.rules.value = descriptor.validation.rules ?? []
  model.placeholder.value = schema.placeholder ?? ""
  model.componentProps.value = schema.componentProps ?? {}
}
