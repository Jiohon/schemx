/**
 * FormGroup - 表单分组组件
 *
 * 用于将相关的表单字段组织在一起，支持分组标题、图标显示、
 * 子字段递归渲染以及折叠/展开功能。
 *
 * @module components/FormGroup
 */

import { computed, defineComponent, inject, PropType, ref, Transition } from "vue"
import type { ComputedRef } from "vue"

import { Icon, Image } from "vant"

import classnames from "classnames"

import FormItem from "../FormItem"
import { FORM_CONTEXT_KEY } from "../hooks/useFormContext"

import type {
  BaseColumnConfig,
  ColumnConfig,
  ISchemaRegistry,
  SchemaFormInstance,
} from "../types"

/**
 * FormGroup Props 接口
 */
export interface FormGroupProps {
  label?: string
  labelIcon?: string
  columns?: ColumnConfig[]
  collapsible?: boolean
  defaultCollapsed?: boolean
  className?: string
  form?: SchemaFormInstance
  schemaRenderer?: ISchemaRegistry
  readonly?: boolean
}

/**
 * 类型守卫：判断是否为基础字段配置
 */
function isBaseColumn(column: ColumnConfig): column is BaseColumnConfig {
  return column.componentType !== "dependency"
}

/**
 * FormGroup 组件
 */
const FormGroup = defineComponent({
  name: "SchemaFormGroup",

  props: {
    label: {
      type: String,
      default: "",
    },
    labelIcon: {
      type: String,
      default: "",
    },
    columns: {
      type: Array as PropType<ColumnConfig[]>,
      default: () => [],
    },
    collapsible: {
      type: Boolean,
      default: false,
    },
    defaultCollapsed: {
      type: Boolean,
      default: false,
    },
    className: {
      type: String,
      default: "",
    },
    form: {
      type: Object as PropType<SchemaFormInstance>,
      default: undefined,
    },
    schemaRenderer: {
      type: Object as PropType<ISchemaRegistry>,
      default: undefined,
    },
    readonly: {
      type: Boolean,
      default: undefined,
    },
  },

  setup(props, { slots }) {
    // 从 FormContext 获取上下文（可选，不抛错）
    inject<ComputedRef<SchemaFormInstance> | undefined>(FORM_CONTEXT_KEY, undefined)

    // 渲染器和只读状态
    const rendererRegistry = computed(() => props.schemaRenderer)
    const mergedReadonly = computed(() => props.readonly ?? false)

    // 折叠状态管理
    const isCollapsed = ref(props.defaultCollapsed)

    const toggleCollapse = () => {
      if (props.collapsible) {
        isCollapsed.value = !isCollapsed.value
      }
    }

    const titleClasses = computed(() =>
      classnames("schema-form-group-title", {
        "schema-form-group-title--collapsible": props.collapsible,
        "schema-form-group-title--collapsed": isCollapsed.value,
      })
    )

    const contentClasses = computed(() =>
      classnames("schema-form-group-content", {
        "schema-form-group-content--collapsed": isCollapsed.value,
      })
    )

    /**
     * 获取字段的 key
     */
    const getColumnKey = (column: ColumnConfig, index: number): string => {
      if (isBaseColumn(column)) {
        return `${column.name}-${index}`
      }

      return `dep-${index}`
    }

    return () => (
      <div class={classnames("schema-form-group", props.className)}>
        {(props.label || props.labelIcon) && (
          <div
            class={titleClasses.value}
            onClick={toggleCollapse}
            role={props.collapsible ? "button" : undefined}
            tabindex={props.collapsible ? 0 : undefined}
            aria-expanded={props.collapsible ? !isCollapsed.value : undefined}
            onKeydown={(e: KeyboardEvent) => {
              if (props.collapsible && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                toggleCollapse()
              }
            }}
          >
            {props.labelIcon && (
              <span class="schema-form-group-title-icon">
                <Image src={props.labelIcon} width="20px" height="20px" fit="contain" />
              </span>
            )}

            {props.label && (
              <span class="schema-form-group-title-label">{props.label}</span>
            )}

            {props.collapsible && (
              <span class="schema-form-group-title-arrow">
                <Icon
                  name={isCollapsed.value ? "arrow-down" : "arrow-up"}
                  class="schema-form-group-arrow-icon"
                />
              </span>
            )}
          </div>
        )}

        <Transition name="schema-form-group-collapse">
          {!isCollapsed.value && (
            <div class={contentClasses.value}>
              {props.columns.map((column, index) => (
                <FormItem
                  key={getColumnKey(column, index)}
                  column={column}
                  schemaRenderer={rendererRegistry.value}
                  readonly={mergedReadonly.value}
                  v-slots={slots}
                />
              ))}
            </div>
          )}
        </Transition>
      </div>
    )
  },
})

export default FormGroup
