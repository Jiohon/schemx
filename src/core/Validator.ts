/**
 * 表单校验器。
 *
 * 管理校验规则（rules）和校验错误（errors），基于 Zod schema 进行字段校验。
 * 使用 Vue reactive 保持错误状态的响应式。
 *
 * @module core/validator
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { createValidator } from './Validator'
 *
 * const validator = createValidator()
 *
 * // 从 columns 提取并注册规则
 * validator.registerRulesFromColumns(columns)
 *
 * // 校验单个字段
 * const result = await validator.validateField('email', latestValues)
 *
 * // 校验整个表单
 * const result = await validator.validate(latestValues)
 * ```
 */

import { reactive } from "vue"
import type { DeepReadonly, Reactive } from "vue"

import { z, type ZodType } from "zod"

import { isDependencyColumn, isGroupColumn, isNestedColumn } from "@/utils"

import { getByPath } from "../utils/path"

import type { FormValues, NamePath, SchemaColumn, Value } from "../types"

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

/** 规则映射表 */
export type RulesMap<T extends FormValues> = Map<NamePath<T>, ZodType>

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
 * 基于 Zod schema 进行字段校验，支持同步和异步规则。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 *
 * @example
 * ```typescript
 * const validator = new Validator<FormValues>()
 * validator.registerRule('email', z.string().email())
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
   * @param path - 字段路径
   * @param rule - Zod schema 规则
   *
   * @example
   * ```typescript
   * validator.registerRule('email', z.string().email())
   * ```
   */
  public registerRule(path: NamePath<T>, rule: ZodType): void {
    this.state.rules.set(path, rule)
  }

  /**
   * 注销单个字段的校验规则，同时清除该字段的错误信息。
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * validator.unregisterRule('email')
   * ```
   */
  public unregisterRule(path: NamePath<T>): void {
    this.state.rules.delete(path)
    this.state.errors.delete(path)
  }

  /**
   * 从 columns 配置中递归提取并注册所有校验规则。
   *
   * @param columns - 表单列配置数组
   *
   * @example
   * ```typescript
   * validator.registerRulesFromColumns(schemaColumns)
   * ```
   */
  public registerRulesFromColumns(columns: SchemaColumn<T>[]): void {
    this.extractRules(columns, "")
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
      const valid = await this.validateOne(p as NamePath<T>, latestValues)
      if (!valid) allValid = false
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
    this.state.errors.clear()

    let allValid = true
    for (const path of this.state.rules.keys()) {
      const valid = await this.validateOne(path, latestValues)
      if (!valid) allValid = false
    }

    return this.buildResult(allValid, latestValues)
  }

  /**
   * 递归遍历 columns 提取规则（内部）。
   *
   * 跳过 dependency 类型，递归处理 group/nested 类型的子列。
   *
   * @param columns - 表单列配置数组
   * @param parentPath - 父级路径前缀
   */
  private extractRules(columns: SchemaColumn<T>[], parentPath: string): void {
    for (const column of columns) {
      if (isDependencyColumn(column)) continue

      if (isGroupColumn(column) || isNestedColumn(column)) {
        this.extractRules(column.columns, "")
        continue
      }

      const path = parentPath ? `${parentPath}.${column.name}` : column.name

      let rules = column?.rules

      if (column?.required || column?.rules === "required") {
        rules = z
          .string({ message: "此字段为必填项" })
          .min(1, { message: "此字段为必填项" })
      } else {
        rules = column?.rules
      }

      if (rules) this.state.rules.set(path as NamePath<T>, rules)
    }
  }

  /**
   * 校验单个字段
   *
   * 通过 getByPath 从 latestValues 中取值，使用 Zod safeParseAsync 进行校验。
   * 校验失败时将错误信息写入 state.errors，成功时清除对应错误。
   *
   * @param path - 字段路径
   * @param latestValues - 当前表单全量值
   * @returns 校验是否通过
   */
  private async validateOne(
    path: NamePath<T>,
    latestValues: DeepReadonly<T>
  ): Promise<boolean> {
    const schema = this.state.rules.get(path)
    if (!schema) {
      this.state.errors.delete(path)

      return true
    }

    const value: Value = getByPath(latestValues, path as string)

    try {
      const result = await schema.safeParseAsync(value)

      if (!result.success) {
        this.state.errors.set(
          path,
          result.error.issues.map((issue) => issue.message)
        )

        return false
      }

      this.state.errors.delete(path)

      return true
    } catch (error) {
      console.warn(`[Validator] 校验字段 "${String(path)}" 时发生错误:`, error)
      this.state.errors.set(path, ["校验失败"])

      return false
    }
  }

  /**
   * 根据校验结果构建 ValidateResult 返回值
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
  return new Validator()
}

export default Validator
