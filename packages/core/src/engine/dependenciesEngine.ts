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
  SchemxConditionFn,
  SchemxDependenciesStaticProps,
  SchemxInstance,
  Values,
} from "../types"

/**
 * 支持动态配置的字段属性键列表。
 */
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
 *
 * @typeParam T - 表单值类型
 *
 * @param node - 字段运行时节点
 * @param options - 解析器配置选项
 * @returns 包含 dispose 方法的挂载结果
 */
export function createDependenciesResolver<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>
): DependenciesEngineMountResult {
  const dependencies = node.schema.dependencies

  // 没有 dependencies 配置或 triggerFields 为空时，返回空释放器。
  if (
    dependencies == null ||
    dependencies.triggerFields == null ||
    dependencies.triggerFields.length === 0
  ) {
    return { dispose: () => {} }
  }

  const { triggerFields } = dependencies

  // 筛选出实际配置了条件函数的属性键。
  const configuredProps = FIELD_DEPENDENCY_PROP_KEYS.filter(
    (key) => dependencies[key] != null
  )

  let disposed = false

  /**
   * 调度一次属性解析任务。
   *
   * 推进版本号后，将解析任务加入调度器队列。
   */
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

  /**
   * 注册响应式 effect，监听 triggerFields 变化。
   */
  const disposeEffect = options.form.effect(() => {
    for (const path of triggerFields) {
      // 读取依赖字段建立响应式追踪；真正解析使用快照，避免条件函数读到半更新状态。
      void options.form.getFieldValue(path)
    }

    // 任意依赖字段变化时，调度重新解析。
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

/**
 * 解析字段的动态属性。
 *
 * 执行所有配置的条件函数，将解析结果应用到字段 runtime。
 *
 * @param node - 字段运行时节点
 * @param options - 解析器配置选项
 * @param versions - 当前计算版本号，用于防竞态
 */
async function resolveFieldProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>,
  versions: ComputationVersions
): Promise<void> {
  const schema = node.schema
  const dependencies = schema.dependencies

  // 获取静态属性作为基线。
  const defaults = resolveStaticProps(schema, options.resolveDefaults(schema))

  if (!dependencies) {
    applyResolvedProps(node, options, defaults, versions)

    return
  }

  const configuredProps = FIELD_DEPENDENCY_PROP_KEYS.filter(
    (key) => dependencies[key] != null
  )

  // 没有配置任何动态属性，直接应用静态基线。
  if (configuredProps.length === 0 && dependencies.trigger == null) {
    applyResolvedProps(node, options, defaults, versions)

    return
  }

  // 使用快照值执行条件函数，保证原子性。
  const values = options.form.getFieldsSnapshot() as T

  // trigger 是副作用入口，异常只记录，不影响其他属性解析。
  const triggerTask = dependencies.trigger
    ? Promise.resolve(dependencies.trigger(values, options.form)).catch((error) => {
        console.error("[schemx] trigger 执行错误:", error)
      })
    : undefined

  // 并行解析所有配置的动态属性。
  const propsTask = configuredProps.map(async (key) => {
    const condition = dependencies[key] as
      | SchemxConditionFn<T, SchemxDependenciesStaticProps<T>[typeof key]>
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

/**
 * 将解析结果应用到字段 runtime，并触发后续更新。
 *
 * @param node - 字段运行时节点
 * @param options - 解析器配置选项
 * @param props - 已解析的属性
 * @param versions - 当前计算版本号
 */
function applyResolvedProps<T extends Values>(
  node: FieldRuntimeNode<T>,
  options: DependenciesEngineOptions<T>,
  props: SchemxDependenciesStaticProps<T>,
  versions: ComputationVersions
): void {
  // 异步解析完成时若节点已销毁或版本已过期，直接丢弃结果。
  if (node.disposed.value || isStale(node, versions)) {
    return
  }

  const changed = applyFieldProps(node.fieldRuntime, props)

  if (!changed) return

  // 通知字段更新和树变化。
  options.onFieldUpdate(node)
  options.onTreeChange()
}

/**
 * 推进计算版本号。
 *
 * 用于防竞态：异步解析结果返回时检查版本是否匹配。
 *
 * @param node - 字段运行时节点
 * @param keys - 需要推进版本号的属性键列表
 * @returns 版本号映射
 */
function bumpComputationVersions<T extends Values>(
  node: FieldRuntimeNode<T>,
  keys: readonly FieldDependencyPropKey[]
): ComputationVersions {
  const versions: ComputationVersions = {}

  for (const key of keys) {
    // placeholder 不是 ReactiveComputation，跳过。
    if (key === "placeholder") continue

    versions[key] = ++node.fieldRuntime[key].version
  }

  return versions
}

/**
 * 检查计算结果是否已过期。
 *
 * @param node - 字段运行时节点
 * @param versions - 原始版本号映射
 * @returns 是否已过期
 */
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
 *
 * @typeParam T - 表单值类型
 * @typeParam R - 属性值类型
 *
 * @param form - 表单实例
 * @param condition - 条件函数
 * @param formValues - 表单值快照
 * @param defaultValue - 默认值
 * @returns 解析后的属性值
 */
async function resolvePropertyCondition<T extends Values, R>(
  form: SchemxInstance<T>,
  condition: SchemxConditionFn<T, R>,
  formValues: T,
  defaultValue: R
): Promise<R> {
  try {
    const result = await condition(formValues, form)

    // null/undefined 视为未指定，回退默认值。
    if (result == null) {
      return defaultValue
    }

    return result
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}
