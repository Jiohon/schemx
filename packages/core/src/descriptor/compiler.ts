/**
 * Schema 编译器。
 *
 * 将 SchemxField[] 编译为 FormDescriptor[]。
 * 不修改原始 schema，生成稳定的 descriptor 顺序。
 *
 * @module core/descriptor/compiler
 */

import { isDependencySchema, isGroupSchema, normalizeSchemas } from "../utils"

import type {
  DependencyDescriptor,
  DependencyRenderer,
  FieldDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "./descriptor"
import type {
  NamePath,
  SchemxDefaultProps,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  SchemxRules,
  Values,
} from "../types"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
} from "../types/schema"

/**
 * 编译器选项。
 */
export interface CompileOptions extends SchemxDefaultProps {}

/**
 * 编译错误。
 */
class CompileErrorImpl extends Error {
  /**
   * Schema key（如果可提取）。
   */
  readonly schemaKey?: string

  /**
   * Schema name path。
   */
  readonly schemaName?: NamePath

  constructor(message: string, schema?: any) {
    super(message)
    this.name = "CompileError"

    if (schema && "name" in schema) {
      this.schemaName = schema.name as NamePath
    }

    if (schema && "key" in schema && schema.key) {
      this.schemaKey = schema.key
    }
  }
}

/**
 * CompileError 的实例类型。
 */
export type CompileError = InstanceType<typeof CompileErrorImpl>

/**
 * CompileError 运行时构造器。
 */
export const CompileError = CompileErrorImpl

/**
 * 将 SchemxField[] 编译为 FormDescriptor[]。
 *
 * @param schemas - 原始 schema 列表
 * @param options - 编译器选项
 * @param parentKey - 父容器 key，用于生成稳定的子节点 key
 * @returns FormDescriptor 列表
 * @throws CompileError - schema 无效时
 */
export function compileToDescriptors<TValues extends Values>(
  schemas: SchemxField<TValues>[],
  options: CompileOptions = {},
  parentKey = ""
): FormDescriptor<TValues>[] {
  const descriptors: FormDescriptor<TValues>[] = []

  const normalized = normalizeSchemas(schemas)

  for (let i = 0; i < normalized.length; i++) {
    const schema = normalized[i]

    let descriptor = undefined

    if (isGroupSchema(schema)) {
      descriptor = compileGroup<TValues>(schema, i, options, parentKey)
    } else if (isDependencySchema(schema)) {
      descriptor = compileDependencySlot<TValues>(schema, i, parentKey)
    } else {
      descriptor = compileField<TValues>(schema, i, options, parentKey)
    }

    descriptors.push(descriptor)
  }

  return descriptors
}

/**
 * 编译字段 schema。
 */
function compileField<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  index: number,
  options: CompileOptions = {},
  parentKey = ""
): FieldDescriptor<TValues> {
  const key =
    schema.key ??
    (parentKey ? `field:${parentKey}/${schema.name}` : `field:${schema.name}`)

  // 构建规范化 schema
  const normalizedSchema = buildNormalizedFieldSchema<TValues>(schema, options)

  return {
    type: "field",
    key,
    name: schema.name,
    rendererType: schema.componentType,
    schema: normalizedSchema,
    dependencies: schema.dependencies,
  }
}

/**
 * 编译分组 schema。
 */
function compileGroup<TValues extends Values>(
  schema: SchemxGroupField<TValues>,
  index: number,
  options: CompileOptions = {},
  parentKey = ""
): GroupDescriptor<TValues> {
  const key = schema.key ?? (parentKey ? `group:${parentKey}/${index}` : `group:${index}`)

  const { children: rawChildren, ...schemaWithoutChildren } = schema

  const children = compileToDescriptors<TValues>(rawChildren, options, key)

  return {
    type: "group",
    key,
    schema: {
      ...schemaWithoutChildren,
      key,
    } as SchemxResolvedGroupField<TValues>,
    children,
  }
}

/**
 * 编译 dependency schema 为 dependencySlot 描述符。
 *
 * 外部 schema 仍使用 `componentType: "dependency"` 表达"依赖字段生成子树"；
 * 表单内部用 dependencySlot 承载这段可替换子树。
 */
function compileDependencySlot<TValues extends Values>(
  schema: SchemxDependencyField<TValues>,
  index: number,
  parentKey = ""
): DependencyDescriptor<TValues> {
  const key =
    schema.key ?? (parentKey ? `dependency:${parentKey}/${index}` : `dependency:${index}`)

  if (!schema.to || schema.to.length === 0) {
    throw new CompileError("Dependency schema must have non-empty trigger fields", schema)
  }

  const trigger = [...schema.to]

  const renderer: DependencyRenderer<TValues> = (formApi, abortSignal) => {
    const values = formApi.getValues()

    return schema.renderer(values, formApi, {
      abortSignal,
    })
  }

  return {
    type: "dependency",
    key,
    trigger,
    renderer,
  }
}

/**
 * 从 raw schema 构建内部规范化后的字段 schema。
 */
function buildNormalizedFieldSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  options: CompileOptions = {}
): SchemxResolvedBaseField<TValues> {
  const {
    componentProps: cp,
    visible,
    readonly,
    disabled,
    required,
    placeholder,
    rules,
    validationTrigger,
    dependencies: _dependencies,
    ...rest
  } = schema

  const mergedVisible = cp?.visible ?? visible ?? true
  const mergedReadonly = cp?.readonly ?? readonly ?? options.readonly ?? false
  const mergedDisabled = cp?.disabled ?? disabled ?? options.disabled ?? false
  const mergedRequired = Object.hasOwn(cp ?? {}, "required") || hasRequiredRule(rules)
  const mergedPlaceholder = cp?.placeholder ?? placeholder ?? ""
  const mergedRules = mergeRules(mergedRequired, rules)

  const componentProps: SchemxBaseField<TValues>["componentProps"] = {
    ...cp,
    readonly: mergedReadonly,
    disabled: mergedDisabled,
    required: mergedRequired,
    placeholder: mergedPlaceholder,
  }

  return {
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
    componentProps: componentProps,
    initialValue: rest.initialValue,

    labelIcon: rest.labelIcon,
    labelAlign: rest.labelAlign,
    labelPosition: rest.labelPosition,
    labelWidth: rest.labelWidth,
    contentAlign: rest.contentAlign,
    colon: rest.colon,

    rules: mergedRules,
    validationTrigger,
  }
}

/**
 * 检查 rules 中是否包含必填规则。
 */
function hasRequiredRule(rules?: SchemxRules | SchemxRules[]): boolean {
  if (!rules) return false

  if (Array.isArray(rules)) {
    return rules.length > 0
  }

  return true
}

/**
 * 合并 rules 规则。
 */
function mergeRules(
  required: boolean,
  rules?: SchemxRules | SchemxRules[]
): SchemxRules | SchemxRules[] {
  if (rules) {
    if (!required) return rules

    if (Array.isArray(rules)) {
      if (rules.includes("required")) return rules

      return ["required", ...rules]
    }

    if (rules === "required") return rules

    return ["required", rules]
  }

  return required ? "required" : []
}
