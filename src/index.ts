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

// 渲染器导出
export {
  InputRenderer,
  TextRenderer,
  TextAreaRenderer,
  NumberRenderer,
  SwitchRenderer,
  RadioRenderer,
  CheckboxRenderer,
  DateRenderer,
  CalendarRenderer,
  PickerRenderer,
  SelectorRenderer,
  RateRenderer,
  SliderRenderer,
  StepperRenderer,
  UploadRenderer,
  CascaderRenderer,
} from "./renderers"

// 渲染器类型导出
export type {
  InputRendererProps,
  TextRendererProps,
  TextAreaRendererProps,
  CheckboxRendererProps,
  CheckboxOption,
  DateRendererProps,
  CalendarRendererProps,
  NumberRendererProps,
  PickerRendererProps,
  RadioRendererProps,
  RadioOption,
  RateRendererProps,
  SliderRendererProps,
  StepperRendererProps,
  SwitchRendererProps,
  UploadRendererProps,
  UploadFile,
  CascaderRendererProps,
  SelectorRendererProps,
  SelectorOption,
} from "./renderers"

// 插件系统导出
export { default as pluginManager, PluginManager, createPluginManager } from "./plugins"

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
  RendererType,
  ValidationTrigger,
  DynamicProp,
  SchemaFormInstance,
  SchemaColumn,
  SchemaBaseColumn,
  ProcessedColumnConfig,
  SchemaFormProps,
} from "./types"
