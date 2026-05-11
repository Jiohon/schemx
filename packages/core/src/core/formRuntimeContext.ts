/**
 * Runtime 面向表单领域层的上下文。
 *
 * runtime 只需要表单实例、字段默认值和字段生命周期回调；通过这个上下文隔离
 * createForm 的 store/validator 实现细节。具体 field lifecycle 编排由
 * `engine/fieldEngine` 处理，validator 同步由 `engine/validationEngine` 处理。
 *
 * @module core/formRuntimeContext
 */

import type { SchemxBaseField, SchemxInstance, Values } from "../types"
import type {
  FieldRuntimeNode,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
} from "../runtime/types"

export interface FieldLifecycle<T extends Values = Values> {
  /** 字段 resolved props 的默认值来源，适配层可注入全局 readonly/disabled 等配置 */
  fieldDefaults?: RuntimeFieldDefaults<T>
  /** 字段节点首次挂载后触发，当前由 validationEngine 用于初始化值和注册校验规则 */
  onFieldMount?: (node: FieldRuntimeNode<T>) => void
  /** 字段 dynamic props 更新后触发，当前由 validationEngine 用于同步 validator 生命周期 */
  onFieldUpdate?: (node: FieldRuntimeNode<T>) => void
  /** 字段节点卸载时触发，当前由 validationEngine 用于清理 rules/errors */
  onFieldUnmount?: (node: FieldRuntimeNode<T>) => void
}

export interface FormRuntimeContext<T extends Values = Values>
  extends FieldLifecycle<T> {
  /** 当前表单实例，供 dependency renderer 和 dynamic props resolver 使用 */
  form: SchemxInstance<T>
  /** 标准化后的默认值解析入口，屏蔽对象/函数两种配置形态 */
  resolveFieldDefaults: (schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>
}

export function createFormRuntimeContext<T extends Values>(
  form: SchemxInstance<T>,
  lifecycle: FieldLifecycle<T> = {}
): FormRuntimeContext<T> {
  return {
    form,
    fieldDefaults: lifecycle.fieldDefaults,
    resolveFieldDefaults: (schema) => {
      const defaults = lifecycle.fieldDefaults

      if (!defaults) return {}

      return typeof defaults === "function" ? defaults(schema) : defaults
    },
    onFieldMount: lifecycle.onFieldMount,
    onFieldUpdate: lifecycle.onFieldUpdate,
    onFieldUnmount: lifecycle.onFieldUnmount,
  }
}
