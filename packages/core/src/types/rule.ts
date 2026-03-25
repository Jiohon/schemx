/**
 * 校验规则类型体系。
 *
 * 定义表单字段的校验规则类型，支持 Standard Schema、内置快捷方式和用户自定义扩展。
 * 用户可通过声明合并扩展 {@link CustomRule} 来注册自定义规则类型。
 *
 * @module types/rule
 */

import type { StandardSchemaV1 } from "@/types/standardSchema"

/**
 * 内置校验规则快捷方式。
 *
 * `"required"` 会被 FormItem 自动转换为 `createRequiredRule` 生成的 StandardSchemaV1 实例。
 */
export type BuiltinRules = "required" | "selectRequired" | "uploadRequired"

/**
 * 自定义规则扩展接口。
 *
 * 用户通过声明合并（declaration merging）扩展此接口，
 * 将自定义规则名称映射到其对应的 StandardSchemaV1 实例类型。
 * 注册后，规则名称字符串可直接用于 `rules` 字段，运行时通过名称查找对应的 schema 执行校验。
 *
 * @example
 * ```ts
 * // 在项目中创建 schemx.d.ts
 * declare module '@schemx/core' {
 *   interface CustomRule {
 *     'phone': StandardSchemaV1<string>
 *     'email': StandardSchemaV1<string>
 *   }
 * }
 * ```
 *
 * @remarks
 * 扩展后，`CustomRules` 会自动推导出所有已注册的规则名称字符串，
 * `SchemxRules` 类型也会随之包含这些名称。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRule {}

/**
 * 自定义规则名称类型。
 *
 * 由 {@link CustomRule} 的键自动推导，
 * 代表所有已注册的自定义规则名称字符串。
 */
export type CustomRules = keyof CustomRule

/**
 * 校验规则类型。
 *
 * 支持三种形式：
 * - `StandardSchemaV1` — 任何实现了 Standard Schema 接口的验证库实例
 * - `BuiltinRules` — 内置快捷方式（如 `"required"`）
 * - `CustomRules` — 用户通过声明合并注册的自定义规则名称
 */
export type SchemxRules = StandardSchemaV1 | BuiltinRules | CustomRules
