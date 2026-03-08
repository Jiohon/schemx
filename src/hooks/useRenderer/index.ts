/**
 * useRenderer - 渲染器注册中心 Hook
 *
 * 提供渲染器注册中心的创建与消费能力。
 * SchemaForm 通过 createRenderer 注入注册中心，
 * FormItem 等子组件通过 useRendererContext 获取。
 *
 * @module hooks/useRenderer
 */

import { inject, provide } from "vue"

import { createLocalRegistry, globalRegistry, Registry } from "../../core/registry"

/** 渲染器注册中心注入 key */
const RENDERER_KEY = Symbol("SchemaRenderer")

/**
 * 创建并注入渲染器注册中心
 *
 * 在 SchemaForm 的 setup 中调用。若传入自定义 Registry 则使用该实例，
 * 否则创建一个新的本地注册中心。
 *
 * @param _registry - 可选的自定义注册中心实例
 * @returns 注入的注册中心实例
 *
 * @example
 * ```ts
 * // 使用全局注册中心
 * createRenderer(globalRegistry)
 *
 * // 创建本地注册中心
 * const registry = createRenderer()
 * ```
 */
export function createRenderer(_registry?: Registry): Registry {
  const registry = _registry ? _registry : createLocalRegistry()

  provide(RENDERER_KEY, registry)

  return registry
}

/**
 * 获取渲染器注册中心
 *
 * 在 FormItem 等子组件中调用，获取 createRenderer 注入的注册中心。
 * 若未找到注入的注册中心，回退到全局注册中心。
 *
 * @returns 渲染器注册中心实例
 *
 * @example
 * ```ts
 * const registry = useRendererContext()
 * const Component = registry.get('input')
 * ```
 */
export function useRendererContext(): Registry {
  const registry = inject<Registry>(RENDERER_KEY)

  if (!registry) {
    return globalRegistry
  }

  return registry
}
