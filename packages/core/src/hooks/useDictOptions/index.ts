/**
 * useDictOptions - 字典选项 Hook
 *
 * 根据 dictUrl 远程加载字典选项，支持三级优先级请求器解析（column > SchemaForm > 全局）。
 * 自动在组件挂载时加载，并在 dictUrl 变化时重新请求。
 *
 * @module hooks/useDictOptions
 */

import { onMounted, Ref, ref, watch } from "vue"

import { SchemaFormInstance } from "@/types/instance"

import { useFormInstance } from "../useForm"
import { useRequester } from "../useRequester"

/**
 * 将对象序列化为 URL 查询字符串
 *
 * @param obj - 键值对对象
 * @returns 带 `?` 前缀的查询字符串，空对象返回空字符串
 *
 * @example
 * ```ts
 * queryString({ page: 1, size: 10 }) // => '?page=1&size=10'
 * queryString({})                     // => ''
 * ```
 */
const queryString = (obj: Record<string, any> = {}): string => {
  const string = Object.keys(obj ?? {})
    .map((key) => `${key}=${obj[key]}`)
    .join("&")

  return string ? `?${string}` : ""
}

/**
 * 字典选项属性
 *
 * 传入 useDictOptions 的配置，控制远程字典的请求地址、参数、格式化及请求器。
 */
export interface DictOptionsAttrs {
  /** 字典数据请求地址 */
  dictUrl?: string
  /** 动态查询参数生成函数 */
  dictQuery?: () => Record<string, any> | Promise<Record<string, any>>
  /** 响应数据格式化函数，将原始响应转换为组件所需的选项格式 */
  dictFormatter?: (res: any, form: SchemaFormInstance | undefined) => any | Promise<any>
  /** HTTP 请求器（column 级别，最高优先级） */
  request?: (url: string) => Promise<any>
  [key: string]: any
}

/**
 * useDictOptions 返回值
 */
export interface UseDictOptionsReturn {
  /** 远程加载的字典选项列表（响应式） */
  remoteOptions: Ref<any[]>
  /** 手动触发字典选项加载 */
  loadDictOptions: (attrs: DictOptionsAttrs) => Promise<void>
}

/**
 * 远程加载字典选项
 *
 * 根据 dictUrl 发起请求，通过三级优先级解析请求器（column > SchemaForm > 全局），
 * 自动在组件挂载时加载，并在 dictUrl 变化时重新请求。
 *
 * @param attrs - 字典选项属性配置
 * @returns 响应式选项列表和手动加载方法
 *
 * @example
 * ```ts
 * const { remoteOptions, loadDictOptions } = useDictOptions({
 *   dictUrl: '/api/dict/status',
 *   dictFormatter: (res) => res.data.map(item => ({ label: item.name, value: item.id })),
 * })
 * ```
 */
export const useDictOptions = (attrs: DictOptionsAttrs): UseDictOptionsReturn => {
  const instance = useFormInstance()

  // 三级优先级解析：column > SchemaForm > 全局（SchemaForm.registerRequest）
  const requester = useRequester(attrs)
  const remoteOptions = ref<any[]>([])

  /**
   * 格式化字典响应数据
   *
   * @param res - 原始响应数据
   * @returns 格式化后的选项数据
   */
  const dictFormatter = async (res: any): Promise<any> => {
    if (typeof attrs?.dictFormatter === "function") {
      return await attrs.dictFormatter(res, instance)
    }

    return res
  }

  /**
   * 加载字典选项
   *
   * @param attrs - 字典选项属性配置
   */
  const loadDictOptions = async (attrs: DictOptionsAttrs): Promise<void> => {
    try {
      if (!attrs?.dictUrl || !requester) return

      const query = typeof attrs?.dictQuery === "function" ? await attrs.dictQuery() : {}

      const res = await requester(`${attrs.dictUrl}${queryString(query)}`)
      remoteOptions.value = await dictFormatter(res)
    } catch (error) {
      remoteOptions.value = []
      throw error
    }
  }

  watch(
    () => attrs?.dictUrl,
    (newValue, prevValue) => {
      if (newValue === prevValue) return
      loadDictOptions(attrs)
    }
  )

  onMounted(() => {
    loadDictOptions(attrs)
  })

  return { remoteOptions, loadDictOptions }
}

export default useDictOptions
