// 样式导入 - 确保样式被编译到 dist/style.css
import "./styles/index.scss"

// 默认导出
export { default } from "./SchemaForm"
export { default as SchemaForm } from "./SchemaForm"

// 核心功能导出
export * from "./core"

// 渲染层导出
export * from "./renderer"

// hooks 导出
export * from "./hooks"
export { FORM_CONTEXT_KEY } from "./hooks/useFormContext"

// 组件导出
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"

// 工具函数导出
export {
  findTreeItem,
  isCamelCase,
  isKebabCase,
  isLowerCase,
  camelToKebab,
  kebabToCamel,
  getFieldProps,
  findDiffProps,
  isObject,
  deepFreeze,
  randomString,
  getFileName,
  stringToHash,
} from "./utils"

// Utils 类型导出
export type { TreeFindOptions, TreeFindResult } from "./utils"

// SchemaForm 实例类型导出
export type { SchemaFormInstallOptions } from "./SchemaForm"

// 类型导出
export type {
  FormValues,
  CustomRendererTypes,
  CustomRendererPropsMap,
  RendererPropsMap,
  RendererType,
  ValidationTrigger,
  DynamicProp,
  FormInstance,
  SchemaColumn,
  SchemaBaseColumn,
  ProcessedColumnConfig,
  SchemaFormProps,
} from "./types"
