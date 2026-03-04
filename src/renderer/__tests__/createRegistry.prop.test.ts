/**
 * Registry 属性测试
 *
 * 使用 fast-check 进行属性测试，验证 Registry 的核心功能：
 * - Property 1: Registry register/get round-trip
 * - Property 2: Registry unregister removes renderer
 * - Property 3: Registry clear resets state
 * - Property 4: Registry default type round-trip
 *
 * **Validates: Requirements 1.1-1.10**
 */

import { defineComponent, h } from "vue"

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createLocalRegistry, type RegistryOptions } from "../rendererRegistry"

// ==================== 测试辅助 ====================

/**
 * 创建一个简单的测试组件
 */
function createTestComponent(name: string) {
  return defineComponent({
    name,
    setup() {
      return () => h("div", { class: name }, name)
    },
  })
}

/**
 * 生成有效的渲染器类型字符串
 * 类型字符串应该是非空的、合理长度的字符串
 */
const rendererTypeArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)

/**
 * 生成唯一的渲染器类型数组
 */
const uniqueRendererTypesArb = fc
  .array(rendererTypeArb, { minLength: 1, maxLength: 20 })
  .map((types) => [...new Set(types)])
  .filter((types) => types.length > 0)

// ==================== 属性测试 ====================

describe("Registry Property Tests", () => {
  /**
   * **Feature: renderer-refactor, Property 1: Registry register/get round-trip**
   *
   * For any type string and renderer component, if we register the renderer with that type,
   * then calling `getRenderer` with the same type should return the registered renderer
   * (or RendererWrapper).
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.8**
   */
  describe("**Feature: renderer-refactor, Property 1: Registry register/get round-trip**", () => {
    it("should return the registered renderer for any valid type", () => {
      fc.assert(
        fc.property(rendererTypeArb, (type) => {
          const registry = createLocalRegistry()
          const component = createTestComponent(`Test-${type}`)

          registry.register(type, component)

          const retrieved = registry.getRenderer(type)
          expect(retrieved).toBe(component)
          expect(registry.hasRenderer(type)).toBe(true)
        }),
        { numRuns: 30 }
      )
    })

    it("should correctly handle registerAll for multiple renderers", () => {
      fc.assert(
        fc.property(uniqueRendererTypesArb, (types) => {
          const registry = createLocalRegistry()
          const rendererMap: Record<string, ReturnType<typeof createTestComponent>> = {}

          types.forEach((type) => {
            rendererMap[type] = createTestComponent(`Test-${type}`)
          })

          registry.registerAll(rendererMap)

          // Verify all renderers are registered and retrievable
          types.forEach((type) => {
            expect(registry.hasRenderer(type)).toBe(true)
            expect(registry.getRenderer(type)).toBe(rendererMap[type])
          })

          expect(registry.size()).toBe(types.length)
        }),
        { numRuns: 30 }
      )
    })
  })

  /**
   * **Feature: renderer-refactor, Property 2: Registry unregister removes renderer**
   *
   * For any registered renderer type, after calling `unregister` with that type,
   * `hasRenderer` should return false and `getRenderer` should return undefined.
   *
   * **Validates: Requirements 1.5, 1.6**
   */
  describe("**Feature: renderer-refactor, Property 2: Registry unregister removes renderer**", () => {
    it("should remove renderer after unregister", () => {
      fc.assert(
        fc.property(rendererTypeArb, (type) => {
          const registry = createLocalRegistry()
          const component = createTestComponent(`Test-${type}`)

          // Register first
          registry.register(type, component)
          expect(registry.hasRenderer(type)).toBe(true)

          // Unregister
          const result = registry.unregister(type)
          expect(result).toBe(true)
          expect(registry.hasRenderer(type)).toBe(false)
          expect(registry.getRenderer(type)).toBeUndefined()
        }),
        { numRuns: 30 }
      )
    })

    it("should return false when unregistering non-existent type", () => {
      fc.assert(
        fc.property(rendererTypeArb, (type) => {
          const registry = createLocalRegistry()

          // Unregister without registering
          const result = registry.unregister(type)
          expect(result).toBe(false)
        }),
        { numRuns: 30 }
      )
    })

    it("should correctly update size after unregister", () => {
      fc.assert(
        fc.property(uniqueRendererTypesArb, (types) => {
          const registry = createLocalRegistry()

          // Register all types
          types.forEach((type) => {
            registry.register(type, createTestComponent(`Test-${type}`))
          })

          const initialSize = registry.size()
          expect(initialSize).toBe(types.length)

          // Unregister each type one by one
          types.forEach((type, index) => {
            registry.unregister(type)
            expect(registry.size()).toBe(initialSize - index - 1)
          })

          expect(registry.size()).toBe(0)
        }),
        { numRuns: 30 }
      )
    })
  })

  /**
   * **Feature: renderer-refactor, Property 3: Registry clear resets state**
   *
   * For any Registry with registered renderers, after calling `clear`,
   * `size` should return 0 and `getTypes` should return an empty array.
   *
   * **Validates: Requirements 1.7, 1.10**
   */
  describe("**Feature: renderer-refactor, Property 3: Registry clear resets state**", () => {
    it("should reset size to 0 after clear", () => {
      fc.assert(
        fc.property(uniqueRendererTypesArb, (types) => {
          const registry = createLocalRegistry()

          // Register multiple renderers
          types.forEach((type) => {
            registry.register(type, createTestComponent(`Test-${type}`))
          })

          expect(registry.size()).toBe(types.length)

          // Clear
          registry.clear()

          expect(registry.size()).toBe(0)
        }),
        { numRuns: 30 }
      )
    })

    it("should return empty array from getTypes after clear", () => {
      fc.assert(
        fc.property(uniqueRendererTypesArb, (types) => {
          const registry = createLocalRegistry()

          // Register multiple renderers
          types.forEach((type) => {
            registry.register(type, createTestComponent(`Test-${type}`))
          })

          expect(registry.getTypes().length).toBe(types.length)

          // Clear
          registry.clear()

          expect(registry.getTypes()).toEqual([])
        }),
        { numRuns: 30 }
      )
    })

    it("should make all previously registered types unavailable after clear", () => {
      fc.assert(
        fc.property(uniqueRendererTypesArb, (types) => {
          const registry = createLocalRegistry()

          // Register multiple renderers
          types.forEach((type) => {
            registry.register(type, createTestComponent(`Test-${type}`))
          })

          // Clear
          registry.clear()

          // Verify all types are no longer available
          types.forEach((type) => {
            expect(registry.hasRenderer(type)).toBe(false)
            expect(registry.getRenderer(type)).toBeUndefined()
          })
        }),
        { numRuns: 30 }
      )
    })

    it("should reset default type to 'text' after clear", () => {
      fc.assert(
        fc.property(
          uniqueRendererTypesArb.filter((types) => types.length >= 1),
          (types) => {
            const registry = createLocalRegistry()

            // Register and set a custom default
            const firstType = types[0]
            registry.register(firstType, createTestComponent(`Test-${firstType}`))
            registry.setDefault(firstType)
            expect(registry.getDefault()).toBe(firstType)

            // Clear
            registry.clear()

            // Default should be reset to 'text'
            expect(registry.getDefault()).toBe("text")
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  /**
   * **Feature: renderer-refactor, Property 4: Registry default type round-trip**
   *
   * For any registered renderer type, after calling `setDefault` with that type,
   * `getDefault` should return the same type.
   *
   * **Validates: Requirements 1.9**
   */
  describe("**Feature: renderer-refactor, Property 4: Registry default type round-trip**", () => {
    it("should return the same type from getDefault after setDefault", () => {
      fc.assert(
        fc.property(rendererTypeArb, (type) => {
          const registry = createLocalRegistry()
          const component = createTestComponent(`Test-${type}`)

          // Register first (setDefault requires the type to be registered)
          registry.register(type, component)

          // Set as default
          registry.setDefault(type)

          // Verify round-trip
          expect(registry.getDefault()).toBe(type)
        }),
        { numRuns: 30 }
      )
    })

    it("should not change default when setting unregistered type", () => {
      fc.assert(
        fc.property(
          fc.tuple(rendererTypeArb, rendererTypeArb).filter(([a, b]) => a !== b),
          ([registeredType, unregisteredType]) => {
            const registry = createLocalRegistry()

            // Register one type
            registry.register(
              registeredType,
              createTestComponent(`Test-${registeredType}`)
            )
            registry.setDefault(registeredType)

            const defaultBefore = registry.getDefault()

            // Try to set unregistered type as default (should fail silently)
            registry.setDefault(unregisteredType)

            // Default should remain unchanged
            expect(registry.getDefault()).toBe(defaultBefore)
          }
        ),
        { numRuns: 30 }
      )
    })

    it("should allow changing default between registered types", () => {
      fc.assert(
        fc.property(
          uniqueRendererTypesArb.filter((types) => types.length >= 2),
          (types) => {
            const registry = createLocalRegistry()

            // Register all types
            types.forEach((type) => {
              registry.register(type, createTestComponent(`Test-${type}`))
            })

            // Set each type as default and verify
            types.forEach((type) => {
              registry.setDefault(type)
              expect(registry.getDefault()).toBe(type)
            })
          }
        ),
        { numRuns: 30 }
      )
    })

    it("should reset default to 'text' when unregistering the default type", () => {
      fc.assert(
        fc.property(
          rendererTypeArb.filter((type) => type !== "text"),
          (type) => {
            const registry = createLocalRegistry()

            // Register and set as default
            registry.register(type, createTestComponent(`Test-${type}`))
            registry.setDefault(type)
            expect(registry.getDefault()).toBe(type)

            // Unregister the default type
            registry.unregister(type)

            // Default should be reset to 'text'
            expect(registry.getDefault()).toBe("text")
          }
        ),
        { numRuns: 30 }
      )
    })
  })
})
