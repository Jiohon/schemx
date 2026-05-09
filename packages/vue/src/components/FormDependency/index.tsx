/**
 * FormDependency - 依赖字段组件
 *
 * 用于创建依赖于其他字段值的动态表单字段。
 * 当依赖的字段值变化时，会重新调用 renderer 函数生成新的字段配置。
 *
 * @module components/FormDependency
 */

import { defineComponent, PropType } from "vue"
import type { DefineComponent } from "vue"

import { useDependency } from "@/hooks/useDependency"

import FormItem from "../FormItem"

import type { SchemxDependencyField, Values } from "@schemx/core"

/**
 * FormDependency Props
 *
 * @typeParam T - 表单值类型
 */
export interface FormDependencyProps<T extends Values = Values> extends Omit<
  SchemxDependencyField<T>,
  "componentType"
> {}

/**
 * FormDependency 组件
 *
 * @example
 * ```tsx
 * <FormDependency
 *   to={['country']}
 *   renderer={(values, form) => {
 *     if (values.country === 'CN') {
 *       return [{ name: 'province', componentType: 'picker', label: '省份' }]
 *     }
 *     return []
 *   }}
 * />
 * ```
 */
const FormDependency = defineComponent({
  name: "SchemxDependency",

  props: {
    to: {
      type: Array as PropType<SchemxDependencyField["to"]>,
      required: true,
    },
    renderer: {
      type: Function as PropType<SchemxDependencyField["renderer"]>,
      required: true,
    },
  },

  setup(props, { slots }) {
    const { schemas } = useDependency(props.to, props.renderer)

    return () => (
      <>
        {schemas.value.map((schema, index) => (
          <FormItem key={`dependency-${index}`} schema={schema as any} v-slots={slots} />
        ))}
      </>
    )
  },
})

export default FormDependency as DefineComponent<FormDependencyProps>
