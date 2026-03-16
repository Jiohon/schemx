/**
 * FormDependency - 依赖字段组件
 *
 * 用于创建依赖于其他字段值的动态表单字段。
 * 当依赖的字段值变化时，会重新调用 renderer 函数生成新的字段配置。
 *
 * @module components/FormDependency
 */

import { defineComponent, PropType } from "vue"

import { isBaseSchema } from "@schemx/core"

import { useDependency } from "@/hooks"

import FormItem from "../FormItem"

import type { SchemaDependencyField } from "@schemx/core"

/**
 * FormDependency Props 接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FormDependencyProps extends Omit<
  SchemaDependencyField,
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
      type: Array as PropType<SchemaDependencyField["to"]>,
      required: true,
    },
    renderer: {
      type: Function as PropType<SchemaDependencyField["renderer"]>,
      required: true,
    },
  },

  setup(props, { slots }) {
    const { schemas } = useDependency(props.to, props.renderer)

    return () => (
      <>
        {schemas.value.map((schema, index) => (
          <FormItem
            key={`${isBaseSchema(schema) ? schema.name : "dep"}-${index}`}
            schema={schema}
            v-slots={slots}
          />
        ))}
      </>
    )
  },
})

export default FormDependency
