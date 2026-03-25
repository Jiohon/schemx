/**
 * 渲染器注册中心。
 *
 * 纯粹的注册/查询中心，不负责渲染逻辑。
 *
 * @module core/registry/rendererRegistry
 */

import { createStrictSingleton } from "../utils/single"

/** 渲染器注册选项 */
export interface RegistryOptions {
  /** 是否覆盖已存在的渲染器 */
  override?: boolean
}

/**
 * 渲染器组件映射类型。
 *
 * key 为渲染器类型字符串，value 为对应的框架组件。
 */
export type RendererMap<R = unknown> = Record<string, R>

/**
 * 渲染器注册中心。
 *
 * 纯粹的 Map 存储。
 *
 * @example
 * ```typescript
 * const registry = new Registry()
 *
 * // 注册组件
 * registry.register('input', InputRenderer)
 *
 * // 批量注册
 * registry.registerAll({ text: TextRenderer, number: NumberRenderer })
 * ```
 *
 * @remarks
 * 当 getRenderer 找不到指定类型时，会自动回退到默认渲染器类型（默认为 'text'）。
 */
export class RendererRegistry<R = unknown> {
  /** 渲染器存储 */
  private renderers: Map<string, R>

  /** 默认渲染器类型 */
  private defaultType: string

  /**
   * 创建 Registry 实例。
   *
   * @param defaultType - 默认渲染器类型，未找到指定类型时回退使用
   */
  constructor(defaultType: string = "text") {
    this.renderers = new Map()
    this.defaultType = defaultType
  }

  /**
   * 注册渲染器。
   *
   * 默认会覆盖已存在的同名渲染器，可通过 `options.override` 控制。
   *
   * @param type - 渲染器类型标识
   * @param renderer - 组件
   * @param options - 注册选项
   *
   * @example
   * ```typescript
   * registry.register('text', TextRenderer)
   * registry.register('text', NewTextRenderer, { override: true })
   * ```
   */
  register(type: string, renderer: R, options?: RegistryOptions): void {
    if (this.renderers.has(type) && options?.override === false) {
      console.warn(
        `[RendererRegistry] Renderer "${type}" already exists, skipping registration`
      )

      return
    }

    this.renderers.set(type, renderer)
  }

  /**
   * 批量注册渲染器。
   *
   * 遍历映射对象逐个注册，已存在的同名渲染器会被直接覆盖。
   *
   * @param renderers - 类型到组件的映射对象
   *
   * @example
   * ```typescript
   * registry.registerAll({
   *   text: TextRenderer,
   *   number: NumberRenderer,
   *   date: DateRenderer,
   * })
   * ```
   */
  registerAll(renderers: RendererMap<R>): void {
    Object.entries(renderers).forEach(([type, renderer]) => {
      this.renderers.set(type, renderer)
    })
  }

  /**
   * 获取指定类型的渲染器组件。
   *
   * 未找到时自动回退到默认类型，默认类型也不存在则返回 undefined。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的组件，未找到且无默认时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = registry.getRenderer('text')
   * const fallback = registry.getRenderer('unknown') // => 默认渲染器
   * ```
   */
  getRenderer(type: string): R | undefined {
    let renderer = this.renderers.get(type)

    if (!renderer) {
      console.warn(
        `[RendererRegistry] Renderer "${type}" not found, falling back to default "${this.defaultType}"`
      )
      renderer = this.renderers.get(this.defaultType)
    }

    return renderer
  }

  /**
   * 检查渲染器是否已注册
   *
   * @param type - 渲染器类型标识
   * @returns 是否存在
   *
   * @example
   * ```typescript
   * registry.hasRenderer('text')   // => true
   * registry.hasRenderer('custom') // => false
   * ```
   */
  hasRenderer(type: string): boolean {
    return this.renderers.has(type)
  }

  /**
   * 移除渲染器
   *
   * 如果移除的是当前默认类型，会从剩余渲染器中智能选取新默认类型。
   * 若无剩余渲染器则默认类型设为空字符串。
   *
   * @param type - 渲染器类型标识
   * @returns 是否成功移除
   *
   * @example
   * ```typescript
   * registry.unregister('date') // => true
   * registry.unregister('nonexistent') // => false
   * ```
   */
  unregister(type: string): boolean {
    const isDefault = type === this.defaultType
    const deleted = this.renderers.delete(type)

    if (isDefault && deleted) {
      const firstKey = this.renderers.keys().next().value
      this.defaultType = firstKey ?? ""
    }

    return deleted
  }

  /**
   * 获取所有已注册的渲染器类型
   *
   * @returns 类型标识数组
   *
   * @example
   * ```typescript
   * registry.getTypes() // => ['text', 'number', 'date']
   * ```
   */
  getTypes(): string[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * 设置默认渲染器类型
   *
   * 当 getRenderer 找不到指定类型时，会回退到默认类型。
   * 设置的类型必须已注册，否则操作无效。
   *
   * @param type - 渲染器类型标识
   *
   * @example
   * ```typescript
   * registry.setDefault('number')
   * registry.getDefault() // => 'number'
   * ```
   */
  setDefault(type: string): void {
    if (!this.renderers.has(type)) {
      console.warn(
        `[RendererRegistry] Cannot set default to "${type}": renderer not registered`
      )

      return
    }

    this.defaultType = type
  }

  /**
   * 获取当前默认渲染器类型
   *
   * @returns 默认类型标识
   *
   * @example
   * ```typescript
   * registry.getDefault() // => 'text'
   * ```
   */
  getDefault(): string {
    return this.defaultType
  }

  /**
   * 清除所有已注册的渲染器并重置默认类型为 'text'。
   *
   * @example
   * ```typescript
   * registry.clear()
   * registry.size() // => 0
   * ```
   */
  clear(): void {
    this.renderers.clear()
    this.defaultType = "text"
  }

  /**
   * 获取已注册渲染器数量
   *
   * @returns 渲染器数量
   *
   * @example
   * ```typescript
   * registry.size() // => 5
   * ```
   */
  size(): number {
    return this.renderers.size
  }
}

/**
 * 创建局部渲染器注册中心实例（仅内部使用）。
 *
 * @param defaultType - 默认渲染器类型
 * @returns 新的 Registry 实例
 *
 * @remarks
 * 用于组件内部创建独立的注册中心实例，
 * 不建议外部直接使用，除非有特殊需求。
 */
export function createLocalRendererRegistry(
  defaultType: string = "text"
): RendererRegistry {
  return new RendererRegistry(defaultType)
}

/**
 * 全局渲染器注册中心的严格单例实例。
 *
 * @example
 * ```typescript
 * import { rendererRegistry } from '@schemx/core'
 *
 * // 注册全局渲染器
 * rendererRegistry.register('custom', CustomRenderer)
 *
 * // 在其他地方获取
 * const renderer = rendererRegistry.getRenderer('custom')
 * ```
 */
export const rendererRegistry = createStrictSingleton(
  (defaultType: string = "text") => new RendererRegistry(defaultType)
).getInstance()

/**
 * 定义并注册单个渲染器。
 *
 * 将渲染器注册到全局 {@link rendererRegistry} 并返回该组件实例，
 * 方便在注册的同时保留引用以供直接使用。
 *
 * @param type - 渲染器类型标识
 * @param renderer - 组件
 *
 * @returns 传入的组件
 *
 * @example
 * ```typescript
 * import { defineRenderer } from '@schemx/core'
 *
 * const InputRenderer = defineRenderer('input', InputComponent)
 *
 * // 在 schemas 中通过名称引用
 * const schemas = [
 *   { name: 'username', componentType: 'input', label: '用户名' },
 * ]
 * ```
 */
export function defineRenderer<R = unknown>(type: string, renderer: R): R {
  rendererRegistry.register(type, renderer)

  return renderer
}

/**
 * 批量定义并注册渲染器。
 *
 * 将映射对象中的所有渲染器注册到全局 {@link rendererRegistry} 并返回原映射，
 * 适合在项目入口集中声明所有渲染器。
 *
 * @param renderers - 类型到组件的映射对象
 *
 * @returns 传入的映射对象
 *
 * @example
 * ```typescript
 * import { defineRenderers } from '@schemx/core'
 *
 * const renderers = defineRenderers({
 *   input: InputComponent,
 *   select: SelectComponent,
 *   date: DateComponent,
 * })
 * ```
 */
export function defineRenderers<R extends RendererMap<R>>(renderers: R): R {
  rendererRegistry.registerAll(renderers)

  return renderers
}

export default RendererRegistry
