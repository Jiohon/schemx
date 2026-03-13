/**
 * 表单校验器。
 *
 * 管理校验规则（rules）和校验错误（errors），基于 Standard Schema 接口进行字段校验。
 * 使用 Vue reactive 保持错误状态的响应式。
 * 支持所有实现了 StandardSchemaV1 接口的验证库（Zod v4、Valibot、ArkType 等）。
 *
 * @module core/validator
 *
 * @example
 * ```typescript
 * import type { StandardSchemaV1 } from './standardSchema'
 * import { createValidator } from './Validator'
 *
 * const validator = createValidator()
 *
 * // 注册校验规则
 * validator.registerRules('email', emailSchema)
 *
 * // 注册校验规则并指定空值提示
 * validator.registerRules('address', addressSchema, '请输入收货地址')
 *
 * // 校验单个字段
 * const result = await validator.validateField('email', latestValues)
 * ```
 */

import { reactive } from "vue"
import type { DeepReadonly, Reactive } from "vue"

import { getByPath } from "../utils/path"

import type { FormValues, NamePath, Value } from "../types"
import type { StandardSchemaV1 } from "../types/standardSchema"

/** 单个字段的校验错误 */
export interface FieldError {
  field: string
  message: string[]
}

/** 校验错误（包含所有失败字段和当前值） */
export interface ValidateError<T extends FormValues = FormValues> {
  errors: FieldError[]
  values: DeepReadonly<T>
}

/** 校验结果（Result 模式） */
export type ValidateResult<T extends FormValues = FormValues> =
  | { ok: true; values: DeepReadonly<T> }
  | { ok: false; error: ValidateError<T> }

/**
 * 校验规则条目。
 *
 * 包含一组 StandardSchemaV1 schema 和可选的空值默认错误提示。
 * 当字段值为 `undefined`/`null` 时，使用 `defaultMessage` 作为错误提示，
 * 避免验证库报出类型错误（如 Zod 的 "expected string, received undefined"）。
 */
export interface RuleEntry {
  /** 符合 StandardSchemaV1 接口的校验 schema 列表 */
  schemas: StandardSchemaV1[]
  /**
   * 空值（undefined/null）时的默认错误提示。
   *
   * 设置后，当字段值为 undefined/null 时直接返回此提示，不调用 schema 校验。
   * 未设置时将原始值直接传给 schema。
   */
  defaultMessage?: string
}

/** 规则映射表 */
export type RulesMap<T extends FormValues> = Map<NamePath<T>, RuleEntry>

/** 错误映射表 */
export type ErrorsMap<T extends FormValues> = Map<NamePath<T>, string[]>

/** Validator 响应式状态 */
export interface ValidatorState<T extends FormValues> {
  rules: RulesMap<T>
  errors: ErrorsMap<T>
}

/**
 * 表单校验器。
 *
 * 不持有 store 引用，所有值由调用方传入。
 * 基于 Standard Schema 接口进行字段校验，支持同步和异步规则。
 * 兼容所有实现了 StandardSchemaV1 接口的验证库。
 *
 * 每个字段可配置 `defaultMessage`，当值为 `undefined`/`null` 时
 * 跳过 schema 校验并返回该提示，避免验证库报类型错误。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 *
 * @example
 * ```typescript
 * const validator = new Validator<FormValues>()
 * validator.registerRules('email', emailSchema)
 * validator.registerRules('address', addressSchema, '请输入收货地址')
 * const result = await validator.validateField('email', formValues)
 * ```
 *
 * @remarks
 * 校验状态（rules / errors）通过 Vue reactive 包装，可在模板中直接响应式使用。
 */
export class Validator<T extends FormValues = FormValues> {
  public state: Reactive<ValidatorState<T>>

  /**
   * 创建 Validator 实例。
   *
   * 初始化空的 rules 和 errors 映射表。
   */
  constructor() {
    this.state = reactive({
      rules: new Map(),
      errors: new Map(),
    })
  }

  /**
   * 注册单个字段的校验规则。
   *
   * 支持传入单个 schema 或 schema 数组，多次调用会追加规则而非覆盖。
   *
   * @param path - 字段路径
   * @param rules - 单个或多个 StandardSchemaV1 校验 schema
   * @param defaultMessage - 可选，空值（undefined/null）时的默认错误提示
   *
   * @example
   * ```typescript
   * validator.registerRules('email', emailSchema)
   * validator.registerRules('name', [minLenSchema, maxLenSchema], '请输入姓名')
   * ```
   */
  public registerRules(
    path: NamePath<T>,
    rules: StandardSchemaV1 | StandardSchemaV1[],
    defaultMessage?: string
  ): void {
    const schemas = Array.isArray(rules) ? rules : [rules]
    const existing = this.state.rules.get(path)

    if (existing) {
      existing.schemas.push(...schemas)

      if (defaultMessage) {
        existing.defaultMessage = defaultMessage
      }
    } else {
      this.state.rules.set(path, { schemas, defaultMessage })
    }
  }

  /**
   * 注销单个字段的校验规则，同时清除该字段的错误信息。
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * validator.unregisterRules('email')
   * ```
   */
  public unregisterRules(path: NamePath<T>): void {
    this.state.rules.delete(path)
    this.state.errors.delete(path)
  }

  /**
   * 获取指定字段的错误信息。
   *
   * @param path - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * validator.getFieldError('email') // => ['邮箱格式不正确']
   * ```
   */
  public getFieldError(path: NamePath<T>): string[] | undefined {
    return this.state.errors.get(path)
  }

  /**
   * 手动设置指定字段的错误信息。
   *
   * @param path - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * validator.setFieldError('email', ['该邮箱已被注册'])
   * ```
   */
  public setFieldError(path: NamePath<T>, errors: string[]): void {
    this.state.errors.set(path, errors)
  }

  /**
   * 重置所有字段的校验错误。
   *
   * 清空 errors 映射表，不影响已注册的校验规则。
   *
   * @example
   * ```typescript
   * validator.resetErrors()
   * ```
   */
  public resetErrors(): void {
    this.state.errors.clear()
  }

  /**
   * 记录字段错误并返回失败结果。
   *
   * @param path - 字段路径
   * @param messages - 错误信息数组
   * @param latestValues - 当前表单全量值
   * @returns 失败的校验结果
   */
  private failResult(
    path: NamePath<T>,
    messages: string[],
    latestValues: DeepReadonly<T>
  ): ValidateResult<T> {
    this.state.errors.set(path, messages)

    return {
      ok: false,
      error: {
        errors: [{ field: String(path), message: messages }],
        values: latestValues,
      },
    }
  }

  /**
   * 校验单个字段的所有规则。
   *
   * 依次执行该字段注册的所有 schema，遇到第一个失败即返回错误。
   * 若值为 undefined/null 且配置了 defaultMessage，直接返回失败结果。
   *
   * @param path - 字段路径
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   */
  private async validateSingleRule(
    path: NamePath<T>,
    latestValues: DeepReadonly<T>
  ): Promise<ValidateResult<T>> {
    const entry = this.state.rules.get(path)

    if (!entry || entry.schemas.length === 0) {
      this.state.errors.delete(path)

      return { ok: true, values: latestValues }
    }

    const value: Value = getByPath(latestValues, path)

    const allMessages: string[] = []

    // 空值拦截：当值为 undefined/null 且配置了 defaultMessage 时，
    // 直接返回该字段的默认错误提示，避免验证库报类型错误
    if ((value === undefined || value === null) && entry.defaultMessage) {
      allMessages.push(entry.defaultMessage)
    }

    for (const schema of entry.schemas) {
      try {
        const result = await schema["~standard"].validate(value)

        if (result.issues) {
          allMessages.push(...result.issues.map((i: { message: any }) => i.message))
        }
      } catch (error) {
        console.warn(`[Validator] 校验字段 "${String(path)}" 时发生错误:`, error)
        allMessages.push("校验失败")
      }
    }

    if (allMessages.length > 0) {
      return this.failResult(path, allMessages, latestValues)
    }

    this.state.errors.delete(path)

    return { ok: true, values: latestValues }
  }

  /**
   * 根据校验结果构建 ValidateResult 返回值。
   *
   * @param ok - 校验是否全部通过
   * @param latestValues - 当前表单全量值
   * @returns 统一的校验结果对象
   */
  private buildResult(ok: boolean, latestValues: DeepReadonly<T>): ValidateResult<T> {
    if (ok) {
      return { ok: true, values: latestValues }
    }

    return {
      ok: false,
      error: {
        errors: Array.from(this.state.errors.entries()).map(([field, message]) => ({
          field: String(field),
          message,
        })),
        values: latestValues,
      },
    }
  }

  /**
   * 校验指定字段。
   *
   * 支持传入单个路径或路径数组，逐个校验后返回汇总结果。
   *
   * @param path - 字段路径或路径数组
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   *
   * @example
   * ```typescript
   * const result = await validator.validateField('email', formValues)
   * if (!result.ok) console.log(result.error.errors)
   * ```
   */
  async validateField(
    path: NamePath<T> | NamePath<T>[],
    latestValues: DeepReadonly<T>
  ): Promise<ValidateResult<T>> {
    const paths = Array.isArray(path) ? path : [path]
    let allValid = true

    for (const p of paths) {
      const result = await this.validateSingleRule(p as NamePath<T>, latestValues)
      if (!result.ok) allValid = false
    }

    return this.buildResult(allValid, latestValues)
  }

  /**
   * 校验所有已注册规则的字段。
   *
   * 校验前清空所有错误，逐个校验后返回汇总结果。
   *
   * @param latestValues - 当前表单全量值
   * @returns 校验结果
   *
   * @example
   * ```typescript
   * const result = await validator.validate(formValues)
   * if (result.ok) submit(result.values)
   * ```
   */
  async validate(latestValues: DeepReadonly<T>): Promise<ValidateResult<T>> {
    let allValid = true

    this.state.errors.clear()

    for (const path of this.state.rules.keys()) {
      const result = await this.validateSingleRule(path, latestValues)
      if (!result.ok) allValid = false
    }

    return this.buildResult(allValid, latestValues)
  }
}

/**
 * 创建 Validator 实例的工厂函数。
 *
 * @typeParam T - 表单值类型
 *
 * @returns Validator 实例
 *
 * @example
 * ```typescript
 * const validator = createValidator<FormValues>()
 * ```
 */
export function createValidator<T extends FormValues>(): Validator<T> {
  return new Validator<T>()
}

export default Validator
