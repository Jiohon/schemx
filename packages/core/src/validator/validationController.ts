import { createFieldKey } from "../utils"

import { builtInAdapters, isValidationRule } from "./builtInAdapters"
import { createRequiredValidationRule } from "./rules"

import type { ValidationAdapter, ValidationRule, Validator } from "./types"
import type {
  ValidationRuleRegistry,
  ValidationRuleRegistryChange,
} from "../registry/validationRuleRegistry"
import type { NamePath, Values } from "../types/form"
import type { DefinedFieldValue, FieldRule, FieldRules, RequiredRule } from "../types/rule"

/** 解析后的单条原生校验规则（按字段路径推导值类型）。 */
type ResolvedValidationRule<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>

/**
 * 同步单个字段校验规则时所需的字段配置。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段路径。
 */
export interface FieldValidationConfig<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 要同步的字段路径。
   */
  readonly name: TName
  /**
   * 用于生成默认错误消息及命名规则工厂的字段标签。
   */
  readonly label: string
  /**
   * 字段的必填声明；存在时会先归一化为 required 规则。
   */
  readonly required: RequiredRule<DefinedFieldValue<TValues, TName>> | undefined
  /**
   * 额外规则声明。
   *
   * 未注册的命名规则会使同步失败，并在开发期对每个规则名仅发出一次警告。
   */
  readonly rules: FieldRules<TValues, TName> | undefined
}

/**
 * 将 Schema 字段配置归一化为 Validator 可执行规则的协调器。
 *
 * 内部持有 adapter 映射（内置 Standard Schema / 原生规则 adapter + 用户 adapter），
 * 统一解析命名规则、品牌 adapter 规则、Standard Schema 与原生规则。解析失败会写入
 * `validation_config` 问题，避免字段在配置错误时被静默视为通过。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * controller.syncField({
 *   name: "email",
 *   label: "邮箱",
 *   required: true,
 *   rules: ["email"],
 * })
 * ```
 */
export interface ValidationController<TValues extends Values> {
  /**
   * 归一化并替换一个字段的全部校验规则。
   *
   * @typeParam TName - 字段路径。
   * @param config - 已解析的字段必填和规则配置。
   * @returns 配置是否已成功解析；失败时字段会保留 `validation_config` 问题。
   *
   * @remarks
   * 未注册命名规则、无法识别对象、adapter 歧义和 adapter 非法输出都会使配置失败关闭。
   */
  syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean
  /**
   * 移除字段规则及其已有错误消息。
   *
   * @param name - 要移除的字段路径。
   */
  removeField(name: NamePath<TValues>): void
  /**
   * 取消 Registry 订阅并清除 Controller 持有的字段配置索引。
   */
  destroy(): void
}

/**
 * 创建 ValidationController 所需的协作对象。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateValidationControllerOptions<TValues extends Values> {
  /**
   * 接收归一化字段规则和错误状态操作的校验器。
   */
  readonly validator: Validator<TValues>
  /**
   * 用于解析 `rules` 中命名规则的注册中心。
   */
  readonly registry: ValidationRuleRegistry
  /**
   * 当前 Form 固定使用的校验 adapters。
   *
   * Standard Schema 与原生校验规则由内置 adapter 始终支持，无需在此注册。
   */
  readonly adapters?: readonly ValidationAdapter[]
}

class ValidationControllerImpl<
  TValues extends Values,
> implements ValidationController<TValues> {
  // 已警告的缺失命名规则，防止重复同步时刷屏。
  private readonly warnedUnknownRules = new Set<string>()
  // 已警告的无法识别字段，按稳定字段身份去重。
  private readonly warnedUnrecognizedFields = new Set<string>()
  // 内置与用户 adapter 按唯一 id 建立的只读路由表。
  private readonly adapters: ReadonlyMap<string, ValidationAdapter>
  // 供动态 Registry 变更重新解析的原始字段配置。
  private readonly configs = new Map<string, FieldValidationConfig<TValues, NamePath<TValues>>>()
  // 每个字段引用的命名规则列表。
  private readonly ruleNamesByField = new Map<string, readonly string[]>()
  // 从命名规则反查受影响字段的索引。
  private readonly fieldsByRuleName = new Map<string, Set<string>>()
  // 销毁时释放 Registry 订阅的函数。
  private readonly unsubscribeRegistry: () => void

  public constructor(
    private readonly options: CreateValidationControllerOptions<TValues>
  ) {
    this.adapters = buildAdapterMap([...builtInAdapters, ...(options.adapters ?? [])])
    this.unsubscribeRegistry = options.registry.subscribe((change) => {
      this.syncAffectedFields(change)
    })
  }

  /**
   * 归一化并替换一个字段的全部校验规则。
   *
   * @typeParam TName - 字段路径。
   * @param config - 已解析的字段必填和规则配置。
   */
  public syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean {
    // 擦除窄路径类型后保存，用于后续动态重同步。
    const storedConfig = config as FieldValidationConfig<TValues, NamePath<TValues>>
    this.trackConfig(storedConfig)

    try {
      // 在替换 Validator 规则前完成全量解析，避免部分规则泄漏。
      const rules = this.normalizeRules(config)
      this.options.validator.clearFieldConfigurationIssues(config.name)

      if (rules.length === 0) {
        this.options.validator.setFieldRules(config.name, [])

        return true
      }

      this.options.validator.setFieldRules(config.name, rules)

      return true
    } catch (error) {
      this.options.validator.setFieldRules(config.name, [])
      this.options.validator.setFieldConfigurationIssues(config.name, [
        {
          message: "字段校验配置错误",
          code: "validation_config",
          cause: error,
        },
      ])

      return false
    }
  }

  /**
   * 移除字段规则及其已有错误消息。
   *
   * @param name - 要移除的字段路径。
   */
  public removeField(name: NamePath<TValues>): void {
    this.untrackConfig(name)
    this.options.validator.removeFieldRules(name)
  }

  /**
   * 取消动态 Registry 订阅并释放所有字段反向索引。
   */
  public destroy(): void {
    this.unsubscribeRegistry()
    this.configs.clear()
    this.ruleNamesByField.clear()
    this.fieldsByRuleName.clear()
  }

  private normalizeRules<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // required 规则与额外规则合并后的执行列表。
    const normalized: ResolvedValidationRule<TValues, TName>[] = []

    if (config.required) {
      normalized.push(
        createRequiredValidationRule<
          DefinedFieldValue<TValues, TName>,
          TValues,
          TName
        >({
          required: config.required,
          label: config.label,
        })
      )
    }

    for (const rule of toRuleArray(config.rules)) {
      const resolved = this.resolveRule(rule, config)
      if (resolved) normalized.push(...resolved)
    }

    return normalized
  }

  private resolveRule<TName extends NamePath<TValues>>(
    rule: FieldRule<TValues, TName>,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] | undefined {
    if (typeof rule === "string") return this.resolveNamedRule(rule, config)

    return this.resolveObjectRule(rule, config)
  }

  private resolveNamedRule<TName extends NamePath<TValues>>(
    name: string,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] | undefined {
    // 使用字段元数据延迟解析命名规则工厂。
    const rule = this.options.registry.resolve(name, {
      name: config.name,
      label: config.label,
      required: Boolean(config.required),
    })
    if (!rule) {
      this.warnUnknownRule(name)
      throw new Error(`未找到名为 "${name}" 的校验规则`)
    }

    // 注册表解析结果可能是 Standard Schema 或原生规则，统一交由内置 adapter 识别。
    return this.resolveObjectRule(rule, config)
  }

  private resolveObjectRule<TName extends NamePath<TValues>>(
    rule: object,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] | undefined {
    // 每条对象规则必须恰好命中一个 adapter。
    const adapter = this.findAdapterForRule(rule)
    if (adapter) return this.resolveAdapterRule(adapter, rule, config)

    this.warnUnrecognizedObjectRule(config.name)
    throw new Error(`字段 "${String(config.name)}" 存在无法识别的校验规则`)
  }

  private findAdapterForRule(rule: unknown): ValidationAdapter | undefined {
    // 收集全部命中的 adapter，以便拒绝歧义匹配。
    const matched: ValidationAdapter[] = []
    for (const adapter of this.adapters.values()) {
      if (adapter.isRule(rule)) matched.push(adapter)
    }

    if (matched.length > 1) {
      throw new Error(
        `校验规则同时匹配多个 adapter: ${matched.map((adapter) => adapter.id).join(", ")}`
      )
    }

    return matched[0]
  }

  private resolveAdapterRule<TName extends NamePath<TValues>>(
    adapter: ValidationAdapter,
    rule: unknown,
    config: FieldValidationConfig<TValues, TName>
  ): readonly ResolvedValidationRule<TValues, TName>[] {
    // adapter 输出仍需做运行时形状校验，不能信任第三方实现。
    const resolved = adapter.resolve(rule as never, config)
    if (
      !Array.isArray(resolved) ||
      resolved.length === 0 ||
      resolved.some((item) => !isValidationRule(item))
    ) {
      throw new Error(
        `字段 "${String(config.name)}" 的 adapter "${adapter.id}" 返回了非法原生校验规则`
      )
    }

    return resolved as readonly ResolvedValidationRule<TValues, TName>[]
  }

  private warnUnknownRule(name: string): void {
    if (this.warnedUnknownRules.has(name)) return

    this.warnedUnknownRules.add(name)
    console.warn(`[schemx] 未找到名为 "${name}" 的校验规则`)
  }

  private warnUnrecognizedObjectRule(name: NamePath<TValues>): void {
    // 仅用于警告去重的展示路径。
    const key = String(name)
    if (this.warnedUnrecognizedFields.has(key)) return

    this.warnedUnrecognizedFields.add(key)
    console.warn(`[schemx] 字段 "${key}" 存在无法识别的校验规则，已跳过`)
  }

  /**
   * 记录字段配置及其引用的命名规则，供 Registry 变更精确重同步。
   */
  private trackConfig(config: FieldValidationConfig<TValues, NamePath<TValues>>): void {
    this.untrackConfig(config.name)

    // 反向索引使用与 Validator 一致的稳定字段身份。
    const key = createFieldKey(config.name)
    // 只有字符串规则名会受 Registry 事件影响。
    const ruleNames = toRuleArray(config.rules).filter(
      (rule): rule is string => typeof rule === "string"
    )

    this.configs.set(key, config)
    this.ruleNamesByField.set(key, ruleNames)

    for (const ruleName of ruleNames) {
      // 同名规则可被多个字段引用。
      const fields = this.fieldsByRuleName.get(ruleName) ?? new Set<string>()
      fields.add(key)
      this.fieldsByRuleName.set(ruleName, fields)
    }
  }

  /**
   * 移除字段配置及其所有命名规则反向索引。
   */
  private untrackConfig(name: NamePath<TValues>): void {
    // 根据稳定身份找到字段此前注册的规则名。
    const key = createFieldKey(name)
    // 删除所有指向该字段的反向索引。
    const ruleNames = this.ruleNamesByField.get(key) ?? []

    for (const ruleName of ruleNames) {
      // 规则名对应的受影响字段集合。
      const fields = this.fieldsByRuleName.get(ruleName)
      if (!fields) continue
      fields.delete(key)
      if (fields.size === 0) this.fieldsByRuleName.delete(ruleName)
    }

    this.ruleNamesByField.delete(key)
    this.configs.delete(key)
  }

  /**
   * 根据 Registry 变更仅重新同步引用受影响规则名的字段。
   */
  private syncAffectedFields(change: ValidationRuleRegistryChange): void {
    // 由变更规则名收集的去重字段集合。
    const affected = new Set<string>()
    for (const name of change.names) {
      for (const key of this.fieldsByRuleName.get(name) ?? []) affected.add(key)
    }

    for (const key of affected) {
      // 字段仍存在时才基于最新 Registry 重新解析。
      const config = this.configs.get(key)
      if (config) this.syncField(config)
    }
  }
}

/**
 * 将字段规则声明统一为数组，供顺序归一化使用。
 */
function toRuleArray<TValues extends Values, TName extends NamePath<TValues>>(
  rules: FieldRules<TValues, TName> | undefined
): readonly FieldRule<TValues, TName>[] {
  if (!rules) return []

  return (Array.isArray(rules) ? rules : [rules]) as readonly FieldRule<TValues, TName>[]
}

/**
 * 按唯一 id 建立 adapter 路由表。
 */
function buildAdapterMap(
  adapters: readonly ValidationAdapter[]
): ReadonlyMap<string, ValidationAdapter> {
  // 最终供规则匹配使用的 adapter 映射。
  const map = new Map<string, ValidationAdapter>()

  for (const adapter of adapters) {
    // adapter id 同时是唯一性约束和诊断名称。
    const id = getAdapterId(adapter)
    if (map.has(id)) throw new Error(`重复的校验 adapter id "${id}"`)
    map.set(id, adapter)
  }

  return map
}

/**
 * 验证并返回 adapter 的可用标识。
 */
function getAdapterId(adapter: ValidationAdapter): string {
  // 容错读取第三方 adapter 的 id，随后统一验证。
  const id = (adapter as { id?: unknown } | null)?.id
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("校验 adapter id 必须为非空字符串")
  }

  return id
}

/**
 * 创建字段校验配置控制器。
 *
 * 控制器将 `required`、命名规则、原生规则、Standard Schema 和 adapter 规则统一为
 * Validator 的原生规则；内置 adapter 始终处理 Standard Schema 与原生规则，用户 adapter
 * 在创建时与内置 adapter 一起去重固化。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Validator、命名规则注册中心与用户 adapters。
 * @returns 用于同步或移除字段校验配置的控制器。
 *
 * @example
 * ```ts
 * const controller = createValidationController({ validator, registry })
 * controller.syncField({ name: "email", label: "邮箱", required: true, rules: "email" })
 * ```
 */
export function createValidationController<TValues extends Values = Values>(
  options: CreateValidationControllerOptions<TValues>
): ValidationController<TValues> {
  return new ValidationControllerImpl(options)
}
