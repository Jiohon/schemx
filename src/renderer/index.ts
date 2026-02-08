// RendererRegistry
export {
  createRegistry,
  Registry,
  type ISchemaRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./createRegistry"

// createRenderWrapper 工厂函数
export { createRenderWrapper, type CreateRenderWrapperOptions } from "./rendererWrapper"

// 导出 defaultRenderer 相关
export {
  DEFAULT_RENDERER_TYPES,
  registerDefaultRenderers,
  hasAllDefaultRenderers,
  getMissingDefaultRenderers,
  type DefaultRendererType,
  type RendererRegistrationConfig,
} from "./defaultRenderers"
