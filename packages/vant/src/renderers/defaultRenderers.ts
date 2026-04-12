import { defineRenderers } from "@schemx/core"

import {
  CalendarRenderer,
  CascaderRenderer,
  CheckboxRenderer,
  DateRenderer,
  InputRenderer,
  NumberRenderer,
  PickerRenderer,
  RadioRenderer,
  RateRenderer,
  SelectorRenderer,
  SliderRenderer,
  StepperRenderer,
  SwitchRenderer,
  TextAreaRenderer,
  TextRenderer,
  UploadRenderer,
} from "../renderers"

/**
 * 注册子渲染器
 */
defineRenderers({
  input: InputRenderer,
  text: TextRenderer,
  textarea: TextAreaRenderer,
  number: NumberRenderer,
  switch: SwitchRenderer,
  radio: RadioRenderer,
  checkbox: CheckboxRenderer,
  date: DateRenderer,
  calendar: CalendarRenderer,
  picker: PickerRenderer,
  selector: SelectorRenderer,
  rate: RateRenderer,
  slider: SliderRenderer,
  stepper: StepperRenderer,
  upload: UploadRenderer,
  cascader: CascaderRenderer,
})
