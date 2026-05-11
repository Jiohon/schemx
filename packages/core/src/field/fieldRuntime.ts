/**
 * 字段运行时状态。
 *
 * FieldRuntime 只保存字段 resolved props signals 和静态默认值解析。字段动态
 * 属性计算属于 `engine/dynamicPropEngine.ts`，不放在 field 层。
 *
 * @module core/field/fieldRuntime
 */

import { isEqual } from "es-toolkit"

import { createSignal } from "../reactivity"

import type {
  FieldRuntime,
  ReactiveComputation,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
  RuntimeFieldResolvedProps,
} from "../runtime/types"
import type { SchemxBaseField, Values } from "../types"

/**
 * 统一解析字段默认属性。
 *
 * 默认值可以是静态对象，也可以是按字段 schema 动态计算的函数；这让 Vue
 * 层的全局 readonly/disabled 能以 runtime 默认值的形式进入 core。
 */
export function resolveRuntimeFieldDefaults<T extends Values>(
  source: RuntimeFieldDefaults<T> | undefined,
  schema: SchemxBaseField<T>
): RuntimeFieldDefaultProps<T> {
  if (!source) return {}

  return typeof source === "function" ? source(schema) : source
}

/**
 * 从静态 schema + runtime 默认值生成字段已解析属性。
 *
 * 优先级为 schema 显式配置 > runtime 默认值 > core 内置默认值。
 * 注意这里不会执行 dependencies 条件函数，只得到字段的静态基线。
 */
export function getStaticFieldResolvedProps<T extends Values>(
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
 */
export function createFieldRuntime<T extends Values>(
  schema: SchemxBaseField<T>,
  defaults: RuntimeFieldDefaultProps<T> = {}
): FieldRuntime<T> {
  const resolved = getStaticFieldResolvedProps(schema, defaults)

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

export function createReactiveComputation<T>(value: T): ReactiveComputation<T> {
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
 * projection 和 validator 生命周期都会通过这个入口把 signals 投影为普通对象。
 */
export function readFieldRuntimeProps<T extends Values>(
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
 */
export function applyFieldRuntimeProps<T extends Values>(
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

function setSignalValue<T>(signal: { value: T; peek: () => T }, nextValue: T): boolean {
  // 深比较可以减少对象型 componentProps 重复写入造成的无意义 projection 刷新。
  if (isEqual(signal.peek(), nextValue)) return false

  signal.value = nextValue

  return true
}
