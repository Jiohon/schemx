/**
 * useFieldHandler - 字段处理 Hook
 *
 * 封装字段实例创建、校验判断、以及 onChange/onBlur 事件处理。
 * 内部创建 field 实例和获取 formContext，调用方无需单独管理。
 * 规则注册/注销由 core runtime 字段生命周期统一处理。
 *
 * @module hooks/useFieldHandler
 */

import { computed, unref, type ComputedRef, type MaybeRef } from "vue"

import { useContext } from "@/hooks/useContext"
import { useField } from "@/hooks/useField"
import { shouldValidateOn } from "@/utils"
import { mergeTrigger } from "@/utils/validation"

import { provideFieldContext } from "./useFieldContext"

import type { SchemxBaseField, ValidationTrigger, Values } from "@schemx/core"

/** mergeTrigger 返回的触发时机类型 */
type TriggerConfig = ValidationTrigger | ValidationTrigger[]

/**
 * useFieldHandler 的返回值。
 */
export interface UseFieldHandlerReturn {
  /** useField 返回的字段控制对象 */
  field: ReturnType<typeof useField>
  /** 是否需要进行校验（响应式） */
  canVerified: ComputedRef<boolean>
  /** 合并后的校验触发时机 */
  trigger: ComputedRef<TriggerConfig>
  /** 值变化处理函数 */
  handleChange: (v: unknown) => void
  /** 失焦处理函数 */
  handleBlur: () => void
}

/**
 * 管理字段事件触发校验逻辑。
 *
 * 内部通过 useField 创建字段实例、通过 useContext 获取表单上下文，
 * 根据 runtime 已解析 schema 的状态自动判断是否需要触发校验。
 *
 * @param baseSchema - runtime resolved 字段配置
 *
 * @returns 字段实例及校验相关的状态和方法
 *
 * @example
 * ```ts
 * const { field, canVerified, handleChange, handleBlur } = useFieldHandler(schemaRef)
 * ```
 */
export function useFieldHandler<T extends Values>(
  baseSchema: MaybeRef<SchemxBaseField<T>>
): UseFieldHandlerReturn {
  const formContext = useContext()
  const getSchema = (): SchemxBaseField<T> => unref(baseSchema)
  const field = useField(getSchema().name)

  provideFieldContext(field)

  const trigger = computed<TriggerConfig>(() =>
    mergeTrigger(getSchema().validationTrigger, formContext.validationTrigger, "onChange")
  )

  /**
   * 是否需要进行校验。
   *
   * 当字段不可见、只读或禁用时，无需进行校验。
   */
  const canVerified = computed(() => {
    const schema = getSchema()
    const isOperate = schema.visible !== false && !schema.readonly && !schema.disabled
    // [] 代表没有有效规则，不能只用 truthy 判断。
    const hasRules = Array.isArray(schema.rules)
      ? schema.rules.length > 0
      : !!schema.rules

    return isOperate && hasRules
  })

  /** 值变化处理，设置值后根据触发时机决定是否校验 */
  const handleChange = (v: unknown) => {
    field.setValue(v)
    if (canVerified.value && shouldValidateOn("change", trigger.value)) {
      field.validate()
    }
  }

  /** 失焦处理，根据触发时机决定是否校验 */
  const handleBlur = () => {
    if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
      field.validate()
    }
  }

  return { field, canVerified, trigger, handleChange, handleBlur }
}

export default useFieldHandler
