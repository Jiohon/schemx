/**
 * FormNested - 嵌套字段组件
 *
 * 用于渲染 componentType 为 "columns" 的嵌套字段配置。
 * 将子 columns 平铺渲染为 FormItem 列表。
 *
 * @module components/FormNested
 */

import { defineComponent, PropType } from "vue"

import { isBaseColumn } from "../../utils"

import FormItem from "../FormItem"

import type { SchemaNestedColumn } from "../../types"

const FormNested = defineComponent({
  name: "SchemaFormNested",

  props: {
    columns: {
      type: Array as PropType<SchemaNestedColumn["columns"]>,
      required: true,
    },
  },

  setup(props, { slots }) {
    return () => (
      <>
        {props.columns.map((column, index) => {
          const key = isBaseColumn(column)
            ? `${String(column.name)}-${index}`
            : `nested-${index}`

          return <FormItem key={key} column={column} v-slots={slots} />
        })}
      </>
    )
  },
})

export default FormNested
