/**
 * 注册中心模块。
 *
 * 聚合渲染器注册中心和校验规则注册中心的公开 API。
 * 用于注册自定义组件渲染器和校验规则工厂。
 *
 * @module core/registry
 */

export {
  createRendererRegistry,
  RendererRegistry,
  type RegistryOptions,
  type RendererMap,
} from "./rendererRegistry"

export {
  createRulesRegistry,
  RulesRegistry,
  type RuleRegistryOptions,
  type RuleFactory,
  type RuleEntry,
  type RuleEntryMap,
} from "./rulesRegistry"
