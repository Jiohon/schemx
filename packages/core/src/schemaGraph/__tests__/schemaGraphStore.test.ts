/**
 * Schema Graph Store Patch Contract Tests (T015)
 *
 * @module core/schemaGraph/__tests__/schemaGraphStore.test
 */

import { describe, it, expect, beforeEach } from "vitest"
import { createSchemaGraphStore } from "../schemaGraphStore"
import type { Values } from "../../../types"

interface TestValues extends Values {
  username: string
}

describe("Schema Graph Store (T015)", () => {
  describe("basic operations", () => {
    it("should create schema graph store", () => {
      const store = createSchemaGraphStore<TestValues>()
      expect(store).toBeDefined()
    })

    it("should have root node children", () => {
      const store = createSchemaGraphStore<TestValues>()
      expect(store.getChildren("root")).toEqual([])
    })

    it("should get empty ancestor path for root", () => {
      const store = createSchemaGraphStore<TestValues>()
      expect(store.getAncestorPath("root")).toEqual(["root"])
    })

    it("should apply patches without errors (skeleton)", () => {
      const store = createSchemaGraphStore<TestValues>()
      expect(() => store.apply([])).not.toThrow()
    })

    it("should return undefined for non-existent nodes", () => {
      const store = createSchemaGraphStore<TestValues>()
      expect(store.getNode("non-existent")).toBeUndefined()
      expect(store.getParent("non-existent")).toBeUndefined()
    })
  })

  describe("snapshot", () => {
    it("should provide snapshot", () => {
      const store = createSchemaGraphStore<TestValues>()
      const snapshot = store.snapshot
      expect(snapshot).toBeDefined()
      expect(snapshot.nodesById).toBeDefined()
      expect(snapshot.childrenById).toBeDefined()
      expect(snapshot.parentById).toBeDefined()
    })
  })
})
