/**
 * Runtime Graph Test Utils - 测试夹具
 *
 * @module core/runtimeGraph/__tests__/runtimeGraphTestUtils
 */

import type { Values } from "../../types"

/**
 * 测试用表单值类型。
 */
export interface TestFormValues extends Values {
  username: string
  email: string
  age: number
  accountType: "personal" | "company"
  companyName?: string
}

/**
 * 创建简单的测试用 jsonSchemas。
 */
export function createTestJsonSchemas() {
  return [
    {
      name: "username",
      label: "用户名",
      componentType: "input",
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
    },
    {
      name: "age",
      label: "年龄",
      componentType: "number",
    },
    {
      name: "accountType",
      label: "账户类型",
      componentType: "select",
    },
  ]
}

/**
 * 创建包含 dynamic slot 的测试用 jsonSchemas。
 */
export function createTestJsonSchemasWithDynamicSlot() {
  return [
    {
      name: "accountType",
      label: "账户类型",
      componentType: "select",
    },
    {
      componentType: "dependency" as const,
      to: ["accountType"],
      renderer: (values: TestFormValues) => {
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
      },
    },
  ]
}

/**
 * 创建包含 dynamic props 的测试用 jsonSchemas。
 */
export function createTestJsonSchemasWithDynamicProps() {
  return [
    {
      name: "accountType",
      label: "账户类型",
      componentType: "select",
    },
    {
      name: "companyName",
      label: "公司名称",
      componentType: "input",
      dependencies: {
        triggerFields: ["accountType"],
        visible: (values: TestFormValues) => values.accountType === "company",
        required: (values: TestFormValues) => values.accountType === "company",
      },
    },
  ]
}

/**
 * 测试初始值。
 */
export const createTestInitialValues = (): Partial<TestFormValues> => ({
  username: "testuser",
  accountType: "personal",
})
