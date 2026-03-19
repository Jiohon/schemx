/**
 * FormGroup - 分组字段组件
 *
 * 用于渲染 componentType 为 "group" 的分组字段配置。
 * 支持可折叠的分组容器，内部渲染子 columns。
 *
 * @module components/FormGroup
 */

import { defineComponent, PropType, ref } from "vue"

import { isBaseSchema } from "@schemx/core"
import classnames from "classnames"

import FormItem from "../FormItem"

import type { SchemaGroupField } from "@schemx/core"

const FormGroup = defineComponent({
  name: "SchemxGroup",

  props: {
    label: {
      type: String,
      default: undefined,
    },
    children: {
      type: Array as PropType<SchemaGroupField["children"]>,
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
        class={classnames("schemx-group", {
          "schemx-group--collapsed": collapsed.value,
        })}
      >
        {props.label && (
          <div
            role={props.collapsible ? "button" : undefined}
            tabindex={props.collapsible ? 0 : undefined}
            class={classnames("schemx-group__header", {
              "schemx-group__header--clickable": props.collapsible,
            })}
            onClick={toggle}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                toggle()
              }
            }}
          >
            <span class="schemx-group__title">{props.label}</span>
            {props.collapsible && (
              <span
                class={classnames("schemx-group__arrow", {
                  "schemx-group__arrow--down": !collapsed.value,
                })}
              />
            )}
          </div>
        )}
        {!collapsed.value && (
          <div class="schemx-group__body">
            {props.children.map((schema, index) => {
              const key = isBaseSchema(schema)
                ? `${schema.name}-${index}`
                : `group-${index}`

              return <FormItem key={key} schema={schema} v-slots={slots} />
            })}
          </div>
        )}
      </div>
    )
  },
})

export default FormGroup
