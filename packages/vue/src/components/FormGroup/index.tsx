/**
 * FormGroup - 分组字段组件
 *
 * 用于渲染 componentType 为 "group" 的分组字段配置。
 * 支持可折叠的分组容器，内部渲染子 columns。
 *
 * @module components/FormGroup
 */

import { defineComponent, PropType, ref } from "vue"
import type { SetupContext, VNodeChild } from "vue"

import classnames from "classnames"

import FormItem from "../FormItem"

import type { ContainerViewNode, Values } from "@schemx/core"

/**
 * FormGroup Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxGroupProps<T extends Values = Values> {
  node: ContainerViewNode
}

const FormGroup = defineComponent(
  <T extends Values = Values>(props: SchemxGroupProps<T>, { slots }: SetupContext) => {
    const collapsed = ref(Boolean(props.node.props.componentProps.defaultCollapsed))

    const toggle = () => {
      if (props.node.props.componentProps.collapsible) {
        collapsed.value = !collapsed.value
      }
    }

    return (): VNodeChild => {
      const node = props.node
      const collapsible = Boolean(node.props.componentProps.collapsible)

      return (
        <div
          class={classnames(
            "schemx-group",
            { "schemx-group--collapsed": collapsed.value },
            node.props.class as string | undefined
          )}
          data-key={node.key}
        >
          {node.props.label && (
            <div
              role={collapsible ? "button" : undefined}
              tabindex={collapsible ? 0 : undefined}
              class={classnames("schemx-group__header", {
                "schemx-group__header--clickable": collapsible,
              })}
              onClick={toggle}
              onKeydown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  toggle()
                }
              }}
            >
              <span class="schemx-group__title">{node.props.label}</span>
              {collapsible && (
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
              {node.children.map((child) => (
                <FormItem key={child.key} node={child} v-slots={slots} />
              ))}
            </div>
          )}
        </div>
      )
    }
  },
  {
    name: "SchemxGroup",

    props: {
      node: {
        type: Object as PropType<ContainerViewNode>,
        required: true,
      },
    },
  }
)

export default FormGroup
