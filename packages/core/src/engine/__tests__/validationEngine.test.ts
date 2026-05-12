import { describe, expect, it, vi } from "vitest"

import { createRulesRegistry } from "../../registry"
import { createSignal } from "../../reactivity"
import { createDisposeBag } from "../../runtime/disposeBag"
import { createRuntimeScheduler } from "../../scheduler"
import { createRequiredRule } from "../../validator/defaultRules"
import { createValidator } from "../../validator"
import { createFieldRuntime, applyFieldProps } from "../../runtime"
import { createDependenciesResolver } from "../DependenciesEngine"
import { createValidationEngine } from "../validationEngine"

import type { FieldRuntimeNode } from "../../runtime"

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })

  return { promise, resolve }
}

function createNode(): FieldRuntimeNode {
  const schema = {
    componentType: "input",
    name: "name",
    label: "Name",
    initialValue: "initial",
    rules: "required",
  } as any

  const disposeBag = createDisposeBag()

  return {
    id: 1,
    key: "root/field:name",
    type: "field",
    schema,
    parent: null,
    mounted: true,
    dirty: false,
    disposed: createSignal(false),
    disposeBag,
    onDispose: disposeBag.onDispose,
    disposeSelf: () => disposeBag.flush(),
    fieldRuntime: createFieldRuntime(schema),
    dispose: () => {},
  }
}

describe("validationEngine", () => {
  it("mount field 时初始化 initialValue 并注册 validator rules", async () => {
    const validator = createValidator()
    const rulesRegistry = createRulesRegistry()
    const values: Record<string, unknown> = {}
    rulesRegistry.register("required", createRequiredRule)
    const engine = createValidationEngine({
      validator,
      rulesRegistry,
      getFieldSnapshot: (name) => values[name as string],
      setInitialValues: (next) => Object.assign(values, next),
      setFieldValue: (name, value) => {
        values[name as string] = value
      },
    })
    const node = createNode()

    engine.mountField(node)

    expect(values.name).toBe("initial")
    await expect(validator.validate({ name: "" })).resolves.toMatchObject({
      ok: false,
    })
  })

  it("字段不可校验时清理 rules 和 errors", async () => {
    const validator = createValidator()
    const rulesRegistry = createRulesRegistry()
    rulesRegistry.register("required", createRequiredRule)
    const engine = createValidationEngine({
      validator,
      rulesRegistry,
      getFieldSnapshot: () => undefined,
      setInitialValues: () => {},
      setFieldValue: () => {},
    })
    const node = createNode()

    engine.mountField(node)
    await validator.validate({ name: "" })
    expect(validator.getFieldError("name")).toBeDefined()

    applyFieldProps(node.fieldRuntime, {
      visible: true,
      readonly: false,
      disabled: true,
      required: true,
      placeholder: "Name",
      componentProps: {},
      rules: "required",
    })
    engine.updateField(node)

    await expect(validator.validate({ name: "" })).resolves.toMatchObject({
      ok: true,
    })
    expect(validator.getFieldError("name")).toBeUndefined()
  })

  it("晚返回的旧 async rules 不会覆盖后触发的新校验规则", async () => {
    const validator = createValidator()
    const rulesRegistry = createRulesRegistry()
    const values: Record<string, unknown> = { name: "", mode: "initial" }
    const slow = createDeferred<string>()
    const fast = createDeferred<string>()
    const effectRuns: Array<() => void> = []
    const scheduler = createRuntimeScheduler()
    const schema = {
      componentType: "input",
      name: "name",
      label: "Name",
      dependencies: {
        triggerFields: ["mode"],
        rules: (snapshot: { mode: string }) => {
          if (snapshot.mode === "slow") return slow.promise
          if (snapshot.mode === "fast") return fast.promise

          return undefined
        },
      },
    } as any
    const disposeBag = createDisposeBag()
    const node: FieldRuntimeNode = {
      id: 1,
      key: "root/field:name",
      type: "field",
      schema,
      parent: null,
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => disposeBag.flush(),
      fieldRuntime: createFieldRuntime(schema),
      dispose: () => {},
    }

    rulesRegistry.register("slowRule", {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({ issues: [{ message: "slow" }] }),
      },
    })
    rulesRegistry.register("fastRule", {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({ issues: [{ message: "fast" }] }),
      },
    })

    const engine = createValidationEngine({
      validator,
      rulesRegistry,
      getFieldSnapshot: (name) => values[name as string],
      setInitialValues: (next) => Object.assign(values, next),
      setFieldValue: (name, value) => {
        values[name as string] = value
      },
    })

    engine.mountField(node)

    const resolver = createDependenciesResolver(node, {
      form: {
        effect: (fn: () => void) => {
          effectRuns.push(fn)
          fn()

          return vi.fn()
        },
        getFieldValue: (path: string) => values[path],
        getFieldsSnapshot: () => values,
      } as any,
      resolveDefaults: () => ({}),
      scheduler,
      onFieldUpdate: (updatedNode) => engine.updateField(updatedNode),
      onTreeChange: vi.fn(),
    })

    await scheduler.flush()

    values.mode = "slow"
    effectRuns[0]()
    const slowFlush = scheduler.flush()

    await Promise.resolve()

    values.mode = "fast"
    effectRuns[0]()
    fast.resolve("fastRule")
    slow.resolve("slowRule")

    await slowFlush
    await scheduler.flush()

    await vi.waitFor(() => {
      expect(node.fieldRuntime.rules.value.value).toBe("fastRule")
    })

    await expect(validator.validate({ name: "" })).resolves.toMatchObject({
      ok: false,
    })
    expect(validator.getFieldError("name")).toEqual(["fast"])

    resolver.dispose()
  })
})
