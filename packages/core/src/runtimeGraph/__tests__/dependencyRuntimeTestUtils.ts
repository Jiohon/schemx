/**
 * Dependency Runtime Test Utils - 动态属性和动态子树测试夹具
 *
 * @module core/runtimeGraph/__tests__/dependencyRuntimeTestUtils
 */

import type { Values } from "../../types"

/**
 * 测试用的 dynamic props 依赖配置。
 */
export function createTestFieldDependencies() {
  return {
    triggerFields: ["accountType"],
    visible: (values: { accountType: string }) =>
      values.accountType === "company",
    disabled: (values: { accountType: string }) =>
      values.accountType === "personal",
    required: (values: { accountType: string }) =>
      values.accountType === "company",
    placeholder: (values: { accountType: string }) =>
      values.accountType === "company" ? "请输入公司名称" : "请输入",
    componentProps: (values: { accountType: string }) => ({
      maxLength: values.accountType === "company" ? 100 : 50,
    }),
  }
}

/**
 * 测试用的 dynamic slot renderer（同步）。
 */
export function createTestSyncSlotRenderer() {
  return (values: { accountType: string }) => {
    if (values.accountType === "company") {
      return [
        {
          name: "companyName",
          label: "公司名称",
          componentType: "input",
        },
        {
          name: "companyAddress",
          label: "公司地址",
          componentType: "input",
        },
      ]
    }
    return []
  }
}

/**
 * 测试用的 dynamic slot renderer（异步）。
 */
export function createTestAsyncSlotRenderer(delayMs: number = 100) {
  return async (values: { accountType: string }) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    if (values.accountType === "company") {
      return [
        {
          name: "companyName",
          label: "公司名称",
          componentType: "input",
        },
      ]
    }
    return []
  }
}

/**
 * 创建会抛出错误的 dynamic props（用于测试错误处理）。
 */
export function createErrorThrowingDependencies() {
  return {
    triggerFields: ["accountType"],
    visible: () => {
      throw new Error("Intentional error for testing")
    },
  }
}
