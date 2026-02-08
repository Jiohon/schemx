import { inject, provide } from "vue"

import { createRegistry, type ISchemaRegistry } from "../renderer/createRegistry"
import { registerDefaultRenderers } from "../renderer/defaultRenderers"

const RENDERER_KEY = Symbol("SchemaRenderer")

export interface UseRendererOptions {
  /** 跳过默认渲染器注册 */
  skipDefaults?: boolean
  /** 自定义注册回调 */
  setup?: (registry: ISchemaRegistry) => void
}

/**
 * 创建并提供渲染器注册中心
 * 在 SchemaForm 的 setup 中调用
 */
export function useRenderer(options: UseRendererOptions = {}): ISchemaRegistry {
  const registry = createRegistry()

  if (!options.skipDefaults) {
    registerDefaultRenderers(registry)
  }

  options.setup?.(registry)

  provide(RENDERER_KEY, registry)

  return registry
}

/**
 * 在子组件中获取渲染器注册中心
 * 在 FormItem 等子组件中调用
 */
export function useRendererContext(): ISchemaRegistry {
  const registry = inject<ISchemaRegistry>(RENDERER_KEY)

  if (!registry) {
    throw new Error("[useRendererContext] 必须在 useRenderer 提供的上下文中使用")
  }

  return registry
}
