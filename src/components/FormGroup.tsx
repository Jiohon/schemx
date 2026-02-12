/**
 * FormGroup - 分组字段组件
 *
 * 用于渲染 componentType 为 "group" 的分组字段配置。
 * 支持可折叠的分组容器，内部渲染子 columns。
 *
 * @module components/FormGroup
 */

import { defineComponent, PropType, ref } from "vue"

import classnames from "classnames"

import { isBaseColumn } from "../utils"

import FormItem from "./FormItem"

import type { SchemaGroupColumn } from "../types"

// ==================== 组件定义 ====================

const FormGroup = defineComponent({
  name: "SchemaFormGroup",

  props: {
    label: {
      type: String,
      default: undefined,
    },
    columns: {
      type: Array as PropType<SchemaGroupColumn["columns"]>,
      required: true,
    },
    collapsible: {
      type: Boolean,
      default: false,
    },
    defaultCollapsed: {
      type: Boolean,
      default: false,
    },
  },

  setup(props, { slots }) {
    const collapsed = ref(props.defaultCollapsed)

    const toggle = () => {
      if (props.collapsible) {
        collapsed.value = !collapsed.value
      }
    }

    return () => (
      <div
        class={classnames("schema-form-group", {
          "schema-form-group--collapsed": collapsed.value,
        })}
      >
        {props.label && (
          <div
            role={props.collapsible ? "button" : undefined}
            tabindex={props.collapsible ? 0 : undefined}
            class={classnames("schema-form-group__header", {
              "schema-form-group__header--clickable": props.collapsible,
            })}
            onClick={toggle}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                toggle()
              }
            }}
          >
            <span class="schema-form-group__title">{props.label}</span>
            {props.collapsible && (
              <span
                class={classnames("schema-form-group__arrow", {
                  "schema-form-group__arrow--down": !collapsed.value,
                })}
              />
            )}
          </div>
        )}
        {!collapsed.value && (
          <div class="schema-form-group__body">
            {props.columns.map((column, index) => {
              const key = isBaseColumn(column)
                ? `${String(column.name)}-${index}`
                : `group-${index}`

              return <FormItem key={key} column={column} v-slots={slots} />
            })}
          </div>
        )}
      </div>
    )
  },
})

export default FormGroup
