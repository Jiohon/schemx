/**
 * 类型定义统一导出
 *
 * @module types
 */

/** 基础类型 */
export type {
  ResolveDynamic,
  Value,
  FormValues,
  NamePath,
  ValidationTrigger,
  DynamicProp,
  CustomRules,
} from "./base"

/** 渲染器类型 */
export type {
  CustomRendererTypes,
  RendererType,
  CustomRendererPropsMap,
  RendererPropsMap,
  RendererMap,
  RendererContext,
} from "./renderer"

/** Schema 列配置类型 */
export type {
  SchemaBaseColumn,
  SchemaNestedColumn,
  SchemaGroupColumn,
  SchemaDependencyColumn,
  SchemaBaseColumnUnion,
  SchemaColumn,
  NormalizedSchemaBaseColumn,
  NormalizedSchemaNestedColumn,
  NormalizedSchemaGroupColumn,
  NormalizedSchemaDependencyColumn,
  NormalizedSchemaColumn,
} from "./schema"

/** 表单组件 Props 类型 */
export type {
  ComponentsProps,
  ColumnComponentsProps,
  ProcessedColumnComponentsProps,
  FormItemProps,
  ProcessedFormItemProps,
  ProcessedColumnConfig,
  SchemaFormProps,
  GlobalContext,
} from "./form"

/** 表单实例接口 */
export type { SchemaFormInstance } from "./instance"

/** 深层路径类型工具 */
export type { DeepNamePath } from "./namePathType"
