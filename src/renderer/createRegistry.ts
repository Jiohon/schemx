/**
 * RendererRegistry - 渲染器注册中心
 *
 * 纯粹的注册/查询中心，不负责渲染逻辑。
 * 支持注册裸组件或经过 createRenderWrapper 包装的组件。
 *
 * @module renderer/RendererRegistry
 */

import { Component } from "vue"

/** 渲染器注册选项 */
export interface RegistryOptions {
  /** 是否覆盖已存在的渲染器 */
  override?: boolean
}

/** 渲染器映射类型 */
export type RendererMap = Record<string, Component>

// ==================== 接口定义 ====================

/**
 * 渲染器注册中心接口
 */
export interface ISchemaRegistry {
  /** 注册渲染器 */
  register(type: string, renderer: Component, options?: RegistryOptions): void
  /** 批量注册渲染器 */
  registerAll(renderers: RendererMap): void
  /** 获取渲染器 */
  getRenderer(type: string): Component | undefined
  /** 检查渲染器是否存在 */
  hasRenderer(type: string): boolean
  /** 移除渲染器 */
  unregister(type: string): boolean
  /** 获取所有已注册类型 */
  getTypes(): string[]
  /** 设置默认渲染器类型 */
  setDefault(type: string): void
  /** 获取默认渲染器类型 */
  getDefault(): string
  /** 清除所有渲染器 */
  clear(): void
  /** 获取渲染器数量 */
  size(): number
}

// ==================== 渲染器注册中心实现 ====================

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
export class Registry implements ISchemaRegistry {
  /** 渲染器存储 */
  private renderers: Map<string, Component>

  /** 默认渲染器类型 */
  private defaultType: string

  constructor(defaultType: string = "text") {
    this.renderers = new Map()
    this.defaultType = defaultType
  }

  // ==================== 注册方法 ====================

  /**
   * 注册渲染器
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
   */
  registerAll(renderers: RendererMap): void {
    Object.entries(renderers).forEach(([type, renderer]) => {
      this.renderers.set(type, renderer)
    })
  }

  // ==================== 获取方法 ====================

  /**
   * 获取渲染器
   *
   * 根据类型获取对应的渲染器组件。未找到则回退到默认类型。
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

  // ==================== 检查方法 ====================

  hasRenderer(type: string): boolean {
    return this.renderers.has(type)
  }

  // ==================== 移除方法 ====================

  unregister(type: string): boolean {
    if (type === this.defaultType) {
      this.defaultType = "text"
    }

    return this.renderers.delete(type)
  }

  clear(): void {
    this.renderers.clear()
    this.defaultType = "text"
  }

  // ==================== 类型管理 ====================

  getTypes(): string[] {
    return Array.from(this.renderers.keys())
  }

  setDefault(type: string): void {
    if (!this.renderers.has(type)) {
      console.warn(
        `[RendererRegistry] Cannot set default to "${type}": renderer not registered`
      )

      return
    }

    this.defaultType = type
  }

  getDefault(): string {
    return this.defaultType
  }

  size(): number {
    return this.renderers.size
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建渲染器注册中心实例
 */
export function createRegistry(defaultType: string = "text"): Registry {
  return new Registry(defaultType)
}

export default Registry
