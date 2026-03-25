/**
 * 全局请求器管理与请求器解析
 *
 * 提供请求器的注册、获取、清除，以及三级优先级请求器解析。
 * 此模块不依赖任何 UI 框架，可在任意 JavaScript 环境中使用。
 *
 * 三级优先级：schema 级别 > schemxForm 实例级别 > 全局级别
 *
 * @module core/requestProvider
 *
 * @remarks
 * 全局请求器由 schemxForm.registerRequest 写入，作为三级优先级中的最低级兜底。
 * 模块级导出的 {@link requestProvider} 由 ES Module 保证全局唯一。
 */

/** HTTP 请求函数类型 */
export type RequestFn = (url: string) => Promise<any>

/** 包含可选 request 字段的对象接口 */
export interface HasRequest {
  request?: RequestFn
  [key: string]: any
}

/**
 * 请求器提供者接口
 *
 * 封装全局请求器的注册、获取、清除和三级优先级解析。
 */
export interface RequestProvider {
  /**
   * 注册全局请求器
   *
   * @param request - HTTP 请求函数
   */
  register(request: RequestFn): void

  /**
   * 获取当前全局请求器
   *
   * @returns 当前请求器，未注册时返回 undefined
   */
  get(): RequestFn | undefined

  /**
   * 清除全局请求器
   *
   * @remarks 仅用于测试环境，生产环境调用会输出警告并跳过
   */
  clear(): void

  /**
   * 按三级优先级解析请求器
   *
   * 依次查找：schema 级别 > schemxForm 实例级别 > 全局级别。
   *
   * @param attrs - schema 级别属性
   * @param context - schemxForm 实例级别上下文
   *
   * @returns 解析后的请求器函数，三级均无则返回 undefined
   */
  resolve(attrs: HasRequest, context: HasRequest): RequestFn | undefined
}

/**
 * 创建请求器提供者实例
 *
 * 内部通过闭包持有请求器状态，返回包含 register、get、clear、resolve 四个方法的对象。
 *
 * @returns 请求器提供者实例
 *
 * @example
 * ```ts
 * const provider = createRequestProvider()
 *
 * provider.register((url) => fetch(url).then(r => r.json()))
 * const requester = provider.resolve(attrs, formContext)
 * ```
 */
export function createRequestProvider(): RequestProvider {
  let request: RequestFn | undefined

  return {
    register(fn: RequestFn): void {
      request = fn
    },

    get(): RequestFn | undefined {
      return request
    },

    clear(): void {
      try {
        if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
          console.warn("[RequestProvider] clear() 不应在生产环境调用")

          return
        }
      } catch {
        /* 环境不支持时优雅降级 */
      }

      request = undefined
    },

    resolve(attrs: HasRequest, context: HasRequest): RequestFn | undefined {
      if (typeof attrs.request === "function") {
        return attrs.request
      }

      if (typeof context.request === "function") {
        return context.request
      }

      if (typeof request === "function") {
        return request
      }

      return undefined
    },
  }
}

/**
 * 全局请求器提供者实例
 *
 * 由 ES Module 保证全局唯一，无需额外单例保护。
 *
 * @example
 * ```ts
 * import { requestProvider } from '@schemxForm/core'
 *
 * requestProvider.register((url) => fetch(url).then(r => r.json()))
 * const requester = requestProvider.resolve(attrs, formContext)
 * ```
 */
export const requestProvider = createRequestProvider()
