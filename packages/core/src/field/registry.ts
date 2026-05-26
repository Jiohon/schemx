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
export interface FieldRegistryEntry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly name: TName
  readonly fiber: Fiber<TValues>
  readonly descriptor: FieldDescriptor<TValues>
  readonly model: FieldModel<TValues>
}

/**
 * FieldRegistry 默认实现。
 */
class RuntimeFieldRegistry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  private fields = new Map<string, FieldRegistryEntry<TValues>>()

  register(entry: FieldRegistryEntry<TValues>): void {
    const key = entry.name
    this.fields.set(key, entry)
  }

  unregister(name: TName, fiber?: Fiber<TValues>): void {
    const key = name
    const current = this.fields.get(key)

    if (fiber && current?.fiber !== fiber) {
      return
    }

    this.fields.delete(key)
  }

  get(name: TName): FieldRegistryEntry<TValues> | undefined {
    const key = name

    return this.fields.get(key)
  }

  list(): FieldRegistryEntry<TValues>[] {
    return Array.from(this.fields.values())
  }
}

/**
 * FieldRegistry 的实例类型。
 */
export type FieldRegistry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = InstanceType<typeof RuntimeFieldRegistry<TValues, TName>>

/**
 * 创建一个 FieldRegistry 实例。
 *
 * @returns 新的字段注册表。
 */
export function createFieldRegistry<
  TValues extends Values = Values,
>(): FieldRegistry<TValues> {
  return new RuntimeFieldRegistry<TValues>()
}
