/**
 * Schema source 创建工具。
 *
 * @module core/createSchemas
 */

import { createSignal } from "./reactivity"

import type { ReadonlySignal } from "./reactivity"
import type { Values } from "./types/form"
import type { SchemxField } from "./types/schema"

/**
 * schema source 变化订阅回调。
 *
 * @typeParam TValues - 表单值类型。
 */
export type SchemxSchemasListener<TValues extends Values = Values> = (
  schemas: readonly SchemxField<TValues>[]
) => void

/**
 * 可响应式更新的 root schema source。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxSchemas<TValues extends Values = Values> {
  /** 当前 schema 列表的只读 signal。 */
  readonly signal: ReadonlySignal<readonly SchemxField<TValues>[]>
  /** 当前 schema 列表。 */
  readonly value: readonly SchemxField<TValues>[]
  /** 无依赖追踪地读取当前 schema 列表。 */
  peek: () => readonly SchemxField<TValues>[]
  /** 替换当前 schema 列表。 */
  set: (schemas: readonly SchemxField<TValues>[]) => void
  /** 基于当前 schema 列表派生下一版。 */
  update: (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ) => void
  /** 订阅 schema 列表变化。 */
  subscribe: (listener: SchemxSchemasListener<TValues>) => () => void
}

/**
 * createForm 可接收的 schema 输入。
 *
 * @typeParam TValues - 表单值类型。
 */
export type SchemxSchemasInput<TValues extends Values = Values> =
  | readonly SchemxField<TValues>[]
  | SchemxSchemas<TValues>

/**
 * 创建空 schema source。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 可响应式更新的 schema source。
 */
export function createSchemas<TValues extends Values = Values>(): SchemxSchemas<TValues>

/**
 * 创建 schema source。
 *
 * @typeParam TValues - 表单值类型。
 * @param schemas - 初始 root schema 列表。
 * @returns 可响应式更新的 schema source。
 */
export function createSchemas<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[]
): SchemxSchemas<TValues>

export function createSchemas<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[] = []
): SchemxSchemas<TValues> {
  const source = createSignal<readonly SchemxField<TValues>[]>(schemas)

  /**
   * 响应式读取当前 schema 列表。
   */
  const getValue = (): readonly SchemxField<TValues>[] => {
    return source.value
  }

  /**
   * 无依赖追踪地读取当前 schema 列表。
   */
  const peek = (): readonly SchemxField<TValues>[] => {
    return source.peek()
  }

  /**
   * 替换 schema 列表并通知订阅者。
   */
  const set = (nextSchemas: readonly SchemxField<TValues>[]): void => {
    source.value = nextSchemas
  }

  /**
   * 基于当前 schema 列表派生下一版并通知订阅者。
   */
  const update = (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void => {
    source.value = updater(source.peek())
  }

  /**
   * 注册 schema source 的手动订阅者。
   */
  const subscribe = (listener: SchemxSchemasListener<TValues>): (() => void) => {
    let isInitialNotify = true
    const unsubscribe = source.subscribe((value) => {
      if (isInitialNotify) {
        isInitialNotify = false

        return
      }

      listener(value)
    })

    return () => {
      unsubscribe()
    }
  }

  return {
    signal: source,
    get value() {
      return getValue()
    },
    peek,
    set,
    update,
    subscribe,
  }
}

/**
 * 判断输入是否为 schema source。
 *
 * @param schemas - createForm 接收的 schema 输入。
 * @returns true 表示输入是 schema source。
 */
export function isSchemxSchemas<TValues extends Values = Values>(
  schemas: SchemxSchemasInput<TValues> | undefined
): schemas is SchemxSchemas<TValues> {
  if (!schemas || Array.isArray(schemas)) {
    return false
  }

  const candidate = schemas as Partial<SchemxSchemas<TValues>>

  return (
    typeof candidate.peek === "function" &&
    typeof candidate.set === "function" &&
    typeof candidate.update === "function" &&
    typeof candidate.subscribe === "function"
  )
}
