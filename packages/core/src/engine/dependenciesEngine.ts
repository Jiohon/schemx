/**
 * Dynamic Prop Engine。
 *
 * 负责监听 `schema.dependencies.triggerFields`，并将 dependencies 中配置的
 * visible/disabled/readonly/rules/componentProps 等动态属性解析后写回
 * FieldRuntime。它只处理字段属性变化，不创建 RuntimeNode，也不替换 subtree。
 *
 * @module core/engine/DependenciesEngine
 */

import { applyFieldProps, resolveStaticProps } from "../runtime"

import type { DependenciesEngineMountResult, DependenciesEngineOptions } from "./types"
import type {
  FieldRuntimeNode,
  RuntimeFieldResolvedProps,
  SchemxConditionFn,
  SchemxInstance,
  Values,
} from "../types"

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
type ComputedDependencyPropKey = Exclude<FieldDependencyPropKey, "placeholder">
type ComputationVersions = Partial<Record<ComputedDependencyPropKey, number>>

/**
 * 创建字段 dependencies 解析器。
 *
 * 解析器监听 dependencies.triggerFields，并把所有配置的属性条件函数统一执行；
 * 与 dependency renderer 一样，它也纳入 runtime 空闲追踪器，submit 前可等待完成。
 */
export function createDependenciesResolver<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>
): DependenciesEngineMountResult {
  const dependencies = node.schema.dependencies

  if (
    dependencies == null ||
    dependencies.triggerFields == null ||
    dependencies.triggerFields.length === 0
  ) {
    return { dispose: () => {} }
  }

  const { triggerFields } = dependencies
  const configuredProps = FIELD_DEPENDENCY_PROP_KEYS.filter(
    (key) => dependencies[key] != null
  )
  let disposed = false

  const schedule = (): void => {
    if (disposed || node.disposed.value) return

    // 每次调度都推进版本号，正在路上的异步结果会因版本不匹配而被丢弃。
    const versions = bumpComputationVersions(node, configuredProps)

    options.scheduler.queue({
      channel: "dependencies",
      key: node.key,
      run: () => {
        if (disposed || node.disposed.value) return

        return resolveFieldProps(node, options, versions)
      },
      onError: (error) => {
        console.error("[schemx] 解析动态属性时发生错误:", error)
      },
    })
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
      bumpComputationVersions(node, configuredProps)
      disposeEffect()
    },
  }
}

async function resolveFieldProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>,
  versions: ComputationVersions
): Promise<void> {
  const schema = node.schema
  const dependencies = schema.dependencies
  const defaults = resolveStaticProps(schema, options.resolveDefaults(schema))

  if (!dependencies) {
    applyResolvedProps(node, options, defaults, versions)

    return
  }

  const configuredProps = FIELD_DEPENDENCY_PROP_KEYS.filter(
    (key) => dependencies[key] != null
  )

  if (configuredProps.length === 0 && dependencies.trigger == null) {
    applyResolvedProps(node, options, defaults, versions)

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

  applyResolvedProps(node, options, nextProps, versions)
}

function applyResolvedProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>,
  props: RuntimeFieldResolvedProps<T>,
  versions: ComputationVersions
): void {
  // 异步解析完成时若节点已销毁或版本已过期，直接丢弃结果。
  if (node.disposed.value || isStale(node, versions)) {
    return
  }

  const changed = applyFieldProps(node.fieldRuntime, props)

  if (!changed) return

  options.onFieldUpdate(node)
  options.onTreeChange()
}

function bumpComputationVersions<T extends Values>(
  node: FieldRuntimeNode<T>,
  keys: readonly FieldDependencyPropKey[]
): ComputationVersions {
  const versions: ComputationVersions = {}

  for (const key of keys) {
    if (key === "placeholder") continue

    versions[key] = ++node.fieldRuntime[key].version
  }

  return versions
}

function isStale<T extends Values>(
  node: FieldRuntimeNode<T>,
  versions: ComputationVersions
): boolean {
  for (const key of Object.keys(versions) as ComputedDependencyPropKey[]) {
    if (node.fieldRuntime[key].version !== versions[key]) return true
  }

  return false
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
