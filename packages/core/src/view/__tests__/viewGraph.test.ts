import { createFieldRuntimeState, setFieldDynamicOverrides } from "../../field/runtimeState"
import { describe, expect, it } from "vitest"
import {
  createFieldNodeViewState,
  createGroupViewState,
  createDependencyViewState,
  createRootViewState,
  readRootViewSchemas,
} from "../viewGraph"
import { createComputed } from "../../reactivity/computed"
import { createSignal } from "../../reactivity/signal"

import type { SchemxViewSchema } from "../types"

describe("ViewGraph", () => {
  describe("createFieldNodeViewState", () => {
    it("应该创建字段视图状态", () => {
      const viewSchema = createComputed(() => ({} as any))
      const state = createFieldNodeViewState(viewSchema)

      expect(state.view).toBeDefined()
      expect(state.view.value).toBeDefined()
    })
  })

  describe("createGroupViewState", () => {
    it("应该创建分组视图状态", () => {
      const childrenView = createComputed<readonly SchemxViewSchema[]>(() => [])
      const state = createGroupViewState({} as any, childrenView)

      expect(state.view).toBeDefined()
      expect(state.view.value).toBeDefined()
    })
  })

  describe("createDependencyViewState", () => {
    it("应该创建 dependency 视图状态", () => {
      const childrenView = createComputed<readonly SchemxViewSchema[]>(() => [])
      const state = createDependencyViewState(childrenView)

      expect(state.view).toBeDefined()
      expect(state.view.value).toEqual([])
    })
  })

  describe("createRootViewState", () => {
    it("应该创建 root 视图状态", () => {
      const childrenView = createComputed<readonly SchemxViewSchema[]>(() => [])
      const state = createRootViewState(childrenView)

      expect(state.viewSchemas).toBeDefined()
      expect(state.viewSchemas.value).toEqual([])
    })
  })

  describe("readRootViewSchemas", () => {
    it("应该返回 root viewSchemas 当前值", () => {
      const schemas = createSignal<readonly SchemxViewSchema[]>([{ key: "test" } as any])
      const rootState = {
        viewSchemas: createComputed(() => schemas.value),
      }

      const result = readRootViewSchemas(rootState)
      expect(result).toEqual([{ key: "test" }])
    })

    it("root disposed 后应返回空数组", () => {
      const disposed = createSignal(false)
      const schemas = createSignal<readonly SchemxViewSchema[]>([{ key: "test" } as any])
      const rootState = {
        viewSchemas: createComputed(() => (disposed.value ? [] : schemas.value)),
      }

      expect(readRootViewSchemas(rootState)).toEqual([{ key: "test" }])

      disposed.value = true
      expect(readRootViewSchemas(rootState)).toEqual([])
    })
  })

  describe("view graph 字段动态属性只更新相关字段 (US2)", () => {
    it("字段 viewSchema 应反映 dynamicOverrides 变化", () => {
      

      const schema = {
        componentType: "input",
        label: "省份",
        visible: true,
        disabled: false,
        readonly: false,
        required: false,
        placeholder: "",
        componentProps: {},
        rules: [],
        validationTrigger: "onChange",
      } as any

      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: { name: "province" as any, staticSchema: schema },
      })

      expect(state.viewSchema.value.visible).toBe(true)

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })

      expect(state.viewSchema.value.visible).toBe(false)
    })
  })
})
