import { onMounted, Ref, ref, watch } from "vue"

import { useFormInstance } from "./useFormContext"

import type { SchemaFormInstance } from "../types"

/**
 * 对象转url参数
 * @param obj - 对象
 * @returns url参数字符串
 */
const queryString = (obj: Record<string, any> = {}): string => {
  const string = Object.keys(obj ?? {})
    .map((key) => `${key}=${obj[key]}`)
    .join("&")

  return string ? `?${string}` : ""
}

export interface DictOptionsAttrs {
  dicUrl?: string
  dicQuery?: () => Record<string, any> | Promise<Record<string, any>>
  dicFormatter?: (res: any, form: SchemaFormInstance | undefined) => any | Promise<any>
  /** HTTP 请求器 */
  request?: (url: string) => Promise<any>
  [key: string]: any
}

export interface UseDictOptionsReturn {
  remoteOptions: Ref<any[]>
  loadDictOptions: (attrs: DictOptionsAttrs) => Promise<void>
}

/**
 * 获取字典选项
 * @param attrs - 属性
 * @param formInstance - 表单实例（可选）
 * @returns 字典选项
 */
export const useDictOptions = (attrs: DictOptionsAttrs): UseDictOptionsReturn => {
  const instance = useFormInstance()

  const requester = attrs.request
  const remoteOptions = ref<any[]>([])

  /**
   * 格式化字典选项
   * @param res - 字典选项
   * @returns 格式化后的字典选项
   */
  const dictFormatter = async (res: any): Promise<any> => {
    if (typeof attrs?.dicFormatter === "function") {
      return await attrs?.dicFormatter?.(res, instance)
    }

    return res
  }

  /**
   * 加载字典选项
   * @param attrs - 属性
   */
  const loadDictOptions = async (attrs: DictOptionsAttrs): Promise<void> => {
    try {
      if (!attrs?.dicUrl || !requester) return

      const query = typeof attrs?.dicQuery === "function" ? await attrs?.dicQuery?.() : {}

      const res = await requester(`${attrs.dicUrl}${queryString(query)}`)

      remoteOptions.value = await dictFormatter(res)
    } catch (error) {
      remoteOptions.value = []
      throw error
    }
  }

  /**
   * 监听字典URL变化
   */
  watch(
    () => attrs?.dicUrl,
    (newValue, prevValue) => {
      if (newValue === prevValue) return

      loadDictOptions(attrs)
    }
  )

  /**
   * 挂载时加载字典选项
   */
  onMounted(() => {
    loadDictOptions(attrs)
  })

  return { remoteOptions, loadDictOptions }
}

export default useDictOptions
