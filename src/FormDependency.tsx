/**
 * FormDependency - 依赖字段组件
 *
 * 用于创建依赖于其他字段值的动态表单字段。
 * 当依赖的字段值变化时，会重新调用 renderer 函数生成新的字段配置。
 *
 * @module components/FormDependency
 */

import { computed, defineComponent, PropType, ref, watchEffect } from "vue"

import { isEqual } from "lodash-es"

import FormItem from "./FormItem"
import { useFormContext } from "./hooks/useFormContext"
import { useMountCleanup } from "./hooks/useMountCleanup"

import type { ISchemaRegistry } from "./renderer/createRegistry"
import type { BaseColumnConfig, ColumnConfig, SchemaFormInstance } from "./types"

// ==================== 类型守卫 ====================

/** 判断是否为基础字段配置 */
function isBaseColumn(column: ColumnConfig): column is BaseColumnConfig {
  return column.componentType !== "dependency"
}

// ==================== 类型定义 ====================

/**
 * FormDependency Props 接口
 */
export interface FormDependencyProps {
  /** 依赖的字段名数组 */
  to: string[]
  /** 渲染函数，根据依赖字段的值返回字段配置 */
  renderer: (
    values: Record<string, any>,
    form: SchemaFormInstance,
    isDependenceUpdated: boolean
  ) => ColumnConfig[] | Promise<ColumnConfig[]>
  /** 是否只读 */
  readonly?: boolean
  /** 表单实例（可选，默认从 form 获取） */
  form?: SchemaFormInstance
  /** 渲染器注册中心（可选） */
  schemaRenderer?: ISchemaRegistry
}

// ==================== 组件定义 ====================

/**
 * FormDependency 组件
 *
 * @example
 * ```tsx
 * <FormDependency
 *   to={['country']}
 *   renderer={(values, form, isDependenceUpdated) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', componentType: 'picker', label: '省份' }]
 *     }
 *     return []
 *   }}
 * />
 * ```
 */
const FormDependency = defineComponent({
  name: "SchemaFormDependency",

  props: {
    to: {
      type: Array as PropType<string[]>,
      required: true,
    },
    renderer: {
      type: Function as PropType<
        (
          values: Record<string, any>,
          form: SchemaFormInstance,
          isDependenceUpdated: boolean
        ) => ColumnConfig[] | Promise<ColumnConfig[]>
      >,
      required: true,
    },
  },

  setup(props, { slots }) {
    // 是否已初始化
    let isInitialized = false

    // ==================== 获取上下文 ====================

    const context = useFormContext()

    // ==================== 状态管理 ====================
    const form = computed(() => context.value.form)

    /** 渲染的字段配置 */
    const renderColumns = ref<ColumnConfig[]>([])

    /** 当前依赖字段的值 */
    const currentValues = ref<Record<string, any>>(
      form.value?.getFieldsValue(props.to || []) || {}
    )

    // ==================== 订阅依赖字段变化 ====================

    useMountCleanup(() => {
      const unsubscribes: Array<() => void> = []

      ;(props.to || []).forEach((fieldName) => {
        const unsubscribe = form.value?.subscribe(
          fieldName,
          (_path: string, value: any) => {
            const prevValue = currentValues.value[fieldName]
            if (prevValue === value) return
            currentValues.value = {
              ...currentValues.value,
              [fieldName]: value,
            }
          }
        )
        if (unsubscribe) unsubscribes.push(unsubscribe)
      })

      return () => unsubscribes.forEach((fn) => fn?.())
    })

    // ==================== 监听依赖字段变化并调用 renderer ====================

    watchEffect(async () => {
      try {
        const updatedValues = form.value?.getFieldsValue(props.to || []) || {}
        const isDependenceUpdated = !isInitialized
          ? true
          : !isEqual(currentValues.value, updatedValues)

        if (props.renderer && form) {
          renderColumns.value = await props.renderer(
            { ...updatedValues },
            form.value,
            isDependenceUpdated
          )
        }
      } catch (error) {
        throw new Error(String(error))
      } finally {
        isInitialized = true
      }
    })

    // ==================== 渲染 ====================

    return () => (
      <>
        {renderColumns.value.map((column, index) => (
          <FormItem
            key={`${isBaseColumn(column) ? column.name : "dep"}-${index}`}
            column={column}
            v-slots={slots}
          />
        ))}
      </>
    )
  },
})

export default FormDependency
