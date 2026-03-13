import "@"

import type { InputRendererProps } from "../renderers/InputRenderer"
import type { NumberRendererProps } from "../renderers/NumberRenderer"
import type { TextAreaRendererProps } from "../renderers/TextAreaRenderer"
import type { TextRendererProps } from "../renderers/TextRenderer"

/**
 * 内置渲染器 Props 映射
 *
 * 将每个内置渲染器类型字符串映射到其对应的 Props 接口，
 * 用于实现 componentType 与 componentProps 之间的严格类型关联。
 */
export interface DefaultRendererPropsMap {
  input: InputRendererProps
  text: TextRendererProps
  textarea: TextAreaRendererProps
  number: NumberRendererProps
}

declare module "@" {
  interface CustomRendererMap extends DefaultRendererPropsMap {
    color: { colors: any }
    starRating: { max: number }
    tagInput: { placeholder: string; maxTags: number }
  }
}
