import { setFieldDynamicOverrides } from "../../field/runtimeState"
import { describe, expect, it, vi } from "vitest"

import { createCompile } from "../../compiler"
import { createFieldRegistry } from "../../field"
import { createLifecycleBus } from "../../lifecycle"
import { createReconciler } from "../../reconciler"
import { type SchemxContext } from "../../schemxContext"
import { createScheduler } from "../../scheduler"
import { createRuntimeResources } from "../resources"

import type { DependencyDescriptor, FieldDescriptor } from "../../descriptor"
import type { LifecycleListener } from "../../lifecycle"
import type { RuntimeNode, FieldRuntimeNode } from "../types"

function createFieldDescriptor(key: string, name = key): FieldDescriptor {
  return {
    type: "field",
    key,
    name,
    componentType: "text",
    staticSchema: {
      name,
      componentType: "text",
    },
  } as FieldDescriptor
}

function createDependencyDescriptor(
  key: string,
  triggerFields: string[],
  renderer = vi.fn().mockResolvedValue([])
): DependencyDescriptor {
  return {
    type: "dependency",
    key,
    triggerFields,
    renderer,
  }
}

function createGraphRuntime(listener: LifecycleListener<RuntimeNode> = {}) {
  const fieldRegistry = createFieldRegistry()
  const lifecycleBus = createLifecycleBus(listener)
  const scheduler = createScheduler()
  const formApi = {
    getValue: vi.fn(),
    getValues: vi.fn(() => ({})),
  }
  const instance = {
    ...formApi,
    getFieldSnapshot: vi.fn(() => undefined),
    setInitialValues: vi.fn(),
    setFieldValue: vi.fn(),
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    setFieldError: vi.fn(),
    validateField: vi.fn().mockResolvedValue({ ok: true, values: {} }),
  }

  const context = {
    defaultProps: {},
    instance,
    formApi,
    compile: createCompile({
      defaultProps: {},
      formInstance: instance as any,
    }),
    scheduler,
    lifecycleBus,
    fieldRegistry,
    nodeResources: createRuntimeResources(),
  } as unknown as SchemxContext

  const reconciler = createReconciler(context)
  const commitChildren = (parent: RuntimeNode, descriptors: any[]) => {
    reconciler.reconcileChildren(parent, descriptors)
  }

  const root = reconciler.createRoot()

  Object.assign(context, { reconciler, commitChildren, compileOptions: {} })

  return {
    context,
    fieldRegistry,
    lifecycleBus,
    reconciler,
    commitChildren,
    root,
    scheduler,
  }
}

describe("RuntimeReconciler + DefaultRuntimeNodeManager", () => {
  it("createReconciler(context) 内部初始化 RuntimeNodeManager 并创建 root", () => {
    const { context, root } = createGraphRuntime()

    expect(context.nodeResources.nodes.get(root.id)).toBe(root)
  })

  it("嵌套 group reconcile 只推进一次结构提交", () => {
    const { commitChildren, root } = createGraphRuntime()
    const descriptors = createCompile().toDescriptors([
      {
        componentType: "group",
        label: "root group",
        children: [
          {
            componentType: "group",
            label: "nested group",
            children: [
              {
                name: "field",
                componentType: "text",
              },
            ],
          },
        ],
      },
    ])

    commitChildren(root, descriptors)

    expect(root.childNodes).toHaveLength(1)
  })

  it("生命周期事件只由 RuntimeNodeManager 触发一次", () => {
    const calls = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }
    const { commitChildren, root } = createGraphRuntime(calls)

    commitChildren(root, [createFieldDescriptor("name", "name")])
    commitChildren(root, [createFieldDescriptor("name", "name")])
    commitChildren(root, [])

    expect(calls.mount).toHaveBeenCalledTimes(1)
    expect(calls.update).toHaveBeenCalledTimes(1)
    expect(calls.unmount).toHaveBeenCalledTimes(1)
  })

  it("同名字段替换时应该移除旧 node 并写入新 descriptor", () => {
    const { context, commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("old", "user.name")])
    const oldNode = root.childNodes[0] as FieldRuntimeNode

    commitChildren(root, [createFieldDescriptor("new", "user.name")])
    const newNode = root.childNodes[0] as FieldRuntimeNode

    expect(oldNode.disposed.value).toBe(true)
    expect(newNode.key).toBe("new")
    expect(context.nodeResources.descriptors.get(newNode.id)?.key).toBe("new")
  })

  it("removeNode 应该删除节点资源并断开父子关系", () => {
    const { context, reconciler, commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("name", "name")])

    const field = root.childNodes[0] as FieldRuntimeNode
    const descriptor = context.nodeResources.descriptors.get(field.id)

    reconciler.removeNode(field)

    expect(field.disposed.value).toBe(true)
    expect(context.nodeResources.descriptors.get(field.id)).toBeUndefined()
    expect(descriptor).toBeDefined()
    expect(field.parent).toBeNull()
  })

  it("dependency trigger 变化时应该复用 node 并更新 descriptor", () => {
    const { context, commitChildren, root } = createGraphRuntime()

    commitChildren(root, [
      createDependencyDescriptor("dep", ["type"], vi.fn().mockResolvedValue([])),
    ])

    const dependency = root.childNodes[0]

    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const firstNode = dependency
    const firstDescriptor = context.nodeResources.descriptors.get(dependency.id)

    commitChildren(root, [
      createDependencyDescriptor("dep", ["type"], vi.fn().mockResolvedValue([])),
    ])

    expect(root.childNodes[0]).toBe(firstNode)

    commitChildren(root, [
      createDependencyDescriptor("dep", ["mode"], vi.fn().mockResolvedValue([])),
    ])

    expect(root.childNodes[0]).toBe(firstNode)
    expect(context.nodeResources.descriptors.get(dependency.id)).not.toBe(firstDescriptor)
    expect(
      (context.nodeResources.descriptors.get(dependency.id) as DependencyDescriptor)
        .triggerFields
    ).toEqual(["mode"])
  })

  it("仅 descriptor props 变化时 commitChildren 不重建节点", () => {
    const { commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    const firstNode = root.childNodes[0]

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    expect(root.childNodes[0]).toBe(firstNode)
  })

  it("子节点新增时 commitChildren 扩展 childNodes", () => {
    const { commitChildren, root } = createGraphRuntime()

    commitChildren(root, [createFieldDescriptor("f1", "f1")])
    expect(root.childNodes).toHaveLength(1)

    commitChildren(root, [
      createFieldDescriptor("f1", "f1"),
      createFieldDescriptor("f2", "f2"),
    ])
    expect(root.childNodes).toHaveLength(2)
  })
})

import { describe, expect, it } from "vitest"
import { createFieldRuntimeState } from "../../field/runtimeState"

import type { SchemxResolvedBaseField } from "../../types"

function createTestSchema(
  overrides: Partial<SchemxResolvedBaseField> = {}
): SchemxResolvedBaseField {
  return {
    componentType: "input",
    label: "测试字段",
    visible: true,
    disabled: false,
    readonly: false,
    required: false,
    placeholder: "请输入",
    componentProps: {},
    rules: [],
    validationTrigger: "onChange",
    ...overrides,
  } as SchemxResolvedBaseField
}

describe("RuntimeNodeManager 创建 field 节点时挂载 FieldRuntimeState (US1)", () => {
  it("createFieldRuntimeState 应该能基于 descriptor 创建运行态", () => {
    const schema = createTestSchema({ label: "用户名" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "username" as any, staticSchema: schema },
    })

    expect(state).toBeDefined()
    expect(state.staticSchema.value.label).toBe("用户名")
    expect(state.effectiveSchema.value.label).toBe("用户名")
  })

  it("runtimeState 应该持有独立的 staticSchema 和 dynamicOverrides", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "username" as any, staticSchema: schema },
    })

    // 验证两个 signal 独立
    expect(state.staticSchema.value.visible).toBe(true)
    expect(state.dynamicOverrides.value).toEqual({})

    // 修改 dynamicOverrides 不影响 staticSchema
    setFieldDynamicOverrides(
      state,
      { visible: false },
      {
        source: "dependencies",
        triggerFields: [],
      }
    )

    expect(state.staticSchema.value.visible).toBe(true)
    expect(state.dynamicOverrides.value.visible).toBe(false)
  })
})
