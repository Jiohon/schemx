/**
 * 类型定义统一导出
 *
 * @module types
 */

/** 基础类型 */
export type {
  Value,
  Values,
  NamePath,
  ValidationTrigger,
  SchemxInstance,
  SchemxInternalHooks,
} from "./form"

/** 规则类型 */
export type {
  SchemxRuleDefinition,
  SchemxRuleDefinitionKey,
  SchemxBuiltinRules,
  SchemxRules,
} from "./rule"

/** 渲染器类型 */
export type { SchemxRendererKey, SchemxRendererDefinition } from "./renderer"

/** Schema 列配置类型 */
export type {
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxFieldDefinition,
  SchemxGroupFieldDefinition,
  SchemxBase,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  SchemxResolvedGroupField,
  SchemxGroupField,
  SchemxDependencyField,
  SchemxBaseField,
  SchemxField,
  SchemxFormItemProps,
} from "./schema"

/** 表单组件 Props 类型 */
export type { SchemxProps, SchemxGlobalContext } from "./form"

/** 深层路径类型工具 */
export type { DeepNamePath } from "./namePathType"

/** 框架无关的工具类型 */
export type { DeepReadonly, CSSProperties } from "./readonly"

/** TypeScript 工具类型 */
export type { Exact } from "./utils"

/** 动态属性解析类型 */
export { type Dynamic } from "./dynamic"

/** 依赖对象类型 */
export type {
  SchemxConditionFn,
  SchemxDependencies,
  SchemxDependenciesConditionKey,
  SchemxDependenciesStaticProps,
} from "./dependencies"

/** 字典对象类型 */
export type { SchemxDictionary, SchemxWithDictionary } from "./dictionary"

/** Standard Schema 类型 */
export type { StandardSchemaV1 } from "./standardSchema"
