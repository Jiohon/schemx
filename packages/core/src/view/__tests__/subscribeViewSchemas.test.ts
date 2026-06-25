import { describe, expect, it, vi } from "vitest"

import createForm from "../../createForm"
import { createSignal } from "../../reactivity"
import { createViewRevision } from "../viewRevision"
import { subscribeViewSchemas } from "../subscribeViewSchemas"
import { createTestRootRuntimeNode } from "../../node/__tests__/runtimeNodeTestUtils"
import { createRootViewState } from "../viewGraph"

import type { RootRuntimeNode } from "../../node"
import type { SchemxViewSchema } from "../types"

function createTestRootWithViewGraph(): RootRuntimeNode {
  const root = createTestRootRuntimeNode()
  root.childrenState = { children: createSignal([]) }
  root.viewState = createRootViewState(root.childrenState.children)

  return root
}

describe("subscribeViewSchemas", () => {
  it("root viewState 应输出真实 ViewSchemas", async () => {
    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
        },
      ],
    })

    const updates: readonly SchemxViewSchema[][] = []

    const dispose = form.subscribeViewSchemas((schemas) => {
      updates.push(schemas)
    })

    await Promise.resolve()

    expect(form.getViewSchemas()).toHaveLength(1)
    expect(form.getViewSchemas()[0]?.key).toContain("field:")
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.at(-1)).toHaveLength(1)

    dispose()
    form.destroy()
  })

  it("dependencies 更新 visible 时 ViewSchema 应读取 effectiveSchema", async () => {
    const form = createForm({
      schemas: [
        {
          name: "country",
          label: "国家",
          componentType: "input",
        },
        {
          name: "province",
          label: "省份",
          componentType: "input",
          dependencies: {
            triggerFields: ["country"],
            visible: (values) => values.country === "CN",
          },
        },
      ],
      initialValues: {
        country: "US",
      },
    })

    await form.waitForDependencies()

    const getProvince = () =>
      form
        .getViewSchemas()
        .find((schema) => "name" in schema && schema.name === "province")

    expect(getProvince()?.visible).toBe(false)

    form.setFieldValue("country", "CN")
    await form.waitForDependencies()

    expect(getProvince()?.visible).toBe(true)

    form.destroy()
  })

  it("应该返回取消订阅函数并立即回调", async () => {
    const root = createTestRootWithViewGraph()
    const revision = createViewRevision()
    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, revision, onChange)

    expect(typeof unsubscribe).toBe("function")
    expect(onChange).toHaveBeenCalled()

    unsubscribe()
  })

  it("取消订阅后不再回调", async () => {
    vi.useFakeTimers()
    const root = createTestRootWithViewGraph()
    const revision = createViewRevision()
    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, revision, onChange)
    const callCountAfterFirst = onChange.mock.calls.length

    unsubscribe()
    revision.bump()
    vi.advanceTimersByTime(20) // 等待 debounce

    expect(onChange).toHaveBeenCalledTimes(callCountAfterFirst)
    vi.useRealTimers()
  })

  it("onChange 回调抛出错误不应中断订阅", async () => {
    const root = createTestRootWithViewGraph()
    const revision = createViewRevision()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const onChange = vi.fn(() => {
      throw new Error("onChange error")
    })

    expect(() => {
      subscribeViewSchemas(root, revision, onChange)
    }).not.toThrow()

    errorSpy.mockRestore()
  })

  it("root dispose 后应回调空 ViewSchemas (使用 createForm)", async () => {
    vi.useFakeTimers()
    const form = createForm({
      schemas: [
        {
          name: "f1",
          label: "测试",
          componentType: "input",
        },
      ],
    })

    const onChange = vi.fn()
    const unsubscribe = form.subscribeViewSchemas(onChange)

    await Promise.resolve()
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.some(call => call[0].length > 0)).toBe(true)

    form.destroy()
    vi.advanceTimersByTime(20)

    unsubscribe()
    vi.useRealTimers()
  })
})
