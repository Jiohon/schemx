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
export type { RendererType, CustomRendererMap } from "./renderer"

/** Schema 列配置类型 */
export type {
  SchemaBaseColumn,
  SchemaNestedColumn,
  SchemaGroupColumn,
  SchemaDependencyColumn,
  SchemaBaseColumnUnion,
  SchemaColumn,
} from "./schema"

/** 表单组件 Props 类型 */
export type {
  ComponentsProps,
  ColumnComponentsProps,
  FormItemProps,
  SchemaFormProps,
  GlobalContext,
} from "./form"

/** 表单实例接口 */
export type { SchemaFormInstance } from "./instance"

/** 深层路径类型工具 */
export type { DeepNamePath } from "./namePathType"
