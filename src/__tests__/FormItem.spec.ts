/**
 * FormItem Unit Tests — Slots and Edge Cases
 *
 * Tests the ColumnRenderer logic component for:
 * - #nameItem slot renders instead of entire form item (Req 5.1)
 * - #name slot renders inside content area (Req 5.2)
 * - Dependency column renders FormDependency (Req 8.1)
 * - No renderer registered returns null content (Req 7.3)
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 7.3, 8.1**
 */

import { computed, defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import ColumnRenderer from "../components/FormItem"

// ==================== Mock Setup ====================

// Mock registry that returns undefined for all types (no renderers registered)
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

vi.mock("../hooks/useFormContext", () => ({
  useFormContext: () => ({
    labelAlign: "left",
    labelWidth: "auto",
    colon: false,
    form: {
      getFieldValue: () => "",
      getFieldsValue: () => ({}),
      setFieldValue: vi.fn(),
      getFieldError: () => undefined,
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
    error: computed(() => undefined),
    dirty: computed(() => false),
    pristine: computed(() => true),
    isValidating: computed(() => false),
    form: computed(() => ({})),
    getValue: () => "",
    getValues: () => ({}),
    setValue: vi.fn(),
    setError: vi.fn(),
    getError: () => undefined,
    clearError: vi.fn(),
    validate: vi.fn(),
    reset: vi.fn(),
    getInitialValue: () => undefined,
  }),
}))

vi.mock("../hooks/useRenderer", () => ({
  useRendererContext: () => mockRegistry,
}))

// ==================== Unit Tests ====================

describe("ColumnRenderer Unit Tests", () => {
  /**
   * Test: #nameItem slot renders instead of entire form item
   *
   * When a #nameItem slot is provided (e.g., #usernameItem for a field named "username"),
   * the ColumnRenderer should render the slot content directly, bypassing the FormItem wrapper.
   *
   * **Validates: Requirement 5.1**
   */
  describe("Requirement 5.1: #nameItem slot replaces entire form item", () => {
    it("renders #nameItem slot content instead of the FormItem wrapper", () => {
      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "username",
            componentType: "input",
            label: "Username",
          },
        },
        slots: {
          usernameItem: (props: any) =>
            h("div", { class: "custom-item" }, `Custom: ${props.name}`),
        },
      })

      // The custom slot content should be rendered
      expect(wrapper.find(".custom-item").exists()).toBe(true)
      expect(wrapper.find(".custom-item").text()).toBe("Custom: username")

      // The FormItem wrapper should NOT be rendered
      expect(wrapper.find(".schema-form-item-wrapper").exists()).toBe(false)

      wrapper.unmount()
    })

    it("passes processed column config to #nameItem slot", () => {
      let receivedProps: any = null

      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "email",
            componentType: "input",
            label: "Email",
          },
        },
        slots: {
          emailItem: (props: any) => {
            receivedProps = props

            return h("div", { class: "custom-item" }, "Custom Email")
          },
        },
      })

      expect(wrapper.find(".custom-item").exists()).toBe(true)
      expect(receivedProps).not.toBeNull()
      expect(receivedProps.name).toBe("email")
      expect(receivedProps.label).toBe("Email")

      wrapper.unmount()
    })
  })

  /**
   * Test: #name slot renders inside content area
   *
   * When a #name slot is provided (e.g., #username for a field named "username"),
   * the ColumnRenderer should render the slot content inside the FormItem's content area,
   * replacing the renderer component but keeping the FormItem wrapper.
   *
   * **Validates: Requirement 5.2**
   */
  describe("Requirement 5.2: #name slot renders inside content area", () => {
    it("renders #name slot content inside the FormItem control area", () => {
      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "username",
            componentType: "input",
            label: "Username",
          },
        },
        slots: {
          username: (props: any) =>
            h("div", { class: "custom-content" }, `Custom Input: ${props.name}`),
        },
      })

      // The FormItem wrapper should be rendered
      expect(wrapper.find(".schema-form-item-wrapper").exists()).toBe(true)

      // The custom content should be rendered inside the control area
      const controlArea = wrapper.find(".schema-form-item__control")
      expect(controlArea.exists()).toBe(true)
      expect(controlArea.find(".custom-content").exists()).toBe(true)
      expect(controlArea.find(".custom-content").text()).toBe("Custom Input: username")

      wrapper.unmount()
    })

    it("passes processed column config to #name slot", () => {
      let receivedProps: any = null

      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "address",
            componentType: "input",
            label: "Address",
          },
        },
        slots: {
          address: (props: any) => {
            receivedProps = props

            return h("div", { class: "custom-content" }, "Custom Address")
          },
        },
      })

      expect(wrapper.find(".custom-content").exists()).toBe(true)
      expect(receivedProps).not.toBeNull()
      expect(receivedProps.name).toBe("address")
      expect(receivedProps.label).toBe("Address")

      wrapper.unmount()
    })
  })

  /**
   * Test: Dependency column renders FormDependency
   *
   * When a column has componentType "dependency", the ColumnRenderer should render
   * a FormDependency component instead of the standard form item layout.
   *
   * **Validates: Requirement 8.1**
   */
  describe("Requirement 8.1: Dependency column renders FormDependency", () => {
    it("renders FormDependency for dependency column type", () => {
      const rendererFn = vi.fn(() => [])

      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            componentType: "dependency",
            to: ["country"],
            renderer: rendererFn,
          },
        },
      })

      // FormDependency should be rendered — check for the component by name
      const formDependency = wrapper.findComponent({ name: "SchemaFormDependency" })
      expect(formDependency.exists()).toBe(true)

      // Verify the props are passed correctly
      expect(formDependency.props("to")).toEqual(["country"])
      expect(formDependency.props("renderer")).toBe(rendererFn)

      wrapper.unmount()
    })
  })

  /**
   * Test: No renderer registered returns null content
   *
   * When no renderer is registered for the column's componentType,
   * the ColumnRenderer should render nothing (return null).
   *
   * **Validates: Requirement 7.3**
   */
  describe("Requirement 7.3: No renderer registered returns null content", () => {
    it("renders nothing when no renderer is registered for the component type", () => {
      // Ensure mockRegistry.getRenderer returns undefined
      mockRegistry.getRenderer.mockReturnValue(undefined)

      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "field1",
            componentType: "unknown-type",
            label: "Field",
          },
        },
      })

      // The component should render nothing — no FormItem wrapper, no content
      expect(wrapper.find(".schema-form-item-wrapper").exists()).toBe(false)
      expect(wrapper.html()).toBe("")

      wrapper.unmount()
    })
  })

  /**
   * Test: When neither #nameItem nor #name slot is provided, renderer is used
   *
   * **Validates: Requirement 5.3**
   */
  describe("Requirement 5.3: Default renderer used when no custom slots provided", () => {
    it("renders the registered renderer component when no custom slots are provided", () => {
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
          return () => h("input", { class: "mock-renderer", value: props.value })
        },
      })

      // Configure mock registry to return the mock renderer
      mockRegistry.getRenderer.mockReturnValue(MockRenderer)

      const wrapper = mount(ColumnRenderer, {
        props: {
          column: {
            name: "testField",
            componentType: "input",
            label: "Test Field",
          },
        },
      })

      // The FormItem wrapper should be rendered
      expect(wrapper.find(".schema-form-item-wrapper").exists()).toBe(true)

      // The mock renderer should be rendered inside the control area
      const controlArea = wrapper.find(".schema-form-item__control")
      expect(controlArea.exists()).toBe(true)
      expect(controlArea.find(".mock-renderer").exists()).toBe(true)

      // Reset mock
      mockRegistry.getRenderer.mockReturnValue(undefined)

      wrapper.unmount()
    })
  })
})
