import type { NamePath, Values } from "../types/form"

export interface ValidationRuleContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly name: TName
  readonly values: Readonly<TValues>
  readonly signal: AbortSignal
}

export interface ValidationRuleIssue {
  readonly message: string
  readonly code?: string
  readonly cause?: unknown
}

export type ValidationRuleResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly issues: readonly ValidationRuleIssue[]
      readonly bail?: boolean
    }

export interface ValidationRule<
  TValue = unknown,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  validate(
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleResult | Promise<ValidationRuleResult>
}

export interface FieldValidationError<TName extends PropertyKey = string> {
  readonly scope: "field"
  readonly name: TName
  readonly messages: readonly string[]
}

export interface FormValidationError {
  readonly scope: "form"
  readonly messages: readonly string[]
}

export type ValidationError<TName extends PropertyKey = string> =
  FieldValidationError<TName> | FormValidationError

export interface ValidationSuccess<TValues extends Values> {
  readonly valid: true
  readonly values: TValues
  readonly errors: readonly []
}

export interface ValidationFailure<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly valid: false
  readonly values: TValues
  readonly errors: readonly ValidationError<TName>[]
}

export type ValidationResult<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = ValidationSuccess<TValues> | ValidationFailure<TValues, TName>
