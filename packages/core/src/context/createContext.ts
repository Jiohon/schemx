/**
 * Schemx 内部上下文模块。
 *
 * 基于 `simple-async-context` 实现，提供 ambient context 读取与临时覆盖。设计目标：
 *
 * - 仅供 core 包内部使用
 * - API 风格接近 React `createContext` / `useContext`，但以对象方法形式暴露
 * - 支持默认值
 * - 支持临时覆盖上下文（`Provider`）
 *
 * 作用域限制：ambient context **仅在 `Provider` 的同步调用栈内有效**。
 * 跨 `await` / 异步回调（`setTimeout` / `queueMicrotask` / 事件回调）不会自动延续。
 * 原因：`simple-async-context` 依赖 `Promise.prototype.then` 的 patch 拦截异步 continuation，
 * 但原生 `async/await` 的 continuation 走引擎内置 microtask 调度，不经过被 patch 的 `then`，
 * 因此 polyfill 拦不到。要让其跨 await 工作，需将构建 target 降级到 es6 把 async/await
 * 转译为 `.then()` 链——本项目保持 ESNext target，故不支持跨 await。
 *
 * 调用方若需在异步回调中读取 context，应在异步入口处显式 `Provider` 重新进入作用域，
 * 或在回调闭包中直接捕获所需的 context 值。
 *
 * 注意：`simple-async-context` 在导入时会 patch 全局 `Promise` / `setTimeout` / 事件 API，
 * 属于模块加载时的全局副作用。
 *
 * @module core/context
 */

import * as AsyncContextNS from "simple-async-context"

const CONTEXT_MARK = Symbol("schemx.async-context")

const { AsyncContext } = AsyncContextNS

/**
 * Schemx 上下文声明。
 *
 * `createContext()` 返回该对象，所有读取和覆盖操作通过其方法完成。
 * 底层 Variable 通过闭包私有化，不对外暴露。
 *
 * @typeParam T - 上下文值类型。
 */
export interface Context<T> {
  /**
   * 调试名称，用于错误信息。
   */
  readonly name: string
  /**
   * 读取当前栈上的上下文值。
   *
   * 优先返回当前栈显式覆盖的值；未覆盖时：
   * - 存在默认值则返回默认值；
   * - 不存在默认值则抛出 `ContextNotProvidedError`。
   *
   * 仅在 `Provider` 的同步调用栈内可读。跨 `await` / 异步回调不会延续，详见模块文档。
   *
   * @throws ContextNotProvidedError - 当前栈未提供且无默认值。
   */
  useContext(): T
  /**
   * 尝试读取当前异步栈上的上下文值。
   *
   * 与 `useContext` 的区别：未提供且无默认值时返回 undefined，而不是抛错。
   */
  tryUseContext(): T | undefined
  /**
   * 在指定函数执行期间覆盖上下文值。
   *
   * 函数执行结束后（无论成功或抛错），当前栈上的覆盖值恢复。
   *
   * 注意：ambient context 仅在 `fn` 的**同步调用栈**内可读。
   * `fn` 内部若 `await` 或调度异步回调，回调中读不到 `value`——
   * 需在异步入口处再次 `Provider`，或在闭包中直接捕获 `value`。
   *
   * @param value - 临时覆盖的值。
   * @param fn - 需要读取覆盖值的同步函数。
   * @returns `fn` 的返回值。
   */
  Provider<R>(value: T, fn: () => R): R
  /**
   * 内部标记，用于判断对象是否是 Schemx Context。
   */
  readonly [CONTEXT_MARK]: true
}

/**
 * 创建一个没有默认值的上下文声明。
 *
 * @param name - 调试名称，用于错误信息和 Variable 标识。
 *
 * @returns 带 `useContext` / `tryUseContext` / `Provider` 方法的上下文声明。
 *
 * @example
 * const UserContext = createContext<{ id: string }>("UserContext")
 *
 * UserContext.Provider({ id: "u1" }, () => {
 *   UserContext.useContext().id // → "u1"
 * })
 */
export function createContext<T>(name: string): Context<T | undefined>

/**
 * 创建一个带默认值的上下文声明。
 *
 * @param name - 调试名称，用于错误信息和 Variable 标识。
 * @param defaultValue - 未显式 provide 时返回的默认值。
 *
 * @returns 带 `useContext` / `tryUseContext` / `Provider` 方法的上下文声明。
 *
 * @example
 * const LocaleContext = createContext("LocaleContext", "zh-CN")
 *
 * LocaleContext.useContext() // → "zh-CN"（未 Provider 时返回默认值）
 */
export function createContext<T>(name: string, defaultValue: T): Context<T>

export function createContext<T>(name: string, defaultValue?: T): Context<T | undefined> {
  const hasDefaultValue = arguments.length >= 2
  const variable = new AsyncContext.Variable<T>()

  const useContext = (): T => {
    const value = variable.get()

    if (value !== undefined) {
      return value
    }

    if (hasDefaultValue) {
      return defaultValue as T
    }

    throw new ContextNotProvidedError({ name } as Context<unknown>)
  }

  const tryUseContext = (): T | undefined => {
    const value = variable.get()

    if (value !== undefined) {
      return value
    }

    if (hasDefaultValue) {
      return defaultValue as T
    }

    return undefined
  }

  const Provider = <R>(value: T, fn: () => R): R => variable.run(value, fn)

  return {
    name,
    useContext,
    tryUseContext,
    Provider,
    [CONTEXT_MARK]: true,
  }
}

/**
 * 读取未提供且没有默认值的 Context 时抛出的错误。
 */
export class ContextNotProvidedError extends Error {
  /**
   * 创建 Context 未提供错误。
   *
   * @param context - 读取失败的上下文声明（仅取 name 用于信息展示）。
   */
  constructor(context: Pick<Context<unknown>, "name">) {
    super(`[schemx] Context "${context.name}" has not been provided.`)

    this.name = "ContextNotProvidedError"
  }
}

/**
 * 判断未知值是否是由 `createContext()` 创建的上下文声明。
 *
 * @param value - 待检查的未知值。
 *
 * @returns 是 Schemx Context 时返回 true。
 *
 * @example
 * const ThemeContext = createContext("ThemeContext", "light")
 * isContext(ThemeContext) // true
 */
export function isContext(value: unknown): value is Context<unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      CONTEXT_MARK in value &&
      (value as Context<unknown>)[CONTEXT_MARK] === true
  )
}
