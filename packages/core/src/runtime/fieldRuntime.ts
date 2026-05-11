/**
 * 字段运行时属性解析与依赖监听。
 *
 * 动态属性下沉到 runtime 后，字段节点自己维护 visible/disabled/rules
 * 等解析结果。Vue 等适配层只消费 schema projection，不再重复实现依赖解析。
 *
 * @module core/runtime/fieldRuntime
 */

import { isEqual } from "es-toolkit"

import { createSignal } from "../reactivity"

import type { SchemxBaseField, SchemxConditionFn, SchemxInstance, Values } from "../types"
import type {
  FieldRuntime,
  FieldRuntimeNode,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
  RuntimeFieldResolvedProps,
} from "./types"

export const FIELD_DEPENDENCY_PROP_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "readonly",
  "disabled",
  "visible",
  "rules",
] as const

type FieldDependencyPropKey = (typeof FIELD_DEPENDENCY_PROP_KEYS)[number]

/**
 * 字段动态属性解析器依赖的外部能力。
 *
 * 这里通过回调接入 engine/createForm，避免 resolver 直接依赖具体表单实现。
 */
export interface FieldDependencyResolverOptions<T extends Values> {
  /** 当前表单实例，用于读取依赖字段、快照和注册 effect */
  form: SchemxInstance<T>
  /** 解析字段级默认值，通常来自框架层全局 readonly/disabled 等配置 */
  resolveDefaults: (schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>
  /** 通知 runtime idle tracker 有异步解析开始或结束 */
  onPendingChange: (delta: number) => void
  /** 字段已解析属性变化后同步 createForm 生命周期 */
  onFieldUpdate: (node: FieldRuntimeNode<T>) => void
  /** 字段投影发生变化，通知 engine 版本更新 */
  onTreeChange: () => void
}

export interface FieldDependencyResolver {
  dispose: () => void
}

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
    schema,
    mounted: false,
    // version 用于异步解析防竞态：新一轮解析开始后旧结果不能再写回。
    version: 0,
    visible: createSignal(resolved.visible),
    readonly: createSignal(resolved.readonly),
    disabled: createSignal(resolved.disabled),
    required: createSignal(resolved.required),
    placeholder: createSignal(resolved.placeholder),
    componentProps: createSignal(resolved.componentProps),
    rules: createSignal(resolved.rules),
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
    visible: field.visible.value,
    readonly: field.readonly.value,
    disabled: field.disabled.value,
    required: field.required.value,
    placeholder: field.placeholder.value,
    componentProps: field.componentProps.value,
    rules: field.rules.value,
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

  changed = setSignalValue(field.visible, props.visible) || changed
  changed = setSignalValue(field.readonly, props.readonly) || changed
  changed = setSignalValue(field.disabled, props.disabled) || changed
  changed = setSignalValue(field.required, props.required) || changed
  changed = setSignalValue(field.placeholder, props.placeholder) || changed
  changed = setSignalValue(field.componentProps, props.componentProps) || changed
  changed = setSignalValue(field.rules, props.rules) || changed

  return changed
}

/**
 * 创建字段 dynamic props 解析器。
 *
 * 解析器监听 dependencies.triggerFields，并把所有配置的属性条件函数统一执行；
 * 与 dependency renderer 一样，它也纳入 runtime 空闲追踪器，submit 前可等待完成。
 */
export function createFieldDependencyResolver<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: FieldDependencyResolverOptions<T>
): FieldDependencyResolver {
  const dependencies = node.schema.dependencies

  if (
    dependencies == null ||
    dependencies.triggerFields == null ||
    dependencies.triggerFields.length === 0
  ) {
    return { dispose: () => {} }
  }

  const { triggerFields } = dependencies
  // queued：本轮已经进入 microtask 队列，避免同一 tick 内重复排队。
  let queued = false
  // resolving：已有异步解析进行中，新变化要排到当前解析之后。
  let resolving = false
  // rerunAfterResolve：解析中又发生依赖变化，完成后再补跑一轮。
  let rerunAfterResolve = false
  let disposed = false

  const schedule = (): void => {
    if (disposed || node.disposed) return

    // 每次调度都推进版本号，正在路上的异步结果会因版本不匹配而被丢弃。
    node.field.version += 1

    if (resolving) {
      rerunAfterResolve = true

      return
    }

    if (queued) return

    queued = true
    // queueMicrotask 前先 +1，waitForIdle 能感知还未开始执行的解析任务。
    options.onPendingChange(1)
    queueMicrotask(executeQueued)
  }

  const executeQueued = async (): Promise<void> => {
    if (disposed || node.disposed) {
      queued = false
      options.onPendingChange(-1)

      return
    }

    queued = false
    resolving = true

    try {
      await resolveFieldProps(node, options, node.field.version)
    } finally {
      resolving = false

      if (!disposed && !node.disposed && rerunAfterResolve) {
        rerunAfterResolve = false
        queued = true
        // 补跑任务也要计入 pending，保证 waitForIdle 等到最后一轮完成。
        options.onPendingChange(1)
        queueMicrotask(executeQueued)
      }

      options.onPendingChange(-1)
    }
  }

  const disposeEffect = options.form.effect(() => {
    for (const path of triggerFields) {
      // 读取依赖字段建立响应式追踪；真正解析使用快照，避免条件函数读到半更新状态。
      void options.form.getFieldValue(path)
    }

    schedule()
  })

  return {
    dispose: () => {
      disposed = true
      // 销毁时推进版本号，让未完成的异步解析结果自然失效。
      node.field.version += 1
      disposeEffect()
    },
  }
}

async function resolveFieldProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: FieldDependencyResolverOptions<T>,
  version: number
): Promise<void> {
  const schema = node.schema
  const dependencies = schema.dependencies
  const defaults = getStaticFieldResolvedProps(schema, options.resolveDefaults(schema))

  if (!dependencies) {
    applyResolvedProps(node, options, defaults, version)

    return
  }

  const configuredProps = FIELD_DEPENDENCY_PROP_KEYS.filter(
    (key) => dependencies[key] != null
  )

  if (configuredProps.length === 0 && dependencies.trigger == null) {
    applyResolvedProps(node, options, defaults, version)

    return
  }

  const values = options.form.getFieldsSnapshot() as T

  // trigger 是副作用入口，异常只记录，不影响其他属性解析。
  const triggerTask = dependencies.trigger
    ? Promise.resolve(dependencies.trigger(values, options.form)).catch((error) => {
        console.error("[schemx] trigger 执行错误:", error)
      })
    : undefined

  const propsTask = configuredProps.map(async (key) => {
    const condition = dependencies[key] as
      | SchemxConditionFn<T, RuntimeFieldResolvedProps<T>[typeof key]>
      | undefined

    if (condition == null) return defaults[key]

    return resolvePropertyCondition(options.form, condition, values, defaults[key])
  })

  const [, results] = await Promise.all([triggerTask, Promise.all(propsTask)])

  const nextProps = { ...defaults }

  // 只覆盖 dependencies 中真正配置过的属性，未配置属性继续使用静态基线。
  configuredProps.forEach((key, index) => {
    ;(nextProps as Record<FieldDependencyPropKey, unknown>)[key] = results[index]
  })

  applyResolvedProps(node, options, nextProps, version)
}

function applyResolvedProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: FieldDependencyResolverOptions<T>,
  props: RuntimeFieldResolvedProps<T>,
  version: number
): void {
  // 异步解析完成时若节点已销毁或版本已过期，直接丢弃结果。
  if (node.disposed || version !== node.field.version) return

  const changed = applyFieldRuntimeProps(node.field, props)

  if (!changed) return

  options.onFieldUpdate(node)
  options.onTreeChange()
}

/**
 * 执行单个动态属性条件函数。
 *
 * 条件函数返回 null/undefined 或抛错时回退默认值，保证字段已解析属性
 * 始终有可用值，避免框架层收到半解析状态。
 */
async function resolvePropertyCondition<T extends Values, R>(
  form: SchemxInstance<T>,
  condition: SchemxConditionFn<T, R>,
  formValues: T,
  defaultValue: R
): Promise<R> {
  try {
    const result = await condition(formValues, form)

    if (result == null) {
      return defaultValue
    }

    return result
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}

function setSignalValue<T>(signal: { value: T; peek: () => T }, nextValue: T): boolean {
  // 深比较可以减少对象型 componentProps 重复写入造成的无意义 projection 刷新。
  if (isEqual(signal.peek(), nextValue)) return false

  signal.value = nextValue

  return true
}
