<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup>
  import { computed, type CSSProperties, onMounted, useAttrs } from "vue"

  import { rendererRegistry as defaultRendererRegistry, isBaseSchema } from "@schemx/core"
  import { omit } from "es-toolkit"

  import FormItem from "./components/FormItem"
  import { createContext } from "./hooks/useContext"
  import { useForm } from "./hooks/useForm"
  import { createRenderer } from "./hooks/useRenderer"
  import { collectObjectPathsByLeaf } from "./utils/path"
  import { requestProvider } from "./utils/requestProvider"

  import type { SchemxFormProps } from "./types/form"
  import type { SchemxField } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxForm" })

  const props = withDefaults(defineProps<SchemxFormProps>(), {
    modelValue: () => ({}),
    initialValues: () => ({}),
    validationTrigger: "onBlur",
    form: undefined,
    schemas: () => [],
    readonly: false,
    disabled: false,
    labelWidth: "auto",
    labelAlign: "right",
    labelPosition: "left",
    colon: true,
    className: "",
    style: () => ({}),
    onFinish: undefined,
    onFinishFailed: undefined,
    onValuesChange: undefined,
    onFieldsChange: undefined,
    rendererRegistry: undefined,
    request: undefined,
  })

  const emit = defineEmits<{
    "update:modelValue": [value: Record<string, any>]
  }>()

  const attrs = useAttrs()

  /**
   * 创建 FormContext 上下文
   *
   * 为子组件提供表单配置信息。
   */
  createContext(
    omit(props, [
      "form",
      "modelValue",
      "rendererRegistry",
      "onFinish",
      "onFinishFailed",
      "onValuesChange",
      "onFieldsChange",
    ])
  )

  /**
   * 获取或创建表单实例
   *
   * 优先使用外部传入的 form，否则内部通过 useForm 创建。
   * 必须在 setup 同步阶段调用，确保 provide 正确注入。
   */
  const form = props.form
    ? props.form
    : useForm({
        schemas: props.schemas,
        initialValues: props.initialValues,

        onFinish: async (values) => {
          props.onFinish?.(values)
        },
        onFinishFailed: async (errors) => {
          props.onFinishFailed?.(errors)
        },
        onValuesChange: (changedValues, latestSnapshot) => {
          emit("update:modelValue", latestSnapshot)
          props.onValuesChange?.(changedValues, latestSnapshot)
          props.onFieldsChange?.(
            collectObjectPathsByLeaf(changedValues),
            collectObjectPathsByLeaf(latestSnapshot)
          )
        },
        onFieldsChange: (changedPaths, allPaths) => {
          props.onFieldsChange?.(changedPaths, allPaths)
        },
      })

  if (!props.rendererRegistry) {
    createRenderer(defaultRendererRegistry)
  }

  onMounted(() => {
    if (props.request && typeof props.request === "function") {
      requestProvider.register(props.request)
    }
  })

  defineExpose({
    ...form,
  })

  /**
   * 生成 schema 的唯一 key
   *
   * @param schema - 字段配置
   * @param index - 数组索引（作为 fallback）
   */
  const getSchemaKey = (schema: SchemxField, index: number): string => {
    return `${schema.componentType}-${isBaseSchema(schema) ? String(schema.name) : index}`
  }

  /**
   * 合并 schema 与 attrs
   *
   * @param schema - 字段配置
   */
  const mergeSchemaAttrs = (schema: SchemxField): SchemxField => {
    return { ...schema, ...attrs } as SchemxField
  }

  /**
   * 表单容器样式
   */
  const formStyle = computed<CSSProperties>(() => ({
    "--schemx-input-align": (attrs.align as string) ?? "right",
  }))
</script>

<template>
  <div :class="['schemx', className]" :style="formStyle">
    <FormItem
      v-for="(schema, index) in schemas"
      :key="getSchemaKey(schema, index)"
      :schema="mergeSchemaAttrs(schema)"
    >
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps ?? {}" />
      </template>
    </FormItem>
  </div>
</template>
