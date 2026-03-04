/**
 * Validator 单元测试
 *
 * 测试基于 Zod 的 Validator 类（字段级别校验）
 * Validator 不再持有 store 引用，所有值由调用方传入。
 */

import { beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { createValidator, Validator } from "../validator"

describe("Validator - Zod Schema Validation", () => {
  let validator: Validator

  beforeEach(() => {
    validator = createValidator()
  })

  describe("constructor", () => {
    it("should create a Validator instance", () => {
      expect(validator).toBeInstanceOf(Validator)
    })
  })

  describe("registerRule", () => {
    it("should register and validate field with Zod schema", async () => {
      validator.registerRule("email", z.string().email("邮箱格式错误"))

      const result = await validator.validateField("email", {
        name: "",
        age: 0,
        email: "invalid",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("邮箱格式错误")
      }
    })

    it("should pass validation for valid value", async () => {
      validator.registerRule("email", z.string().email("邮箱格式错误"))

      const result = await validator.validateField("email", {
        name: "",
        age: 0,
        email: "test@example.com",
      })
      expect(result.ok).toBe(true)
    })

    it("should support complex Zod schema", async () => {
      validator.registerRule(
        "name",
        z.string().min(2, "姓名至少2个字符").max(20, "姓名最多20个字符")
      )

      const result = await validator.validateField("name", {
        name: "A",
        age: 0,
        email: "",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("姓名至少2个字符")
      }
    })

    it("should support async validation with refine", async () => {
      validator.registerRule(
        "name",
        z.string().refine(
          async (val) => {
            await new Promise((resolve) => setTimeout(resolve, 10))

            return val !== "taken"
          },
          { message: "名称已被占用" }
        )
      )

      const result = await validator.validateField("name", {
        name: "taken",
        age: 0,
        email: "",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("名称已被占用")
      }
    })
  })

  describe("validateField", () => {
    it("should return ok when no rules registered", async () => {
      const result = await validator.validateField("name", {
        name: "",
        age: 0,
        email: "",
      })
      expect(result.ok).toBe(true)
    })

    it("should validate required string field", async () => {
      validator.registerRule("name", z.string().min(1, "姓名必填"))

      const result = await validator.validateField("name", {
        name: "",
        age: 0,
        email: "",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("姓名必填")
      }
    })

    it("should validate email format", async () => {
      validator.registerRule("email", z.string().email("邮箱格式错误"))

      const result = await validator.validateField("email", {
        name: "",
        age: 0,
        email: "invalid-email",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("邮箱格式错误")
      }
    })

    it("should validate number range", async () => {
      validator.registerRule(
        "age",
        z.number().min(0, "年龄不能为负").max(150, "年龄不能超过150")
      )

      const result = await validator.validateField("age", {
        name: "",
        age: -5,
        email: "",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("年龄不能为负")
      }
    })

    it("should clear error when validation passes", async () => {
      validator.registerRule("name", z.string().min(1, "姓名必填"))

      // First fail
      const fail = await validator.validateField("name", { name: "", age: 0, email: "" })
      expect(fail.ok).toBe(false)
      expect(validator.getFieldError("name")).toContain("姓名必填")

      // Then pass
      const pass = await validator.validateField("name", {
        name: "John",
        age: 0,
        email: "",
      })
      expect(pass.ok).toBe(true)
      expect(validator.getFieldError("name")).toBeUndefined()
    })
  })

  describe("unregisterRule", () => {
    it("should remove field rules", async () => {
      validator.registerRule("email", z.string().email("邮箱格式错误"))
      validator.unregisterRule("email")

      const result = await validator.validateField("email", {
        name: "",
        age: 0,
        email: "invalid",
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("validate (full form)", () => {
    it("should return ok when no rules registered", async () => {
      const result = await validator.validate({ name: "", age: 0, email: "" })
      expect(result.ok).toBe(true)
    })

    it("should validate all registered fields", async () => {
      validator.registerRule("name", z.string().min(1, "姓名必填"))
      validator.registerRule("email", z.string().email("邮箱格式错误"))

      const result = await validator.validate({ name: "", age: 0, email: "invalid" })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        const fields = result.error.errors.map((e) => e.field)
        expect(fields).toContain("name")
        expect(fields).toContain("email")
      }
    })

    it("should pass when all fields are valid", async () => {
      validator.registerRule("name", z.string().min(1, "姓名必填"))
      validator.registerRule("email", z.string().email("邮箱格式错误"))

      const result = await validator.validate({
        name: "John",
        age: 0,
        email: "john@example.com",
      })
      expect(result.ok).toBe(true)
    })

    it("should clear all errors before validation", async () => {
      validator.registerRule("name", z.string().min(1, "姓名必填"))

      // First fail
      await validator.validate({ name: "", age: 0, email: "" })
      expect(validator.getFieldError("name")).toContain("姓名必填")

      // Then pass
      await validator.validate({ name: "John", age: 0, email: "" })
      expect(validator.getFieldError("name")).toBeUndefined()
    })
  })

  describe("async validation (refine)", () => {
    it("should support async validation with refine", async () => {
      validator.registerRule(
        "username",
        z.string().refine(
          async (val) => {
            await new Promise((resolve) => setTimeout(resolve, 10))

            return val !== "taken"
          },
          { message: "用户名已存在" }
        )
      )

      const result = await validator.validateField("username", {
        username: "taken",
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.errors[0].message).toContain("用户名已存在")
      }
    })
  })
})

describe("createValidator factory function", () => {
  it("should create a Validator instance", () => {
    const validator = createValidator()
    expect(validator).toBeInstanceOf(Validator)
  })
})
