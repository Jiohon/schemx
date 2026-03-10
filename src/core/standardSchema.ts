/**
 * Standard Schema v1 类型定义与内置校验工厂。
 *
 * 基于 [Standard Schema](https://github.com/standard-schema/standard-schema) 规范，
 * 定义通用的校验接口，使表单系统不再绑定任何特定验证库。
 * 同时提供内置的必填校验 schema 工厂函数，用于替代 Zod 构造必填规则。
 *
 * @module core/standardSchema
 *
 * @example
 * ```typescript
 * import { createRequiredSchema } from './standardSchema'
 * import type { StandardSchemaV1 } from './standardSchema'
 *
 * // 使用内置必填校验
 * const requiredSchema = createRequiredSchema('请输入用户名')
 * const result = requiredSchema['~standard'].validate('')
 * // => { issues: [{ message: '请输入用户名' }] }
 *
 * // 任何实现了 StandardSchemaV1 的验证库都可以使用
 * function registerRule(schema: StandardSchemaV1) { ... }
 * ```
 */

/**
 * Standard Schema v1 接口。
 *
 * 定义了验证库互操作的统一协议，任何实现了该接口的验证库
 * （Zod v4、Valibot、ArkType 等）都可以与表单系统集成。
 *
 * @typeParam Input - 输入值类型
 * @typeParam Output - 输出值类型，默认与 Input 相同
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
  /**
   * Schema 属性接口。
   *
   * 包含版本号、供应商标识、校验方法和可选的类型信息。
   *
   * @typeParam Input - 输入值类型
   * @typeParam Output - 输出值类型
   */
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output>
  }

  /**
   * 校验结果类型。
   *
   * 成功时包含 `value` 字段，失败时包含 `issues` 数组。
   * 两种形态互斥，通过可辨识联合类型区分。
   *
   * @typeParam Output - 输出值类型
   */
  type Result<Output = unknown> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue>; readonly value?: undefined }

  /**
   * 校验问题接口。
   *
   * 描述单个校验失败的详细信息。
   */
  interface Issue {
    /** 错误提示信息 */
    readonly message: string
    /** 可选的字段路径，标识问题发生的位置 */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>
  }

  /**
   * 路径段接口。
   *
   * 用于描述嵌套对象中的路径节点。
   */
  interface PathSegment {
    readonly key: PropertyKey
  }

  /**
   * 类型信息接口。
   *
   * 用于在类型层面携带输入/输出类型信息，运行时不使用。
   *
   * @typeParam Input - 输入值类型
   * @typeParam Output - 输出值类型
   */
  interface Types<Input = unknown, Output = Input> {
    readonly input?: Input
    readonly output?: Output
  }

  /**
   * 从 StandardSchemaV1 实例中提取输入类型。
   *
   * @typeParam T - StandardSchemaV1 实例类型
   */
  type InferInput<T extends StandardSchemaV1> = NonNullable<
    T["~standard"]["types"]
  >["input"]

  /**
   * 从 StandardSchemaV1 实例中提取输出类型。
   *
   * @typeParam T - StandardSchemaV1 实例类型
   */
  type InferOutput<T extends StandardSchemaV1> = NonNullable<
    T["~standard"]["types"]
  >["output"]
}

/**
 * 创建内置必填校验 schema。
 *
 * 返回一个符合 StandardSchemaV1 接口的轻量校验对象，
 * 用于替代 FormItem 中直接构造 Zod required 规则的逻辑。
 * 当值为 `undefined`、`null` 或空字符串时校验失败，返回包含提示信息的 issues。
 *
 * @param errorMessage - 校验失败时展示给用户的提示文本（通常为 placeholder 或自定义错误信息）
 *
 * @returns 符合 StandardSchemaV1 接口的必填校验 schema
 *
 * @example
 * ```typescript
 * const schema = createRequiredSchema('请输入用户名')
 *
 * schema['~standard'].validate('')        // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate(undefined) // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate(null)      // => { issues: [{ message: '请输入用户名' }] }
 * schema['~standard'].validate('hello')   // => { value: 'hello' }
 * ```
 */
export function createRequiredSchema(
  errorMessage: string
): StandardSchemaV1<unknown, unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "vue-schema-form",
      validate(value: unknown): StandardSchemaV1.Result<unknown> {
        if (value === undefined || value === null || value === "") {
          return { issues: [{ message: errorMessage }] }
        }

        return { value }
      },
    },
  }
}
