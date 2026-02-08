/**
 * SchemaParser - Schema 解析器
 *
 * 职责单一：只负责 columns 配置的解析和规范化。
 *
 * @module core/SchemaParser
 */

import type {
  ColumnConfig,
  DependencyColumnConfig,
  NormalizedBaseColumnConfig,
  NormalizedColumnConfig,
  NormalizedDependencyColumn,
} from "../types"

/**
 * 字段节点
 */
export interface FieldNode {
  /** 字段名 */
  name: string
  /** 完整路径 */
  path: string
  /** 规范化后的配置 */
  column: NormalizedBaseColumnConfig
}

/**
 * 解析结果
 */
export interface ParsedSchema {
  /** 规范化后的 columns */
  columns: NormalizedColumnConfig[]
  /** 字段列表（扁平化） */
  fieldList: FieldNode[]
  /** 默认值集合 */
  defaults: Record<string, any>
}

export interface SchemaParserOptions {
  columns: ColumnConfig[]
  readonly?: boolean
  disabled?: boolean
}

/**
 * 类型守卫：判断是否为依赖字段配置
 */
function isDependencyColumn(column: ColumnConfig): column is DependencyColumnConfig {
  return column.componentType === "dependency"
}

/**
 * SchemaParser 类
 */
export class SchemaParser {
  /**
   * 解析 columns 配置
   */
  static parse(options: SchemaParserOptions): ParsedSchema {
    const { columns } = options
    const fieldList: FieldNode[] = []
    const defaults: Record<string, any> = {}
    const normalizedColumns = SchemaParser.normalizeColumns(
      columns,
      "",
      fieldList,
      defaults
    )

    return { columns: normalizedColumns, fieldList, defaults }
  }

  /**
   * 规范化 columns
   */
  private static normalizeColumns(
    columns: ColumnConfig[],
    parentPath: string,
    fieldList: FieldNode[],
    defaults: Record<string, any>
  ): NormalizedColumnConfig[] {
    return columns.map((column) => {
      // 处理依赖字段
      if (isDependencyColumn(column)) {
        return {
          componentType: "dependency",
          to: column.to,
          renderer: column.renderer,
          _raw: column,
        } as NormalizedDependencyColumn
      }

      // 处理基础字段
      const path = parentPath ? `${parentPath}.${column.name}` : column.name

      const normalized: NormalizedBaseColumnConfig = {
        ...column,
        path,
        componentType: column.componentType || "text",
        _raw: column,
      }
      // 提取默认值
      if (column.initialValue !== undefined) {
        SchemaParser.setByPath(defaults, path, column.initialValue)
      }

      // 添加到字段列表
      fieldList.push({ name: column.name, path, column: normalized })

      // 递归处理嵌套字段
      if (column.columns?.length) {
        normalized.columns = SchemaParser.normalizeColumns(
          column.columns,
          path,
          fieldList,
          defaults
        )
      }

      return normalized
    })
  }

  /**
   * 按路径设置值
   */
  private static setByPath(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split(".")
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        current[part] = {}
      }

      current = current[part]
    }

    current[parts[parts.length - 1]] = value
  }
}

/**
 * 解析 columns 的便捷函数
 */
export function parseSchema(options: SchemaParserOptions): ParsedSchema {
  return SchemaParser.parse(options)
}

export default SchemaParser
