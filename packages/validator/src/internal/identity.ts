import type { AdapterRule } from "@schemx/core"

/**
 * 结构性判断值是否形似 adapter 规则。
 *
 * 仅用于分辨"形似 adapter 规则的外来对象"与"裸输入"，不能作为来源证明；
 * 真正的来源校验由 {@link RuleIdentity} 的 WeakSet 完成。
 */
function isAdapterRuleLike(value: unknown): value is AdapterRule {
  return (
    typeof value === "object" &&
    value !== null &&
    "adapterId" in value &&
    "payload" in value
  )
}

/**
 * adapter 实例私有的规则身份。
 *
 * 把"创建带身份的规则 / 识别本实例规则 / 从带身份的规则或裸输入中抽取 payload"
 * 三类脚手架收敛到一处，供 zod、async-validator 等 adapter 共用，避免各 adapter 重复实现。
 *
 * @typeParam TPayload - 带身份规则承载的 payload 类型，同时也是裸输入的类型。
 */
export interface RuleIdentity<TPayload> {
  /**
   * 将 payload 包成带本实例身份的规则（冻结外层）。
   *
   * 内层 payload 是否冻结由调用方决定：调用方可传入已冻结的对象，
   * 也可保留用户原始对象的不变性。
   */
  create(payload: TPayload): AdapterRule
  /**
   * 判断值是否由本实例 `create()` 产生。
   */
  isRule(value: unknown): value is AdapterRule
  /**
   * 从带身份的规则或裸输入中取出 payload。
   *
   * - 本实例创建的规则 -> 返回其 payload；
   * - 形似 adapter 规则但非本实例创建 -> 抛 `TypeError`，防止其他 adapter 实例的规则被误解析；
   * - 否则按裸输入经 `assertBare` 校验后返回。
   *
   * @param input - 带身份的规则或裸输入。
   * @param assertBare - 裸输入（及 payload）的结构校验函数。
   * @returns 已校验的 payload。
   */
  extract(
    input: AdapterRule | TPayload,
    assertBare: (value: unknown) => asserts value is TPayload
  ): TPayload
}

/**
 * 创建一个 adapter 实例私有的规则身份。
 *
 * 每次调用返回独立的 WeakSet 身份记录；一个实例创建的规则不能由另一个实例识别。
 *
 * @typeParam TPayload - 带身份规则承载的 payload 类型。
 * @param id - adapter 标识，用于规则的 `adapterId` 与 foreign-rejection 错误消息。
 * @returns 可创建 / 识别 / 抽取带身份规则的身份对象。
 */
export function createRuleIdentity<TPayload>(id: string): RuleIdentity<TPayload> {
  // 记录由当前实例 create() 创建的规则；使用 WeakSet 避免持有强引用，
  // 规则随字段释放后可被 GC 回收。
  const owned = new WeakSet<object>()

  const create = (payload: TPayload): AdapterRule => {
    const rule: AdapterRule = Object.freeze({ adapterId: id, payload })
    owned.add(rule)

    return rule
  }

  const isRule = (value: unknown): value is AdapterRule =>
    typeof value === "object" && value !== null && owned.has(value)

  const extract = (
    input: AdapterRule | TPayload,
    assertBare: (value: unknown) => asserts value is TPayload
  ): TPayload => {
    if (isRule(input)) {
      const payload = input.payload
      assertBare(payload)

      return payload
    }

    if (isAdapterRuleLike(input)) {
      // 相同结构不能证明来源；只接受当前实例 WeakSet 记录过的规则。
      throw new TypeError(`${id} adapter 仅接受由当前实例创建的规则`)
    }

    assertBare(input)

    return input
  }

  return { create, isRule, extract }
}
