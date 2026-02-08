/**
 * useForm Hook 单元测试
 * 
 * 测试 useForm hook 与 FormStore 和 Zod Validator 的集成
 */

import { nextTick } from 'vue'
import { defineComponent, h } from 'vue'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { useForm, UseFormOptions, UseFormReturn } from '../useForm'

/**
 * 创建测试组件的辅助函数
 * 
 * 由于 useForm 使用了 Vue 的 onUnmounted，需要在组件上下文中测试
 */
function createTestComponent(options: UseFormOptions = {}) {
  let formReturn: UseFormReturn | null = null
  
  const TestComponent = defineComponent({
    setup() {
      formReturn = useForm(options)

      return () => h('div')
    }
  })
  
  const wrapper = mount(TestComponent)
  
  return {
    wrapper,
    getForm: () => formReturn!,
  }
}

describe('useForm Hook', () => {
  describe('基础功能', () => {
    it('应该创建独立的表单实例', () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      expect(form).toBeDefined()
      expect(form.values).toBeDefined()
      expect(form.errors).toBeDefined()
      expect(form.submitting).toBeDefined()
      expect(form.setFieldValue).toBeInstanceOf(Function)
      expect(form.setFieldsValue).toBeInstanceOf(Function)
      expect(form.getFieldValue).toBeInstanceOf(Function)
      expect(form.getFieldsValue).toBeInstanceOf(Function)
      expect(form.validate).toBeInstanceOf(Function)
      expect(form.resetFields).toBeInstanceOf(Function)
      expect(form.submit).toBeInstanceOf(Function)
      expect(form.subscribe).toBeInstanceOf(Function)
      expect(form.subscribeAll).toBeInstanceOf(Function)
      
      wrapper.unmount()
    })

    it('应该使用初始值初始化表单', () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      expect(form.values.value).toEqual({ name: 'John', age: 25 })
      expect(form.getFieldValue('name')).toBe('John')
      expect(form.getFieldValue('age')).toBe(25)
      
      wrapper.unmount()
    })

    it('应该在没有初始值时使用空对象', () => {
      const { getForm, wrapper } = createTestComponent()
      
      const form = getForm()
      
      expect(form.values.value).toEqual({})
      
      wrapper.unmount()
    })
  })

  describe('值操作', () => {
    it('setFieldValue 应该更新单个字段值', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' }
      })
      
      const form = getForm()
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(form.getFieldValue('name')).toBe('Jane')
      expect(form.values.value.name).toBe('Jane')
      
      wrapper.unmount()
    })

    it('setFieldsValue 应该批量更新字段值', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      form.setFieldsValue({ name: 'Jane', age: 30 })
      await nextTick()
      
      expect(form.getFieldValue('name')).toBe('Jane')
      expect(form.getFieldValue('age')).toBe(30)
      
      wrapper.unmount()
    })

    it('getFieldsValue 应该返回所有字段值', () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      const values = form.getFieldsValue()
      expect(values).toEqual({ name: 'John', age: 25 })
      
      wrapper.unmount()
    })

    it('getFieldsValue 应该返回指定字段值', () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25, email: 'john@example.com' }
      })
      
      const form = getForm()
      
      const values = form.getFieldsValue(['name', 'age'])
      expect(values).toEqual({ name: 'John', age: 25 })
      
      wrapper.unmount()
    })

    it('应该支持嵌套路径', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { user: { name: 'John', address: { city: 'Beijing' } } }
      })
      
      const form = getForm()
      
      expect(form.getFieldValue('user.name')).toBe('John')
      expect(form.getFieldValue('user.address.city')).toBe('Beijing')
      
      form.setFieldValue('user.address.city', 'Shanghai')
      await nextTick()
      
      expect(form.getFieldValue('user.address.city')).toBe('Shanghai')
      
      wrapper.unmount()
    })
  })

  describe('Zod 校验功能', () => {
    it('validate 应该使用 columns 中的 Zod rules 校验字段', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: '' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1, '姓名必填') }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.name).toContain('姓名必填')
      
      wrapper.unmount()
    })

    it('validate 应该在值有效时通过', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1, '姓名必填') }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(true)
      expect(form.errors.value.name).toBeUndefined()
      
      wrapper.unmount()
    })

    it('validate 应该校验所有字段', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: '', email: 'invalid' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1, '姓名必填') },
          { name: 'email', componentType: 'text', rules: z.string().email('邮箱格式错误') }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.name).toContain('姓名必填')
      expect(form.errors.value.email).toContain('邮箱格式错误')
      
      wrapper.unmount()
    })

    it('应该支持 Zod 的 email 校验', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { email: 'invalid-email' },
        columns: [
          { name: 'email', componentType: 'text', rules: z.string().email('邮箱格式错误') }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.email).toContain('邮箱格式错误')
      
      wrapper.unmount()
    })

    it('应该支持 Zod 的 min/max 校验', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { age: 5 },
        columns: [
          { name: 'age', componentType: 'number', rules: z.number().min(18, '必须年满18岁') }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.age).toContain('必须年满18岁')
      
      wrapper.unmount()
    })

    it('应该支持 Zod 的 refine 自定义校验', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { password: '123' },
        columns: [
          { 
            name: 'password', 
            componentType: 'text', 
            rules: z.string().refine(
              (val) => val.length >= 6,
              { message: '密码至少6个字符' }
            )
          }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.password).toContain('密码至少6个字符')
      
      wrapper.unmount()
    })

    it('应该支持 Zod 的异步校验', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { username: 'taken' },
        columns: [
          { 
            name: 'username', 
            componentType: 'text', 
            rules: z.string().refine(
              async (val) => {
                await new Promise(resolve => setTimeout(resolve, 10))

                return val !== 'taken'
              },
              { message: '用户名已存在' }
            )
          }
        ],
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(false)
      expect(form.errors.value.username).toContain('用户名已存在')
      
      wrapper.unmount()
    })

    it('没有 columns 时校验应该通过', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: '' },
      })
      
      const form = getForm()
      
      const isValid = await form.validate()
      
      expect(isValid).toBe(true)
      
      wrapper.unmount()
    })
  })

  describe('重置功能', () => {
    it('resetFields 应该重置表单到初始值', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      form.setFieldsValue({ name: 'Jane', age: 30 })
      await nextTick()
      
      expect(form.getFieldValue('name')).toBe('Jane')
      
      form.resetFields()
      await nextTick()
      
      expect(form.getFieldValue('name')).toBe('John')
      expect(form.getFieldValue('age')).toBe(25)
      
      wrapper.unmount()
    })

    it('resetFields 应该清除错误', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: '' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1, '姓名必填') }
        ],
      })
      
      const form = getForm()
      
      await form.validate()
      expect(form.errors.value.name).toBeDefined()
      
      form.resetFields()
      await nextTick()
      
      expect(form.errors.value.name).toBeUndefined()
      
      wrapper.unmount()
    })

    it('resetFields 应该支持重置指定字段', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      form.setFieldsValue({ name: 'Jane', age: 30 })
      await nextTick()
      
      form.resetFields(['name'])
      await nextTick()
      
      expect(form.getFieldValue('name')).toBe('John')
      expect(form.getFieldValue('age')).toBe(30) // age 不应该被重置
      
      wrapper.unmount()
    })
  })

  describe('提交功能', () => {
    it('submit 应该在校验通过时调用 onFinish', async () => {
      const onFinish = vi.fn()
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1) }
        ],
        onFinish
      })
      
      const form = getForm()
      
      await form.submit()
      
      expect(onFinish).toHaveBeenCalledWith({ name: 'John' })
      
      wrapper.unmount()
    })

    it('submit 应该在校验失败时调用 onFinishFailed', async () => {
      const onFinish = vi.fn()
      const onFinishFailed = vi.fn()
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: '' },
        columns: [
          { name: 'name', componentType: 'text', rules: z.string().min(1, '姓名必填') }
        ],
        onFinish,
        onFinishFailed
      })
      
      const form = getForm()
      
      await form.submit()
      
      expect(onFinish).not.toHaveBeenCalled()
      expect(onFinishFailed).toHaveBeenCalled()
      expect(onFinishFailed.mock.calls[0][0]).toHaveProperty('name')
      
      wrapper.unmount()
    })

    it('submit 应该设置 submitting 状态', async () => {
      let submittingDuringSubmit = false
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' },
        onFinish: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      })
      
      const form = getForm()
      
      const submitPromise = form.submit()
      
      // 检查提交过程中的状态
      await nextTick()
      submittingDuringSubmit = form.submitting.value
      
      await submitPromise
      
      expect(submittingDuringSubmit).toBe(true)
      expect(form.submitting.value).toBe(false)
      
      wrapper.unmount()
    })
  })

  describe('订阅功能', () => {
    it('subscribe 应该订阅单个字段变化', async () => {
      const callback = vi.fn()
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' }
      })
      
      const form = getForm()
      
      const unsubscribe = form.subscribe('name', callback)
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0]).toBe('name')
      expect(callback.mock.calls[0][1]).toBe('Jane')
      
      unsubscribe()
      wrapper.unmount()
    })

    it('subscribeAll 应该订阅所有字段变化', async () => {
      const callback = vi.fn()
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      const unsubscribe = form.subscribeAll(callback)
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls[0][0]).toEqual({ name: 'Jane' })
      
      unsubscribe()
      wrapper.unmount()
    })

    it('onValuesChange 回调应该在值变化时被调用', async () => {
      const onValuesChange = vi.fn()
      
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' },
        onValuesChange
      })
      
      const form = getForm()
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(onValuesChange).toHaveBeenCalled()
      expect(onValuesChange.mock.calls[0][0]).toEqual({ name: 'Jane' })
      
      wrapper.unmount()
    })
  })

  describe('Touched 检测功能（字段是否被修改）', () => {
    it('isFieldTouched 应该检测字段是否被修改', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John' }
      })
      
      const form = getForm()
      
      expect(form.isFieldTouched('name')).toBe(false)
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(form.isFieldTouched('name')).toBe(true)
      
      wrapper.unmount()
    })

    it('getTouchedFields 应该返回所有被修改的字段', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25, email: 'john@example.com' }
      })
      
      const form = getForm()
      
      form.setFieldValue('name', 'Jane')
      form.setFieldValue('age', 30)
      await nextTick()
      
      const touchedFields = form.getTouchedFields()
      expect(touchedFields).toContain('name')
      expect(touchedFields).toContain('age')
      expect(touchedFields).not.toContain('email')
      
      wrapper.unmount()
    })

    it('isFieldsTouched 应该检测多个字段是否全部被修改', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25, email: 'john@example.com' }
      })
      
      const form = getForm()
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(form.isFieldsTouched(['name'])).toBe(true)
      expect(form.isFieldsTouched(['name', 'age'])).toBe(false)
      
      form.setFieldValue('age', 30)
      await nextTick()
      
      expect(form.isFieldsTouched(['name', 'age'])).toBe(true)
      
      wrapper.unmount()
    })

    it('isFieldsTouched 不传参数应该检测是否有任一字段被修改', async () => {
      const { getForm, wrapper } = createTestComponent({
        initialValues: { name: 'John', age: 25 }
      })
      
      const form = getForm()
      
      expect(form.isFieldsTouched()).toBe(false)
      
      form.setFieldValue('name', 'Jane')
      await nextTick()
      
      expect(form.isFieldsTouched()).toBe(true)
      
      wrapper.unmount()
    })
  })
})
