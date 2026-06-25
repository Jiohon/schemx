/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 descriptor.dependencies 监听 triggerFields，并把解析结果写入
 * FieldRuntimeState.dynamicOverrides。
 * 该模块不修改 descriptor/schema。
 *
 * @module core/field/dependencies
 */

import { createSignalEffect } from "../reactivity"

import { type FieldRuntimeState, setFieldDynamicOverrides } from "./runtimeState"

import type { SchemxFormContext } from "../createForm"
import type { FieldDescriptor } from "../descriptor"
import type { Scope } from "../node"
import type {
  SchemxConditionFn,
  SchemxDependencies,
  SchemxFormApi,
  SchemxResolvedBaseField,
  Values,
} from "../types"

/**
 * 支持动态配置的字段呈现态键列表。
 */
export const FIELD_DEPENDENCIES_PROP_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "readonly",
  "disabled",
  "visible",
  "rules",
] as const

type DependenciesPropKey = (typeof FIELD_DEPENDENCIES_PROP_KEYS)[number]

export type DependenciesResolvedProps<TValues extends Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, Exclude<DependenciesPropKey, "rules">> & {
    rules?: SchemxResolvedBaseField<TValues>["rules"]
  }
>

/**
 * 创建字段 dependencies effect 的运行时依赖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateDependenciesEffectOptions<TValues extends Values = Values> {
  /**
   * 字段 descriptor，提供静态 schema、validation 和 dependencies 配置。
   */
  descriptor: Readonly<FieldDescriptor<TValues>>
  /**
   * 字段运行态（Signal Graph 阶段），dependencies 结果会写入 dynamicOverrides。
   */
  runtimeState: FieldRuntimeState<TValues>
  /**
   * form 内部运行时上下文。
   */
  context: SchemxFormContext<TValues>
  /**
   * 当前 effect 所属的资源作用域。
   */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的 descriptor、runtimeState 和运行时上下文。
 */
export function createDependenciesEffect<TValues extends Values = Values>(
  options: CreateDependenciesEffectOptions<TValues>
): void {
  const { descriptor, runtimeState, context, scope } = options
  const dependencies = descriptor.dependencies

  if (
    dependencies == null ||
    dependencies.triggerFields == null ||
    dependencies.triggerFields.length === 0
  ) {
    return
  }

  let version = 0

  const dispose = createSignalEffect(() => {
    const currentVersion = ++version

    // 读取 trigger 字段值以建立响应式依赖；字段值变化时 effect 会重新执行。
    void context.formApi.getValues(dependencies.triggerFields)

    void context.scheduler.track(
      resolveDependencies(dependencies, context.formApi).then((resolvedProps) => {
        if (scope.disposed || currentVersion !== version) {
          return
        }

        setFieldDynamicOverrides(runtimeState, resolvedProps, {
          source: "dependencies",
          triggerFields: dependencies.triggerFields,
        })
      })
    )
  })

  scope.add(() => {
    version += 1
    dispose()
  })
}

/**
 * 解析单个字段的 dependencies 配置。
 */
async function resolveDependencies<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const values = formApi.getValues() as TValues

  const [resolvedProps] = await Promise.all([
    resolveDependenciesProps(dependencies, values, formApi),
    runDependenciesTrigger(dependencies, values, formApi),
  ])

  return resolvedProps
}

/**
 * 执行 dependencies.trigger 副作用。
 */
async function runDependenciesTrigger<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<void> {
  if (!dependencies.trigger) {
    return
  }

  try {
    await dependencies.trigger(values, formApi)
  } catch (error) {
    console.error("[schemx] trigger 执行错误:", error)
  }
}

/**
 * 解析 dependencies 中显式配置的动态属性。
 */
async function resolveDependenciesProps<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const entries = await Promise.all(
    FIELD_DEPENDENCIES_PROP_KEYS.filter((key) => dependencies[key] != null).map(
      async (key) => {
        const condition = dependencies[key] as SchemxConditionFn<TValues, unknown>
        const value = await resolveCondition(formApi, condition, values, undefined)

        return [key, value] as const
      }
    )
  )

  return Object.fromEntries(entries) as DependenciesResolvedProps<TValues>
}

/**
 * 执行单个动态属性条件函数。
 */
async function resolveCondition<TValues extends Values, TValue>(
  formApi: SchemxFormApi<TValues>,
  condition: SchemxConditionFn<TValues, TValue>,
  formValues: TValues,
  defaultValue: TValue | undefined
): Promise<TValue | undefined> {
  try {
    const result = await condition(formValues, formApi)

    return result ?? defaultValue
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}
