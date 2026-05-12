/**
 * Runtime 面向表单领域层的上下文。
 *
 * runtime 只需要表单实例、字段默认值和字段生命周期回调；通过这个上下文隔离
 * createForm 的 store/validator 实现细节。具体 field lifecycle 编排由
 * `engine/fieldEngine` 处理，validator 同步由 `engine/validationEngine` 处理。
 *
 * @module core/formRuntimeContext
 */

import type {
  FieldRuntimeNode,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
  SchemxBaseField,
  SchemxInstance,
  Values,
} from "../types"

/**
 * 字段生命周期配置。
 *
 * 定义字段在运行时各阶段的回调钩子，用于注入默认属性和生命周期处理逻辑。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const lifecycle: FieldLifecycle<FormValues> = {
 *   fieldDefaults: { readonly: true, disabled: false },
 *   onFieldMount: (node) => console.log('Field mounted:', node.key),
 *   onFieldUnmount: (node) => console.log('Field unmounted:', node.key),
 * }
 * ```
 */
export interface FieldLifecycle<T extends Values = Values> {
  /**
   * 字段 resolved props 的默认值来源。
   *
   * 适配层可注入全局 readonly/disabled 等配置，支持静态对象或按 schema 动态计算的函数。
   */
  fieldDefaults?: RuntimeFieldDefaults<T>
  /**
   * 字段节点首次挂载后触发。
   *
   * 当前由 validationEngine 用于初始化值和注册校验规则。
   *
   * @param node - 挂载的字段运行时节点
   */
  onFieldMount?: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段 dependencies 更新后触发。
   *
   * 当前由 validationEngine 用于同步 validator 生命周期。
   *
   * @param node - 更新的字段运行时节点
   */
  onFieldUpdate?: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段节点卸载时触发。
   *
   * 当前由 validationEngine 用于清理 rules/errors。
   *
   * @param node - 卸载的字段运行时节点
   */
  onFieldUnmount?: (node: FieldRuntimeNode<T>) => void
}

/**
 * 表单运行时上下文。
 *
 * 提供 Runtime 与 createForm 之间的边界隔离，封装表单实例和字段生命周期回调，
 * 避免引擎直接感知 store/validator 实现细节。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const context = createFormRuntimeContext(form, {
 *   fieldDefaults: { readonly: true },
 *   onFieldMount: (node) => registerValidator(node),
 * })
 *
 * // 使用 context.form 访问表单实例
 * const values = context.form.getValues()
 * ```
 */
export interface FormRuntimeContext<T extends Values = Values> extends FieldLifecycle<T> {
  /**
   * 当前表单实例。
   *
   * 供 dependency renderer 和 dependencies resolver 获取值和执行副作用。
   */
  form: SchemxInstance<T>
  /**
   * 标准化后的默认值解析入口。
   *
   * 屏蔽对象/函数两种配置形态，统一返回解析后的默认属性。
   *
   * @param schema - 字段 schema
   * @returns 解析后的字段默认属性
   */
  resolveFieldDefaults: (schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>
}

/**
 * 创建表单运行时上下文。
 *
 * 将表单实例和生命周期配置封装为统一的上下文对象，供 Runtime 和各引擎模块使用。
 *
 * @typeParam T - 表单值类型
 *
 * @param form - 表单实例
 * @param lifecycle - 字段生命周期配置，包含默认值和回调钩子
 * @returns 封装后的表单运行时上下文
 *
 * @example
 * ```ts
 * const context = createFormRuntimeContext(form, {
 *   fieldDefaults: { readonly: true, disabled: false },
 *   onFieldMount: (node) => {
 *     console.log('Field mounted:', node.key)
 *   },
 * })
 * ```
 */
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
