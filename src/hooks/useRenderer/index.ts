import { inject, provide } from "vue"

import { createLocalRegistry, globalRegistry, Registry } from "../../core/registry"

const RENDERER_KEY = Symbol("SchemaRenderer")

/**
 * 创建并提供渲染器注册中心
 * 在 SchemaForm 的 setup 中调用
 */
export function createRenderer(_registry?: Registry): Registry {
  const registry = _registry ? _registry : createLocalRegistry()

  provide(RENDERER_KEY, registry)

  return registry
}

/**
 * 在子组件中获取渲染器注册中心
 * 在 FormItem 等子组件中调用
 */
export function useRendererContext(): Registry {
  const registry = inject<Registry>(RENDERER_KEY)

  if (!registry) {
    return globalRegistry
    // throw new Error("[useRendererContext] 必须在 useRenderer 提供的上下文中使用")
  }

  return registry
}
