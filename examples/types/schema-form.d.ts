import "@"

import type { CalendarRendererProps } from "../../renderers/CalendarRenderer"
import type { CascaderRendererProps } from "../../renderers/CascaderRenderer"
import type { CheckboxRendererProps } from "../../renderers/CheckboxRenderer"
import type { DateRendererProps } from "../../renderers/DateRenderer"
import type { InputRendererProps } from "../../renderers/InputRenderer"
import type { NumberRendererProps } from "../../renderers/NumberRenderer"
import type { PickerRendererProps } from "../../renderers/PickerRenderer"
import type { RadioRendererProps } from "../../renderers/RadioRenderer"
import type { RateRendererProps } from "../../renderers/RateRenderer"
import type { SelectorRendererProps } from "../../renderers/SelectorRenderer"
import type { SliderRendererProps } from "../../renderers/SliderRenderer"
import type { StepperRendererProps } from "../../renderers/StepperRenderer"
import type { SwitchRendererProps } from "../../renderers/SwitchRenderer"
import type { TextAreaRendererProps } from "../../renderers/TextAreaRenderer"
import type { TextRendererProps } from "../../renderers/TextRenderer"
import type { UploadRendererProps } from "../../renderers/UploadRenderer"

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
  switch: SwitchRendererProps
  radio: RadioRendererProps
  checkbox: CheckboxRendererProps
  date: DateRendererProps
  calendar: CalendarRendererProps
  picker: PickerRendererProps
  selector: SelectorRendererProps
  rate: RateRendererProps
  slider: SliderRendererProps
  stepper: StepperRendererProps
  upload: UploadRendererProps
  cascader: CascaderRendererProps
}

declare module "@" {
  interface CustomRendererPropsMap extends DefaultRendererPropsMap {
    color: { colors: any }
  }
}
