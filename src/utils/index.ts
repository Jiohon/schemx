import { cloneDeep } from "es-toolkit"

import { setByPath } from "./path"

import type {
  DynamicProp,
  FormValues,
  NormalizedSchemaBaseColumn,
  NormalizedSchemaColumn,
  NormalizedSchemaDependencyColumn,
  NormalizedSchemaGroupColumn,
  NormalizedSchemaNestedColumn,
  SchemaBaseColumn,
  SchemaBaseColumnUnion,
  SchemaColumn,
  SchemaDependencyColumn,
  SchemaGroupColumn,
  SchemaNestedColumn,
  ValidationTrigger,
} from "../types"

/**
 * 从树形结构中查找指定项并返回路径
 */
export interface TreeFindOptions {
  valueKey?: string
  labelKey?: string
  childrenKey?: string
}

export interface TreeFindResult<T = any> {
  ids: any[]
  labels: string[]
  item: T | null
  parent: T | null
}

export const findTreeItem = <T = any>(
  tree: T[],
  targetValue: any,
  options: TreeFindOptions = {}
): TreeFindResult<T> => {
  const emptyResult: TreeFindResult<T> = {
    ids: [],
    labels: [],
    item: null,
    parent: null,
  }

  if (
    !Array.isArray(tree) ||
    !tree.length ||
    targetValue === null ||
    targetValue === undefined
  ) {
    return emptyResult
  }

  const { valueKey = "value", labelKey = "label", childrenKey = "children" } = options

  // 深度优先搜索函数
  const dfs = (
    nodes: T[],
    target: any,
    currentPath = { ids: [] as any[], labels: [] as string[] },
    parent: T | null = null
  ): TreeFindResult<T> | null => {
    if (!Array.isArray(nodes)) return null

    for (const node of nodes) {
      const nodeRecord = node as Record<string, any>
      // 构建当前路径
      const newPath = {
        ids: [...currentPath.ids, nodeRecord[valueKey]],
        labels: [...currentPath.labels, nodeRecord[labelKey]],
      }

      // 如果找到目标节点，返回路径、节点和父节点
      if (nodeRecord[valueKey] === target) {
        return {
          ...newPath,
          item: node,
          parent,
        }
      }

      // 如果有子节点，递归查找
      if (nodeRecord[childrenKey] && Array.isArray(nodeRecord[childrenKey])) {
        const result = dfs(nodeRecord[childrenKey], target, newPath, node)
        if (result) return result
      }
    }

    return null
  }

  const result = dfs(tree, targetValue)

  return result || emptyResult
}

/**
 * 检查字符串是否包含大写字母（驼峰格式）
 */
export const isCamelCase = (str: string): boolean => /[A-Z]/.test(str)

/**
 * 检查字符串是否包含连字符
 */
export const isKebabCase = (str: string): boolean => str.includes("-")

/**
 * 检查字符串是否全小写且不含连字符
 */
export const isLowerCase = (str: string): boolean =>
  str === str.toLowerCase() && !str.includes("-")

/**
 * 驼峰转换为连字符命名
 */
export const camelToKebab = (str: string): string => {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * 连字符转换为驼峰命名
 */
export const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
}

/**
 * 获取字段属性
 */
export const getFieldProps = <T = any>(
  attrs: Record<string, any>,
  key: string,
  defaultValue: T = "" as T
): T => {
  const kebabKey = camelToKebab(key)
  const camelKey = kebabToCamel(key)

  return attrs[kebabKey] || attrs[camelKey] || defaultValue
}

/**
 * 查找两个对象的差异属性
 */
export const findDiffProps = (
  obj1: Record<string, any>,
  obj2: Record<string, any>
): string[] => {
  const diffs: string[] = []

  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  for (const key of keys) {
    const val1 = obj1[key]
    const val2 = obj2[key]

    // 使用严格不相等判断，处理 undefined / null / false 等情况
    if (val1 !== val2) {
      diffs.push(key)
    }
  }

  return diffs
}

/**
 * 检查是否为对象
 */
export const isObject = (v: any): v is object => v !== null && typeof v === "object"

/**
 * 深冻结对象
 */
export const deepFreeze = <T>(obj: T, seen = new WeakSet()): T => {
  if (!isObject(obj) || seen.has(obj)) return obj
  seen.add(obj)

  for (const key of Object.getOwnPropertyNames(obj)) {
    deepFreeze((obj as Record<string, any>)[key], seen)
  }

  return Object.freeze(obj)
}

/**
 * 生成随机字符串
 */
export const randomString = (): string => Math.random().toString(36).slice(2)

/**
 * 从路径中获取文件名
 */
export const getFileName = (url: string): string => {
  if (typeof url !== "string") return randomString()

  const fileNameMatch = url.match(/\/([^/?#]+?)(?:\.[^/?#]+)?(?=[?#]|$)/)

  if (!fileNameMatch) return randomString()

  return fileNameMatch[1]
}

/**
 * 字符串转哈希
 */
export function stringToHash(str: string, hashLength = 5): string {
  // 定义字符集，包含大小写字母和数字
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const charsetLength = charset.length

  // 初始化哈希值
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // 强制转换为32位整数
  }

  // 生成哈希字符串
  let hashStr = ""
  let tempHash = hash

  for (let i = 0; i < hashLength; i++) {
    // 使用哈希的不同部分，确保每次选择不同字符
    const index = Math.abs(tempHash % charsetLength)
    hashStr += charset[index]

    // 防止重复，通过进一步的位操作改变hash
    tempHash = ((tempHash << 3) - tempHash + i) ^ (tempHash >> 2)
  }

  return hashStr.substring(0, hashLength) // 截取到指定长度
}

/**
 * 提取所有initialValue
 * @param columns
 * @returns
 */
export const getInitialValuesFromColumns = <T extends FormValues = FormValues>(
  initialValues: T,
  columns: SchemaColumn<T>[]
): T => {
  const result = cloneDeep(initialValues)

  const bfs = (columns: SchemaColumn<T>[]) => {
    // do something
    if (!Array.isArray(columns)) return

    for (const col of columns) {
      // dependency 动态列
      if (isDependencyColumn(col)) {
        continue
      }

      if (isGroupColumn(col)) {
        bfs(col.columns)
        continue
      }

      // 嵌套 columns
      if (isNestedColumn(col)) {
        bfs(col.columns)
        continue
      }

      // 普通字段
      if (col.name && Reflect.has(col, "initialValue")) {
        setByPath(result, col.name, col.initialValue)
      }
    }
  }

  bfs(columns)

  return result
}
// ==================== 工具函数 ====================

/**
 * 解析动态属性
 *
 * 支持函数类型和静态值：
 * - 如果值是函数，调用它并传入表单值，捕获错误并返回默认值
 * - 如果值是静态值，直接返回
 * - 如果值是 null/undefined，返回默认值
 *
 * @param value - 动态属性值（函数或静态值）
 * @param formValues - 当前表单值
 * @param defaultValue - 默认值
 * @returns 解析后的属性值
 *
 * @example
 * ```typescript
 * // 函数类型
 * const result = resolveDynamicProp((values) => values.name, { name: 'test' }, '')
 * // result: 'test'
 *
 * // 静态值
 * const result = resolveDynamicProp('hello', {}, '')
 * // result: 'hello'
 *
 * // null/undefined
 * const result = resolveDynamicProp(undefined, {}, 'default')
 * // result: 'default'
 * ```
 */
export async function resolveDynamicPropByBoolean(
  value: DynamicProp<boolean> | undefined | null,
  formValues: FormValues,
  defaultValue: boolean | undefined = false
): Promise<boolean> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await value(formValues)

      return result ? result : defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value
}

/**
 * 解析动态属性
 *
 * 支持函数类型和静态值：
 * - 如果值是函数，调用它并传入表单值，捕获错误并返回默认值
 * - 如果值是静态值，直接返回
 * - 如果值是 null/undefined，返回默认值
 *
 * @param value - 动态属性值（函数或静态值）
 * @param formValues - 当前表单值
 * @param defaultValue - 默认值
 * @returns 解析后的属性值
 *
 * @example
 * ```typescript
 * // 函数类型
 * const result = resolveDynamicProp((values) => values.name, { name: 'test' }, '')
 * // result: 'test'
 *
 * // 静态值
 * const result = resolveDynamicProp('hello', {}, '')
 * // result: 'hello'
 *
 * // null/undefined
 * const result = resolveDynamicProp(undefined, {}, 'default')
 * // result: 'default'
 * ```
 */
export async function resolveDynamicProp<T>(
  value: DynamicProp<T> | T | undefined | null,
  formValues: FormValues,
  defaultValue: T
): Promise<T> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await (value as (values: FormValues) => T)(formValues)

      return result ?? defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value
}

/**
 * 类型守卫：判断是否为基础字段配置
 */
export function isBaseColumn(
  column: SchemaColumn | NormalizedSchemaColumn
): column is SchemaBaseColumnUnion | NormalizedSchemaBaseColumn {
  return !isGroupColumn(column) && !isDependencyColumn(column) && !isNestedColumn(column)
}

/**
 * 类型守卫：判断是否为分类字段配置
 */
export function isGroupColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaGroupColumn<T> | NormalizedSchemaGroupColumn {
  return column.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖字段配置
 */
export function isDependencyColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaDependencyColumn<T> | NormalizedSchemaDependencyColumn {
  return column.componentType === "dependency"
}

/**
 * 类型守卫：判断是否为嵌套字段配置
 */
export function isNestedColumn<T extends FormValues = FormValues>(
  column: SchemaColumn<T> | NormalizedSchemaColumn
): column is SchemaNestedColumn<T> | NormalizedSchemaNestedColumn {
  return column.componentType === "columns"
}

// ==================== 校验触发工具 ====================

type NormalizedTrigger = "blur" | "change" | "submit"

/**
 * 归一化触发类型
 *
 * 将 "onBlur" → "blur", "onChange" → "change", "onSubmit" → "submit"
 */
function normalizeTrigger(t: ValidationTrigger): NormalizedTrigger {
  const map: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  return map[t] ?? "submit"
}

/**
 * 判断当前事件是否应该触发校验
 *
 * @param event - 当前触发的事件类型 ("blur" | "change" | "submit")
 * @param trigger - 配置的触发时机（支持单个或数组）
 * @returns 是否应该触发校验
 *
 * @example
 * ```typescript
 * shouldValidateOn("change", "onChange")  // true
 * shouldValidateOn("blur", ["onBlur", "onChange"])  // true
 * shouldValidateOn("change", "onSubmit")  // false
 * shouldValidateOn("change", undefined)   // false
 * ```
 */
export function shouldValidateOn(
  event: NormalizedTrigger,
  trigger?: ValidationTrigger | ValidationTrigger[]
): boolean {
  if (!trigger) return false
  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  return triggers.some((t) => normalizeTrigger(t) === event)
}
