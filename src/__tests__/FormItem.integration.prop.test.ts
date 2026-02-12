/**
 * FormItem Integration Property-Based Tests
 *
 * Tests the ColumnRenderer logic component with mocked hooks to verify
 * renderer integration properties.
 *
 * Properties tested:
 * - Property 9: Renderer receives correct props
 *
 * **Validates: Requirements 6.3, 7.2**
 */

import { computed, defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import * as fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import ColumnRenderer from "../components/FormItem"

// ==================== Mock Setup ====================

// Configurable mock state for useField
const mockFieldState = {
  value: "" as unknown,
  error: undefined as string[] | undefined,
  readonly: false,
  disabled: false,
}

const mockSetValue = vi.fn()

vi.mock("../hooks/useFormContext", () => ({
  useFormContext: () => ({
    labelAlign: "left",
    labelWidth: "auto",
    colon: false,
    form: {
      getFieldValue: () => mockFieldState.value,
      getFieldsValue: () => ({}),
      setFieldValue: vi.fn(),
      getFieldError: () => mockFieldState.error,
      setFieldError: vi.fn(),
      isFieldTouched: () => false,
      getInitialValue: () => undefined,
      resetFields: vi.fn(),
      validateField: vi.fn(),
      subscribe: vi.fn(),
      subscribeAll: vi.fn(),
      destroy: vi.fn(),
    },
  }),
}))

vi.mock("../hooks/useField", () => ({
  useField: () => ({
    error: computed(() => mockFieldState.error),
    dirty: computed(() => false),
    pristine: computed(() => true),
    isValidating: computed(() => false),
    form: computed(() => ({})),
    getValue: () => mockFieldState.value,
    getValues: () => ({}),
    setValue: mockSetValue,
    setError: vi.fn(),
    getError: () => mockFieldState.error,
    clearError: vi.fn(),
    validate: vi.fn(),
    reset: vi.fn(),
    getInitialValue: () => undefined,
  }),
}))

// Configurable mock renderer registry
const mockRegistry = {
  register: vi.fn(),
  registerAll: vi.fn(),
  getRenderer: vi.fn(() => undefined),
  hasRenderer: vi.fn(() => false),
  unregister: vi.fn(),
  getTypes: vi.fn(() => []),
  setDefault: vi.fn(),
  getDefault: vi.fn(() => "text"),
  clear: vi.fn(),
  size: vi.fn(() => 0),
}

vi.mock("../hooks/useRenderer", () => ({
  useRendererContext: () => mockRegistry,
}))

// ==================== Generators ====================

/**
 * Generate valid field names (alphanumeric starting with a letter).
 */
const fieldNameArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,15}$/)
  .filter((s) => s.length > 0)

/**
 * Generate boolean values for readonly, disabled.
 */
const booleanArb = fc.boolean()

// ==================== Property Tests ====================

/**
 * **Feature: formitem-library-agnostic, Property 9: Renderer receives correct props**
 *
 * For any registered renderer and column config, the renderer component should receive
 * name, value, onChange (function), readonly (resolved), disabled (resolved),
 * and formItemProps (the processed column config) as props.
 *
 * **Validates: Requirements 6.3, 7.2**
 */
describe("Feature: formitem-library-agnostic, Property 9: Renderer receives correct props", () => {
  it("renderer receives name, value, onChange, readonly, disabled, and formItemProps", () => {
    fc.assert(
      fc.property(fieldNameArb, booleanArb, booleanArb, (name, readonly, disabled) => {
        // Track props received by the mock renderer
        let receivedProps: Record<string, unknown> | null = null

        const MockRenderer = defineComponent({
          name: "MockRenderer",
          props: {
            name: String,
            value: [String, Number, Boolean, Object, Array],
            onChange: Function,
            readonly: Boolean,
            disabled: Boolean,
            formItemProps: Object,
          },
          setup(props) {
            receivedProps = { ...props }
            return () => h("input", { class: "mock-renderer" })
          },
        })

        // Configure mock registry to return the mock renderer
        mockRegistry.getRenderer.mockReturnValue(MockRenderer)

        // Configure field state
        mockFieldState.value = "test-value"
        mockFieldState.error = undefined

        const wrapper = mount(ColumnRenderer, {
          props: {
            column: {
              name,
              componentType: "input",
              label: "Test Label",
              readonly,
              disabled,
            },
          },
        })

        // Verify the renderer was rendered
        expect(wrapper.find(".mock-renderer").exists()).toBe(true)

        // Verify the renderer received the correct props
        expect(receivedProps).not.toBeNull()
        expect(receivedProps!.name).toBe(name)
        expect(receivedProps!.value).toBe("test-value")
        expect(typeof receivedProps!.onChange).toBe("function")
        expect(receivedProps!.readonly).toBe(readonly)
        expect(receivedProps!.disabled).toBe(disabled)
        expect(receivedProps!.formItemProps).toBeDefined()
        expect((receivedProps!.formItemProps as Record<string, unknown>).name).toBe(name)

        // Reset mock
        mockRegistry.getRenderer.mockReturnValue(undefined)
        receivedProps = null

        wrapper.unmount()
      }),
      { numRuns: 100 }
    )
  })
})
