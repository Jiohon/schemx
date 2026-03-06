/**
 * useRenderer Hook 单元测试
 *
 * 测试 useRenderer 和 useRendererContext 的 provide/inject 机制
 */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { DEFAULT_RENDERER_TYPES } from "../../../renderers/defaultRenderers"
import { createRenderer, useRendererContext } from "../useRenderer"

import type { Registry } from "../../core/registry"

/**
 * 创建测试组件的辅助函数
 *
 * 使用父子组件结构来正确测试 provide/inject
 */
function createTestSetup() {
  let parentRegistry: Registry | null = null
  let childRegistry: Registry | null = null

  const ChildComponent = defineComponent({
    name: "ChildComponent",
    setup() {
      childRegistry = useRendererContext()

      return () => h("div", { class: "child" })
    },
  })

  const ParentComponent = defineComponent({
    name: "ParentComponent",
    setup() {
      parentRegistry = createRenderer()

      return () => h(ChildComponent)
    },
  })

  const wrapper = mount(ParentComponent)

  return {
    wrapper,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getParentRegistry: () => parentRegistry!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getChildRegistry: () => childRegistry!,
  }
}

describe("useRenderer Hook (Task 5.1)", () => {
  describe("useRenderer - Requirement 10.1", () => {
    it("应该创建 Registry 实例并注册默认渲染器", () => {
      const { getParentRegistry, wrapper } = createTestSetup()
      const registry = getParentRegistry()

      expect(registry).toBeDefined()
      // 验证默认渲染器已注册
      for (const type of DEFAULT_RENDERER_TYPES) {
        expect(registry.hasRenderer(type)).toBe(true)
      }

      wrapper.unmount()
    })

    it("应该返回 Registry 实例", () => {
      const { getParentRegistry, wrapper } = createTestSetup()
      const registry = getParentRegistry()

      expect(registry.register).toBeInstanceOf(Function)
      expect(registry.getRenderer).toBeInstanceOf(Function)
      expect(registry.hasRenderer).toBeInstanceOf(Function)

      wrapper.unmount()
    })
  })

  describe("skipDefaults 选项 - Requirement 10.2", () => {
    it("skipDefaults=true 时应该跳过默认渲染器注册", () => {
      const { getParentRegistry, wrapper } = createTestSetup({ skipDefaults: true })
      const registry = getParentRegistry()

      expect(registry.size()).toBe(0)
      for (const type of DEFAULT_RENDERER_TYPES) {
        expect(registry.hasRenderer(type)).toBe(false)
      }

      wrapper.unmount()
    })

    it("skipDefaults=false 时应该注册默认渲染器", () => {
      const { getParentRegistry, wrapper } = createTestSetup({ skipDefaults: false })
      const registry = getParentRegistry()

      expect(registry.size()).toBeGreaterThan(0)
      expect(registry.hasRenderer("input")).toBe(true)

      wrapper.unmount()
    })
  })

  describe("setup 回调 - Requirement 10.3", () => {
    it("应该在默认渲染器注册后调用 setup 回调", () => {
      const setup = vi.fn((registry: Registry) => {
        // 验证默认渲染器已注册
        expect(registry.hasRenderer("input")).toBe(true)
        // 注册自定义渲染器
        registry.register("custom", defineComponent({ render: () => h("div") }))
      })

      const { getParentRegistry, wrapper } = createTestSetup({ setup })
      const registry = getParentRegistry()

      expect(setup).toHaveBeenCalledTimes(1)
      expect(registry.hasRenderer("custom")).toBe(true)

      wrapper.unmount()
    })

    it("skipDefaults=true 时 setup 回调仍然被调用", () => {
      const setup = vi.fn((registry: Registry) => {
        expect(registry.size()).toBe(0)
        registry.register("myRenderer", defineComponent({ render: () => h("span") }))
      })

      const { getParentRegistry, wrapper } = createTestSetup({
        skipDefaults: true,
        setup,
      })
      const registry = getParentRegistry()

      expect(setup).toHaveBeenCalledTimes(1)
      expect(registry.hasRenderer("myRenderer")).toBe(true)
      expect(registry.size()).toBe(1)

      wrapper.unmount()
    })
  })

  describe("provide/inject - Requirement 10.4, 10.5", () => {
    it("子组件应该通过 useRendererContext 获取同一个 Registry 实例", () => {
      const { getParentRegistry, getChildRegistry, wrapper } = createTestSetup()

      expect(getChildRegistry()).toBe(getParentRegistry())

      wrapper.unmount()
    })

    it("子组件应该能使用 Registry 的所有方法", () => {
      const { getChildRegistry, wrapper } = createTestSetup()
      const registry = getChildRegistry()

      expect(registry.hasRenderer("input")).toBe(true)
      expect(registry.getRenderer("input")).toBeDefined()
      expect(registry.getTypes().length).toBeGreaterThan(0)

      wrapper.unmount()
    })
  })

  describe("useRendererContext 错误处理 - Requirement 10.6", () => {
    it("在没有 useRenderer 提供者时应该抛出错误", () => {
      const ComponentWithoutProvider = defineComponent({
        name: "ComponentWithoutProvider",
        setup() {
          // 直接调用 useRendererContext 而没有 useRenderer 提供者
          useRendererContext()

          return () => h("div")
        },
      })

      expect(() => {
        mount(ComponentWithoutProvider)
      }).toThrow("[useRendererContext] 必须在 useRenderer 提供的上下文中使用")
    })
  })

  describe("默认选项", () => {
    it("不传选项时应该使用默认行为", () => {
      const { getParentRegistry, wrapper } = createTestSetup()
      const registry = getParentRegistry()

      // 默认应该注册所有默认渲染器
      expect(registry.size()).toBe(DEFAULT_RENDERER_TYPES.length)

      wrapper.unmount()
    })
  })
})
