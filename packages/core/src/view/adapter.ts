/**
 * ViewAdapter 与 RendererRegistry 契约接口。
 *
 * Adapter 必须实现 ViewAdapter 以消费 ViewNode 树。
 * 契约接口不暴露任何内部类型（Fiber、Store、DependencyEffectSlot）。
 *
 * @module core/view/adapter
 */

import type { NamePath } from "../types"
import type { SchemxRendererKey, ViewNode } from "./types"

/**
 * Adapter 契约接口。
 *
 * Adapter 必须实现此接口以消费 ViewNode 树。
 * 接口不暴露任何内部类型（Fiber、Store、DependencyEffectSlot）。
 */
export interface ViewAdapter {
  /**
   * 兼容旧命名：渲染视图树。
   */
  render?(viewTree: readonly ViewNode[]): void

  /**
   * 渲染视图树。
   *
   * 当 ViewTree 为空数组时，应正常处理且不抛出异常。
   *
   * @param viewTree - ViewNode 树（只读）
   */
  renderer?(viewTree: readonly ViewNode[]): void

  /**
   * 处理字段值变更。
   *
   * 当 name 为无效的 NamePath（空数组或包含非字符串元素）时，
   * 应抛出 TypeError。
   *
   * @param name - 字段 name path
   * @param value - 新值
   * @throws TypeError - name 无效时
   */
  onFieldValueChange(name: NamePath, value: unknown): void

  /**
   * 处理字段触碰。
   *
   * 当 name 为无效的 NamePath 时，应抛出 TypeError。
   *
   * @param name - 字段 name path
   * @throws TypeError - name 无效时
   */
  onFieldTouched(name: NamePath): void
}

/**
 * 渲染器注册表。
 *
 * 用于注册和获取渲染组件。
 */
export interface RendererRegistry {
  /**
   * 注册渲染器。
   *
   * @param key - 渲染器标识
   * @param renderer - 渲染器实现
   */
  register(key: SchemxRendererKey, renderer: unknown): void

  /**
   * 获取渲染器。
   *
   * @param key - 渲染器标识
   * @returns 渲染器实现或 undefined
   */
  get(key: SchemxRendererKey): unknown | undefined

  /**
   * 检查渲染器是否存在。
   *
   * @param key - 渲染器标识
   * @returns 是否已注册
   */
  has(key: SchemxRendererKey): boolean
}

/**
 * 校验 NamePath 是否有效。
 *
 * @param name - 字段 name path
 * @returns 是否有效
 */
export function validateNamePath(name: unknown): name is NamePath {
  if (typeof name === "string") {
    return name.length > 0
  }

  if (Array.isArray(name)) {
    return (
      name.length > 0 &&
      name.every((segment) => typeof segment === "string" && segment.length > 0)
    )
  }

  return false
}

/**
 * Adapter 安全桥接。
 *
 * 在 wrapper 中统一校验 NamePath，无效时抛出 TypeError。
 * renderer 方法直接转发空数组，不做额外校验。
 *
 * @param adapter - 目标 Adapter 实例
 * @returns 带安全校验的 Adapter wrapper
 */
export function createViewAdapterBridge(adapter: ViewAdapter): ViewAdapter {
  const render = (viewTree: readonly ViewNode[]): void => {
    const renderer = adapter.renderer ?? adapter.render

    if (!renderer) {
      throw new TypeError("ViewAdapter requires renderer or render")
    }

    renderer.call(adapter, viewTree)
  }

  return {
    render,

    renderer(viewTree: readonly ViewNode[]): void {
      render(viewTree)
    },

    onFieldValueChange(name: NamePath, value: unknown): void {
      if (!validateNamePath(name)) {
        throw new TypeError(
          `Invalid NamePath: ${JSON.stringify(name)}. Expected non-empty string or string array.`
        )
      }

      adapter.onFieldValueChange(name, value)
    },

    onFieldTouched(name: NamePath): void {
      if (!validateNamePath(name)) {
        throw new TypeError(
          `Invalid NamePath: ${JSON.stringify(name)}. Expected non-empty string or string array.`
        )
      }

      adapter.onFieldTouched(name)
    },
  }
}
