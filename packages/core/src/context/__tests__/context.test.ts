import { describe, expect, it } from "vitest"

import { ContextNotProvidedError, createContext, isContext } from "../createContext"

describe("context", () => {
  it("Provider 应在同步作用域内暴露当前 context，并在退出后清理", () => {
    const context = createContext<{ id: string }>("TestContext")

    expect(context.tryUseContext()).toBeUndefined()
    expect(() => context.useContext()).toThrow(ContextNotProvidedError)

    const result = context.Provider({ id: "root" }, () => {
      expect(context.useContext()).toEqual({ id: "root" })

      return "done"
    })

    expect(result).toBe("done")
    expect(context.tryUseContext()).toBeUndefined()
  })

  it("嵌套 Provider 应覆盖当前 context，并在异常退出后恢复上一层", () => {
    const context = createContext<{ id: string }>("NestedContext")

    context.Provider({ id: "outer" }, () => {
      expect(context.useContext()).toEqual({ id: "outer" })

      expect(() => {
        context.Provider({ id: "inner" }, () => {
          expect(context.useContext()).toEqual({ id: "inner" })

          throw new Error("boom")
        })
      }).toThrow("boom")

      expect(context.useContext()).toEqual({ id: "outer" })
    })

    expect(context.tryUseContext()).toBeUndefined()
  })

  it("应支持默认值、未提供时回退默认值，以及 context 类型判断", () => {
    const withDefault = createContext("WithDefault", "fallback")
    const withUndefinedDefault = createContext<string | undefined>(
      "WithUndefinedDefault",
      undefined
    )

    expect(isContext(withDefault)).toBe(true)
    expect(isContext({ name: "plain" })).toBe(false)
    expect(withDefault.useContext()).toBe("fallback")
    expect(withUndefinedDefault.useContext()).toBeUndefined()

    withDefault.Provider("provided", () => {
      expect(withDefault.useContext()).toBe("provided")
    })

    // Provider 退出后回到默认值
    expect(withDefault.useContext()).toBe("fallback")
  })
})
