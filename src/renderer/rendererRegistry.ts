/**
 * RendererRegistry - 渲染器注册中心
 *
 * 纯粹的注册/查询中心，不负责渲染逻辑。
 * 支持注册裸组件或经过 createRenderWrapper 包装的组件。
 *
 * @module renderer/RendererRegistry
 */

import { Component } from "vue"

import { createStrictSingleton } from "../utils/single"

/** 渲染器注册选项 */
export interface RegistryOptions {
  /** 是否覆盖已存在的渲染器 */
  override?: boolean
}

/** 渲染器映射类型 */
export type RendererMap = Record<string, Component>

/**
 * 渲染器注册中心
 *
 * 纯粹的 Map 存储，不关心注册的是裸组件还是包装组件。
 *
 * @example
 * ```typescript
 * const registry = new Registry()
 *
 * // 注册裸组件
 * registry.register('calendar', CalendarRenderer)
 *
 * // 注册包装组件
 * registry.register('input', createRenderWrapper({ component: InputComponent, ... }))
 *
 * // 批量注册
 * registry.registerAll({ text: TextRenderer, number: NumberRenderer })
 * ```
 */
export class Registry {
  /** 渲染器存储 */
  private renderers: Map<string, Component>

  /** 默认渲染器类型 */
  private defaultType: string

  constructor(defaultType: string = "text") {
    this.renderers = new Map()
    this.defaultType = defaultType
  }

  /**
   * 注册渲染器
   *
   * @param type - 渲染器类型标识
   * @param renderer - Vue 组件
   * @param options - 注册选项
   *
   * @example
   * ```typescript
   * registry.register('text', TextRenderer)
   * registry.register('text', NewTextRenderer, { override: true })
   * ```
   */
  register(type: string, renderer: Component, options?: RegistryOptions): void {
    if (this.renderers.has(type) && options?.override === false) {
      console.warn(
        `[RendererRegistry] Renderer "${type}" already exists, skipping registration`
      )

      return
    }

    this.renderers.set(type, renderer)
  }

  /**
   * 批量注册渲染器
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
  registerAll(renderers: RendererMap): void {
    Object.entries(renderers).forEach(([type, renderer]) => {
      this.renderers.set(type, renderer)
    })
  }

  /**
   * 获取渲染器
   *
   * 根据类型获取对应的渲染器组件。未找到则回退到默认类型。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的 Vue 组件，未找到且无默认时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = registry.getRenderer('text')
   * const fallback = registry.getRenderer('unknown') // => 默认渲染器
   * ```
   */
  getRenderer(type: string): Component | undefined {
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
   * 如果移除的是当前默认类型，默认类型会重置为 'text'。
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
    if (type === this.defaultType) {
      this.defaultType = "text"
    }

    return this.renderers.delete(type)
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
   * 清除所有渲染器并重置默认类型为 'text'
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

/** 创建局部渲染器注册中心实例（仅内部使用） */
export function createLocalRegistry(defaultType: string = "text"): Registry {
  return new Registry(defaultType)
}

/** 全局渲染器注册中心严格单例 */
const globalRegistrySingleton = createStrictSingleton(
  (defaultType: string = "text") => new Registry(defaultType)
)

export const globalRegistry: Registry = globalRegistrySingleton.getInstance()

export default Registry
