/**
 * T016 & T025 [P] [US1] - Value Graph Tests
 *
 * 测试覆盖：
 * - initial values
 * - set/get values
 * - dirty/touched state
 * - replacement reuse
 */

import { describe, it, expect, beforeEach } from "vitest"
import { createValueGraph } from "../valueGraph"
import type { Values } from "../../types/form"

interface TestValues extends Values {
  username: string
  email: string
  age: number
}

describe("Value Graph (T016 & T025)", () => {
  describe("basic operations", () => {
    it("should create value graph", () => {
      const valueGraph = createValueGraph<TestValues>()
      expect(valueGraph).toBeDefined()
    })

    it("should set and get field values", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.setValue("username", "testuser")
      expect(valueGraph.getValue("username")).toBe("testuser")
    })

    it("should create field node on setValue if not exists", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.setValue("username", "testuser")
      expect(valueGraph.getValue("username")).toBe("testuser")
    })

    it("should mount field and get field node", () => {
      const valueGraph = createValueGraph<TestValues>()
      const fieldNode = valueGraph.mountField("node1", "username", "initial")
      expect(fieldNode).toBeDefined()
      expect(fieldNode.name).toBe("username")
    })

    it("should get field by node id", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      const fieldNode = valueGraph.getField("node1")
      expect(fieldNode).toBeDefined()
      expect(fieldNode?.name).toBe("username")
    })

    it("should get field by name", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      const fieldNode = valueGraph.getFieldByName("username")
      expect(fieldNode).toBeDefined()
      expect(fieldNode?.name).toBe("username")
    })
  })

  describe("initial values (T025)", () => {
    it("should set and use initial values", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.setInitialValues({ username: "inituser", age: 25 })
      valueGraph.mountField("node1", "username")
      expect(valueGraph.getValue("username")).toBe("inituser")
    })

    it("should mount field with initial value", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "mounted")
      expect(valueGraph.getValue("username")).toBe("mounted")
    })

    it("should use mount initial value over setInitialValues when both exist", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.setInitialValues({ username: "from-initial-values" })
      valueGraph.mountField("node1", "username", "from-mount")
      expect(valueGraph.getValue("username")).toBe("from-mount")
    })

    it("should update existing fields' initial values when setInitialValues called", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "old-initial")
      valueGraph.setInitialValues({ username: "new-initial" })

      const fieldNode = valueGraph.getFieldByName("username")
      expect(fieldNode?.initialValue.value).toBe("new-initial")
    })
  })

  describe("set/get values (T025)", () => {
    it("should set and get string values", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "new-value")
      expect(valueGraph.getValue("username")).toBe("new-value")
    })

    it("should set and get number values", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "age", 25)
      valueGraph.setValue("age", 30)
      expect(valueGraph.getValue("age")).toBe(30)
    })

    it("should set and get undefined values", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", undefined)
      expect(valueGraph.getValue("username")).toBeUndefined()
    })
  })

  describe("dirty/touched state (T025)", () => {
    it("should initialize dirty as false", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      expect(valueGraph.snapshot.dirty.username).toBe(false)
    })

    it("should set dirty to true when value differs from initial", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "changed")
      expect(valueGraph.snapshot.dirty.username).toBe(true)
    })

    it("should set dirty back to false when value matches initial again", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "changed")
      expect(valueGraph.snapshot.dirty.username).toBe(true)
      valueGraph.setValue("username", "initial")
      expect(valueGraph.snapshot.dirty.username).toBe(false)
    })

    it("should initialize touched as false", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      expect(valueGraph.snapshot.touched.username).toBe(false)
    })

    it("should set touched to true when explicitly set", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setTouched("username", true)
      expect(valueGraph.snapshot.touched.username).toBe(true)
    })

    it("should set touched to false when explicitly set", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setTouched("username", true)
      valueGraph.setTouched("username", false)
      expect(valueGraph.snapshot.touched.username).toBe(false)
    })

    it("should track dirty/touched independently", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")

      // dirty: false, touched: true
      valueGraph.setTouched("username", true)
      expect(valueGraph.snapshot.dirty.username).toBe(false)
      expect(valueGraph.snapshot.touched.username).toBe(true)

      // dirty: true, touched: true
      valueGraph.setValue("username", "changed")
      expect(valueGraph.snapshot.dirty.username).toBe(true)
      expect(valueGraph.snapshot.touched.username).toBe(true)

      // dirty: false, touched: true
      valueGraph.setValue("username", "initial")
      expect(valueGraph.snapshot.dirty.username).toBe(false)
      expect(valueGraph.snapshot.touched.username).toBe(true)
    })
  })

  describe("field state", () => {
    it("should set and get errors", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username")
      valueGraph.setErrors("username", ["Required field"])
      expect(valueGraph.snapshot.errors.username).toEqual(["Required field"])
    })

    it("should set and get validating", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username")
      valueGraph.setValidating("username", true)
      expect(valueGraph.snapshot.validating.username).toBe(true)
    })
  })

  describe("snapshot", () => {
    it("should provide complete snapshot", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "test")
      valueGraph.setTouched("username", true)

      const snapshot = valueGraph.snapshot
      expect(snapshot.values.username).toBe("test")
      expect(snapshot.touched.username).toBe(true)
    })

    it("should pick values by names", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "test")
      valueGraph.mountField("node2", "email", "test@example.com")
      valueGraph.mountField("node3", "age", 25)

      const picked = valueGraph.pickValues(["username", "age"])
      expect(picked).toEqual({ username: "test", age: 25 })
    })
  })

  describe("replacement reuse (T025)", () => {
    it("should reuse existing field when same name mounted again with different node id", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "changed-value")
      valueGraph.setTouched("username", true)
      valueGraph.setErrors("username", ["some error"])

      // 用不同的 nodeId 再次 mount 同名字段
      const fieldNode = valueGraph.mountField("node2", "username")

      // 应该复用现有字段状态
      expect(fieldNode.name).toBe("username")
      expect(valueGraph.getValue("username")).toBe("changed-value")
      expect(valueGraph.snapshot.touched.username).toBe(true)
      expect(valueGraph.snapshot.errors.username).toEqual(["some error"])
    })

    it("should preserve field state during schema replacement reuse", () => {
      const valueGraph = createValueGraph<TestValues>()

      // 初始 mount
      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "user-value")
      valueGraph.setTouched("username", true)
      valueGraph.setErrors("username", ["error1"])

      // 模拟 schema replacement：先 dispose 旧节点，再 mount 新节点
      valueGraph.disposeNode("node1")
      valueGraph.mountField("node1-new", "username", "new-initial") // initial 应该被忽略

      // 验证状态被保留
      expect(valueGraph.getValue("username")).toBe("user-value")
      expect(valueGraph.snapshot.touched.username).toBe(true)
      expect(valueGraph.snapshot.errors.username).toEqual(["error1"])
    })

    it("should preserve dirty state during reuse", () => {
      const valueGraph = createValueGraph<TestValues>()

      valueGraph.mountField("node1", "username", "initial")
      valueGraph.setValue("username", "changed")

      expect(valueGraph.snapshot.dirty.username).toBe(true)

      // 复用
      valueGraph.disposeNode("node1")
      valueGraph.mountField("node2", "username", "different-initial")

      expect(valueGraph.snapshot.dirty.username).toBe(true) // dirty 状态应该保持
    })

    it("should update initial value but preserve current value on setInitialValues after mount", () => {
      const valueGraph = createValueGraph<TestValues>()

      valueGraph.mountField("node1", "username", "old-initial")
      valueGraph.setValue("username", "current-value")

      valueGraph.setInitialValues({ username: "new-initial" })

      expect(valueGraph.getValue("username")).toBe("current-value") // 当前值不变
      expect(valueGraph.snapshot.dirty.username).toBe(true) // dirty 保持 true，因为 current != new-initial
    })
  })

  describe("disposal", () => {
    it("should dispose node without affecting field value", () => {
      const valueGraph = createValueGraph<TestValues>()
      valueGraph.mountField("node1", "username", "test")
      valueGraph.disposeNode("node1")

      expect(valueGraph.getField("node1")).toBeUndefined()
      // 字段值应该保留，因为可能被其他节点复用
      expect(valueGraph.getValue("username")).toBe("test")
    })

    it("should only remove node mapping, not field data, on dispose", () => {
      const valueGraph = createValueGraph<TestValues>()

      valueGraph.mountField("node1", "username", "test")
      valueGraph.setValue("username", "changed")
      valueGraph.setTouched("username", true)

      valueGraph.disposeNode("node1")

      // node 映射被移除
      expect(valueGraph.getField("node1")).toBeUndefined()

      // 字段数据保留
      expect(valueGraph.getFieldByName("username")).toBeDefined()
      expect(valueGraph.getValue("username")).toBe("changed")
      expect(valueGraph.snapshot.touched.username).toBe(true)
    })
  })
})
