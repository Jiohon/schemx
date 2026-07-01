/**
 * Descriptor 创建函数。
 *
 * 该模块只负责把单个 schema 转换为 descriptor；递归编排、缓存和失效策略属于
 * compiler 模块。
 *
 * @module core/descriptor/createDescriptor
 */

import { defaultConfig } from "../defaultConfig"
import { useSchemxContext } from "../schemxContext"
import { isDependencySchema, isGroupSchema, NormalizedTrigger } from "../utils"

import type {
  CreateDependencyDescriptorOptions,
  CreateDescriptorOptions,
  CreateFieldDescriptorOptions,
  CreateGroupDescriptorOptions,
  DependencyDescriptor,
  DependencyRenderer,
  FieldDynamicPropsDescriptor,
  FieldDescriptor,
  FieldValidationDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "./types"
import type {
  NamePath,
  SchemxDependencies,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  SchemxRules,
  ValidationTrigger,
  Values,
} from "../types"
import type { SchemxBaseField } from "../types/schema"

/**
 * 创建任意表单 descriptor。
 *
 * @param options - descriptor 创建选项。
 * @returns 编译后的 descriptor。
 */
export function createDescriptor<TValues extends Values = Values>(
  options: CreateDescriptorOptions<TValues>
): FormDescriptor<TValues> {
  const { schema, index, parentKey = "" } = options

  if (isGroupSchema(schema)) {
    return createGroupDescriptor({ schema, index, parentKey })
  }

  if (isDependencySchema(schema)) {
    return createDependencyDescriptor({ schema, parentKey })
  }

  return createFieldDescriptor({ schema, parentKey })
}

/**
 * 创建字段 descriptor。
 *
 * @param options - 字段 descriptor 创建选项。
 * @returns 字段 descriptor。
 */
export function createFieldDescriptor<TValues extends Values = Values>(
  options: CreateFieldDescriptorOptions<TValues>
): FieldDescriptor<TValues> {
  const { schema, parentKey = "" } = options

  const key =
    schema.key ??
    (parentKey ? `field:${parentKey}/${schema.name}` : `field:${schema.name}`)

  const normalizedSchema = buildNormalizedFieldSchema(schema)

  return {
    type: "field",
    key,
    name: schema.name,
    componentType: schema.componentType,
    staticSchema: normalizedSchema,
    dynamicProps: createFieldDynamicProps(schema.dependencies),
    validation: createFieldValidation(normalizedSchema),
  }
}

/**
 * 创建分组 descriptor。
 *
 * @param options - 分组 descriptor 创建选项。
 * @returns 分组 descriptor。
 */
export function createGroupDescriptor<TValues extends Values = Values>(
  options: CreateGroupDescriptorOptions<TValues>
): GroupDescriptor<TValues> {
  const { schema, index, parentKey = "" } = options

  const key = createGroupDescriptorKey(schema.key, index, parentKey)

  const { children: _rawChildren, ...schemaWithoutChildren } = schema

  return {
    type: "group",
    key,
    staticSchema: {
      ...schemaWithoutChildren,
      key,
    } as SchemxResolvedGroupField<TValues>,
    children: [],
  }
}

/**
 * 创建 dependency descriptor。
 *
 * @param options - dependency descriptor 创建选项。
 * @returns dependency descriptor。
 */
export function createDependencyDescriptor<TValues extends Values = Values>(
  options: CreateDependencyDescriptorOptions<TValues>
): DependencyDescriptor<TValues> {
  const { schema, parentKey = "" } = options

  const trigger = [...schema.to]

  const triggerKey = trigger.map(serializeNamePath).join(",")

  const key =
    schema.key ??
    (parentKey ? `dependency:${parentKey}/${triggerKey}` : `dependency:${triggerKey}`)

  const renderer: DependencyRenderer<TValues> = (formApi, abortSignal) => {
    const values = formApi.getValues()

    return schema.renderer(values, formApi, {
      abortSignal,
    })
  }

  return {
    type: "dependency",
    key,
    triggerFields: trigger,
    renderer,
  }
}

/**
 * 根据 componentType 和 placeholder 配置生成字段占位提示文本。
 *
 * @param schema - 字段 schema。
 * @returns 占位提示文本。
 */
function getPlaceholder<TValues extends Values>(
  schema: SchemxBaseField<TValues>
): string {
  const existingplaceholder = schema.componentProps?.placeholder ?? schema.placeholder

  if (existingplaceholder == null) {
    return ["input", "text", "textarea"].includes(schema.componentType)
      ? `请输入${schema.label || schema.name}`
      : `请选择${schema.label || schema.name}`
  }

  return existingplaceholder
}

/**
 * 合并默认值与 schema 配置，生成规范化字段 schema。
 *
 * 字段自身配置优先级最高，其次是表单级 defaultProps，最后是 defaultConfig。
 * 只读态会强制 contentAlign 为 right、labelPosition 为 left。
 *
 * @param schema - 原始字段 schema。
 * @returns 规范化后的字段 schema。
 */
function buildNormalizedFieldSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>
): SchemxResolvedBaseField<TValues> {
  const { defaultProps, instance } = useSchemxContext<TValues>()

  const {
    componentProps: cp,
    visible,
    readonly,
    disabled,
    required,
    rules,
    validationTrigger,
    dependencies: _dependencies,
    ...rest
  } = schema

  const mergedVisible = visible ?? defaultConfig.visible
  const mergedReadonly = readonly ?? defaultProps.readonly ?? defaultConfig.readonly
  const mergedDisabled = disabled ?? defaultProps.disabled ?? defaultConfig.disabled
  const mergedAlign = mergedReadonly ? "right" : (cp?.align ?? rest.contentAlign)
  const mergedValidationTrigger =
    validationTrigger ?? defaultProps.validationTrigger ?? defaultConfig.validationTrigger
  const mergedPlaceholder = getPlaceholder(schema)
  const rulesArray = (Array.isArray(rules) ? rules : [rules]).filter(Boolean)
  const mergedRequired = required ?? (rulesArray.length > 0 || defaultConfig.required)

  const normalizedSchema: SchemxResolvedBaseField<TValues> = {
    ...(rest ?? {}),
    key: rest.key,
    name: rest.name,
    label: rest.label,
    componentType: rest.componentType,

    visible: mergedVisible,
    readonly: mergedReadonly,
    disabled: mergedDisabled,
    required: mergedRequired,
    placeholder: mergedPlaceholder,

    labelIcon: rest.labelIcon || defaultConfig.labelIcon,
    labelAlign: rest.labelAlign || defaultConfig.labelAlign,
    labelPosition: rest.labelPosition || defaultConfig.labelPosition,
    labelWidth: rest.labelWidth || defaultConfig.labelWidth,
    colon: rest.colon ?? defaultConfig.colon,

    rules,
    validationTrigger: normalizeTrigger(mergedValidationTrigger),
  }

  if (Object.hasOwn(schema, "initialValue")) {
    normalizedSchema.initialValue = rest.initialValue
  }

  if (mergedReadonly) {
    normalizedSchema.contentAlign = "right"
    normalizedSchema.labelPosition = "left"
  }

  normalizedSchema.componentProps = {
    ...cp,
    align: mergedAlign,
    readonly: mergedReadonly,
    disabled: mergedDisabled,
    placeholder: mergedPlaceholder,
    formItemProps: normalizedSchema,
    formInstance: instance,
  }

  return normalizedSchema
}

/**
 * 根据字段 dependencies 配置构建动态属性描述。
 *
 * @param dependencies - 字段 dependencies 配置，缺省时返回 null。
 * @returns 动态属性描述，或 null 表示字段无动态属性。
 */
function createFieldDynamicProps<TValues extends Values>(
  dependencies: SchemxDependencies<TValues> | undefined
): FieldDynamicPropsDescriptor<TValues> | null {
  if (!dependencies) {
    return null
  }

  return {
    source: "dependencies",
    triggerFields: dependencies.triggerFields,
    dependencies,
  }
}

/**
 * 从规范化 schema 中提取校验描述。
 *
 * @param schema - 规范化字段 schema。
 * @returns 校验描述，或 null 表示字段无校验资源。
 */
function createFieldValidation<TValues extends Values>(
  schema: SchemxResolvedBaseField<TValues>
): FieldValidationDescriptor<TValues> | null {
  const rules = normalizeValidationRules(schema.rules)

  if (!rules) {
    return null
  }

  return {
    trigger: schema.validationTrigger,
    rules,
  }
}

/**
 * 规范化校验规则：过滤空值，空数组视为无规则。
 *
 * @param rules - 原始 rules 配置。
 * @returns 规范化后的 rules，或 null 表示无规则。
 */
function normalizeValidationRules(
  rules: SchemxRules | readonly SchemxRules[] | undefined
): SchemxRules | readonly SchemxRules[] | null {
  if (rules == null) {
    return null
  }

  if (Array.isArray(rules)) {
    return rules.length > 0 ? rules : null
  }

  return rules
}

/**
 * 生成分组 descriptor 的稳定 key。
 *
 * 优先使用显式 key，否则按 parentKey + index 拼装。
 *
 * @param explicitKey - schema 上显式声明的 key。
 * @param index - schema 在同级列表中的位置。
 * @param parentKey - 父级 descriptor key。
 * @returns 分组 descriptor key。
 */
function createGroupDescriptorKey(
  explicitKey: string | undefined,
  index: number,
  parentKey: string
): string {
  return explicitKey ?? (parentKey ? `group:${parentKey}/${index}` : `group:${index}`)
}

/**
 * 将 NamePath 序列化为字符串，数组用 `.` 连接。
 *
 * @param name - 字段名路径。
 * @returns 序列化后的字符串。
 */
function serializeNamePath(name: NamePath): string {
  if (Array.isArray(name)) {
    return name.join(".")
  }

  return String(name)
}

/**
 * 把外部校验触发方式映射为内部 NormalizedTrigger，未识别值回落到 submit。
 *
 * @param trigger - 原始触发方式或其数组。
 * @returns 规范化后的触发方式或其数组。
 */
function normalizeTrigger(
  trigger: ValidationTrigger | ValidationTrigger[]
): NormalizedTrigger | NormalizedTrigger[] {
  const map: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  const TArray = Array.isArray(trigger) ? trigger : [trigger]

  return TArray.map((t) => map[t] ?? "submit")
}
