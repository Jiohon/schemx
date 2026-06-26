/**
 * Public Export Boundary Tests (T014)
 *
 * @module core/__tests__/publicExports.test
 */

import { describe, it, expect } from "vitest"
import * as coreExports from "../index"

describe("Public Export Boundary (T014)", () => {
  it("should export public API without exposing internal graph stores", () => {
    // 检查应该导出的公共 API
    expect(coreExports.createForm).toBeDefined()
    expect(coreExports.createFormInstance).toBeDefined()
    expect(coreExports.createSchemas).toBeDefined()
    expect(coreExports.isSchemxSchemas).toBeDefined()

    // 检查不应该导出的内部模块
    const exportKeys = Object.keys(coreExports)
    expect(exportKeys).not.toContain("createRuntimeGraph")
    expect(exportKeys).not.toContain("createSchemaGraphStore")
    expect(exportKeys).not.toContain("createValueGraph")
    expect(exportKeys).not.toContain("createDynamicPropsEngine")
    expect(exportKeys).not.toContain("createDynamicSlotEngine")
    expect(exportKeys).not.toContain("createEffectiveSchemaLayer")
    expect(exportKeys).not.toContain("createValidationEngine")
    expect(exportKeys).not.toContain("createRuntimeScopeManager")
    expect(exportKeys).not.toContain("createViewGraph")
  })

  it("should export type definitions for public use", () => {
    // 类型只能在 TypeScript 中检查，但我们可以验证导出结构
    // 这里主要验证运行时导出
    expect(typeof coreExports.createForm).toBe("function")
  })
})
