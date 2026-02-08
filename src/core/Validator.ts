/**
 * Validator - 表单校验器
 *
 * 纯校验模块，无框架依赖。
 * 职责：管理校验规则（rules）和校验错误（errors）。
 *
 * @module core/Validator
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { createValidator } from './Validator'
 * import { createFormStore } from './FormStore'
 *
 * const store = createFormStore({ initialValues: { name: '', email: '' } })
 * const validator = createValidator({ store })
 *
 * // 注册校验规则
 * validator.registerRules('name', z.string().min(1, '姓名必填'))
 * validator.registerRules('email', z.string().email('邮箱格式错误'))
 *
 * // 校验单个字段
 * const isNameValid = await validator.validateField('name')
 *
 * // 校验整个表单
 * const isFormValid = await validator.validate()
 *
 * // 获取错误信息
 * validator.getFieldError('name') // => ['姓名必填']
 * validator.getErrors() // => { name: ['姓名必填'] }
 * ```
 */

import type { FormStore } from "./FormStore"
import type { ColumnConfig, DependencyColumnConfig, FormValues } from "../types"
import type { ZodType } from "zod"

/**
 * Validator 配置选项
 */
export interface ValidatorOptions<T extends FormValues> {
  /** FormStore 实例，用于获取字段值 */
  store: FormStore<T>
}

/**
 * 规则映射表类型
 */
export type RulesMap = Map<string, ZodType>

/**
 * 单个字段的校验错误
 *
 * @example
 * ```typescript
 * const error: FieldError = {
 *   field: 'email',
 *   message: ['邮箱格式错误', '邮箱已存在']
 * }
 * ```
 */
export interface FieldError {
  /** 字段路径 */
  field: string
  /** 错误信息数组 */
  message: string[]
}

/**
 * 校验错误类型
 *
 * 包含所有校验失败的字段错误和当前表单值
 *
 * @template T - 表单值类型
 *
 * @example
 * ```typescript
 * const error: ValidateError = {
 *   errors: [
 *     { field: 'name', message: ['姓名必填'] },
 *     { field: 'email', message: ['邮箱格式错误'] }
 *   ],
 *   values: { name: '', email: 'invalid' }
 * }
 * ```
 */
export interface ValidateError<T extends FormValues = FormValues> {
  /** 字段错误列表 */
  errors: FieldError[]
  /** 当前表单值 */
  values: T
}

/**
 * 校验结果类型
 *
 * 使用 Result 模式表示校验结果：
 * - 成功时返回 { ok: true, values: T }
 * - 失败时返回 { ok: false, error: ValidateError<T> }
 *
 * @template T - 表单值类型
 *
 * @example
 * ```typescript
 * const result = await validator.validate()
 * if (result.ok) {
 *   console.log('校验通过:', result.values)
 * } else {
 *   console.log('校验失败:', result.error.errors)
 * }
 * ```
 */
export type ValidateResult<T extends FormValues = FormValues> =
  | { ok: true; values: T }
  | { ok: false; error: ValidateError<T> }

/**
 * Validator 接口
 */
export interface IValidator<T extends FormValues = FormValues> {
  // 规则管理
  extractRulesFromColumns(columns: ColumnConfig[]): RulesMap
  registerRules(path: string, rules: ZodType): void
  registerRulesFromMap(rulesMap: RulesMap): void
  unregisterRules(path: string): void
  clearAllRules(): void
  syncRules(oldRules: RulesMap, newRules: RulesMap): void
  getRulesMap(): RulesMap
  getRegisteredPaths(): string[]

  // 校验执行
  validateField(path: string | string[]): Promise<ValidateResult<T>>
  validate(): Promise<ValidateResult<T>>

  // 错误管理
  getFieldError(path: string): string[] | undefined
  getErrors(): Record<string, string[]>
  setFieldError(path: string, errors: string[]): void
  clearFieldError(path: string): void
  clearAllErrors(): void
}

/**
 * 类型守卫：判断是否为依赖字段配置
 */
function isDependencyColumn(column: ColumnConfig): column is DependencyColumnConfig {
  return column.componentType === "dependency"
}

/**
 * Validator 类 - 表单校验器
 *
 * @implements {IValidator}
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 *
 * const validator = new Validator({ store })
 *
 * // 从 columns 提取规则
 * const columns = [
 *   { name: 'name', rules: z.string().min(1) },
 *   { name: 'email', rules: z.string().email() }
 * ]
 * const rules = validator.extractRulesFromColumns(columns)
 * validator.registerRulesFromMap(rules)
 *
 * // 执行校验
 * const isValid = await validator.validate()
 * if (!isValid) {
 *   console.log(validator.getErrors())
 * }
 * ```
 */
export class Validator<T extends FormValues = FormValues> implements IValidator<T> {
  /** FormStore 实例 */
  private store: FormStore<T>

  /** 校验规则映射 */
  private rulesMap: RulesMap = new Map()

  /** 校验错误映射：path -> 错误信息数组 */
  private errors: Record<string, string[]> = {}

  constructor(options: ValidatorOptions<T>) {
    this.store = options.store
  }

  // ==================== 规则提取 ====================

  /**
   * 从 columns 配置中提取校验规则
   *
   * 递归遍历 columns，提取所有字段的 rules 配置。
   *
   * @param columns - 字段配置数组
   * @returns 规则映射表
   *
   * @example
   * ```typescript
   * const columns = [
   *   { name: 'name', rules: z.string().min(1) },
   *   { name: 'profile', columns: [
   *     { name: 'age', rules: z.number().min(0) }
   *   ]}
   * ]
   * const rules = validator.extractRulesFromColumns(columns)
   * // rules: Map { 'name' => ZodString, 'profile.age' => ZodNumber }
   * ```
   */
  extractRulesFromColumns(columns: ColumnConfig[]): RulesMap {
    const rulesMap: RulesMap = new Map()
    this.extractRulesRecursive(columns, "", rulesMap)

    return rulesMap
  }

  /**
   * 递归提取规则
   * @private
   */
  private extractRulesRecursive(
    columns: ColumnConfig[],
    parentPath: string,
    rulesMap: RulesMap
  ): void {
    for (const column of columns) {
      if (isDependencyColumn(column)) continue

      const path = parentPath ? `${parentPath}.${column.name}` : column.name

      if (column.rules) {
        rulesMap.set(path, column.rules)
      }

      if (column.columns?.length) {
        this.extractRulesRecursive(column.columns, path, rulesMap)
      }
    }
  }

  // ==================== 规则管理 ====================

  /**
   * 注册单个字段的校验规则
   *
   * @param path - 字段路径
   * @param rules - Zod schema
   *
   * @example
   * ```typescript
   * validator.registerRules('email', z.string().email('邮箱格式错误'))
   * ```
   */
  registerRules(path: string, rules: ZodType): void {
    this.rulesMap.set(path, rules)
  }

  /**
   * 批量注册校验规则
   *
   * @param rulesMap - 规则映射表
   *
   * @example
   * ```typescript
   * const rules = new Map([
   *   ['name', z.string().min(1)],
   *   ['email', z.string().email()]
   * ])
   * validator.registerRulesFromMap(rules)
   * ```
   */
  registerRulesFromMap(rulesMap: RulesMap): void {
    for (const [path, rules] of rulesMap) {
      this.rulesMap.set(path, rules)
    }
  }

  /**
   * 移除字段的校验规则
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * validator.unregisterRules('email')
   * ```
   */
  unregisterRules(path: string): void {
    this.rulesMap.delete(path)
  }

  /**
   * 清除所有校验规则
   *
   * @example
   * ```typescript
   * validator.clearAllRules()
   * ```
   */
  clearAllRules(): void {
    this.rulesMap.clear()
  }

  /**
   * 同步校验规则（增量更新）
   *
   * 用于 columns 变化时，只更新变化的规则。
   *
   * @param oldRules - 旧规则映射表
   * @param newRules - 新规则映射表
   *
   * @example
   * ```typescript
   * const oldRules = validator.getRulesMap()
   * const newRules = validator.extractRulesFromColumns(newColumns)
   * validator.syncRules(oldRules, newRules)
   * ```
   */
  syncRules(oldRules: RulesMap, newRules: RulesMap): void {
    // 移除不再存在的规则
    for (const path of oldRules.keys()) {
      if (!newRules.has(path)) {
        this.unregisterRules(path)
        this.clearFieldError(path)
      }
    }

    // 添加/更新新规则
    for (const [path, rules] of newRules) {
      this.registerRules(path, rules)
    }
  }

  /**
   * 获取当前规则映射表的副本
   *
   * @returns 规则映射表副本
   *
   * @example
   * ```typescript
   * const rules = validator.getRulesMap()
   * console.log(rules.size) // 规则数量
   * ```
   */
  getRulesMap(): RulesMap {
    return new Map(this.rulesMap)
  }

  /**
   * 获取所有已注册规则的字段路径
   *
   * @returns 字段路径数组
   *
   * @example
   * ```typescript
   * validator.getRegisteredPaths() // => ['name', 'email', 'profile.age']
   * ```
   */
  getRegisteredPaths(): string[] {
    return Array.from(this.rulesMap.keys())
  }

  // ==================== 校验执行 ====================

  /**
   * 校验单个字段（内部方法）
   * @private
   */
  private async validateSingleField(path: string): Promise<boolean> {
    const schema = this.rulesMap.get(path)
    if (!schema) {
      this.clearFieldError(path)

      return true
    }

    const value = this.store.getFieldValue(path)

    try {
      const result = await schema.safeParseAsync(value)

      if (!result.success) {
        const errors = result.error.issues.map((issue) => issue.message)
        this.setFieldError(path, errors)

        return false
      }

      this.clearFieldError(path)

      return true
    } catch (error) {
      console.warn(`[Validator] 校验字段 "${path}" 时发生错误:`, error)
      this.setFieldError(path, ["校验失败"])

      return false
    }
  }

  /**
   * 校验单个或多个字段
   *
   * @param path - 字段路径或路径数组
   * @returns 校验结果，成功返回 values，失败返回 error
   *
   * @example
   * ```typescript
   * // 校验单个字段
   * const result = await validator.validateField('email')
   *
   * // 校验多个字段
   * const result = await validator.validateField(['name', 'email'])
   * ```
   */
  async validateField(path: string | string[]): Promise<ValidateResult<T>> {
    let allValid = true

    if (Array.isArray(path)) {
      for (const p of path) {
        const isValid = await this.validateSingleField(p)
        if (!isValid) {
          allValid = false
        }
      }
    } else {
      allValid = await this.validateSingleField(path)
    }

    if (allValid) {
      return { ok: true, values: this.store.getFieldsValue() }
    }

    return {
      ok: false,
      error: {
        errors: this.getFieldErrors(),
        values: this.store.getFieldsValue(),
      },
    }
  }

  /**
   * 校验整个表单
   *
   * 校验所有已注册规则的字段。
   *
   * @returns 校验结果，成功返回 values，失败返回 error
   *
   * @example
   * ```typescript
   * const result = await validator.validate()
   * if (result.ok) {
   *   // 校验通过，提交表单
   *   submitForm(result.values)
   * } else {
   *   // 校验失败，显示错误
   *   console.log(result.error.errors)
   * }
   * ```
   */
  async validate(): Promise<ValidateResult<T>> {
    this.clearAllErrors()

    let allValid = true
    for (const path of this.rulesMap.keys()) {
      const isValid = await this.validateSingleField(path)
      if (!isValid) {
        allValid = false
      }
    }

    if (allValid) {
      return { ok: true, values: this.store.getFieldsValue() }
    }

    return {
      ok: false,
      error: {
        errors: this.getFieldErrors(),
        values: this.store.getFieldsValue(),
      },
    }
  }

  // ==================== 错误管理 ====================

  /**
   * 获取所有字段错误（FieldError 数组格式）
   *
   * @returns 字段错误数组
   *
   * @example
   * ```typescript
   * validator.getFieldErrors()
   * // => [{ field: 'name', message: ['姓名必填'] }, { field: 'email', message: ['邮箱格式错误'] }]
   * ```
   */
  getFieldErrors(): FieldError[] {
    return Object.entries(this.errors).map(([field, message]) => ({
      field,
      message,
    }))
  }

  /**
   * 获取指定字段的错误信息
   *
   * @param path - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * validator.getFieldError('email') // => ['邮箱格式错误'] 或 undefined
   * ```
   */
  getFieldError(path: string): string[] | undefined {
    return this.errors[path]
  }

  /**
   * 获取所有字段的错误信息（Record 格式）
   *
   * @returns 错误信息对象，key 为字段路径，value 为错误信息数组
   *
   * @example
   * ```typescript
   * validator.getErrors()
   * // => { name: ['姓名必填'], email: ['邮箱格式错误'] }
   * ```
   */
  getErrors(): Record<string, string[]> {
    return { ...this.errors }
  }

  /**
   * 设置指定字段的错误信息
   *
   * @param path - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * validator.setFieldError('name', ['姓名不能为空', '姓名太短'])
   * ```
   */
  setFieldError(path: string, errors: string[]): void {
    this.errors[path] = errors
  }

  /**
   * 清除指定字段的错误信息
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * validator.clearFieldError('email')
   * ```
   */
  clearFieldError(path: string): void {
    delete this.errors[path]
  }

  /**
   * 清除所有字段的错误信息
   *
   * @example
   * ```typescript
   * validator.clearAllErrors()
   * ```
   */
  clearAllErrors(): void {
    this.errors = {}
  }
}

/**
 * 创建 Validator 实例的工厂函数
 *
 * @param options - 配置选项
 * @returns Validator 实例
 *
 * @example
 * ```typescript
 * const validator = createValidator({ store })
 * ```
 */
export function createValidator<T extends FormValues>(
  options: ValidatorOptions<T>
): Validator<T> {
  return new Validator(options)
}

export default Validator
