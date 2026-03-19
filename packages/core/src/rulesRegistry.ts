/**
 * Rule 校验注册中心。
 *
 * 管理自定义 rule 名称到 StandardSchemaV1 实例的全局映射。
 * 用户通过 `register` 注册自定义 rule 后，
 * FormItem 解析 `rules` 字段时遇到字符串会从此注册中心查找对应的 schema。
 *
 * @module core/rulesRegistry
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

import { FormValues, SchemaBaseField } from "@/types"

import { createStrictSingleton } from "./utils/single"

import type { StandardSchemaV1 } from "./types/standardSchema"

/**
 * Rule 工厂函数类型。
 *
 * 接收 label 参数，返回 StandardSchemaV1 实例。
 * 用于内置规则等需要运行时上下文才能生成 rule 的场景。
 */
export type RuleFactory<T extends FormValues = FormValues> = (
  rule?: SchemaBaseField<T>
) => StandardSchemaV1

/**
 * Rule 注册条目类型。
 *
 * 支持直接的 StandardSchemaV1 实例或工厂函数。
 */
export type RuleEntry<T extends FormValues = FormValues> =
  | StandardSchemaV1
  | RuleFactory<T>

/** Rule 注册选项 */
export interface RuleRegistryOptions {
  /** 是否覆盖已存在的同名 rule */
  override?: boolean
}

/** Rule 映射类型（实例或工厂） */
export type RuleEntryMap<T extends FormValues = FormValues> = Record<string, RuleEntry<T>>

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
 * const rule = rulesRegistry.resolve('required', '用户名')
 * ```
 */
export class RulesRegistry<T extends FormValues = FormValues> {
  /** Rule 存储 */
  private rules: Map<string, RuleEntry<T>>

  /** 父级注册中心，用于链式查找 */
  private parent: RulesRegistry | null

  /**
   * 创建 RulesRegistry 实例。
   *
   * 支持可选的父级注册中心，查找时先查本地，再委托父级。
   * 用于实现全局规则继承 + 局部规则覆盖。
   *
   * @param parent - 父级注册中心，未找到本地 rule 时委托查找
   */
  constructor(parent?: RulesRegistry) {
    this.rules = new Map()
    this.parent = parent ?? null
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
  register(name: string, rule: RuleEntry<T>, options?: RuleRegistryOptions): void {
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
  registerAll(rules: RuleEntryMap<T>): void {
    Object.entries(rules).forEach(([name, rule]) => {
      this.rules.set(name, rule)
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
  getRule(name: string): RuleEntry<T> | undefined {
    return (
      this.rules.get(name) ?? (this.parent?.getRule(name) as RuleEntry<T> | undefined)
    )
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
   * rulesRegistry.resolve('phone', '手机号') // => phoneRule
   *
   * // 工厂函数会被调用
   * rulesRegistry.resolve('required', '用户名') // => createRequiredRule('用户名')
   * ```
   */
  resolve(name: string, rule?: SchemaBaseField<T>): StandardSchemaV1 | undefined {
    const entry = this.rules.get(name)

    if (entry) {
      return typeof entry === "function" ? entry(rule) : entry
    }

    return this.parent?.resolve(name, rule as SchemaBaseField)
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
  hasRule(name: string): boolean {
    return this.rules.has(name) || (this.parent?.hasRule(name) ?? false)
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
  unregister(name: string): boolean {
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
  getNames(): string[] {
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
 * 默认以全局 {@link rulesRegistry} 作为父级，
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
export function createLocalRuleRegistry<T extends FormValues = FormValues>(
  parent?: RulesRegistry
): RulesRegistry<T> {
  return new RulesRegistry<T>(parent)
}

/**
 * 全局 rule 注册中心的严格单例实例。
 *
 * @example
 * ```typescript
 * import { rulesRegistry } from ''
 *
 * rulesRegistry.register('phone', phoneRule)
 * const rule = rulesRegistry.getRule('phone')
 * ```
 */
export const rulesRegistry = createStrictSingleton(
  () => new RulesRegistry()
).getInstance()

/**
 * 定义并注册单个校验规则。
 *
 * 将 rule 或工厂函数注册到全局 {@link rulesRegistry} 并返回原值，
 * 方便在注册的同时保留引用以供直接使用。
 *
 * @param name - rule 名称
 * @param rule - StandardSchemaV1 实例或工厂函数
 *
 * @returns 传入的 rule 或工厂函数
 *
 * @example
 * ```typescript
 * import { defineRule } from '@schemx/core'
 * import { z } from 'zod'
 *
 * // 注册固定 rule
 * const phoneRule = defineRule('phone', z.string().regex(/^1\d{10}$/))
 *
 * // 注册工厂函数
 * const requiredFactory = defineRule('required', (label) => createRequiredRule(label))
 * ```
 */
export function defineRule<T extends RuleEntry>(name: string, rule: T): T {
  rulesRegistry.register(name, rule)

  return rule
}

/**
 * 批量定义并注册校验规则。
 *
 * 将映射对象中的所有 rule/工厂注册到全局 {@link rulesRegistry} 并返回原映射，
 * 适合在项目入口集中声明所有自定义校验规则。
 *
 * @param rules - 名称到 rule/工厂的映射对象
 *
 * @returns 传入的映射对象
 *
 * @example
 * ```typescript
 * import { defineRules } from '@schemx/core'
 * import { z } from 'zod'
 *
 * const rules = defineRules({
 *   phone: z.string().regex(/^1\d{10}$/),
 *   required: (label) => createRequiredRule(label),
 * })
 * ```
 */
export function defineRules<T extends RuleEntryMap>(rules: T): T {
  rulesRegistry.registerAll(rules)

  return rules
}

export default RulesRegistry
