import { createRuleIdentity } from "./internal/identity"

import type {
  AdapterRule,
  DefinedFieldValue,
  NamePath,
  ValidationAdapter,
  ValidationRule,
  ValidationRuleIssue,
  Values,
} from "@schemx/core"

/**
 * Zod `safeParse` 结果中的单条失败信息。
 *
 * 该结构只使用 Zod 3 和 Zod 4 均公开提供的字段。
 */
export interface ZodIssue {
  /**
   * Zod 生成的可展示错误消息。
   */
  readonly message: string
  /**
   * Zod 用于区分失败类型的错误代码。
   */
  readonly code?: string
  /**
   * Zod 指向失败值位置的路径。
   */
  readonly path?: readonly PropertyKey[]
}

/**
 * Zod 3 和 Zod 4 共同公开的可安全解析 schema 结构。
 *
 * @typeParam TInput - Schema 接收的输入值类型。
 */
export interface ZodSchema<TInput = unknown> {
  /**
   * 异步安全解析输入值。
   *
   * @param input - 待校验的值。
   * @returns Zod 的异步解析结果。
   */
  safeParseAsync?: (input: TInput) => Promise<ZodSafeParseResult>
  /**
   * 同步安全解析输入值。
   *
   * @param input - 待校验的值。
   * @returns Zod 的同步解析结果。
   */
  safeParse?: (input: TInput) => ZodSafeParseResult
}

/**
 * Zod 安全解析的成功或失败结果。
 */
export type ZodSafeParseResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: { readonly issues: readonly ZodIssue[] } }

/**
 * 单条 Zod issue 到 Schemx 原生 issue 的映射函数。
 *
 * @param issue - Zod 报告的原始失败信息。
 * @returns 供 Schemx Validator 聚合的失败信息。
 */
export type ZodIssueMapper = (issue: ZodIssue) => ValidationRuleIssue

/**
 * 包装 Zod schema 时的可选行为。
 */
export interface ZodRuleOptions {
  /**
   * 将每条 Zod issue 转换为应用需要的消息、代码或附加原因。
   *
   * 未设置时保留 Zod 的 `message`，并在存在时保留其 `code`。
   */
  readonly mapIssue?: ZodIssueMapper
}

/**
 * 供 Zod adapter 执行的规则输入。
 *
 * `rule()` 会将 schema 与选项组合为此对象，并将其作为品牌规则的 `payload` 保存。
 */
export interface ZodRuleInput {
  /**
   * 要执行的 Zod 3 或 Zod 4 schema。
   */
  readonly schema: ZodSchema
  /**
   * 当前规则的 issue 映射配置。
   */
  readonly options?: ZodRuleOptions
}

/**
 * 可供 Core 调用的 Zod 校验 adapter。
 *
 * Core 通过 `resolve()` 把品牌规则解析为原生 `ValidationRule[]`，
 * 再由 Validator 执行；adapter 自身不直接返回校验结果。
 */
export interface ZodValidationAdapter {
  /**
   * 此 adapter 的稳定标识。
   */
  readonly id: "zod"
  /**
   * 将 Zod schema 包装为仅当前 adapter 实例可识别的品牌规则。
   *
   * @param schema - 要执行的 Zod 3 或 Zod 4 schema。
   * @param options - 当前规则的 issue 映射配置。
   * @returns 可放入 Schemx 字段 `rules` 的品牌规则。
   */
  rule(schema: ZodSchema, options?: ZodRuleOptions): AdapterRule
  /**
   * 判断值是否由当前 adapter 实例创建。
   *
   * @param value - 待判断的规则声明。
   * @returns 值是否带有当前实例的私有规则品牌。
   */
  isRule(value: unknown): value is AdapterRule
  /**
   * 把 Zod 品牌规则解析为原生校验规则。
   *
   * 直接复用 Core `ValidationAdapter<ZodRuleInput>` 的 `resolve` 签名，
   * 与 Core 契约完全一致，无需在本包重复声明 `FieldValidationConfig`。
   *
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 当前字段路径。
   * @param rule - 由当前 adapter `rule()` 创建的品牌规则。
   * @param context - 当前字段的校验配置。
   * @returns 单条原生校验规则，由 Validator 执行 safeParse 并映射 issue。
   */
  resolve: ValidationAdapter<ZodRuleInput>["resolve"]
}

/**
 * 创建 Zod 3/4 校验规则 adapter。
 *
 * 每次调用都会创建独立的规则品牌；一个 adapter 创建的规则不能由另一个实例解析。
 *
 * @returns 可注册到 Schemx Form 的 Zod adapter。
 *
 * @example
 * ```ts
 * import { z } from "zod"
 * import { createZodAdapter } from "@schemx/validator/zod"
 *
 * const zod = createZodAdapter()
 * const emailRule = zod.rule(z.string().email("邮箱格式不正确"))
 * ```
 */
export function createZodAdapter(): ZodValidationAdapter {
  const identity = createRuleIdentity<ZodRuleInput>("zod")

  const rule = (schema: ZodSchema, options?: ZodRuleOptions): AdapterRule =>
    identity.create(Object.freeze({ schema, options }))

  const isRule = identity.isRule

  const resolve: ZodValidationAdapter["resolve"] = <
    TValues extends Values,
    TName extends NamePath<TValues>,
  >(
    input: AdapterRule | ZodRuleInput
  ) => [createZodValidationRule<TValues, TName>(identity.extract(input, assertRuleInput))]

  return { id: "zod", rule, isRule, resolve }
}

/**
 * 将 Zod 规则输入包装为原生校验规则。
 *
 * 规则执行时优先 `safeParseAsync`，并在开始与异步解析后检查取消信号，
 * 避免返回陈旧结果；失败时按 `mapIssue` 或默认映射产出 issue。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径。
 * @param ruleInput - 已校验的 Zod 规则输入。
 * @returns 供 Validator 执行的原生校验规则。
 */
function createZodValidationRule<TValues extends Values, TName extends NamePath<TValues>>(
  ruleInput: ZodRuleInput
): ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName> {
  return {
    async validate(value, context) {
      // 校验已被新一轮校验或销毁中止：返回成功以避免写入陈旧错误。
      if (context.signal.aborted) return { valid: true }

      const result = await safeParse(ruleInput.schema, value)
      // 异步解析期间可能被中止，再次检查以丢弃过时结果。
      if (context.signal.aborted) return { valid: true }

      if (result.success) return { valid: true }

      return {
        valid: false,
        issues: result.error.issues.map(
          (issue) => ruleInput.options?.mapIssue?.(issue) ?? toValidationIssue(issue)
        ),
      }
    },
  }
}

/**
 * 将单条 Zod issue 转换为 Schemx 原生 issue。
 *
 * Zod issue 的 `code` 可选；存在时一并保留，便于调用方按错误代码分类处理。
 */
function toValidationIssue(issue: ZodIssue): ValidationRuleIssue {
  return issue.code === undefined
    ? { message: issue.message }
    : { message: issue.message, code: issue.code }
}

/**
 * 校验品牌规则 payload 是否包含可执行的 Zod schema。
 */
function assertRuleInput(value: unknown): asserts value is ZodRuleInput {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schema" in value) ||
    typeof (value as ZodRuleInput).schema !== "object" ||
    (value as ZodRuleInput).schema === null
  ) {
    throw new TypeError("Zod 规则输入必须包含 schema")
  }
}

/**
 * 调用 Zod schema 的安全解析方法。
 *
 * 优先使用 `safeParseAsync` 以支持异步 refine；回退到 `safeParse` 兼容仅提供同步解析的包装器。
 */
async function safeParse(schema: ZodSchema, value: unknown): Promise<ZodSafeParseResult> {
  // 两个主版本都公开 safeParseAsync；保留 safeParse 回退以支持兼容 schema 包装器。
  if (typeof schema.safeParseAsync === "function") {
    return schema.safeParseAsync(value)
  }

  if (typeof schema.safeParse === "function") return schema.safeParse(value)

  throw new TypeError("Zod schema 必须提供 safeParseAsync() 或 safeParse()")
}
