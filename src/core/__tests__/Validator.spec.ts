/**
 * Validator 单元测试
 * 
 * 测试基于 Zod 的 Validator 类（字段级别校验）
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createFormStore, type FormStore } from '../FormStore'
import { createValidator, Validator } from '../Validator'

describe('Validator - Zod Schema Validation', () => {
  let store: FormStore
  let validator: Validator

  beforeEach(() => {
    store = createFormStore({ initialValues: { name: '', age: 0, email: '' } })
    validator = createValidator({ store })
  })

  describe('constructor', () => {
    it('should create a Validator instance with FormStore', () => {
      expect(validator).toBeInstanceOf(Validator)
      expect(validator.getStore()).toBe(store)
    })
  })

  describe('registerRules', () => {
    it('should register and validate field with Zod schema', async () => {
      validator.registerRules('email', z.string().email('邮箱格式错误'))

      store.setFieldValue('email', 'invalid')
      const result = await validator.validateField('email')
      expect(result).toBe(false)
      expect(store.getFieldError('email')).toContain('邮箱格式错误')
    })

    it('should pass validation for valid value', async () => {
      validator.registerRules('email', z.string().email('邮箱格式错误'))

      store.setFieldValue('email', 'test@example.com')
      const result = await validator.validateField('email')
      expect(result).toBe(true)
      expect(store.getFieldError('email')).toBeUndefined()
    })

    it('should support complex Zod schema', async () => {
      validator.registerRules('name', z.string()
        .min(2, '姓名至少2个字符')
        .max(20, '姓名最多20个字符')
      )

      store.setFieldValue('name', 'A')
      const result = await validator.validateField('name')
      expect(result).toBe(false)
      expect(store.getFieldError('name')).toContain('姓名至少2个字符')
    })

    it('should support async validation with refine', async () => {
      validator.registerRules('name', z.string().refine(
        async (val) => {
          await new Promise(resolve => setTimeout(resolve, 10))

          return val !== 'taken'
        },
        { message: '名称已被占用' }
      ))

      store.setFieldValue('name', 'taken')
      const result = await validator.validateField('name')
      expect(result).toBe(false)
      expect(store.getFieldError('name')).toContain('名称已被占用')
    })
  })

  describe('validateField', () => {
    it('should return true when no rules registered', async () => {
      const result = await validator.validateField('name')
      expect(result).toBe(true)
    })

    it('should validate required string field', async () => {
      validator.registerRules('name', z.string().min(1, '姓名必填'))

      store.setFieldValue('name', '')
      const result = await validator.validateField('name')
      expect(result).toBe(false)
      expect(store.getFieldError('name')).toContain('姓名必填')
    })

    it('should validate email format', async () => {
      validator.registerRules('email', z.string().email('邮箱格式错误'))

      store.setFieldValue('email', 'invalid-email')
      const result = await validator.validateField('email')
      expect(result).toBe(false)
      expect(store.getFieldError('email')).toContain('邮箱格式错误')
    })

    it('should validate number range', async () => {
      validator.registerRules('age', z.number().min(0, '年龄不能为负').max(150, '年龄不能超过150'))

      store.setFieldValue('age', -5)
      const result = await validator.validateField('age')
      expect(result).toBe(false)
      expect(store.getFieldError('age')).toContain('年龄不能为负')
    })

    it('should clear error when validation passes', async () => {
      validator.registerRules('name', z.string().min(1, '姓名必填'))

      // First fail
      store.setFieldValue('name', '')
      await validator.validateField('name')
      expect(store.getFieldError('name')).toContain('姓名必填')

      // Then pass
      store.setFieldValue('name', 'John')
      await validator.validateField('name')
      expect(store.getFieldError('name')).toBeUndefined()
    })
  })

  describe('unregisterRules', () => {
    it('should remove field rules', async () => {
      validator.registerRules('email', z.string().email('邮箱格式错误'))
      validator.unregisterRules('email')

      store.setFieldValue('email', 'invalid')
      const result = await validator.validateField('email')
      expect(result).toBe(true) // No rules, should pass
    })
  })

  describe('validate (full form)', () => {
    it('should return true when no rules registered', async () => {
      const result = await validator.validate()
      expect(result).toBe(true)
    })

    it('should validate all registered fields', async () => {
      validator.registerRules('name', z.string().min(1, '姓名必填'))
      validator.registerRules('email', z.string().email('邮箱格式错误'))

      store.setFieldValue('name', '')
      store.setFieldValue('email', 'invalid')

      const result = await validator.validate()
      expect(result).toBe(false)
      expect(store.getFieldError('name')).toContain('姓名必填')
      expect(store.getFieldError('email')).toContain('邮箱格式错误')
    })

    it('should pass when all fields are valid', async () => {
      validator.registerRules('name', z.string().min(1, '姓名必填'))
      validator.registerRules('email', z.string().email('邮箱格式错误'))

      store.setFieldValue('name', 'John')
      store.setFieldValue('email', 'john@example.com')

      const result = await validator.validate()
      expect(result).toBe(true)
    })

    it('should clear all errors before validation', async () => {
      validator.registerRules('name', z.string().min(1, '姓名必填'))

      // First fail
      store.setFieldValue('name', '')
      await validator.validate()
      expect(store.getFieldError('name')).toContain('姓名必填')

      // Then pass
      store.setFieldValue('name', 'John')
      await validator.validate()
      expect(store.getFieldError('name')).toBeUndefined()
    })
  })

  describe('getRegisteredPaths', () => {
    it('should return empty array when no rules registered', () => {
      expect(validator.getRegisteredPaths()).toEqual([])
    })

    it('should return registered field paths', () => {
      validator.registerRules('name', z.string())
      validator.registerRules('email', z.string().email())
      validator.registerRules('age', z.number())

      const paths = validator.getRegisteredPaths()
      expect(paths).toContain('name')
      expect(paths).toContain('email')
      expect(paths).toContain('age')
    })
  })

  describe('async validation (refine)', () => {
    it('should support async validation with refine', async () => {
      validator.registerRules('username', z.string().refine(
        async (val) => {
          // 模拟异步检查
          await new Promise((resolve) => setTimeout(resolve, 10))

          return val !== 'taken'
        },
        { message: '用户名已存在' }
      ))

      store.setFieldValue('username', 'taken')
      const result = await validator.validateField('username')
      expect(result).toBe(false)
      expect(store.getFieldError('username')).toContain('用户名已存在')
    })
  })
})

describe('createValidator factory function', () => {
  it('should create a Validator instance', () => {
    const store = createFormStore({ initialValues: {} })
    const validator = createValidator({ store })

    expect(validator).toBeInstanceOf(Validator)
  })

  it('should pass store to Validator', () => {
    const store = createFormStore({ initialValues: { name: 'test' } })
    const validator = createValidator({ store })

    expect(validator.getStore()).toBe(store)
  })
})
