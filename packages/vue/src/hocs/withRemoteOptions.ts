/**
 * WithRemoteOptions - 远程选项高阶组件
 *
 * 包装任意渲染器组件，自动注入 useDictionary 的远程选项加载能力。
 * 被包装组件会额外收到 options、loading、error 三个 props，
 * 无需自行调用 useDictionary。
 *
 * @module hocs/withRemoteOptions
 */

import { Component, computed, defineComponent, h, PropType, SetupContext } from "vue"

import { SchemxBaseField } from "@schemx/core"

import { useDictionary } from "@/hooks/useDictionary"

/**
 * WithRemoteOptions 注入给被包装组件的额外 Props
 */
export interface RemoteOptionsInjectedProps {
  /** 远程加载的选项列表 */
  options: any[]
  /** 请求加载状态 */
  loading: boolean
  /** 请求错误信息 */
  error: Error | undefined
}

/**
 * 远程选项高阶组件
 *
 * 包装一个渲染器组件，自动从 componentProps 中提取字典配置
 * （url、query、formatter、request、cacheTime 等），
 * 调用 useDictionary 加载远程选项，并将结果作为 options prop 注入。
 *
 * 当组件自身已传入非空 options 时，优先使用静态 options，不发起远程请求的结果。
 *
 * @param WrappedComponent - 被包装的渲染器组件
 * @returns 增强后的组件，自动具备远程选项加载能力
 *
 * @example
 * ```ts
 * import { WithRemoteOptions } from '@schemx/vue'
 * import MySelect from './MySelect.vue'
 *
 * const RemoteSelect = WithRemoteOptions(MySelect)
 *
 * // 在 schema 中使用
 * const schema = {
 *   name: 'city',
 *   label: '城市',
 *   componentType: 'remote-select',
 *   componentProps: {
 *     url: '/api/cities',
 *     formatter: (res) => res.data.map(item => ({ label: item.name, value: item.id })),
 *   },
 * }
 * ```
 */
export function WithRemoteOptions(WrappedComponent: Component) {
  return defineComponent({
    name: `WithRemoteOptions(${WrappedComponent.name || "Anonymous"})`,
    inheritAttrs: false,
    props: {
      dict: {
        type: Object as PropType<SchemxBaseField["dict"]>,
        default: undefined,
      },
    },
    setup(props, { attrs, slots }: SetupContext) {
      const { list } = useDictionary(props.dict)

      const childrenProps = computed(() => {
        return { ...attrs, dict: props.dict, options: props.dict ? list : attrs.options }
      })

      return () => h(WrappedComponent, childrenProps.value, slots)
    },
  })
}

export default WithRemoteOptions
