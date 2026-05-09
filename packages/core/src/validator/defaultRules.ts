/**
 * 内置默认校验规则工厂。
 *
 * 提供轻量的内置校验 schema 构造函数，
 * 用于替代直接依赖 Zod 等第三方库构造必填规则。
 *
 * @module core/validator/defaultRules
 */

import type { SchemxBaseField, StandardSchemaV1 } from "../types"

/**
 * 创建内置必填校验 schema。
 *
 * 返回一个符合 StandardSchemaV1 接口的轻量校验对象。
 * 当值为 `undefined`、`null` 或空字符串时校验失败，返回包含提示信息的 issues。
 *
 * @param schema: SchemxBaseField 字段schema
 *
 * @returns 符合 StandardSchemaV1 接口的必填校验 schema
 *
 * @example
 * const schema = createRequiredRule({ label: '用户名', ... })
 *
 * schema['~standard'].validate('')        // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate('hello')   // => { value: 'hello' }
 */
export function createRequiredRule(
  schema?: SchemxBaseField
): StandardSchemaV1<unknown, unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "schemx",
      validate(value: unknown): StandardSchemaV1.Result<unknown> {
        console.log("createRequiredRule", value)
        if (value === undefined || value === null || value === "") {
          const label = schema?.label ?? ""

          return { issues: [{ message: label ? `请输入${label}` : "此项为必填项" }] }
        }

        return { value }
      },
    },
  }
}

/**
 * 创建选择类必填校验 schema。
 *
 * 适用于下拉选择、级联选择等组件。
 * 当值为 `undefined`、`null`、空字符串或空数组时校验失败。
 *
 * @param schema: SchemxBaseField 字段schema
 *
 * @returns 符合 StandardSchemaV1 接口的选择必填校验 schema
 *
 * @example
 * const schema = createSelectRequiredRule({ label: '城市', ... })
 *
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate(null)      // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate('')        // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate([])        // => { issues: [{ message: '请选择城市' }] }
 * schema['~standard'].validate('beijing') // => { value: 'beijing' }
 * schema['~standard'].validate([1, 2])    // => { value: [1, 2] }
 */
export function createSelectRequiredRule(schema?: SchemxBaseField): StandardSchemaV1 {
  return {
    "~standard": {
      version: 1,
      vendor: "schemx",
      validate(value: unknown): StandardSchemaV1.Result<unknown> {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          const label = schema?.label ?? ""

          return { issues: [{ message: label ? `请选择${label}` : "此项为必选项" }] }
        }

        return { value }
      },
    },
  }
}

/**
 * 创建上传类必填校验 schema。
 *
 * 适用于文件上传组件，值通常为数组。
 * 当值为 `undefined`、`null` 或空数组时校验失败。
 *
 * @param schema: SchemxBaseField 字段schema
 *
 * @returns 符合 StandardSchemaV1 接口的上传必填校验 schema
 *
 * @example
 * const schema = createUploadRequiredRule({ label: '文件', ... })
 *
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate(null)      // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate([])        // => { issues: [{ message: '请上传文件' }] }
 * schema['~standard'].validate([file])    // => { value: [file] }
 */
export function createUploadRequiredRule(
  schema?: SchemxBaseField
): StandardSchemaV1<unknown, unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "schemx",
      validate(value: unknown): StandardSchemaV1.Result<unknown> {
        if (
          value === undefined ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          const label = schema?.label ?? ""

          return { issues: [{ message: label ? `请上传${label}` : "此项为必传项" }] }
        }

        return { value }
      },
    },
  }
}
