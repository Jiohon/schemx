import type { ColumnConfig, DynamicProp, FormValues } from "../types"

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
 * 从列配置中获取初始值
 */
export interface SimpleFormInstance {
  setFieldValue: (name: string, value: any) => void
  getFieldValue: (name: string) => any
  getFieldsValue: (names?: string[]) => Record<string, any>
}

export function getInitialValuesFromColumns(
  columns: any[],
  initValues: Record<string, any> = {}
): Record<string, any> {
  const result: Record<string, any> = {}

  const form: SimpleFormInstance = {
    setFieldValue(name: string, value: any) {
      initValues[name] = value
      if (!(name in result)) result[name] = value ?? null
    },
    getFieldValue(name: string) {
      return initValues[name]
    },
    getFieldsValue(names?: string[]) {
      if (Array.isArray(names)) {
        return names.reduce(
          (o, k) => ((o[k] = initValues[k]), o),
          {} as Record<string, any>
        )
      }

      return { ...initValues }
    },
  }

  const walk = (cols: any[]): void => {
    if (!Array.isArray(cols)) return

    for (const col of cols) {
      // 嵌套 columns
      if (
        Object.prototype.hasOwnProperty.call(col, "columns") &&
        Array.isArray(col.columns)
      ) {
        walk(col.columns)
        continue
      }

      // dependency 动态列
      if (col?.componentType === "dependency" && typeof col?.renderer === "function") {
        const deps: Record<string, any> = {}
        ;(col.to || []).forEach((k: string) => {
          deps[k] = initValues[k] ?? null
        })
        const children = col.renderer(deps, form) || []
        walk(children)
        continue
      }

      // 普通字段
      if (col?.name) {
        if (!(col.name in result)) {
          const iv = Object.prototype.hasOwnProperty.call(col, "initialValue")
            ? col.initialValue
            : null
          result[col.name] = iv
          if (!(col.name in initValues)) initValues[col.name] = iv
        }
      }
    }
  }

  walk(columns)

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
export function resolveDynamicProp<T>(
  value: DynamicProp<T> | T | undefined | null,
  formValues: FormValues,
  defaultValue: T
): T {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = (value as (values: FormValues) => T)(formValues)

      return result ?? defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value as T
}

/**
 * 判断字段类型
 */
export function getFieldType(column: ColumnConfig): "group" | "dependency" | "normal" {
  if (
    Object.prototype.hasOwnProperty.call(column, "columns") &&
    Array.isArray(column.columns)
  ) {
    return "group"
  }

  if (column.componentType === "dependency") {
    return "dependency"
  }

  return "normal"
}
