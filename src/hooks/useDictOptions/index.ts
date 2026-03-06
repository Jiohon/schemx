import { onMounted, Ref, ref, watch } from "vue"

import { useFormInstance } from "../useFormContext"
import { useRequester } from "../useRequester"

import type { FormInstance } from "../../types"

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
  dictUrl?: string
  dictQuery?: () => Record<string, any> | Promise<Record<string, any>>
  dictFormatter?: (res: any, form: FormInstance | undefined) => any | Promise<any>
  /** HTTP 请求器（column 级别，最高优先级） */
  request?: (url: string) => Promise<any>
  [key: string]: any
}

export interface UseDictOptionsReturn {
  remoteOptions: Ref<any[]>
  loadDictOptions: (attrs: DictOptionsAttrs) => Promise<void>
}

/**
 * 获取字典选项
 *
 * 三级优先级解析请求器：column > SchemaForm > 全局
 *
 * @param attrs - 属性
 * @returns 字典选项
 */
export const useDictOptions = (attrs: DictOptionsAttrs): UseDictOptionsReturn => {
  const instance = useFormInstance()

  // 三级优先级解析：column > SchemaForm > 全局（SchemaForm.registerRequest）
  const requester = useRequester(attrs)
  const remoteOptions = ref<any[]>([])

  const dictFormatter = async (res: any): Promise<any> => {
    if (typeof attrs?.dictFormatter === "function") {
      return await attrs.dictFormatter(res, instance)
    }
    return res
  }

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
