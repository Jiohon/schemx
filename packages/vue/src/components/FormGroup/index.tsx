/**
 * FormGroup - 分组字段组件
 *
 * 用于渲染 componentType 为 "group" 的分组字段配置。
 * 支持可折叠的分组容器，内部渲染子 columns。
 *
 * @module components/FormGroup
 */

import { defineComponent, PropType, ref } from "vue"
import type { DefineComponent } from "vue"

import { isBaseSchema } from "@schemx/core"
import classnames from "classnames"

import FormItem from "../FormItem"

import type { SchemxGroupField, Values } from "@schemx/core"

/**
 * FormGroup Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxGroupProps<T extends Values = Values> {
  schema: SchemxGroupField<T>
}

const FormGroup = defineComponent({
  name: "SchemxGroup",

  props: {
    schema: {
      type: Object as PropType<SchemxGroupField>,
      required: true,
    },
  },

  setup(props, { slots }) {
    const groupColumn = props.schema

    const collapsed = ref(groupColumn.defaultCollapsed)

    const toggle = () => {
      if (groupColumn.collapsible) {
        collapsed.value = !collapsed.value
      }
    }

    return () => (
      <div
        class={classnames(
          "schemx-group",
          {
            "schemx-group--collapsed": collapsed.value,
          },
          groupColumn.class
        )}
      >
        {groupColumn.label && (
          <div
            role={groupColumn.collapsible ? "button" : undefined}
            tabindex={groupColumn.collapsible ? 0 : undefined}
            class={classnames("schemx-group__header", {
              "schemx-group__header--clickable": groupColumn.collapsible,
            })}
            onClick={toggle}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                toggle()
              }
            }}
          >
            <span class="schemx-group__title">{groupColumn.label}</span>
            {groupColumn.collapsible && (
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
            {groupColumn.children.map((schema, index) => {
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

export default FormGroup as DefineComponent<SchemxGroupProps>
