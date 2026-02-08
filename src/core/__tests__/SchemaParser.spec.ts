/**
 * SchemaParser 单元测试
 *
 * 测试新的 SchemaParser API：
 * - SchemaParser.parse() 静态方法
 * - NormalizedColumn 输出结构
 * - fieldMap 和 fieldList 构建
 * - defaults 提取
 * - rulesMap 提取
 * - dependencies 提取
 * - 嵌套 columns 解析
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { parseSchema, SchemaParser } from '../SchemaParser'

import type { ColumnConfig } from '../../types'

describe('SchemaParser', () => {
  describe('SchemaParser.parse() - 基础解析', () => {
    it('应该解析简单的 columns 配置', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text', label: '姓名' },
        { name: 'age', componentType: 'number', label: '年龄' },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns).toHaveLength(2)
      expect(result.columns[0].name).toBe('name')
      expect(result.columns[0].path).toBe('name')
      expect(result.columns[0].componentType).toBe('text')
      expect(result.columns[1].name).toBe('age')
      expect(result.columns[1].path).toBe('age')
    })

    it('应该返回空数组当 columns 为空', () => {
      const result = SchemaParser.parse([])

      expect(result.columns).toEqual([])
      expect(result.fieldMap.size).toBe(0)
      expect(result.fieldList).toHaveLength(0)
    })

    it('应该使用便捷函数 parseSchema', () => {
      const columns: ColumnConfig[] = [
        { name: 'field1', componentType: 'text' },
      ]

      const result = parseSchema(columns)

      expect(result.columns).toHaveLength(1)
      expect(result.columns[0].name).toBe('field1')
    })
  })

  describe('Schema Normalize - 规范化', () => {
    it('应该补齐默认字段值', () => {
      const columns: ColumnConfig[] = [
        { name: 'field1', componentType: 'text' },
      ]

      const result = SchemaParser.parse(columns)
      const normalized = result.columns[0]

      expect(normalized.required).toBe(false)
      expect(normalized.disabled).toBe(false)
      expect(normalized.visible).toBe(true)
      expect(normalized.readonly).toBe(false)
      expect(normalized.hidden).toBe(false)
    })

    it('应该保留用户指定的布尔值', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'field1',
          componentType: 'text',
          required: true,
          disabled: true,
          visible: false,
          readonly: true,
          hidden: true,
        },
      ]

      const result = SchemaParser.parse(columns)
      const normalized = result.columns[0]

      expect(normalized.required).toBe(true)
      expect(normalized.disabled).toBe(true)
      expect(normalized.visible).toBe(false)
      expect(normalized.readonly).toBe(true)
      expect(normalized.hidden).toBe(true)
    })

    it('应该保留动态属性函数', () => {
      const visibleFn = (values: Record<string, any>) => values.type === 'vip'
      const disabledFn = (values: Record<string, any>) => values.status === 'locked'

      const columns: ColumnConfig[] = [
        {
          name: 'field1',
          componentType: 'text',
          visible: visibleFn,
          disabled: disabledFn,
        },
      ]

      const result = SchemaParser.parse(columns)
      const normalized = result.columns[0]

      expect(normalized.visible).toBe(visibleFn)
      expect(normalized.disabled).toBe(disabledFn)
    })

    it('应该默认 componentType 为 text', () => {
      const columns: ColumnConfig[] = [
        { name: 'field1' } as ColumnConfig,
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns[0].componentType).toBe('text')
    })

    it('应该保留原始配置在 _raw 字段', () => {
      const original: ColumnConfig = {
        name: 'field1',
        componentType: 'text',
        label: '字段1',
        componentProps: { placeholder: '请输入' },
      }

      const result = SchemaParser.parse([original])

      expect(result.columns[0]._raw).toBe(original)
    })
  })

  describe('字段路径展开 & 索引表构建', () => {
    it('应该构建 fieldMap 索引表', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text' },
        { name: 'email', componentType: 'text' },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldMap.size).toBe(2)
      expect(result.fieldMap.has('name')).toBe(true)
      expect(result.fieldMap.has('email')).toBe(true)
    })

    it('应该构建 fieldList 扁平列表', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text' },
        { name: 'email', componentType: 'text' },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldList).toHaveLength(2)
      expect(result.fieldList[0].name).toBe('name')
      expect(result.fieldList[1].name).toBe('email')
    })

    it('应该支持 O(1) 查询字段', () => {
      const columns: ColumnConfig[] = [
        { name: 'field1', componentType: 'text', label: '字段1' },
        { name: 'field2', componentType: 'number', label: '字段2' },
        { name: 'field3', componentType: 'switch', label: '字段3' },
      ]

      const result = SchemaParser.parse(columns)
      const field2 = result.fieldMap.get('field2')

      expect(field2).toBeDefined()
      expect(field2!.column.label).toBe('字段2')
      expect(field2!.column.componentType).toBe('number')
    })

    it('应该为嵌套字段生成正确的路径', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'address',
          componentType: 'group',
          columns: [
            { name: 'city', componentType: 'text' },
            { name: 'street', componentType: 'text' },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldMap.has('address')).toBe(true)
      expect(result.fieldMap.has('address.city')).toBe(true)
      expect(result.fieldMap.has('address.street')).toBe(true)

      const cityNode = result.fieldMap.get('address.city')
      expect(cityNode!.path).toBe('address.city')
    })
  })

  describe('默认值提取', () => {
    it('应该提取 initialValue 到 defaults', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text', initialValue: 'John' },
        { name: 'age', componentType: 'number', initialValue: 18 },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.defaults).toEqual({
        name: 'John',
        age: 18,
      })
    })

    it('应该忽略没有 initialValue 的字段', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text' },
        { name: 'age', componentType: 'number', initialValue: 0 },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.defaults).toEqual({ age: 0 })
      expect('name' in result.defaults).toBe(false)
    })

    it('应该处理嵌套字段的默认值', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'user',
          componentType: 'group',
          columns: [
            { name: 'name', componentType: 'text', initialValue: 'John' },
            { name: 'email', componentType: 'text', initialValue: 'john@example.com' },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.defaults).toEqual({
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      })
    })

    it('应该处理 falsy 默认值', () => {
      const columns: ColumnConfig[] = [
        { name: 'count', componentType: 'number', initialValue: 0 },
        { name: 'enabled', componentType: 'switch', initialValue: false },
        { name: 'text', componentType: 'text', initialValue: '' },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.defaults).toEqual({
        count: 0,
        enabled: false,
        text: '',
      })
    })
  })

  describe('校验规则提取', () => {
    it('应该提取 Zod rules 到 rulesMap', () => {
      const nameRule = z.string().min(1, '必填')
      const emailRule = z.string().email('邮箱格式错误')

      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text', rules: nameRule },
        { name: 'email', componentType: 'text', rules: emailRule },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.rulesMap.size).toBe(2)
      expect(result.rulesMap.get('name')).toBe(nameRule)
      expect(result.rulesMap.get('email')).toBe(emailRule)
    })

    it('应该忽略没有 rules 的字段', () => {
      const columns: ColumnConfig[] = [
        { name: 'name', componentType: 'text' },
        { name: 'email', componentType: 'text', rules: z.string().email() },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.rulesMap.size).toBe(1)
      expect(result.rulesMap.has('name')).toBe(false)
      expect(result.rulesMap.has('email')).toBe(true)
    })

    it('应该处理嵌套字段的规则', () => {
      const cityRule = z.string().min(1)

      const columns: ColumnConfig[] = [
        {
          name: 'address',
          componentType: 'group',
          columns: [
            { name: 'city', componentType: 'text', rules: cityRule },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.rulesMap.has('address.city')).toBe(true)
      expect(result.rulesMap.get('address.city')).toBe(cityRule)
    })
  })

  describe('依赖关系图构建', () => {
    it('应该从依赖字段的 to 属性构建依赖关系', () => {
      const columns: ColumnConfig[] = [
        { name: 'type', componentType: 'radio' },
        {
          componentType: 'dependency',
          to: ['type'],
          renderer: () => [],
        },
      ]

      const result = SchemaParser.parse(columns)

      // 依赖字段不会被添加到 fieldMap，因为它没有 name 属性
      expect(result.fieldMap.size).toBe(1)
      expect(result.columns).toHaveLength(2)
      expect(result.columns[1].componentType).toBe('dependency')
    })

    it('应该正确解析依赖字段的 to 属性', () => {
      const columns: ColumnConfig[] = [
        { name: 'type', componentType: 'radio' },
        { name: 'status', componentType: 'radio' },
        {
          componentType: 'dependency',
          to: ['type', 'status'],
          renderer: () => [],
        },
      ]

      const result = SchemaParser.parse(columns)

      // 依赖字段保留了 to 属性
      const depColumn = result.columns[2]
      expect(depColumn.componentType).toBe('dependency')
      expect((depColumn as any).to).toEqual(['type', 'status'])
    })

    it('应该支持多个依赖字段', () => {
      const columns: ColumnConfig[] = [
        { name: 'type', componentType: 'radio' },
        {
          componentType: 'dependency',
          to: ['type'],
          renderer: () => [],
        },
        {
          componentType: 'dependency',
          to: ['type'],
          renderer: () => [],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns).toHaveLength(3)
      expect(result.columns[1].componentType).toBe('dependency')
      expect(result.columns[2].componentType).toBe('dependency')
    })
  })

  describe('嵌套 columns 解析', () => {
    it('应该递归解析嵌套 columns', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'address',
          componentType: 'group',
          label: '地址',
          columns: [
            { name: 'city', componentType: 'text', label: '城市' },
            { name: 'street', componentType: 'text', label: '街道' },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns[0].columns).toBeDefined()
      expect(result.columns[0].columns).toHaveLength(2)
      expect(result.columns[0].columns![0].name).toBe('city')
      expect(result.columns[0].columns![0].path).toBe('address.city')
    })

    it('应该处理深层嵌套', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'level1',
          componentType: 'group',
          columns: [
            {
              name: 'level2',
              componentType: 'group',
              columns: [
                { name: 'level3', componentType: 'text' },
              ],
            },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldMap.has('level1.level2.level3')).toBe(true)
      const level3 = result.fieldMap.get('level1.level2.level3')
      expect(level3!.path).toBe('level1.level2.level3')
    })

    it('应该建立父子关系', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'parent',
          componentType: 'group',
          columns: [
            { name: 'child', componentType: 'text' },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      const parentNode = result.fieldMap.get('parent')
      const childNode = result.fieldMap.get('parent.child')

      expect(childNode!.parent).toBe(parentNode)
      expect(parentNode!.children).toContain(childNode)
    })

    it('应该处理空的嵌套 columns', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'group',
          componentType: 'group',
          columns: [],
        },
      ]

      const result = SchemaParser.parse(columns)

      // 空数组会被保留（不会变成 undefined）
      expect(result.columns[0].columns).toEqual([])
    })
  })

  describe('FieldNode 结构', () => {
    it('应该生成正确的 FieldNode 结构', () => {
      const columns: ColumnConfig[] = [
        { name: 'field1', componentType: 'text', label: '字段1' },
      ]

      const result = SchemaParser.parse(columns)
      const node = result.fieldMap.get('field1')

      expect(node).toBeDefined()
      expect(node!.name).toBe('field1')
      expect(node!.path).toBe('field1')
      expect(node!.column).toBeDefined()
      expect(node!.column.label).toBe('字段1')
      expect(node!.parent).toBeUndefined()
      expect(node!.children).toBeUndefined()
    })

    it('应该在 fieldList 中包含所有字段', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'group',
          componentType: 'group',
          columns: [
            { name: 'child1', componentType: 'text' },
            { name: 'child2', componentType: 'text' },
          ],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldList).toHaveLength(3)
      expect(result.fieldList.map(n => n.path)).toEqual([
        'group',
        'group.child1',
        'group.child2',
      ])
    })
  })

  describe('componentProps 处理', () => {
    it('应该保留静态 componentProps', () => {
      const columns: ColumnConfig[] = [
        {
          name: 'field1',
          componentType: 'text',
          componentProps: { placeholder: '请输入', maxLength: 100 },
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns[0].componentProps).toEqual({
        placeholder: '请输入',
        maxLength: 100,
      })
    })

    it('应该保留动态 componentProps 函数', () => {
      const propsFn = (values: Record<string, any>) => ({
        max: values.type === 'vip' ? 50 : 20,
      })

      const columns: ColumnConfig[] = [
        {
          name: 'field1',
          componentType: 'number',
          componentProps: propsFn,
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns[0].componentProps).toBe(propsFn)
    })
  })

  describe('边界情况', () => {
    it('应该处理混合类型的 columns', () => {
      const columns: ColumnConfig[] = [
        { name: 'simple', componentType: 'text' },
        {
          name: 'group',
          componentType: 'group',
          columns: [
            { name: 'nested', componentType: 'text' },
          ],
        },
        {
          componentType: 'dependency',
          to: ['simple'],
          renderer: () => [],
        },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.columns).toHaveLength(3)
      // 依赖字段不会被添加到 fieldMap，因为它没有 name 属性
      expect(result.fieldMap.size).toBe(3) // simple, group, group.nested
    })

    it('应该处理特殊字符的字段名', () => {
      const columns: ColumnConfig[] = [
        { name: 'field_1', componentType: 'text' },
        { name: 'field-2', componentType: 'text' },
      ]

      const result = SchemaParser.parse(columns)

      expect(result.fieldMap.has('field_1')).toBe(true)
      expect(result.fieldMap.has('field-2')).toBe(true)
    })
  })
})
