import type { FormValues, SchemxProps } from "@schemx/core"

/**
 * schemx 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxFormProps<
  T extends FormValues = FormValues,
> extends SchemxProps<T> {
  /** 全局 HTTP 请求器，作为该表单实例内所有 useDictionary 的默认请求器 */
  request?: (url: string) => Promise<any>
}
