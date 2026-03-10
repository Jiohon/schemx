/**
 * FormDependency - 依赖字段组件
 *
 * 用于创建依赖于其他字段值的动态表单字段。
 * 当依赖的字段值变化时，会重新调用 renderer 函数生成新的字段配置。
 *
 * @module components/FormDependency
 */

import { defineComponent, PropType } from "vue"

import { useDependency } from "../../hooks"
import { isBaseColumn } from "../../utils"
import FormItem from "../FormItem"

import type { SchemaDependencyColumn } from "../../types"

/**
 * FormDependency Props 接口
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FormDependencyProps extends Omit<
  SchemaDependencyColumn,
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
  name: "SchemaFormDependency",

  props: {
    to: {
      type: Array as PropType<SchemaDependencyColumn["to"]>,
      required: true,
    },
    renderer: {
      type: Function as PropType<SchemaDependencyColumn["renderer"]>,
      required: true,
    },
  },

  setup(props, { slots }) {
    const { columns } = useDependency(props.to, props.renderer)

    return () => (
      <>
        {columns.value.map((column, index) => (
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
