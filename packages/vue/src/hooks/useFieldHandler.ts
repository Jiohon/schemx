/**
 * useFieldHandler - 字段处理 Hook
 *
 * 封装字段实例创建、校验判断、规则注册/注销、以及 onChange/onBlur 事件处理。
 * 内部创建 field 实例和获取 formContext，调用方无需单独管理。
 * 当字段不可见、只读或禁用时自动清除校验规则和错误信息。
 *
 * @module hooks/useFieldHandler
 */

import { computed, type ComputedRef, watch } from "vue"

import { useContext } from "@/hooks/useContext"
import { useField } from "@/hooks/useField"
import { shouldValidateOn } from "@/utils"
import { mergeTrigger } from "@/utils/validation"

import type { SchemxDependenciesStaticProps } from "@schemx/core"
import type { SchemxBase, ValidationTrigger } from "@schemx/core"

/** mergeTrigger 返回的触发时机类型 */
type TriggerConfig = ValidationTrigger | ValidationTrigger[]

/**
 * useFieldValidation 的返回值
 */
export interface UseFieldHandlerReturn {
  /** useField 返回的字段控制对象 */
  field: ReturnType<typeof useField>
  /** 是否需要进行校验（响应式） */
  canVerified: ComputedRef<boolean>
  /** 合并后的校验触发时机 */
  trigger: TriggerConfig
  /** 值变化处理函数 */
  handleChange: (v: unknown) => void
  /** 失焦处理函数 */
  handleBlur: () => void
}

/**
 * 管理字段的校验逻辑。
 *
 * 内部通过 useField 创建字段实例、通过 useContext 获取表单上下文，
 * 根据 resolvedProps 的状态自动判断是否需要校验，
 * 在状态变化时自动注册/注销校验规则，
 * 并提供 onChange、onBlur 事件处理函数。
 *
 * @param baseSchema - 字段基础配置
 * @param resolvedProps - 解析后的动态属性状态
 *
 * @returns 字段实例及校验相关的状态和方法
 *
 * @example
 * ```ts
 * const { field, canVerified, handleChange, handleBlur } = useFieldValidation(
 *   baseSchema,
 *   resolvedProps
 * )
 * ```
 */
export function useFieldHandler(
  baseSchema: SchemxBase,
  resolvedProps: SchemxDependenciesStaticProps
): UseFieldHandlerReturn {
  const formContext = useContext()
  const field = useField(baseSchema.name)

  const trigger = mergeTrigger(
    baseSchema.validationTrigger,
    formContext.validationTrigger,
    "onChange"
  )

  /**
   * 是否需要进行校验。
   *
   * 当字段不可见、只读或禁用时，无需进行校验。
   */
  const canVerified = computed(() => {
    const isOperate =
      resolvedProps.visible && !resolvedProps.readonly && !resolvedProps.disabled

    return !!(isOperate && Object.hasOwn(baseSchema, "rules"))
  })

  /**
   * 提取规则配置并注册到字段。
   *
   * 同时将 placeholder 作为 defaultMessage 传给 registerRule，
   * 用于空值拦截时的错误提示。
   */
  const extractAndRegisterRules = () => {
    if (!canVerified.value) return

    const defaultMessage =
      resolvedProps.componentProps?.placeholder || resolvedProps.placeholder

    if (baseSchema.rules) {
      field.registerRules(baseSchema.rules, defaultMessage)
    }
  }

  watch(
    [canVerified, () => resolvedProps.componentProps, () => resolvedProps.placeholder],
    () => {
      if (!canVerified.value) {
        field.clearError()
        field.unregisterRules()
      } else {
        extractAndRegisterRules()
      }
    },
    { immediate: true }
  )

  /** 值变化处理，设置值后根据触发时机决定是否校验 */
  const handleChange = (v: unknown) => {
    field.setValue(v)
    if (canVerified.value && shouldValidateOn("change", trigger)) {
      field.validate()
    }
  }

  /** 失焦处理，根据触发时机决定是否校验 */
  const handleBlur = () => {
    if (canVerified.value && shouldValidateOn("blur", trigger)) {
      field.validate()
    }
  }

  return { field, canVerified, trigger, handleChange, handleBlur }
}

export default useFieldHandler
