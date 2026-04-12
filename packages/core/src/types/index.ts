/**
 * 类型定义统一导出
 *
 * @module types
 */

/** 基础类型 */
export type {
  Value,
  FormValues,
  NamePath,
  ValidationTrigger,
  SchemxInstance,
} from "./form"

/** 规则类型 */
export type { CustomRulesKey, BuiltinRules, SchemxRules } from "./rule"

/** 渲染器类型 */
export type { RendererType, RendererDefinition } from "./renderer"

/** Schema 列配置类型 */
export type {
  BaseComponentProps,
  ComponentProps,
  FieldDefinition,
  SchemxBase,
  SchemxGroupField,
  SchemxDependencyField,
  SchemxBaseField,
  SchemxField,
  FormItemProps,
} from "./schema"

/** 表单组件 Props 类型 */
export type { SchemxProps, GlobalContext } from "./form"

/** 深层路径类型工具 */
export type { DeepNamePath } from "./namePathType"

/** 框架无关的工具类型 */
export type { DeepReadonly, CSSProperties } from "./readonly"

/** TypeScript 工具类型 */
export type { Exact } from "./utils"
