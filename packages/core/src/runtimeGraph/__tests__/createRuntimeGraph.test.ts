/**
 * Runtime Graph Assembly Contract Tests (T013)
 *
 * @module core/runtimeGraph/__tests__/createRuntimeGraph.test
 */

import { describe, it, expect, beforeEach } from "vitest"
import { createRuntimeGraph } from "../createRuntimeGraph"
import { createRuntimeDiagnostics } from "../diagnostics"
import type { Values } from "../../../types"

interface TestValues extends Values {
  username: string
  email: string
  age: number
}

describe("Runtime Graph Assembly (T013)", () => {
  describe("createRuntimeGraph", () => {
    it("should create a runtime graph instance", () => {
      const runtimeGraph = createRuntimeGraph<TestValues>()
      expect(runtimeGraph).toBeDefined()
    })

    it("should initialize with all required modules", () => {
      const runtimeGraph = createRuntimeGraph<TestValues>()
      expect(runtimeGraph.schemaGraph).toBeDefined()
      expect(runtimeGraph.valueGraph).toBeDefined()
      expect(runtimeGraph.dynamicProps).toBeDefined()
      expect(runtimeGraph.dynamicSlot).toBeDefined()
      expect(runtimeGraph.effectiveSchema).toBeDefined()
      expect(runtimeGraph.validation).toBeDefined()
      expect(runtimeGraph.scopeManager).toBeDefined()
      expect(runtimeGraph.viewGraph).toBeDefined()
      expect(runtimeGraph.diagnostics).toBeDefined()
    })

    it("should accept initial values", () => {
      const initialValues: Partial<TestValues> = {
        username: "testuser",
        age: 25,
      }
      const runtimeGraph = createRuntimeGraph<TestValues>({
        initialValues,
      })
      expect(runtimeGraph.getFieldValue("username")).toBe("testuser")
      expect(runtimeGraph.getFieldValue("age")).toBe(25)
    })
  })

  describe("Runtime Graph API", () => {
    let runtimeGraph: ReturnType<typeof createRuntimeGraph<TestValues>>

    beforeEach(() => {
      runtimeGraph = createRuntimeGraph<TestValues>({
        initialValues: {
          username: "initialuser",
          email: "initial@example.com",
        },
      })
    })

    it("should get and set field values", () => {
      expect(runtimeGraph.getFieldValue("username")).toBe("initialuser")
      runtimeGraph.setFieldValue("username", "newuser")
      expect(runtimeGraph.getFieldValue("username")).toBe("newuser")
    })

    it("should validate form (skeleton implementation)", async () => {
      const result = await runtimeGraph.validate()
      expect(typeof result).toBe("boolean")
    })

    it("should destroy without errors", () => {
      expect(() => runtimeGraph.destroy()).not.toThrow()
    })

    it("should accept schema updates (skeleton implementation)", () => {
      expect(() => runtimeGraph.setSchemas([])).not.toThrow()
    })
  })

  describe("Runtime Diagnostics", () => {
    it("should create diagnostics instance", () => {
      const diagnostics = createRuntimeDiagnostics()
      expect(diagnostics).toBeDefined()
      expect(diagnostics.schemaErrors).toEqual([])
      expect(diagnostics.dynamicPropsErrors).toEqual([])
      expect(diagnostics.staleSlotRuns).toEqual([])
      expect(diagnostics.disposalRecords).toEqual([])
      expect(diagnostics.viewRecomputationTraces).toEqual([])
    })

    it("should add schema errors", () => {
      const diagnostics = createRuntimeDiagnostics()
      diagnostics.addSchemaError({
        type: "invalid_node",
        message: "Test error",
      })
      expect(diagnostics.schemaErrors).toHaveLength(1)
      expect(diagnostics.schemaErrors[0].message).toBe("Test error")
    })

    it("should record view recomputation traces", () => {
      const diagnostics = createRuntimeDiagnostics()
      diagnostics.recordViewRecomputation({
        nodeId: "root",
        triggeredBy: "schema_change",
        timestamp: Date.now(),
      })
      expect(diagnostics.viewRecomputationTraces).toHaveLength(1)
    })
  })
})
