/**
 * Schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 SchemaForm 的列配置解析。
 *
 * @module utils/schema
 */

import { cloneDeep } from "es-toolkit"

import { setByPath } from "./path"

import type {
  FormValues,
  NormalizedSchemaBaseColumn,
  NormalizedSchemaColumn,
  NormalizedSchemaDependencyColumn,
  NormalizedSchemaGroupColumn,
  NormalizedSchemaNestedColumn,
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
export function isBaseColumn(
  column: SchemaColumn | NormalizedSchemaColumn
): column is SchemaBaseColumnUnion | NormalizedSchemaBaseColumn {
  return !isGroupColumn(column) && !isDependencyColumn(column) && !isNestedColumn(column)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 */
export function isGroupColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaGroupColumn<T> | NormalizedSchemaGroupColumn {
  return column.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "dependency"` 的依赖列
 */
export function isDependencyColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaDependencyColumn<T> | NormalizedSchemaDependencyColumn {
  return column.componentType === "dependency"
}

/**
 * 类型守卫：判断是否为嵌套列配置
 *
 * @param column - 列配置
 * @returns 是否为 `componentType === "columns"` 的嵌套列
 */
export function isNestedColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaNestedColumn<T> | NormalizedSchemaNestedColumn {
  return column.componentType === "columns"
}

/**
 * 从列配置中提取所有 initialValue，合并到初始值对象中
 *
 * 递归遍历列配置树，跳过 dependency 列，
 * 将每个基础字段的 `initialValue` 通过路径写入结果对象。
 *
 * @typeParam T - 表单值类型
 *
 * @param initialValues - 基础初始值对象
 * @param columns - 列配置数组
 * @returns 合并了列 initialValue 的完整初始值
 *
 * @example
 * ```typescript
 * const columns = [
 *   { name: 'name', componentType: 'input', initialValue: 'John' },
 *   { name: 'age', componentType: 'number', initialValue: 25 },
 * ]
 * getInitialValuesFromColumns({}, columns)
 * // => { name: 'John', age: 25 }
 * ```
 */
export const getInitialValuesFromColumns = <T extends FormValues = FormValues>(
  initialValues: T,
  columns: SchemaColumn<T>[]
): T => {
  const result = cloneDeep(initialValues)

  const bfs = (columns: SchemaColumn<T>[]) => {
    if (!Array.isArray(columns)) return

    for (const col of columns) {
      if (isDependencyColumn(col)) {
        continue
      }

      if (isGroupColumn(col)) {
        bfs(col.columns)
        continue
      }

      if (isNestedColumn(col)) {
        bfs(col.columns)
        continue
      }

      if (col.name && Reflect.has(col, "initialValue")) {
        setByPath(result, col.name, col.initialValue)
      }
    }
  }

  bfs(columns)

  return result
}
