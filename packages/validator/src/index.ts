/**
 * Schemx 第三方校验 adapter 的公共类型入口。
 *
 * 运行时实现应分别从 `/zod`、`/async-validator` 或 `/preset` 导入，
 * 以避免无意加载未使用的 optional peer dependency。
 */
export type { ZodValidationAdapter } from "./zod"

/**
 * 导出 async-validator 适配器入口的类型。
 */
export type { AsyncValidatorValidationAdapter } from "./async-validator"

/**
 * 导出预设适配器集合的类型。
 */
export type { ValidationAdapterPreset } from "./preset"
