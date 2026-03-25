/**
 * useDictionary - 字典选项 Hook
 *
 * 根据 url 远程加载字典选项，支持三级优先级请求器解析（schema > schemx > 全局）。
 * 自动在组件挂载时加载，并在 url 变化时重新请求。
 *
 * @module hooks/useDictionary
 */

import { onMounted, Ref, ref, watch } from "vue"

import { SchemxInstance } from "@schemx/core"

import { requestProvider } from "@/utils/requestProvider"

import { useContext } from "./useContext"
import { useFormInstance } from "./useForm"

/**
 * 将对象序列化为 URL 查询字符串
 *
 * 对键和值分别调用 `encodeURIComponent` 编码，跳过值为 `null` 或 `undefined` 的条目。
 *
 * @param obj - 键值对对象
 * @returns 带 `?` 前缀的查询字符串，无有效键值对时返回空字符串
 *
 * @example
 * ```ts
 * queryString({ page: 1, size: 10 })       // => '?page=1&size=10'
 * queryString({ a: null, b: 'hello' })      // => '?b=hello'
 * queryString({})                           // => ''
 * ```
 */
export const queryString = (obj: Record<string, any> = {}): string => {
  const pairs = Object.entries(obj ?? {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")

  return pairs ? `?${pairs}` : ""
}

/**
 * 缓存条目，存储已获取的字典数据及其写入时间戳
 */
export interface CacheEntry {
  /** 缓存的数据数组 */
  data: any[]
  /** 缓存写入时间戳（毫秒） */
  timestamp: number
}

/**
 * 模块级缓存 Map，跨组件实例共享。
 * key 为完整 URL（含查询参数）。
 */
export const dictCache = new Map<string, CacheEntry>()

/**
 * 判断缓存条目是否仍然有效
 *
 * @param entry - 待检查的缓存条目
 * @param cacheTime - 缓存有效期（毫秒）。
 *   `0` 表示不缓存，`-1` 表示永不过期，`>0` 检查是否超时。
 *
 * @returns 缓存有效返回 `true`，否则返回 `false`
 */
export function isCacheValid(entry: CacheEntry, cacheTime: number): boolean {
  if (cacheTime === 0) return false
  if (cacheTime === -1) return true

  return Date.now() - entry.timestamp < cacheTime
}

/**
 * 将未知抛出值规范化为 `Error` 实例
 *
 * @param err - 捕获的值（可能是任意类型）
 *
 * @returns 包装原始值的 `Error` 对象
 */
export function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err

  return new Error(String(err))
}

/**
 * 字典选项属性
 *
 * 传入 useDictionary 的配置，控制远程字典的请求地址、参数、格式化及请求器。
 */
export interface UseDictionaryOptions {
  /** 字典数据请求地址 */
  url?: string
  /** 动态查询参数生成函数 */
  query?: () => Record<string, any> | Promise<Record<string, any>>
  /** 响应数据格式化函数，将原始响应转换为组件所需的选项格式 */
  formatter?: (res: any, form: SchemxInstance | undefined) => any | Promise<any>
  /** HTTP 请求器（schema 级别，最高优先级） */
  request?: (url: string) => Promise<any>
  /**
   * 缓存有效期（毫秒）。
   *
   * `0` 表示不缓存（默认），`-1` 表示永不过期，
   * 正数表示指定的过期时间。
   */
  cacheTime?: number
  /** 失败重试次数，默认 `0`（不重试） */
  retryCount?: number
  /** 重试间隔（毫秒），默认 `1000` */
  retryInterval?: number
  /** 请求失败回调 */
  onError?: (error: Error) => void
  [key: string]: any
}

/**
 * useDictionary 返回值
 */
export interface UseDictOptionsReturn {
  /** 远程加载的字典选项列表（响应式） */
  list: Ref<any[]>
  /** 请求加载状态（响应式） */
  loading: Ref<boolean>
  /** 请求错误信息（响应式） */
  error: Ref<Error | undefined>
  /** 触发字典选项加载（内部使用，保持向后兼容） */
  loadDict: () => Promise<void>
  /** 使用当前配置重新发起请求 */
  refresh: () => Promise<void>
  /** 直接修改 list 的值，不触发网络请求 */
  mutate: (data: any[]) => void
}

/**
 * 远程加载字典选项
 *
 * 通过三级优先级解析请求器（schema > schemx > 全局），
 * 自动在组件挂载时加载，并在 url 变化时重新请求。
 * 支持缓存、重试、竞态控制和错误处理。
 *
 * @param options - 字典配置选项
 * @returns 响应式选项列表、loading/error 状态及控制方法
 *
 * @example
 * ```ts
 * const { list, loading, error, refresh, mutate } = useDictionary({
 *   url: '/api/dict/status',
 *   cacheTime: 60000,
 *   retryCount: 2,
 *   formatter: (res) => res.data.map(item => ({ label: item.name, value: item.id })),
 * })
 * ```
 */
export const useDictionary = (options: UseDictionaryOptions): UseDictOptionsReturn => {
  const instance = useFormInstance()
  const context = useContext()

  const list = ref<any[]>([])
  const loading = ref<boolean>(false)
  const error = ref<Error | undefined>(undefined)

  // 竞态控制：仅最新请求写入状态
  let requestCount = 0

  /**
   * 使用配置的 formatter 格式化原始响应数据
   *
   * @param res - 请求器返回的原始响应
   * @returns 格式化后的选项数据
   */
  const formatter = async (res: any): Promise<any> => {
    if (typeof options?.formatter === "function") {
      return await options.formatter(res, instance)
    }

    return res
  }

  /**
   * 带重试的请求执行
   *
   * 对指定 URL 发起请求，失败时按配置的重试次数和间隔自动重试。
   * 不处理竞态和状态更新，仅负责网络请求和重试逻辑。
   *
   * @param requester - 请求器函数
   * @param url - 完整请求 URL
   * @returns 请求器的原始响应
   *
   * @throws Error 所有重试耗尽后抛出最后一次失败的错误
   */
  const fetchWithRetry = async (
    requester: (url: string) => Promise<any>,
    url: string
  ): Promise<any> => {
    const maxRetries = options.retryCount ?? 0
    const retryDelay = options.retryInterval ?? 1000
    let lastError: Error = new Error("Unknown error")

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requester(url)
      } catch (err) {
        lastError = normalizeError(err)

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay))
        }
      }
    }

    throw lastError
  }

  /**
   * 从远程加载字典选项
   *
   * 每次调用时动态解析请求器，检查缓存，通过请求计数器处理竞态条件。
   * 所有错误在内部捕获并写入 `error` 引用；返回的 Promise 永不 reject。
   */
  const loadDict = async (): Promise<void> => {
    try {
      // 每次调用时动态解析请求器（三级优先级）
      const requester = requestProvider.resolve(options, context)

      if (!options?.url || !requester) return

      loading.value = true
      error.value = undefined

      // 构建带查询参数的完整 URL
      const query = typeof options?.query === "function" ? await options.query() : {}
      const fullUrl = `${options.url}${queryString(query)}`

      // 发起网络请求前检查缓存
      const cacheTime = options.cacheTime ?? 0
      const cached = dictCache.get(fullUrl)

      if (cached && isCacheValid(cached, cacheTime)) {
        list.value = cached.data
        loading.value = false

        return
      }

      // 递增请求计数器用于竞态控制
      const currentCount = ++requestCount

      const res = await fetchWithRetry(requester, fullUrl)

      // 竞态检查：丢弃过期响应
      if (currentCount !== requestCount) return

      const formatted = await formatter(res)

      // 格式化后再次竞态检查（格式化可能是异步的）
      if (currentCount !== requestCount) return

      list.value = formatted
      error.value = undefined

      // 写入缓存
      if (cacheTime !== 0) {
        dictCache.set(fullUrl, { data: formatted, timestamp: Date.now() })
      }

      loading.value = false
    } catch (err) {
      // 竞态检查：若已不是最新请求则静默丢弃
      if (requestCount !== 0) {
        const normalized = normalizeError(err)

        error.value = normalized
        list.value = []

        if (typeof options.onError === "function") {
          options.onError(normalized)
        }
      }

      loading.value = false
    }
  }

  /**
   * 使用当前配置重新获取字典选项
   *
   * @returns 加载完成后 resolve 的 Promise（永不 reject）
   */
  const refresh = (): Promise<void> => loadDict()

  /**
   * 直接设置 remoteOptions，不触发网络请求
   *
   * @param data - 新的选项数组
   */
  const mutate = (data: any[]): void => {
    list.value = data
  }

  watch(
    () => options?.url,
    (newValue, prevValue) => {
      if (newValue === prevValue) return
      void loadDict()
    }
  )

  onMounted(() => {
    void loadDict()
  })

  return { list, loading, error, loadDict, refresh, mutate }
}

export default useDictionary
