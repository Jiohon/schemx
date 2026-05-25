/**
 * ValidationEffect - 校验 effect。
 *
 * Validation 是字段状态的 effect，不是 lifecycle bridge。
 *
 * @module core/field/validationEffect
 */

import { createReactiveEffect, createSignal } from "../reactivity"

import type { SchemxFormContext } from "../createForm"
import type { FieldDescriptor } from "../descriptor"
import type { FieldModel } from "./model"
import type { RuntimeScope } from "../graph"
import type { Signal } from "../reactivity"
import type { ReadonlySignal } from "../reactivity"
import type { RuntimeScheduler } from "../scheduler"
import type { SchemxBaseField, Values } from "../types"
import type { ValidateResult } from "../validator"

/**
 * 校验模型。
 */
export interface ValidationModel<TValues extends Values> {
  /**
   * 是否已注册规则。
   */
  registered: Signal<boolean>

  /**
   * 是否正在校验。
   */
  validating: Signal<boolean>

  /**
   * 执行校验。
   */
  validate(): Promise<ValidateResult<TValues>>

  /**
   * 释放资源。
   */
  dispose(): void
}

/**
 * 创建 ValidationEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateValidationEffectOptions<TValues extends Values = Values> {
  /**
   * 字段属性。
   */
  props: ReadonlySignal<Readonly<SchemxBaseField<TValues>>>

  /**
   * 字段描述符。
   */
  descriptor: Readonly<FieldDescriptor<TValues>>

  /**
   * 字段呈现态模型。
   */
  fieldModel: FieldModel<TValues>

  /**
   * 关联的 scope。
   */
  scope: RuntimeScope

  /**
   * 调度器。
   */
  scheduler?: RuntimeScheduler

  /**
   * 表单内部上下文。
   */
  context: SchemxFormContext<TValues>
}

interface ValidationRegistrationSnapshot<TValues extends Values> {
  visible: boolean
  readonly: boolean
  disabled: boolean
  rules: SchemxBaseField<TValues>["rules"]
}

/**
 * 创建一个 ValidationEffect 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 配置选项
 * @returns 新创建的 ValidationModel
 *
 * @example
 * ```ts
 * const validation = createValidationEffect({
 *   state,
 *   props,
 *   scope,
 *   scheduler,
 *   validator,
 * })
 *
 * const result = await validation.validate()
 * ```
 */
export function createValidationEffect<TValues extends Values = Values>(
  options: CreateValidationEffectOptions<TValues>
): ValidationModel<TValues> {
  const { props, descriptor, fieldModel, scope, context, scheduler } = options

  const name = descriptor.schema.name
  const taskScheduler = scheduler ?? context.scheduler

  const registered = createSignal(false)
  const validating = createSignal(false)
  let registrationVersion = 0

  function readValidationProps(): ValidationRegistrationSnapshot<TValues> {
    if (fieldModel) {
      return {
        visible: fieldModel.visible.value,
        readonly: fieldModel.readonly.value,
        disabled: fieldModel.disabled.value,
        rules: fieldModel.rules.value,
      }
    }

    const schema = props?.value

    return {
      visible: schema?.visible ?? true,
      readonly: schema?.readonly ?? false,
      disabled: schema?.disabled ?? false,
      rules: schema?.rules,
    }
  }

  /**
   * 更新规则注册状态。
   */
  const applyRegistration = (snapshot: ValidationRegistrationSnapshot<TValues>): void => {
    const { visible, readonly, disabled, rules } = snapshot

    // visible=false / readonly=true / disabled=true 时注销规则
    if (!visible || readonly || disabled || !rules) {
      // 始终注销规则并清空 errors（即使之前没有注册过）
      context.validator.unregisterRules(name)
      context.validator.setFieldError(name, [])

      registered.value = false

      return
    }

    const resolvedRules = context.rulesRegistry.resolveRuleBySchema(descriptor.schema)

    // 注册规则
    context.validator.registerRules(
      name,
      resolvedRules,
      `${descriptor.schema.label}为必填项`
    )

    registered.value = true
  }

  const scheduleRegistration = (
    snapshot: ValidationRegistrationSnapshot<TValues>
  ): void => {
    const currentVersion = ++registrationVersion

    taskScheduler.schedule({
      id: `validation:${descriptor.key}`,
      priority: "post",
      scope,
      run: () => {
        if (scope.disposed || currentVersion !== registrationVersion) {
          return
        }

        applyRegistration(snapshot)
      },
    })
  }

  // 注册 cleanup：scope 释放时注销规则
  scope.add(() => {
    registrationVersion += 1
    context.validator.unregisterRules(name)
    context.validator.setFieldError(name, [])

    registered.value = false
  })

  // 创建响应式 effect：当 props 变化时自动重新评估规则注册状态
  const disposeEffect = createReactiveEffect(() => {
    scheduleRegistration(readValidationProps())
  })

  // 注册 effect 清理到 scope
  scope.add(disposeEffect)

  /**
   * 执行校验。
   */
  const validate = async () => {
    validating.value = true

    try {
      const result = await context.validator.validateField(
        name,
        context.store.getFieldsSnapshot()
      )

      return result as ValidateResult<TValues>
    } finally {
      validating.value = false
    }
  }

  /**
   * 释放资源。
   */
  const dispose = (): void => {
    scope.dispose()
  }

  return {
    registered,
    validating,
    validate,
    dispose,
  }
}
