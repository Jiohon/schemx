/**
 * ResourceMap - 领域层挂载模型的唯一扩展点。
 *
 * ResourceMap 避免把字段状态塞进 Fiber 自身字段，
 * 提供类型安全的 set/get/require/delete/clear 操作。
 *
 * @module core/runtime/core/resource
 */

/**
 * 类型安全的资源标识。
 *
 * @typeParam T - 资源类型
 */
export interface ResourceKey<T> {
  /**
   * 唯一标识符。
   */
  readonly id: symbol

  /**
   * 描述信息，用于错误提示。
   */
  readonly description: string
}

/**
 * Fiber 级资源容器。
 */
export interface ResourceMap {
  /**
   * 设置资源。
   *
   * @typeParam T - 资源类型
   * @param key - 资源标识
   * @param value - 资源值
   */
  set<T>(key: ResourceKey<T>, value: T): void

  /**
   * 获取资源。
   *
   * @typeParam T - 资源类型
   * @param key - 资源标识
   * @returns 资源值，不存在返回 undefined
   */
  get<T>(key: ResourceKey<T>): T | undefined

  /**
   * 获取资源，不存在时抛错。
   *
   * @typeParam T - 资源类型
   * @param key - 资源标识
   * @returns 资源值
   * @throws 资源不存在时抛出错误
   */
  require<T>(key: ResourceKey<T>): T

  /**
   * 删除资源。
   *
   * @typeParam T - 资源类型
   * @param key - 资源标识
   */
  delete<T>(key: ResourceKey<T>): void

  /**
   * 清空所有资源。
   */
  clear(): void
}

/**
 * 创建类型安全的资源标识。
 *
 * @typeParam T - 资源类型
 * @param description - 描述信息
 * @returns 资源标识
 *
 * @example
 * ```ts
 * // 定义资源 key
 * export const FIELD_MODEL = createResourceKey<FieldModel>("schemx.fieldModel")
 * export const DYNAMIC_SLOT = createResourceKey<DynamicSlot>("schemx.dynamicSlot")
 *
 * // 使用资源 key
 * fiber.resources.set(FIELD_MODEL, fieldModel)
 * const model = fiber.resources.get(FIELD_MODEL)
 * ```
 */
export function createResourceKey<T>(description: string): ResourceKey<T> {
  return {
    id: Symbol(description),
    description,
  }
}

/**
 * ResourceMap 的运行时实现。
 */
export class RuntimeResourceMap implements ResourceMap {
  /**
   * 内部资源存储。
   */
  #resources = new Map<symbol, unknown>()

  /**
   * 设置资源。
   */
  set<T>(key: ResourceKey<T>, value: T): void {
    this.#resources.set(key.id, value)
  }

  /**
   * 获取资源。
   */
  get<T>(key: ResourceKey<T>): T | undefined {
    const value = this.#resources.get(key.id)

    return value === undefined ? undefined : (value as T)
  }

  /**
   * 获取资源，不存在时抛错。
   */
  require<T>(key: ResourceKey<T>): T {
    const value = this.get(key)

    if (value === undefined) {
      throw new Error(`Missing runtime resource: ${key.description}`)
    }

    return value
  }

  /**
   * 删除资源。
   */
  delete<T>(key: ResourceKey<T>): void {
    this.#resources.delete(key.id)
  }

  /**
   * 清空所有资源。
   */
  clear(): void {
    this.#resources.clear()
  }
}

/**
 * 创建一个 ResourceMap 实例。
 *
 * @returns 新创建的 ResourceMap
 *
 * @example
 * ```ts
 * const resources = createResourceMap()
 *
 * resources.set(FIELD_MODEL, fieldModel)
 * const model = resources.get(FIELD_MODEL)
 * resources.delete(FIELD_MODEL)
 * resources.clear()
 * ```
 */
export function createResourceMap(): ResourceMap {
  return new RuntimeResourceMap()
}
