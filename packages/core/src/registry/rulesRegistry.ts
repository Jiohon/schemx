/**
 * Rule 校验注册中心。
 *
 * 管理自定义 rule 名称到 StandardSchemaV1 实例的全局映射。
 * 用户通过 `register` 注册自定义 rule 后，
 * FormItem 解析 `rules` 字段时遇到字符串会从此注册中心查找对应的 schema。
 *
 * @module core/registry/rulesRegistry
 *
 * @example
 * ```typescript
 * import { rulesRegistry } from '@schemx/core'
 * import { z } from 'zod'
 *
 * // 注册自定义 rule
 * rulesRegistry.register('phone', z.string().regex(/^1\d{10}$/))
 * rulesRegistry.register('email', z.string().email())
 *
 * // 在 rule 中使用名称
 * const rules = [
 *   { name: 'phone', componentType: 'input', rules: 'phone' },
 *   { name: 'email', componentType: 'input', rules: 'email' },
 * ]
 * ```
 */

import { SchemxRuleKey } from "@/types/rule"

import { SchemxBaseField, Values } from "../types"

import type { StandardSchemaV1 } from "../types"

/**
 * Rule 工厂函数类型。
 *
 * 接收 label 参数，返回 StandardSchemaV1 实例。
 * 用于内置规则等需要运行时上下文才能生成 rule 的场景。
 */
export type RuleFactory<TValues extends Values = Values> = (
  schema?: SchemxBaseField<TValues>
) => StandardSchemaV1

/**
 * Rule 注册条目类型。
 *
 * 支持直接的 StandardSchemaV1 实例或工厂函数。
 */
export type RuleEntry<TValues extends Values = Values> =
  | StandardSchemaV1
  | RuleFactory<TValues>

/** Rule 注册选项 */
export interface RuleRegistryOptions {
  /** 是否覆盖已存在的同名 rule */
  override?: boolean
}

/** Rule 映射类型（实例或工厂） */
export type RuleEntryMap<TValues extends Values = Values> = Record<
  SchemxRuleKey,
  RuleEntry<TValues>
>

/**
 * Rule 校验注册中心。
 *
 * 将 rule 名称映射到 StandardSchemaV1 实例或工厂函数。
 * 工厂函数接收 label 参数，用于生成带上下文提示信息的 schema。
 * 与 {@link RendererRegistry}（渲染器注册中心）同构设计。
 *
 * @example
 * ```typescript
 * const rulesRegistry = new RulesRegistry()
 *
 * // 注册固定 rule
 * rulesRegistry.register('phone', phoneRule)
 *
 * // 注册工厂函数（需要 label 上下文）
 * rulesRegistry.register('required', (label) => createRequiredRule(label))
 *
 * // 解析 schema（工厂会自动调用）
 * const rule = rulesRegistry.resolveRuleBySchema('required', '用户名')
 * ```
 */
export class RulesRegistry<TValues extends Values = Values> {
  /** Rule 存储 */
  private rules: Map<SchemxRuleKey, RuleEntry<TValues>>

  /**
   * 创建 RulesRegistry 实例。
   *
   * 支持可选的父级注册中心，查找时先查本地，再委托父级。
   * 用于实现全局规则继承 + 局部规则覆盖。
   *
   * @param parent - 父级注册中心，未找到本地 rule 时委托查找
   */
  constructor() {
    this.rules = new Map()
  }

  /**
   * 注册校验规则。
   *
   * 支持 StandardSchemaV1 实例或工厂函数。
   * 默认覆盖已存在的同名规则，可通过 `options.override` 控制。
   *
   * @param name - rule 名称
   * @param rule - StandardSchemaV1 实例或工厂函数
   * @param options - 注册选项
   *
   * @example
   * ```typescript
   * // 注册固定 rule
   * rulesRegistry.register('phone', phoneRule)
   *
   * // 注册工厂函数
   * rulesRegistry.register('required', (label) => createRequiredRule(label))
   * ```
   */
  register(
    name: SchemxRuleKey,
    rule: RuleEntry<TValues>,
    options?: RuleRegistryOptions
  ): void {
    if (this.rules.has(name) && options?.override === false) {
      console.warn(`[RulesRegistry] Rule "${name}" 已存在，跳过注册`)

      return
    }

    this.rules.set(name, rule)
  }

  /**
   * 批量注册校验规则。
   *
   * 遍历映射对象逐个注册，已存在的同名规则会被直接覆盖。
   *
   * @param rules - 名称到 rule/工厂的映射对象
   *
   * @example
   * ```typescript
   * rulesRegistry.registerAll({
   *   phone: phoneRule,
   *   required: (label) => createRequiredRule(label),
   * })
   * ```
   */
  registerAll(rules: RuleEntryMap<TValues>): void {
    Object.entries(rules).forEach(([name, rule]) => {
      this.rules.set(name as SchemxRuleKey, rule)
    })
  }

  /**
   * 获取指定名称的原始注册条目。
   *
   * 返回 StandardSchemaV1 实例或工厂函数，不做解析。
   * 如需自动解析工厂，请使用 {@link resolve}。
   *
   * @param name - rule 名称
   * @returns 对应的注册条目，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const entry = rulesRegistry.getRule('phone')
   * ```
   */
  getRule(name: SchemxRuleKey): RuleEntry<TValues> | undefined {
    return this.rules.get(name)
  }

  /**
   * 解析指定名称的校验规则。
   *
   * 如果注册的是工厂函数，传入 label 调用后返回 StandardSchemaV1 实例；
   * 如果注册的是固定实例，直接返回。
   *
   * @param name - rule 名称
   * @param label - 字段标签，传递给工厂函数生成上下文相关的错误提示
   * @returns 解析后的 StandardSchemaV1 实例，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * // 固定 rule 直接返回
   * rulesRegistry.resolveRuleBySchema('phone', { label :'手机号', ComponentType: 'input', ... }) // => phoneRule
   *
   * // 工厂函数会被调用
   * rulesRegistry.resolveRuleBySchema('required', {  label :'用户名', ComponentType: 'input', ... }) // => createRequiredRule('用户名')
   * ```
   */
  resolveRuleBySchema(schema: SchemxBaseField<TValues>): StandardSchemaV1[] {
    const rules = schema?.rules ?? []

    const ruleList = Array.isArray(rules) ? rules : [rules]

    const resolved: StandardSchemaV1[] = []

    for (const rule of ruleList) {
      if (typeof rule === "string") {
        if (this.rules.has(rule)) {
          const entry = this.rules.get(rule)

          if (entry) {
            resolved.push(typeof entry === "function" ? entry(schema) : entry)
          }
        } else {
          console.warn(`[schemx] 未找到名为 "${rule}" 的校验规则`)
        }
      } else {
        if (rule) resolved.push(rule)
      }
    }

    return resolved
  }

  /**
   * 检查 rule 是否已注册。
   *
   * @param name - rule 名称
   * @returns 是否存在
   *
   * @example
   * ```typescript
   * rulesRegistry.hasRule('phone')   // => true
   * rulesRegistry.hasRule('custom')  // => false
   * ```
   */
  hasRule(name: SchemxRuleKey): boolean {
    return this.rules.has(name)
  }

  /**
   * 移除校验规则。
   *
   * @param name - rule 名称
   * @returns 是否成功移除
   *
   * @example
   * ```typescript
   * rulesRegistry.unregister('phone') // => true
   * ```
   */
  unregister(name: SchemxRuleKey): boolean {
    return this.rules.delete(name)
  }

  /**
   * 获取所有已注册的 rule 名称。
   *
   * @returns rule 名称数组
   *
   * @example
   * ```typescript
   * rulesRegistry.getNames() // => ['phone', 'email', 'idCard']
   * ```
   */
  getNames(): SchemxRuleKey[] {
    return Array.from(this.rules.keys())
  }

  /**
   * 清除所有已注册的规则。
   *
   * @example
   * ```typescript
   * rulesRegistry.clear()
   * rulesRegistry.size() // => 0
   * ```
   */
  clear(): void {
    this.rules.clear()
  }

  /**
   * 获取已注册 rule 数量。
   *
   * @returns rule 数量
   *
   * @example
   * ```typescript
   * rulesRegistry.size() // => 3
   * ```
   */
  size(): number {
    return this.rules.size
  }
}

/**
 * 创建局部 rule 注册中心实例。
 *
 * 默认以全局 {@link globalRulesRegistry} 作为父级，
 * 查找时先查局部注册的规则，未命中则委托全局实例。
 *
 * @param parent - 父级注册中心，默认为全局单例
 *
 * @returns 带父级链的 RulesRegistry 实例
 *
 * @remarks
 * 用于 useForm 内部创建表单级别的注册中心实例，
 * 既能继承全局自定义规则，又能支持表单级别的规则覆盖。
 */
export function createRulesRegistry<
  TValues extends Values = Values,
>(): RulesRegistry<TValues> {
  return new RulesRegistry<TValues>()
}

export default RulesRegistry
