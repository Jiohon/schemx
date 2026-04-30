/**
 * schemx 渲染器类型声明合并
 *
 * 将 Vant 渲染器的 componentType 和 componentProps 注册到 schemx 类型系统，
 * 使 schemas 配置获得完整的类型提示。
 */
import type { SchemxRendererDefinition } from "@schemx/core"
import type { SchemxWithDictionary } from "@schemx/core"

import type {
  InputRendererProps,
  TextRendererProps,
  TextAreaRendererProps,
  NumberRendererProps,
  SwitchRendererProps,
  RadioRendererProps,
  CheckboxRendererProps,
  DateRendererProps,
  CalendarRendererProps,
  PickerRendererProps,
  SelectorRendererProps,
  RateRendererProps,
  SliderRendererProps,
  StepperRendererProps,
  UploadRendererProps,
  CascaderRendererProps,
} from "../renderers"

declare module "@schemx/core" {
  interface SchemxRendererDefinition<T extends Values> {
    input: InputRendererProps
    text: TextRendererProps
    textarea: TextAreaRendererProps
    number: NumberRendererProps
    switch: SwitchRendererProps
    radio: SchemxWithDictionary<RadioRendererProps, T>
    checkbox: SchemxWithDictionary<CheckboxRendererProps, T>
    date: DateRendererProps
    calendar: CalendarRendererProps
    picker: SchemxWithDictionary<PickerRendererProps, T>
    selector: SchemxWithDictionary<SelectorRendererProps, T>
    rate: RateRendererProps
    slider: SliderRendererProps
    stepper: StepperRendererProps
    upload: UploadRendererProps
    cascader: CascaderRendererProps
  }
}
