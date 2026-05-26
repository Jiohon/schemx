/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 descriptor.dependencies 监听 triggerFields，并把解析结果写入
 * FieldModel signals。该模块不修改 descriptor/schema。
 *
 * @module core/field/dependencies
 */

import { createSignalEffect } from "../reactivity"

import type { FieldDescriptor, ValidationDescriptor } from "../descriptor"
import type { FieldModel } from "./model"
import type { SchemxFormContext } from "../createForm"
import type { Scope } from "../graph"
import type {
  SchemxBaseField,
  SchemxConditionFn,
  SchemxDependencies,
  SchemxFormApi,
  SchemxResolvedBaseField,
  Values,
} from "../types"

/**
 * 支持动态配置的字段呈现态键列表。
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

type DependencyPropKey = (typeof FIELD_DEPENDENCY_PROP_KEYS)[number]

type DependencyResolvedProps<TValues extends Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, Exclude<DependencyPropKey, "rules">> &
    Pick<ValidationDescriptor, "rules">
>

/**
 * 创建字段 dependencies effect 的运行时依赖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateDependenciesEffectOptions<TValues extends Values = Values> {
  /** 字段 descriptor，提供静态 schema、validation 和 dependencies 配置。 */
  descriptor: Readonly<FieldDescriptor<TValues>>
  /** 被 dependencies 动态写入的字段呈现态模型。 */
  fieldModel: FieldModel<TValues>
  /** form 内部运行时上下文。 */
  context: SchemxFormContext<TValues>
  /** 当前 effect 所属的资源作用域。 */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的字段模型、descriptor 和运行时上下文。
 */
export function createDependenciesEffect<TValues extends Values = Values>(
  options: CreateDependenciesEffectOptions<TValues>
): void {
  const { descriptor, fieldModel, context, scope } = options
  const formApi = context.getFormApi()
  const base = descriptor.schema
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
    for (const triggerField of dependencies.triggerFields) {
      void formApi.getValue(triggerField)
    }

    void context.scheduler.track(
      resolveDependencies(dependencies, base, descriptor.validation, formApi).then(
        (resolvedProps) => {
          if (scope.disposed || currentVersion !== version) {
            return
          }

          patchFieldModel(fieldModel, base, descriptor.validation, resolvedProps)
        }
      )
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
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  validation: Readonly<ValidationDescriptor>,
  formApi: SchemxFormApi<TValues>
): Promise<DependencyResolvedProps<TValues>> {
  const values = formApi.getValues() as TValues

  const [resolvedProps] = await Promise.all([
    resolveDependencyProps(dependencies, base, validation, values, formApi),
    runDependencyTrigger(dependencies, values, formApi),
  ])

  return resolvedProps
}

/**
 * 执行 dependencies.trigger 副作用。
 */
async function runDependencyTrigger<TValues extends Values>(
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
async function resolveDependencyProps<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  validation: Readonly<ValidationDescriptor>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<DependencyResolvedProps<TValues>> {
  const entries = await Promise.all(
    getConfiguredPropKeys(dependencies).map(async (key) => [
      key,
      await resolveCondition(
        formApi,
        dependencies[key] as SchemxConditionFn<
          TValues,
          SchemxBaseField<TValues>[typeof key]
        >,
        values,
        getDefaultDependencyValue(key, base, validation),
        key === "rules"
      ),
    ])
  )

  return Object.fromEntries(entries) as DependencyResolvedProps<TValues>
}

/**
 * 获取 dependencies 中已配置条件函数的属性键。
 */
function getConfiguredPropKeys<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>
): DependencyPropKey[] {
  return FIELD_DEPENDENCY_PROP_KEYS.filter((key) => dependencies[key] != null)
}

/**
 * 执行单个动态属性条件函数。
 */
async function resolveCondition<T extends Values, R>(
  formApi: SchemxFormApi<T>,
  condition: SchemxConditionFn<T, R>,
  formValues: T,
  defaultValue: R,
  preserveEmptyResult = false
): Promise<R> {
  try {
    const result = await condition(formValues, formApi)

    if (result == null && !preserveEmptyResult) {
      return defaultValue
    }

    return result as R
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}

/**
 * 将解析结果写入 FieldModel，未解析项回退到 descriptor 静态值。
 */
function patchFieldModel<TValues extends Values>(
  model: FieldModel<TValues>,
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  validation: Readonly<ValidationDescriptor>,
  resolved: DependencyResolvedProps<TValues>
): void {
  model.visible.value = resolved.visible ?? base.visible ?? true
  model.disabled.value = resolved.disabled ?? base.disabled ?? false
  model.readonly.value = resolved.readonly ?? base.readonly ?? false
  model.required.value = resolved.required ?? base.required ?? false
  model.rules.value = resolved.rules ?? validation.rules ?? []
  model.placeholder.value = resolved.placeholder ?? base.placeholder ?? ""
  model.componentProps.value = resolved.componentProps ?? base.componentProps ?? {}
}

function getDefaultDependencyValue<TValues extends Values>(
  key: DependencyPropKey,
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  validation: Readonly<ValidationDescriptor>
): SchemxBaseField<TValues>[DependencyPropKey] {
  if (key === "rules") {
    return validation.rules
  }

  return base[key]
}
