import { createStandardSchemaValidationRule } from "./rules"

import type { AdapterRule, ValidationAdapter, ValidationRule } from "./types"
import type { DefinedFieldValue, NamePath, StandardSchemaV1, Values } from "../types"

/**
 * 判断值是否为 Standard Schema V1 协议对象。
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1<unknown, unknown> {
  return typeof value === "object" && value !== null && "~standard" in value
}

/**
 * 判断值是否为可执行的原生校验规则（含 `validate` 函数）。
 */
export function isValidationRule(value: unknown): value is ValidationRule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ValidationRule).validate === "function"
  )
}

/**
 * Standard Schema 内置 adapter。
 *
 * 识别带 `~standard` 标记的 schema 并包装为原生校验规则。自描述规则，不提供 `rule()` 工厂。
 */
export const standardSchemaAdapter: ValidationAdapter<StandardSchemaV1<unknown, unknown>> = {
  id: "standard-schema",
  isRule: isStandardSchema,
  resolve<TValues extends Values, TName extends NamePath<TValues>>(
    rule: AdapterRule | StandardSchemaV1<unknown, unknown>
  ): readonly ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>[] {
    return [
      createStandardSchemaValidationRule<unknown, TValues, TName>(
        rule as StandardSchemaV1<unknown, unknown>
      ),
    ]
  },
}

/**
 * 原生 ValidationRule 内置 adapter。
 *
 * 识别含 `validate` 函数的原生规则并原样返回。自描述规则，不提供 `rule()` 工厂。
 */
export const nativeRuleAdapter: ValidationAdapter<ValidationRule> = {
  id: "native-rule",
  isRule: isValidationRule,
  resolve<TValues extends Values, TName extends NamePath<TValues>>(
    rule: AdapterRule | ValidationRule
  ): readonly ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>[] {
    return [rule as ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>]
  },
}

/**
 * 控制器构造时自动注入的内置 adapter，处理 Standard Schema 与原生校验规则。
 *
 * id `"standard-schema"` 与 `"native-rule"` 为保留 id，用户 adapter 不应复用。
 */
export const builtInAdapters: readonly ValidationAdapter[] = [
  standardSchemaAdapter,
  nativeRuleAdapter,
]
