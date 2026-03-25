/**
 * queryString 工具函数的属性测试
 *
 * 使用 fast-check 在大量随机生成的输入上验证编码正确性和往返一致性。
 *
 * @module hooks/__tests__/useDictionary
 */

import { defineComponent, h, nextTick } from "vue"

import { createFormInstance } from "@schemx/core"
import { mount } from "@vue/test-utils"
import fc from "fast-check"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { requestProvider } from "@/utils/requestProvider"

import { FORM_CONTEXT_KEY } from "../useContext"
import {
  CacheEntry,
  dictCache,
  isCacheValid,
  normalizeError,
  queryString,
  useDictionary,
  type UseDictionaryOptions,
  type UseDictOptionsReturn,
} from "../useDictionary"
import { FORM_INSTANCE_KEY } from "../useForm"

describe("queryString", () => {
  /**
   * 属性 7：queryString 编码正确性
   *
   * 对于任意键值对对象，输出中的每个键和值都必须经过
   * encodeURIComponent 编码，且 null/undefined 值必须被跳过。
   *
   * **验证：需求 6.1, 6.2, 6.3**
   */
  it("属性 7：所有键值经过 encodeURIComponent 编码，null/undefined 值被跳过", () => {
    const valueArb = fc.oneof(
      fc.string(),
      fc.integer().map(String),
      fc.constant(null),
      fc.constant(undefined)
    )

    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }), valueArb), (obj) => {
        const result = queryString(obj)

        // 收集应出现在输出中的条目（非 null/undefined 值）
        const validEntries = Object.entries(obj).filter(([, v]) => v != null)

        if (validEntries.length === 0) {
          // 无有效条目 => 空字符串
          expect(result).toBe("")

          return
        }

        // 结果必须以 '?' 开头
        expect(result.startsWith("?")).toBe(true)

        const body = result.slice(1) // 移除前导 '?'
        const pairs = body.split("&")

        expect(pairs.length).toBe(validEntries.length)

        // 每个键值对必须正确编码
        for (const [key, value] of validEntries) {
          const encodedKey = encodeURIComponent(key)
          const encodedValue = encodeURIComponent(value as string)
          const expectedPair = `${encodedKey}=${encodedValue}`
          expect(pairs).toContain(expectedPair)
        }

        // 验证 null/undefined 的键不出现在输出中
        const nullKeys = Object.entries(obj)
          .filter(([, v]) => v == null)
          .map(([k]) => encodeURIComponent(k))

        for (const nk of nullKeys) {
          const pairStartsWithKey = pairs.some((p) => p.startsWith(`${nk}=`))
          expect(pairStartsWithKey).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 属性 8：queryString 编码往返一致性
   *
   * 对于任意键值对对象（值均为非 null/undefined 字符串），
   * 将 queryString 输出通过 URLSearchParams 解析后必须能还原出原始键值对。
   *
   * **验证：需求 6.1, 6.2**
   */
  it("属性 8：输出可通过 URLSearchParams 往返解析", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }), fc.string()), (obj) => {
        const result = queryString(obj)
        const entries = Object.entries(obj)

        if (entries.length === 0) {
          expect(result).toBe("")

          return
        }

        // 解析查询字符串（去掉前导 '?'）
        const parsed = new URLSearchParams(result.slice(1))

        // 每个原始键值对必须可还原
        for (const [key, value] of entries) {
          expect(parsed.get(key)).toBe(value)
        }

        // 解析结果应有相同数量的键
        const parsedKeys = [...parsed.keys()]
        expect(parsedKeys.length).toBe(entries.length)
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * isCacheValid 单元测试
 *
 * 验证不同 cacheTime 配置下的缓存有效性逻辑：
 * - cacheTime = 0：始终无效（禁用缓存）
 * - cacheTime = -1：始终有效（永不过期）
 * - cacheTime > 0：仅在指定时间内有效
 *
 * **验证：需求 3.1, 3.2, 3.4, 3.5**
 */
describe("isCacheValid", () => {
  it("cacheTime 为 0 时返回 false（禁用缓存）", () => {
    const entry: CacheEntry = { data: [1, 2, 3], timestamp: Date.now() }
    expect(isCacheValid(entry, 0)).toBe(false)
  })

  it("cacheTime 为 -1 时返回 true（永不过期）", () => {
    const entry: CacheEntry = { data: [1, 2, 3], timestamp: 0 }
    expect(isCacheValid(entry, -1)).toBe(true)
  })

  it("cacheTime > 0 且缓存未过期时返回 true", () => {
    const entry: CacheEntry = { data: [1, 2, 3], timestamp: Date.now() }
    expect(isCacheValid(entry, 5000)).toBe(true)
  })

  it("cacheTime > 0 且缓存已过期时返回 false", () => {
    const entry: CacheEntry = { data: [1, 2, 3], timestamp: Date.now() - 10000 }
    expect(isCacheValid(entry, 5000)).toBe(false)
  })
})

/**
 * normalizeError 单元测试
 *
 * 验证未知抛出值能正确规范化为 Error 实例。
 *
 * **验证：需求 3.1, 3.2, 3.4, 3.5**
 */
describe("normalizeError", () => {
  it("传入 Error 实例时返回同一实例", () => {
    const err = new Error("test error")
    const result = normalizeError(err)
    expect(result).toBe(err)
    expect(result.message).toBe("test error")
  })

  it("将字符串包装为以该字符串为 message 的 Error", () => {
    const result = normalizeError("something went wrong")
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("something went wrong")
  })

  it("将数字包装为以 String(数字) 为 message 的 Error", () => {
    const result = normalizeError(404)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("404")
  })

  it("将 null 包装为以 'null' 为 message 的 Error", () => {
    const result = normalizeError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("null")
  })

  it("将 undefined 包装为以 'undefined' 为 message 的 Error", () => {
    const result = normalizeError(undefined)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("undefined")
  })
})

/**
 * 辅助函数：刷新微任务和待处理的 Promise
 */
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * 挂载一个包装组件，提供必要的 inject 上下文
 * （FORM_INSTANCE_KEY、FORM_CONTEXT_KEY），并在 setup 中调用 useDictionary。
 *
 * @param options - useDictionary 配置
 * @param contextProps - 额外的上下文属性（如 { request }）
 * @returns wrapper、hookReturn 和 form 实例
 */
function mountUseDictionary(
  options: UseDictionaryOptions,
  contextProps: Record<string, any> = {}
) {
  let hookReturn: UseDictOptionsReturn

  const form = createFormInstance({ initialValues: {} })

  const Comp = defineComponent({
    setup() {
      hookReturn = useDictionary(options)

      return () => h("div")
    },
  })

  const wrapper = mount(Comp, {
    global: {
      provide: {
        [FORM_INSTANCE_KEY]: form,
        [FORM_CONTEXT_KEY]: contextProps,
      },
    },
  })

  return { wrapper, hookReturn: hookReturn!, form }
}

/**
 * useDictionary Hook 集成测试
 *
 * 这些测试挂载真实的 Vue 组件并提供 provide/inject 上下文，
 * 在真实环境中验证 Hook 的行为。
 */
describe("useDictionary 集成测试", () => {
  beforeEach(() => {
    dictCache.clear()
    requestProvider.clear()
  })

  /**
   * 属性 1：Loading 状态一致性
   *
   * 调用 loadDict 后，请求进行中 loading 应为 true，
   * 请求完成后（无论成功或失败）loading 应为 false。
   *
   * **验证：需求 1.1, 1.2**
   */
  describe("属性 1：Loading 状态一致性", () => {
    it("请求期间 loading 为 true，成功后为 false", async () => {
      let resolveRequest: (value: any) => void
      const mockRequest = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve
          })
      )

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      await nextTick()

      // 挂载后 onMounted 触发 loadDict => loading 应为 true
      expect(hookReturn.loading.value).toBe(true)

      // 解析请求
      resolveRequest!([{ label: "A", value: 1 }])
      await flushPromises()
      await nextTick()

      expect(hookReturn.loading.value).toBe(false)
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })

    it("请求失败后 loading 为 false", async () => {
      let rejectRequest: (reason: any) => void
      const mockRequest = vi.fn(
        () =>
          new Promise((_, reject) => {
            rejectRequest = reject
          })
      )

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      await nextTick()

      expect(hookReturn.loading.value).toBe(true)

      rejectRequest!(new Error("network error"))
      await flushPromises()
      await nextTick()

      expect(hookReturn.loading.value).toBe(false)

      wrapper.unmount()
    })
  })

  /**
   * 属性 2：Error 状态与请求结果一致
   *
   * 请求成功时 error 应为 undefined；请求失败时 error 应为
   * 包含失败原因的 Error 实例。
   *
   * **验证：需求 1.3, 1.4**
   */
  describe("属性 2：Error 状态与请求结果一致", () => {
    it("请求成功后 error 为 undefined", async () => {
      const mockRequest = vi.fn().mockResolvedValue([{ label: "A", value: 1 }])

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeUndefined()
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })

    it("请求失败后 error 为 Error 实例", async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error("server error"))

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeInstanceOf(Error)
      expect(hookReturn.error.value!.message).toBe("server error")

      wrapper.unmount()
    })

    it("后续请求成功后 error 重置为 undefined", async () => {
      let callCount = 0
      const mockRequest = vi.fn(() => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error("first fail"))

        return Promise.resolve([{ label: "B", value: 2 }])
      })

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      // 第一次调用（onMounted）失败
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeInstanceOf(Error)

      // 手动调用 loadDict 成功
      await hookReturn.loadDict()
      await nextTick()

      expect(hookReturn.error.value).toBeUndefined()
      expect(hookReturn.list.value).toEqual([{ label: "B", value: 2 }])

      wrapper.unmount()
    })
  })

  /**
   * 属性 3：竞态控制——最后请求胜出
   *
   * 当多个请求并发发起时，只有最后一个请求的响应
   * 应写入 remoteOptions。
   *
   * **验证：需求 2.1, 2.2**
   */
  describe("属性 3：竞态控制——最后请求胜出", () => {
    it("请求乱序完成时仅保留最后一个请求的响应", async () => {
      const resolvers: Array<(value: any) => void> = []
      const mockRequest = vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          })
      )

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/test",
        request: mockRequest,
      })

      // onMounted 触发第一次 loadDict
      await nextTick()

      // 手动触发第二次 loadDict
      hookReturn.loadDict()
      await nextTick()

      // 手动触发第三次 loadDict
      hookReturn.loadDict()
      await nextTick()

      expect(resolvers.length).toBe(3)

      // 乱序解析：先第三个，再第一个，最后第二个
      resolvers[2]([{ label: "C", value: 3 }]) // 最新请求
      await flushPromises()
      await nextTick()

      resolvers[0]([{ label: "A", value: 1 }]) // 过期请求
      await flushPromises()
      await nextTick()

      resolvers[1]([{ label: "B", value: 2 }]) // 过期请求
      await flushPromises()
      await nextTick()

      // 只有最后一个请求的数据应保留
      expect(hookReturn.list.value).toEqual([{ label: "C", value: 3 }])

      wrapper.unmount()
    })
  })

  /**
   * 属性 4：缓存命中避免重复请求
   *
   * 缓存有效时，loadDict 应直接返回缓存数据而不调用请求器。
   * 缓存过期时，应发起新请求。
   *
   * **验证：需求 3.1, 3.2, 3.3**
   */
  describe("属性 4：缓存命中避免重复请求", () => {
    it("缓存有效时使用缓存数据并跳过网络请求", async () => {
      const mockRequest = vi.fn().mockResolvedValue([{ label: "A", value: 1 }])

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/cached",
        cacheTime: 60000, // 60 seconds
        request: mockRequest,
      })

      // 第一次调用（onMounted）——应发起网络请求
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      // 第二次调用——应使用缓存
      await hookReturn.loadDict()
      await nextTick()

      expect(mockRequest).toHaveBeenCalledTimes(1) // 仍为 1，无新请求
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })

    it("缓存过期时重新发起请求", async () => {
      const mockRequest = vi
        .fn()
        .mockResolvedValueOnce([{ label: "old", value: 1 }])
        .mockResolvedValueOnce([{ label: "new", value: 2 }])

      // 预填充一个已过期的缓存条目
      dictCache.set("/api/dict/expired", {
        data: [{ label: "stale", value: 0 }],
        timestamp: Date.now() - 10000, // 10 秒前
      })

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/expired",
        cacheTime: 5000, // 5 秒——缓存已过期
        request: mockRequest,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      // 缓存已过期，应发起网络请求
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "old", value: 1 }])

      wrapper.unmount()
    })
  })

  /**
   * 属性 5：重试次数与最终错误
   *
   * 当 retryCount > 0 且所有尝试均失败时，请求器应被调用
   * 恰好 retryCount + 1 次，且 error 应包含最后一次失败的错误。
   *
   * **验证：需求 4.1, 4.4**
   */
  describe("属性 5：重试次数与最终错误", () => {
    it("重试 retryCount 次并报告最后一次错误", async () => {
      const errors = [new Error("fail 1"), new Error("fail 2"), new Error("fail 3")]
      let callIdx = 0
      const mockRequest = vi.fn(() => {
        return Promise.reject(errors[callIdx++])
      })

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/retry",
        request: mockRequest,
        retryCount: 2,
        retryInterval: 0, // 无延迟以加速测试
      })

      await nextTick()
      await flushPromises()
      await nextTick()
      // 等待重试完成
      await flushPromises()
      await nextTick()
      await flushPromises()
      await nextTick()

      // 1 次初始 + 2 次重试 = 3 次调用
      expect(mockRequest).toHaveBeenCalledTimes(3)
      expect(hookReturn.error.value).toBeInstanceOf(Error)
      expect(hookReturn.error.value!.message).toBe("fail 3")
      expect(hookReturn.loading.value).toBe(false)

      wrapper.unmount()
    })
  })

  /**
   * 属性 6：请求器动态解析
   *
   * 当两次 loadDict 调用之间更换了 options 中的 request 函数时，
   * 第二次调用应使用更新后的请求器。
   *
   * **验证：需求 5.1, 5.2**
   */
  describe("属性 6：请求器动态解析", () => {
    it("后续调用使用更新后的 request 函数", async () => {
      const firstRequest = vi.fn().mockResolvedValue([{ label: "first", value: 1 }])
      const secondRequest = vi.fn().mockResolvedValue([{ label: "second", value: 2 }])

      const options: UseDictionaryOptions = {
        url: "/api/dict/dynamic",
        request: firstRequest,
      }

      const { wrapper, hookReturn } = mountUseDictionary(options)

      // 第一次调用使用 firstRequest
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(firstRequest).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "first", value: 1 }])

      // 替换 request 函数
      options.request = secondRequest

      // 第二次调用应使用 secondRequest
      await hookReturn.loadDict()
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(secondRequest).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "second", value: 2 }])

      wrapper.unmount()
    })
  })

  /**
   * 属性 9：错误不外泄
   *
   * loadDict 返回的 Promise 永不 reject。错误被捕获并写入
   * error 引用，若提供了 onError 回调则调用之。
   *
   * **验证：需求 8.1, 8.2, 8.3**
   */
  describe("属性 9：错误不外泄", () => {
    it("loadDict 的 Promise 不 reject，错误写入 ref", async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error("boom"))

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/error",
        request: mockRequest,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      // 手动调用 loadDict——不应抛出
      await expect(hookReturn.loadDict()).resolves.toBeUndefined()
      await nextTick()

      expect(hookReturn.error.value).toBeInstanceOf(Error)
      expect(hookReturn.error.value!.message).toBe("boom")

      wrapper.unmount()
    })

    it("onError 回调被调用并传入错误对象", async () => {
      const onError = vi.fn()
      const mockRequest = vi.fn().mockRejectedValue(new Error("callback test"))

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/onerror",
        request: mockRequest,
        onError,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(onError.mock.calls[0][0].message).toBe("callback test")
      // error 引用应与回调参数一致
      expect(hookReturn.error.value!.message).toBe("callback test")

      wrapper.unmount()
    })
  })

  /**
   * 属性 10：mutate 直接更新数据
   *
   * 调用 mutate(data) 后应立即将 list.value 设置为
   * 传入的数据，且不触发任何网络请求。
   *
   * **验证：需求 9.2, 9.3**
   */
  describe("属性 10：mutate 直接更新数据", () => {
    it("mutate 立即设置 list 且不发起网络请求", async () => {
      const mockRequest = vi.fn().mockResolvedValue([])

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/mutate",
        request: mockRequest,
      })

      // 等待 onMounted 的 loadDict 完成
      await nextTick()
      await flushPromises()
      await nextTick()

      const callCountBefore = mockRequest.mock.calls.length

      const newData = [{ label: "manual", value: 99 }]
      hookReturn.mutate(newData)

      // 立即更新，无需异步等待
      expect(hookReturn.list.value).toEqual(newData)

      // 无额外网络请求
      expect(mockRequest).toHaveBeenCalledTimes(callCountBefore)

      wrapper.unmount()
    })
  })

  /**
   * 属性 11：refresh 触发重新请求
   *
   * 调用 refresh() 应使用当前 options 重新发起请求，
   * 请求器应被再次调用。
   *
   * **验证：需求 9.1**
   */
  describe("属性 11：refresh 触发重新请求", () => {
    it("refresh 使用当前 options 重新请求", async () => {
      const mockRequest = vi
        .fn()
        .mockResolvedValueOnce([{ label: "initial", value: 1 }])
        .mockResolvedValueOnce([{ label: "refreshed", value: 2 }])

      const { wrapper, hookReturn } = mountUseDictionary({
        url: "/api/dict/refresh",
        request: mockRequest,
      })

      // 等待 onMounted 的 loadDict
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "initial", value: 1 }])

      // 调用 refresh
      await hookReturn.refresh()
      await nextTick()

      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(hookReturn.list.value).toEqual([{ label: "refreshed", value: 2 }])

      wrapper.unmount()
    })
  })
})
