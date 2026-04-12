/**
 * TypeScript 工具类型
 *
 * 提供类型层面的辅助工具，用于增强类型安全性。
 *
 * @module types/utils
 */

/**
 * 精确类型约束，禁止对象字面量中出现目标类型未定义的属性。
 *
 * TypeScript 的多余属性检查在展开运算符场景下可能失效，
 * 此工具类型通过将未知 key 映射为 never 来强制报错。
 *
 * @typeParam T - 目标类型
 * @typeParam U - 实际传入的类型，必须是 T 的子类型
 *
 * @example
 * ```ts
 * interface Props { name: string; age: number }
 *
 * function create<T extends Props>(props: Exact<Props, T>): Props {
 *   return props
 * }
 *
 * create({ name: "test", age: 18 })          // 正常
 * create({ name: "test", age: 18, x: true }) // 报错：x 不能赋值给 never
 * ```
 */
export type Exact<T, U extends T> = T & Record<Exclude<keyof U, keyof T>, never>
