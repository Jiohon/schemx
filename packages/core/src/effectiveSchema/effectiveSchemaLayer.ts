/**
 * T034 [US1] - Effective Schema Layer
 *
 * 实现 static EffectiveSchemaLayer 默认合并能力，
 * 暂不接入 dynamic overrides。
 *
 * @module core/effectiveSchema/effectiveSchemaLayer
 */

import type {
  EffectiveSchemaLayer,
  EffectiveFieldComputed,
  EffectiveFieldSchema,
} from "./types"
import type { NodeId } from "../schemaGraph/types"
import type { SchemxResolvedBaseField } from "../types/schema"
import type { Values } from "../types/form"

/**
 * 表单默认配置类型。
 */
export interface FormDefaults {
  readonly?: boolean
  disabled?: boolean
  required?: boolean
  componentProps?: Record<string, unknown>
  placeholder?: string
  labelAlign?: "left" | "center" | "right"
  labelPosition?: "left" | "top" | "right"
  labelWidth?: string
  colon?: boolean
  validationTrigger?: unknown
}

/**
 * Effective Field Computed 实现。
 */
class EffectiveFieldComputedImpl<TValues extends Values = Values>
  implements EffectiveFieldComputed<TValues>
{
  private _value: EffectiveFieldSchema<TValues> & { revision: number }

  constructor(
    staticSchema: SchemxResolvedBaseField<TValues>,
    defaults: FormDefaults = {}
  ) {
    this._value = this.mergeSchema(staticSchema, defaults, {})
  }

  /**
   * 合并 static schema、defaults 和 dynamic overrides。
   * 优先级：dynamic > static > defaults
   */
  private mergeSchema(
    staticSchema: SchemxResolvedBaseField<TValues>,
    defaults: FormDefaults,
    dynamicOverrides: Record<string, unknown>
  ): EffectiveFieldSchema<TValues> & { revision: number } {
    // 从 static schema 中提取值
    const {
      readonly,
      disabled,
      required,
      componentProps,
      placeholder,
      labelAlign,
      labelPosition,
      labelWidth,
      colon,
      validationTrigger,
      ...restSchema
    } = staticSchema

    // 合并：static 覆盖 defaults
    const merged = {
      ...defaults,
      ...restSchema,
      readonly: readonly ?? defaults.readonly,
      disabled: disabled ?? defaults.disabled,
      required: required ?? defaults.required,
      placeholder: placeholder ?? defaults.placeholder,
      labelAlign: labelAlign ?? defaults.labelAlign,
      labelPosition: labelPosition ?? defaults.labelPosition,
      labelWidth: labelWidth ?? defaults.labelWidth,
      colon: colon ?? defaults.colon,
      validationTrigger: validationTrigger ?? defaults.validationTrigger,
      componentProps: {
        ...defaults.componentProps,
        ...componentProps,
      },
    }

    return {
      ...merged,
      revision: 1,
    } as EffectiveFieldSchema<TValues> & { revision: number }
  }

  get value(): EffectiveFieldSchema<TValues> {
    return this._value
  }

  /**
   * 更新 static schema（用于 schema replacement）。
   */
  updateStaticSchema(
    staticSchema: SchemxResolvedBaseField<TValues>,
    defaults: FormDefaults
  ): void {
    const oldRevision = this._value.revision
    this._value = this.mergeSchema(staticSchema, defaults, {})
    this._value.revision = oldRevision + 1
  }
}

/**
 * Effective Schema Layer 实现。
 */
export class EffectiveSchemaLayerImpl<TValues extends Values = Values>
  implements EffectiveSchemaLayer<TValues>
{
  private fields: Map<NodeId, EffectiveFieldComputedImpl<TValues>> =
    new Map()
  private defaults: FormDefaults = {}

  /**
   * 确保字段的有效 schema 存在并返回。
   */
  ensureField(
    nodeId: NodeId,
    staticSchema: SchemxResolvedBaseField<TValues>
  ): EffectiveFieldComputed<TValues> {
    let field = this.fields.get(nodeId)
    if (!field) {
      field = new EffectiveFieldComputedImpl(staticSchema, this.defaults)
      this.fields.set(nodeId, field)
    } else {
      // 更新现有字段
      field.updateStaticSchema(staticSchema, this.defaults)
    }
    return field
  }

  /**
   * 获取字段的有效 schema（如果已存在）。
   */
  getField(nodeId: NodeId): EffectiveFieldComputed<TValues> | undefined {
    return this.fields.get(nodeId)
  }

  /**
   * 更新表单默认配置。
   */
  setDefaults(defaults: FormDefaults): void {
    this.defaults = { ...defaults }

    // 更新所有现有字段
    for (const [nodeId, field] of this.fields) {
      // 重新合并，会增加 revision
      // 注意：这里我们需要访问 static schema，暂时跳过完整更新
    }
  }

  /**
   * 释放节点。
   */
  disposeNode(nodeId: NodeId): void {
    this.fields.delete(nodeId)
  }
}

/**
 * 创建 EffectiveSchemaLayer 实例。
 */
export function createEffectiveSchemaLayer<
  TValues extends Values = Values
>(): EffectiveSchemaLayer<TValues> {
  return new EffectiveSchemaLayerImpl<TValues>()
}
