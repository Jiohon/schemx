/**
 * ValidationEffect - 校验规则注册 effect。
 *
 * ValidationEffect 只同步字段规则与 Validator 的注册状态，
 * 字段交互触发校验由具体渲染层调用字段校验命令。
 *
 * @module core/field/validationEffect
 */

import { createSignal, createSignalEffect } from "../reactivity"

import type { Scope } from "../node"
import type { Signal } from "../reactivity"
import type { SchemxContext } from "../schemxContext"
import type { FieldEffectiveSchema } from "./runtimeState"
import type { ComputedSignal } from "../reactivity/computed"
import type { SchemxBaseField, Values } from "../types"

/**
 * 创建 ValidationEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateValidationEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   */
  context: SchemxContext<TValues>

  /**
   * 字段名路径。
   */
  name: SchemxBaseField<TValues>["name"]

  /**
   * 字段有效状态 computed（Signal Graph 阶段）。
   */
  effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>

  /**
   * 关联的 scope。
   */
  scope: Scope
}

/**
 * 校验规则注册 effect。
 */
export interface ValidationEffect {
  /**
   * 是否已注册规则。
   */
  registered: Signal<boolean>

  /**
   * 释放资源。
   */
  dispose(): void
}

interface ValidationRegistrationSnapshot {
  visible: boolean
  readonly: boolean
  disabled: boolean
  label: string
  rules: SchemxBaseField<Values>["rules"]
}

/**
 * 创建一个 ValidationEffect 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param options - 配置选项
 * @returns 新创建的 ValidationEffect
 */
export function createValidationEffect<TValues extends Values = Values>(
  options: CreateValidationEffectOptions<TValues>
): ValidationEffect {
  const { context, name, effectiveSchema, scope } = options

  const taskScheduler = context.scheduler

  const registered = createSignal(false)
  let registrationVersion = 0

  /**
   * 读取参与规则注册决策的响应式字段呈现态。
   *
   * 直接读取 effectiveSchema（Signal Graph 路径）。
   */
  const readValidationProps = (): ValidationRegistrationSnapshot => {
    const effective = effectiveSchema.value

    return {
      visible: effective.visible,
      readonly: effective.readonly,
      disabled: effective.disabled,
      label: effective.label,
      rules: effective.rules,
    }
  }

  /**
   * 根据当前字段呈现态注册或注销校验规则。
   */
  const applyRegistration = (snapshot: ValidationRegistrationSnapshot): void => {
    const { visible, readonly, disabled, label, rules } = snapshot

    if (!visible || readonly || disabled || !hasRules(rules)) {
      context.instance.unregisterRules(name)
      context.instance.setFieldError(name, [])

      registered.value = false

      return
    }

    const normalizedRules = rules ?? []

    context.instance.registerRules(name, normalizedRules, `${label}为必填项`)

    registered.value = true
  }

  /**
   * 将规则注册延后到 post 队列，避免与字段呈现态更新竞争。
   */
  const scheduleRegistration = (snapshot: ValidationRegistrationSnapshot): void => {
    const currentVersion = ++registrationVersion

    taskScheduler.schedule({
      id: `validation:${String(name)}`,
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

  scope.add(() => {
    registrationVersion += 1
    context.instance.unregisterRules(name)
    context.instance.setFieldError(name, [])

    registered.value = false
  })

  const disposeEffect = createSignalEffect(() => {
    scheduleRegistration(readValidationProps())
  })

  scope.add(disposeEffect)

  /**
   * 释放校验 effect 持有的资源作用域。
   */
  const dispose = (): void => {
    scope.dispose()
  }

  return {
    registered,
    dispose,
  }
}

function hasRules(rules: SchemxBaseField<Values>["rules"]): boolean {
  return Array.isArray(rules) ? rules.length > 0 : Boolean(rules)
}
