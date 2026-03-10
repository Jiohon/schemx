/**
 * 深层路径类型工具。
 *
 * 提供类型安全的嵌套对象路径推导，用于 FormStore 的字段路径约束。
 *
 * @module types/namePathType
 */

/** 基础路径类型，支持字符串、数字、布尔值及其数组组合 */
type BaseNamePath = string | number | boolean | (string | number | boolean)[]

/**
 * 深层路径类型推导。
 *
 * 根据 Store 类型递归推导所有合法的字段访问路径，
 * 支持嵌套对象、数组索引，最大递归深度为 5 层。
 *
 * @typeParam Store - 表单数据类型
 * @typeParam ParentNamePath - 父级路径元组，由递归自动生成，无需手动传入
 *
 * @example
 * ```ts
 * interface FormData {
 *   user: {
 *     name: string
 *     address: { city: string }
 *   }
 *   tags: string[]
 * }
 *
 * // 合法路径：'user' | ['user', 'name'] | ['user', 'address'] | ['user', 'address', 'city'] | 'tags' | ['tags', number]
 * type Path = DeepNamePath<FormData>
 * ```
 *
 * @remarks
 * - 递归深度限制为 5 层，超出后返回 `never`
 * - 顶层路径支持单独的 key 字符串（如 `'user'`），嵌套路径使用元组（如 `['user', 'name']`）
 * - 数组类型的子路径使用 `number` 作为索引
 * - 函数类型的属性会被排除
 */
export type DeepNamePath<
  Store = any,
  ParentNamePath extends any[] = [],
> = ParentNamePath["length"] extends 5
  ? never
  : // 判断 Store 是否为基础类型
    true extends (Store extends BaseNamePath ? true : false)
    ? ParentNamePath["length"] extends 0
      ? Store | BaseNamePath // 顶层直接返回 BaseNamePath
      : Store extends any[]
        ? [...ParentNamePath, number] // 数组类型拼接数字索引
        : never
    : Store extends any[] // 判断 Store 是否为数组
      ? // 数组路径：如 { a: { b: string }[] }
          // 推导出：[a] | [a, number] | [a, number, b]
          | [...ParentNamePath, number]
          | DeepNamePath<Store[number], [...ParentNamePath, number]>
      : keyof Store extends never // unknown 类型兜底
        ? Store
        : {
            // 遍历 Store 的每个属性
            [FieldKey in keyof Store]: Store[FieldKey] extends Function
              ? never // 排除函数类型属性
              :
                  | (ParentNamePath["length"] extends 0 ? FieldKey : never) // 顶层允许单独使用 key
                  | [...ParentNamePath, FieldKey] // 拼接父级路径
                  | DeepNamePath<Required<Store>[FieldKey], [...ParentNamePath, FieldKey]> // 递归子属性
          }[keyof Store]
