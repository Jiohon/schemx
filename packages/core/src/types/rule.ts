/**
 * 校验规则类型体系。
 *
 * @module types/rule
 */

import type { ValidationRule } from "../validator/types"
import type { FieldValue, NamePath, Values } from "./form"
import type { StandardSchemaV1 } from "./standardSchema"

export interface RequiredOptions<TValue = unknown> {
  message?: string
  isEmpty?: (value: TValue | null | undefined) => boolean
}

export type RequiredRule<TValue = unknown> = boolean | RequiredOptions<TValue>

export type DefinedFieldValue<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = Exclude<FieldValue<TValues, TName>, undefined>

export interface ValidationRuleDefinition {}

type DeclaredRuleName = Extract<keyof ValidationRuleDefinition, string>

export type ValidationRuleName<TValue> = [DeclaredRuleName] extends [never]
  ? string
  : {
      [K in DeclaredRuleName]: TValue extends ValidationRuleDefinition[K] ? K : never
    }[DeclaredRuleName]

export type FieldRule<
  TValues extends Values,
  TName extends NamePath<TValues>,
  TValue = DefinedFieldValue<TValues, TName>,
> =
  | ValidationRuleName<TValue>
  | ValidationRule<TValue, TValues, TName>
  | StandardSchemaV1<TValue, unknown>

export type FieldRules<TValues extends Values, TName extends NamePath<TValues>> =
  FieldRule<TValues, TName> | readonly FieldRule<TValues, TName>[]

/** @deprecated 仅供旧运行时代码迁移使用。 */
export interface SchemxRuleDefinition {}

/** @deprecated 仅供旧运行时代码迁移使用。 */
export type SchemxRuleDefinitionKey = [keyof SchemxRuleDefinition] extends [never]
  ? string
  : keyof SchemxRuleDefinition

/** @deprecated 仅供旧运行时代码迁移使用。 */
export type SchemxRuleBuiltinKey = "required" | "selectRequired" | "uploadRequired"

/** @deprecated 仅供旧运行时代码迁移使用。 */
export type SchemxRules =
  string | ValidationRule<any, any, any> | StandardSchemaV1<any, unknown>

/** @deprecated 仅供旧运行时代码迁移使用。 */
export type SchemxRuleKey = SchemxRuleBuiltinKey | SchemxRuleDefinitionKey
