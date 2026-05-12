/**
 * 字段运行时状态。
 *
 * FieldRuntime 只保存字段 resolved props signals 和静态默认值解析。字段动态
 * 属性计算属于 `engine/DependenciesEngine.ts`，不放在本模块中。
 *
 * @module core/runtime/fieldRuntime
 */

import { isEqual } from "es-toolkit"

import { createSignal } from "../reactivity"

import type {
  FieldRuntime,
  ReactiveComputation,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
  RuntimeFieldResolvedProps,
  SchemxBaseField,
  Values,
} from "../types"

/**
 * 统一解析字段默认属性。
 *
 * 默认值可以是静态对象，也可以是按字段 schema 动态计算的函数；
 * 这让 Vue 层的全局 readonly/disabled 能以 runtime 默认值的形式进入 core。
 *
 * @typeParam T - 表单值类型
 *
 * @param source - 字段默认值来源，可以是静态对象或函数
 * @param schema - 字段 schema
 * @returns 解析后的字段默认属性
 *
 * @example
 * ```ts
 * // 静态默认值
 * const defaults1 = resolveFieldDefaults({ readonly: true }, schema)
 *
 * // 动态默认值
 * const defaults2 = resolveFieldDefaults(
 *   (s) => ({ readonly: s.name === 'disabledField' }),
 *   schema
 * )
 * ```
 */
export function resolveFieldDefaults<T extends Values>(
  source: RuntimeFieldDefaults<T> | undefined,
  schema: SchemxBaseField<T>
): RuntimeFieldDefaultProps<T> {
  if (!source) return {}

  return typeof source === "function" ? source(schema) : source
}

/**
 * 从静态 schema 和 runtime 默认值生成字段已解析属性。
 *
 * 优先级为 schema 显式配置 > runtime 默认值 > core 内置默认值。
 * 注意这里不会执行 dependencies 条件函数，只得到字段的静态基线。
 *
 * @typeParam T - 表单值类型
 *
 * @param schema - 字段 schema
 * @param defaults - 运行时默认值，默认为空对象
 * @returns 已解析的字段属性
 *
 * @example
 * ```ts
 * const schema = {
 *   name: 'username',
 *   label: '用户名',
 *   required: true,
 * }
 *
 * const props = resolveStaticProps(schema, { readonly: true })
 * // props.visible = true (内置默认值)
 * // props.readonly = true (runtime 默认值)
 * // props.required = true (schema 配置)
 * ```
 */
export function resolveStaticProps<T extends Values>(
  schema: SchemxBaseField<T>,
  defaults: RuntimeFieldDefaultProps<T> = {}
): RuntimeFieldResolvedProps<T> {
  const defaultComponentProps = defaults.componentProps ?? {}
  const schemaComponentProps = schema.componentProps ?? {}

  return {
    visible: schema.visible ?? defaults.visible ?? true,
    readonly: schema.readonly ?? defaults.readonly ?? false,
    disabled: schema.disabled ?? defaults.disabled ?? false,
    required: schema.required ?? defaults.required ?? !!schema.rules,
    placeholder: schema.placeholder ?? defaults.placeholder ?? `${schema.label}为必填项`,
    componentProps: {
      // 全局 componentProps 先铺底，字段自身配置覆盖全局默认值。
      ...defaultComponentProps,
      ...schemaComponentProps,
    },
    rules: Object.hasOwn(schema, "rules") ? schema.rules : defaults.rules,
  }
}

/**
 * 创建字段运行时状态。
 *
 * 每个可解析属性都保存为独立 signal，投影和 effect 可以细粒度追踪变化。
 *
 * @typeParam T - 表单值类型
 *
 * @param schema - 字段 schema
 * @param defaults - 运行时默认值，默认为空对象
 * @returns 字段运行时状态对象
 *
 * @example
 * ```ts
 * const fieldRuntime = createFieldRuntime(schema, { readonly: true })
 *
 * // 读取属性（响应式）
 * const visible = fieldRuntime.visible.value.value
 *
 * // 写入属性
 * fieldRuntime.visible.value.value = false
 * ```
 */
export function createFieldRuntime<T extends Values>(
  schema: SchemxBaseField<T>,
  defaults: RuntimeFieldDefaultProps<T> = {}
): FieldRuntime<T> {
  const resolved = resolveStaticProps(schema, defaults)

  return {
    visible: createReactiveComputation(resolved.visible),
    readonly: createReactiveComputation(resolved.readonly),
    disabled: createReactiveComputation(resolved.disabled),
    required: createReactiveComputation(resolved.required),
    placeholder: createSignal(resolved.placeholder),
    componentProps: createReactiveComputation(resolved.componentProps),
    rules: createReactiveComputation(resolved.rules),
  }
}

/**
 * 创建响应式计算对象。
 *
 * @typeParam T - 值类型
 *
 * @param value - 初始值
 * @returns 响应式计算对象
 */
function createReactiveComputation<T>(value: T): ReactiveComputation<T> {
  return {
    version: 0,
    value: createSignal(value),
    abortController: null,
    dispose: () => {},
  }
}

/**
 * 读取字段运行时属性。
 *
 * resolved schema 生成和 validator 生命周期都会通过这个入口把 signals 读成普通对象。
 *
 * @typeParam T - 表单值类型
 *
 * @param field - 字段运行时状态
 * @returns 已解析的字段属性快照
 *
 * @example
 * ```ts
 * const props = readFieldProps(fieldRuntime)
 * console.log('Field visible:', props.visible)
 * console.log('Field readonly:', props.readonly)
 * ```
 */
export function readFieldProps<T extends Values>(
  field: FieldRuntime<T>
): RuntimeFieldResolvedProps<T> {
  return {
    visible: field.visible.value.value,
    readonly: field.readonly.value.value,
    disabled: field.disabled.value.value,
    required: field.required.value.value,
    placeholder: field.placeholder.value,
    componentProps: field.componentProps.value.value,
    rules: field.rules.value.value,
  }
}

/**
 * 批量写入字段运行时属性。
 *
 * 返回值表示是否真的发生变化，调用方据此决定是否触发生命周期和 revision。
 *
 * @typeParam T - 表单值类型
 *
 * @param field - 字段运行时状态
 * @param props - 要写入的属性
 * @returns 是否有属性发生变化
 *
 * @example
 * ```ts
 * const changed = applyFieldProps(fieldRuntime, {
 *   visible: true,
 *   readonly: false,
 *   disabled: false,
 *   required: true,
 *   placeholder: '请输入',
 *   componentProps: {},
 *   rules: [],
 * })
 *
 * if (changed) {
 *   console.log('Field props changed, triggering update')
 * }
 * ```
 */
export function applyFieldProps<T extends Values>(
  field: FieldRuntime<T>,
  props: RuntimeFieldResolvedProps<T>
): boolean {
  let changed = false

  changed = setSignalValue(field.visible.value, props.visible) || changed
  changed = setSignalValue(field.readonly.value, props.readonly) || changed
  changed = setSignalValue(field.disabled.value, props.disabled) || changed
  changed = setSignalValue(field.required.value, props.required) || changed
  changed = setSignalValue(field.placeholder, props.placeholder) || changed
  changed = setSignalValue(field.componentProps.value, props.componentProps) || changed
  changed = setSignalValue(field.rules.value, props.rules) || changed

  return changed
}

/**
 * 设置信号值并返回是否发生变化。
 *
 * 使用深比较判断是否变化，减少对象型值的无意义更新。
 *
 * @typeParam T - 值类型
 *
 * @param signal - 信号对象
 * @param nextValue - 新值
 * @returns 是否发生变化
 */
function setSignalValue<T>(signal: { value: T; peek: () => T }, nextValue: T): boolean {
  // 深比较可以减少对象型 componentProps 重复写入造成的无意义 resolved schema 刷新。
  if (isEqual(signal.peek(), nextValue)) return false

  signal.value = nextValue

  return true
}
