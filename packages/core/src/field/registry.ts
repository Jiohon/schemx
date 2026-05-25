/**
 * FieldRegistry - 字段索引。
 *
 * 通过 descriptor.schema.name 快速查询字段 entry。Registry 不依赖
 * FieldModel.name，因为 FieldModel 不持有静态字段身份。
 *
 * @module core/field/registry
 */

import type { FieldDescriptor } from "../descriptor"
import type { FieldModel } from "./model"
import type { Fiber } from "../graph"
import type { NamePath, Values } from "../types/form"

/**
 * 字段索引条目。
 */
export interface FieldRegistryEntry<TValues extends Values = Values> {
  readonly name: NamePath<TValues>
  readonly fiber: Fiber
  readonly descriptor: FieldDescriptor<TValues>
  readonly model: FieldModel<TValues>
}

/**
 * 字段索引接口。
 */
export interface FieldRegistry<TValues extends Values = Values> {
  register(entry: FieldRegistryEntry<TValues>): void
  unregister(name: NamePath<TValues>, fiber?: Fiber): void
  get(name: NamePath<TValues>): FieldRegistryEntry<TValues> | undefined
  list(): FieldRegistryEntry<TValues>[]
}

/**
 * NamePath 标准化为字符串 key。
 */
function normalizeNamePath(name: NamePath | unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}

/**
 * FieldRegistry 默认实现。
 */
export class RuntimeFieldRegistry<
  TValues extends Values = Values,
> implements FieldRegistry<TValues> {
  #fields = new Map<string, FieldRegistryEntry<TValues>>()

  register(entry: FieldRegistryEntry<TValues>): void {
    const key = normalizeNamePath(entry.name)
    this.#fields.set(key, entry)
  }

  unregister(name: NamePath<TValues> | unknown, fiber?: Fiber): void {
    const key = normalizeNamePath(name)
    const current = this.#fields.get(key)

    if (fiber && current?.fiber !== fiber) {
      return
    }

    this.#fields.delete(key)
  }

  get(name: NamePath<TValues> | unknown): FieldRegistryEntry<TValues> | undefined {
    const key = normalizeNamePath(name)

    return this.#fields.get(key)
  }

  list(): FieldRegistryEntry<TValues>[] {
    return Array.from(this.#fields.values())
  }
}

/**
 * 创建一个 FieldRegistry 实例。
 */
export function createFieldRegistry<
  TValues extends Values = Values,
>(): FieldRegistry<TValues> {
  return new RuntimeFieldRegistry<TValues>()
}
