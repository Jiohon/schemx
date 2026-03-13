/**
 * column 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 SchemaForm 的列配置解析。
 *
 * @module utils/column
 */

import type {
  FormValues,
  SchemaBaseColumnUnion,
  SchemaColumn,
  SchemaDependencyColumn,
  SchemaGroupColumn,
  SchemaNestedColumn,
} from "../types"

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param column - 列配置
 * @returns 是否为基础字段
 */
export function isBaseColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T>
): column is SchemaBaseColumnUnion<T> {
  return !isGroupColumn(column) && !isDependencyColumn(column) && !isNestedColumn(column)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 */
export function isGroupColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T>
): column is SchemaGroupColumn<T> {
  return column.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "dependency"` 的依赖列
 */
export function isDependencyColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T>
): column is SchemaDependencyColumn<T> {
  return column.componentType === "dependency"
}

/**
 * 类型守卫：判断是否为嵌套列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "columns"` 的嵌套列
 */
export function isNestedColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T>
): column is SchemaNestedColumn<T> {
  return column.componentType === "columns"
}

/**
 * 在列配置树中按字段名查找基础字段配置。
 *
 * 递归搜索 group、nested 的子 columns，返回第一个匹配的基础字段。
 *
 * @param columns - 列配置数组
 * @param name - 字段名称
 *
 * @returns 匹配的基础字段配置，未找到时返回 undefined
 *
 * @example
 * const column = findColumn(columns, 'email')
 */
export function findColumn<T extends FormValues = FormValues>(
  columns: SchemaColumn<T>[],
  name: string
): SchemaBaseColumnUnion<T> | undefined {
  for (const column of columns) {
    if (isBaseColumn(column) && String(column.name) === name) {
      return column
    }

    if (isGroupColumn(column) || isNestedColumn(column)) {
      const found = findColumn<T>(column.columns as SchemaColumn<T>[], name)

      if (found) return found
    }
  }

  return undefined
}
