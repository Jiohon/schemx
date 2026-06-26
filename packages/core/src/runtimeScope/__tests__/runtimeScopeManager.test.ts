/**
 * Runtime Scope Lifecycle Contract Tests (T017)
 *
 * @module core/runtimeScope/__tests__/runtimeScopeManager.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { createRuntimeScopeManager } from "../runtimeScopeManager"

describe("Runtime Scope Manager (T017)", () => {
  describe("scope creation", () => {
    it("should create scope manager", () => {
      const manager = createRuntimeScopeManager()
      expect(manager).toBeDefined()
    })

    it("should ensure scope exists", () => {
      const manager = createRuntimeScopeManager()
      const scope = manager.ensureScope("node1")
      expect(scope).toBeDefined()
      expect(scope.nodeId).toBe("node1")
    })

    it("should return same scope for same node id", () => {
      const manager = createRuntimeScopeManager()
      const scope1 = manager.ensureScope("node1")
      const scope2 = manager.ensureScope("node1")
      expect(scope1).toBe(scope2)
    })

    it("should get existing scope", () => {
      const manager = createRuntimeScopeManager()
      manager.ensureScope("node1")
      const scope = manager.getScope("node1")
      expect(scope).toBeDefined()
      expect(scope?.nodeId).toBe("node1")
    })

    it("should return undefined for non-existent scope", () => {
      const manager = createRuntimeScopeManager()
      expect(manager.getScope("non-existent")).toBeUndefined()
    })
  })

  describe("scope state", () => {
    it("should check if node is disposed", () => {
      const manager = createRuntimeScopeManager()
      expect(manager.isDisposed("node1")).toBe(false)

      manager.ensureScope("node1")
      expect(manager.isDisposed("node1")).toBe(false)

      manager.disposeScope("node1")
      expect(manager.isDisposed("node1")).toBe(true)
    })

    it("should report form as disposed after disposeForm", () => {
      const manager = createRuntimeScopeManager()
      manager.ensureScope("node1")
      expect(manager.isDisposed("node1")).toBe(false)

      manager.disposeForm()
      expect(manager.isDisposed("node1")).toBe(true)
    })
  })

  describe("scope operations", () => {
    it("should add disposer to scope", () => {
      const manager = createRuntimeScopeManager()
      const scope = manager.ensureScope("node1")
      const disposer = vi.fn()
      scope.add(disposer)
      // disposer is added, will be called on dispose
    })

    it("should call disposers on scope dispose", () => {
      const manager = createRuntimeScopeManager()
      const scope = manager.ensureScope("node1")
      const disposer1 = vi.fn()
      const disposer2 = vi.fn()
      scope.add(disposer1)
      scope.add(disposer2)

      manager.disposeScope("node1")
      expect(disposer1).toHaveBeenCalled()
      expect(disposer2).toHaveBeenCalled()
    })

    it("should call disposers immediately if scope is already disposed", () => {
      const manager = createRuntimeScopeManager()
      manager.disposeForm()

      const scope = manager.ensureScope("node1")
      const disposer = vi.fn()
      scope.add(disposer)
      expect(disposer).toHaveBeenCalled()
    })

    it("should provide abort controller", () => {
      const manager = createRuntimeScopeManager()
      const scope = manager.ensureScope("node1")
      const controller = scope.getOrCreateAbortController()
      expect(controller).toBeDefined()
      expect(controller.signal).toBeDefined()
    })

    it("should abort signal on scope dispose", () => {
      const manager = createRuntimeScopeManager()
      const scope = manager.ensureScope("node1")
      const controller = scope.getOrCreateAbortController()
      expect(controller.signal.aborted).toBe(false)

      manager.disposeScope("node1")
      expect(controller.signal.aborted).toBe(true)
    })
  })

  describe("subtree disposal", () => {
    it("should dispose subtree", () => {
      const manager = createRuntimeScopeManager()
      manager.ensureScope("parent")
      manager.ensureScope("child1")
      manager.ensureScope("child2")

      const getChildren = (nodeId: string) => {
        if (nodeId === "parent") return ["child1", "child2"]
        return []
      }

      manager.disposeSubtree("parent", getChildren)
      expect(manager.isDisposed("parent")).toBe(true)
      expect(manager.isDisposed("child1")).toBe(true)
      expect(manager.isDisposed("child2")).toBe(true)
    })
  })

  describe("form disposal", () => {
    it("should dispose all scopes on form dispose", () => {
      const manager = createRuntimeScopeManager()
      manager.ensureScope("node1")
      manager.ensureScope("node2")
      manager.ensureScope("node3")

      manager.disposeForm()
      expect(manager.isDisposed("node1")).toBe(true)
      expect(manager.isDisposed("node2")).toBe(true)
      expect(manager.isDisposed("node3")).toBe(true)
    })

    it("should be idempotent", () => {
      const manager = createRuntimeScopeManager()
      manager.ensureScope("node1")

      manager.disposeForm()
      expect(() => manager.disposeForm()).not.toThrow()
    })
  })
})
