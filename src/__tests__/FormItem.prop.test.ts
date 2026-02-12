/**
 * FormItem Property-Based Tests
 *
 * Uses fast-check to verify core presentation properties of the FormItem component.
 * Tests the pure presentation component directly (src/components/FormItem/index.tsx)
 * without needing to mock useField, useFormContext, or useRendererContext.
 * Also tests resolveDynamicProp utility function directly.
 *
 * Properties tested:
 * - Property 1: CSS class application
 * - Property 2: Hidden field renders nothing
 * - Property 3: Label presence
 * - Property 4: Label styling reflects Form Context
 * - Property 5: Colon appended when enabled
 * - Property 6: Required indicator
 * - Property 7: Error display
 * - Property 8: Dynamic property resolution
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 6.1, 6.2**
 */

import { mount } from "@vue/test-utils"
import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import FormItem from "../components/FormItem/FormItem"
import { resolveDynamicProp } from "../utils"

// ==================== Generators ====================

/**
 * Generate valid CSS class names: alphanumeric strings starting with a letter.
 */
const classNameArb = fc
  .stringMatching(/^[a-z][a-z0-9_-]{0,20}$/)
  .filter((s) => s.length > 0)

/**
 * Generate optional CSS class names (undefined or valid class name).
 */
const optionalClassNameArb = fc.option(classNameArb, { nil: undefined })

/**
 * Generate non-empty label strings (alphanumeric to avoid HTML encoding issues).
 */
const nonEmptyLabelArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/)
  .filter((s) => s.trim().length > 0)

/**
 * Generate optional labels (undefined or non-empty string).
 */
const optionalLabelArb = fc.option(nonEmptyLabelArb, { nil: undefined })

/**
 * Generate boolean values for required, hidden, etc.
 */
const booleanArb = fc.boolean()

/**
 * Generate non-empty error message strings (alphanumeric to avoid HTML encoding issues).
 */
const errorMessageArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,50}$/)
  .filter((s) => s.trim().length > 0)

/**
 * Generate optional error arrays: undefined, empty array, or array with 1-3 messages.
 */
const optionalErrorArb = fc.oneof(
  fc.constant(undefined),
  fc.constant([] as string[]),
  fc.array(errorMessageArb, { minLength: 1, maxLength: 3 })
)

// ==================== Property Tests ====================

describe("FormItem Property Tests", () => {
  /**
   * **Feature: formitem-library-agnostic, Property 1: CSS class application**
   *
   * For any column config with optional className, verify wrapper has
   * `schema-form-item-wrapper` and inner has `schema-form-item` + className.
   *
   * **Validates: Requirements 1.2, 1.3**
   */
  describe("Feature: formitem-library-agnostic, Property 1: CSS class application", () => {
    it("wrapper always has schema-form-item-wrapper class and inner has schema-form-item plus optional className", () => {
      fc.assert(
        fc.property(optionalClassNameArb, (className) => {
          const wrapper = mount(FormItem, {
            props: {
              className,
            },
          })

          // Outer wrapper must have schema-form-item-wrapper
          const outerWrapper = wrapper.find(".schema-form-item-wrapper")
          expect(outerWrapper.exists()).toBe(true)

          // Inner div must have schema-form-item
          const innerDiv = wrapper.find(".schema-form-item")
          expect(innerDiv.exists()).toBe(true)

          // If className is provided, inner div must also have that class
          if (className !== undefined) {
            expect(innerDiv.classes()).toContain(className)
          }

          wrapper.unmount()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 2: Hidden field renders nothing**
   *
   * For any column where hidden resolves to true, verify null output.
   *
   * **Validates: Requirements 1.4**
   */
  describe("Feature: formitem-library-agnostic, Property 2: Hidden field renders nothing", () => {
    it("renders nothing when hidden is true regardless of other props", () => {
      fc.assert(
        fc.property(
          optionalClassNameArb,
          optionalLabelArb,
          booleanArb,
          optionalErrorArb,
          (className, label, required, error) => {
            const wrapper = mount(FormItem, {
              props: {
                hidden: true,
                className,
                label,
                required,
                error,
              },
            })

            // When hidden is true, the component should render nothing
            // Vue renders null as an empty comment node; html() returns empty string
            expect(wrapper.find(".schema-form-item-wrapper").exists()).toBe(false)

            wrapper.unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 3: Label presence**
   *
   * For any column, label element present iff column has non-empty label.
   * When present, the label text contains the label value.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe("Feature: formitem-library-agnostic, Property 3: Label presence", () => {
    it("label element is present iff label prop is a non-empty string", () => {
      fc.assert(
        fc.property(optionalLabelArb, (label) => {
          const wrapper = mount(FormItem, {
            props: {
              label,
            },
          })

          const labelEl = wrapper.find(".schema-form-item__label")
          const hasLabel = label !== undefined && label.length > 0

          // Label element present iff label is non-empty
          expect(labelEl.exists()).toBe(hasLabel)

          // When present, label text element contains the label value
          if (hasLabel) {
            const labelText = wrapper.find(".schema-form-item__label-text")
            expect(labelText.exists()).toBe(true)
            expect(labelText.element.textContent).toContain(label)
          }

          wrapper.unmount()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 6: Required indicator**
   *
   * For any column, asterisk present iff required resolves to true.
   * Note: required indicator only shows when a label is present.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  describe("Feature: formitem-library-agnostic, Property 6: Required indicator", () => {
    it("required asterisk is present iff required is true (with label present)", () => {
      fc.assert(
        fc.property(nonEmptyLabelArb, booleanArb, (label, required) => {
          const wrapper = mount(FormItem, {
            props: {
              label,
              required,
            },
          })

          const requiredEl = wrapper.find(".schema-form-item__required")

          // Required indicator present iff required is true
          expect(requiredEl.exists()).toBe(required)

          // When present, it should contain the asterisk
          if (required) {
            expect(requiredEl.text()).toBe("*")
          }

          wrapper.unmount()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 7: Error display**
   *
   * For any field, error element present iff field has errors (non-empty array),
   * showing first message.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  describe("Feature: formitem-library-agnostic, Property 7: Error display", () => {
    it("error element is present iff error array has length > 0, showing first message", () => {
      fc.assert(
        fc.property(optionalErrorArb, (error) => {
          const wrapper = mount(FormItem, {
            props: {
              error,
            },
          })

          const errorEl = wrapper.find(".schema-form-item__error")
          const hasErrors = error !== undefined && error.length > 0

          // Error element present iff error array is non-empty
          expect(errorEl.exists()).toBe(hasErrors)

          // When present, it should show the first error message
          if (hasErrors) {
            expect(errorEl.element.textContent).toBe(error[0])
          }

          wrapper.unmount()
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 4: Label styling reflects Form Context**
   *
   * For any labelAlign value (left, right, top) and any labelWidth string,
   * the FormItem should apply the corresponding alignment CSS class and width style
   * to the label element.
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  describe("Feature: formitem-library-agnostic, Property 4: Label styling reflects Form Context", () => {
    const labelAlignArb = fc.constantFrom(
      "left" as const,
      "right" as const,
      "top" as const
    )
    const labelWidthArb = fc.oneof(
      fc.constant(undefined),
      fc.constant("80px"),
      fc.constant("120px"),
      fc.constant("auto")
    )

    it("applies correct label alignment CSS class and label width style", () => {
      fc.assert(
        fc.property(
          nonEmptyLabelArb,
          labelAlignArb,
          labelWidthArb,
          (label, labelAlign, labelWidth) => {
            const wrapper = mount(FormItem, {
              props: {
                label,
                labelAlign,
                labelWidth,
              },
            })

            // The inner .schema-form-item div must have the alignment class
            const innerDiv = wrapper.find(".schema-form-item")
            expect(innerDiv.exists()).toBe(true)
            expect(innerDiv.classes()).toContain(`schema-form-item--label-${labelAlign}`)

            // If labelWidth is provided, the label element must have the corresponding width style
            const labelEl = wrapper.find(".schema-form-item__label")
            expect(labelEl.exists()).toBe(true)

            if (labelWidth !== undefined) {
              expect((labelEl.element as HTMLElement).style.width).toBe(labelWidth)
            } else {
              // When labelWidth is undefined, no inline width style should be set
              expect((labelEl.element as HTMLElement).style.width).toBe("")
            }

            wrapper.unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: formitem-library-agnostic, Property 5: Colon appended when enabled**
   *
   * For any column with a label, when colon is true, the rendered label text
   * should include a colon suffix. When colon is false, no colon should be appended.
   *
   * **Validates: Requirements 2.5**
   */
  describe("Feature: formitem-library-agnostic, Property 5: Colon appended when enabled", () => {
    it("label text ends with colon iff colon prop is true", () => {
      fc.assert(
        fc.property(nonEmptyLabelArb, booleanArb, (label, colon) => {
          const wrapper = mount(FormItem, {
            props: {
              label,
              colon,
            },
          })

          const labelTextEl = wrapper.find(".schema-form-item__label-text")
          expect(labelTextEl.exists()).toBe(true)

          const textContent = labelTextEl.element.textContent || ""

          if (colon) {
            // When colon is true, label text must end with ":"
            expect(textContent).toBe(`${label}:`)
            expect(textContent.endsWith(":")).toBe(true)
          } else {
            // When colon is false, label text must NOT end with ":"
            expect(textContent).toBe(label)
            expect(textContent.endsWith(":")).toBe(false)
          }

          wrapper.unmount()
        }),
        { numRuns: 100 }
      )
    })
  })
})

/**
 * resolveDynamicProp Property-Based Tests
 *
 * Tests the resolveDynamicProp utility function directly without component mounting.
 *
 * **Feature: formitem-library-agnostic, Property 8: Dynamic property resolution**
 *
 * **Validates: Requirements 6.1, 6.2**
 */
describe("Feature: formitem-library-agnostic, Property 8: Dynamic property resolution", () => {
  /**
   * Generator for random form values: a dictionary of string keys to string/integer/boolean values.
   */
  const formValuesArb = fc.dictionary(
    fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,10}$/).filter((s) => s.length > 0),
    fc.oneof(fc.string(), fc.integer(), fc.boolean())
  )

  it("dynamic prop function result matches resolveDynamicProp output", () => {
    fc.assert(
      fc.property(formValuesArb, fc.boolean(), (formValues, expectedResult) => {
        // Create a dynamic prop function that returns expectedResult
        const dynamicFn = (values: Record<string, unknown>) => {
          // Use values to ensure the function actually receives form values
          void values
          return expectedResult
        }

        const result = resolveDynamicProp(dynamicFn, formValues, false)
        expect(result).toBe(expectedResult)
      }),
      { numRuns: 100 }
    )
  })

  it("static values pass through unchanged", () => {
    fc.assert(
      fc.property(
        formValuesArb,
        fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        (formValues, staticValue) => {
          const result = resolveDynamicProp(staticValue, formValues, false as any)
          expect(result).toBe(staticValue)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("null and undefined return the default value", () => {
    fc.assert(
      fc.property(
        formValuesArb,
        fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        (formValues, defaultValue) => {
          const resultNull = resolveDynamicProp(null, formValues, defaultValue)
          expect(resultNull).toBe(defaultValue)

          const resultUndefined = resolveDynamicProp(undefined, formValues, defaultValue)
          expect(resultUndefined).toBe(defaultValue)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("function that throws returns the default value", () => {
    fc.assert(
      fc.property(formValuesArb, fc.boolean(), (formValues, defaultValue) => {
        const throwingFn = () => {
          throw new Error("test error")
        }

        const result = resolveDynamicProp(throwingFn, formValues, defaultValue)
        expect(result).toBe(defaultValue)
      }),
      { numRuns: 100 }
    )
  })

  it("function receives the actual form values", () => {
    fc.assert(
      fc.property(formValuesArb, (formValues) => {
        let receivedValues: Record<string, unknown> | null = null

        const captureFn = (values: Record<string, unknown>) => {
          receivedValues = values
          return true
        }

        resolveDynamicProp(captureFn, formValues, false)
        expect(receivedValues).toEqual(formValues)
      }),
      { numRuns: 100 }
    )
  })
})
