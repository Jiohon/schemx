/**
 * schemx 渲染器类型声明合并
 *
 * 将 Vant 渲染器的 componentType 和 componentProps 注册到 schemx 类型系统，
 * 使 schemas 配置获得完整的类型提示。
 */
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
} from "@schemx/vant"

declare module "@schemx/core" {
  interface CustomRenderer {
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
}
