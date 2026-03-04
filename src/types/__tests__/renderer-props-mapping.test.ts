/**
 * 渲染器 Props 映射类型测试
 *
 * 验证 RendererPropsMap、SchemaBaseColumn 泛型化、分布式联合类型等类型系统功能。
 */
import { describe, expectTypeOf, it } from "vitest"

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
import type {
  CustomRendererPropsMap,
  DefaultRendererPropsMap,
  DynamicProp,
  FormValues,
  RendererPropsMap,
  SchemaBaseColumn,
  SchemaBaseColumnUnion,
  SchemaColumn,
} from "../index"

describe("RendererPropsMap 类型测试", () => {
  it("应包含所有 16 种内置渲染器映射", () => {
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("input")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("text")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("textarea")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("number")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("switch")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("radio")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("checkbox")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("date")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("calendar")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("picker")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("selector")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("rate")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("slider")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("stepper")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("upload")
    expectTypeOf<DefaultRendererPropsMap>().toHaveProperty("cascader")
  })

  it("input 键应映射到 InputRendererProps", () => {
    expectTypeOf<DefaultRendererPropsMap["input"]>().toEqualTypeOf<InputRendererProps>()
  })

  it("picker 键应映射到 PickerRendererProps", () => {
    expectTypeOf<DefaultRendererPropsMap["picker"]>().toEqualTypeOf<PickerRendererProps>()
  })

  it("number 键应映射到 NumberRendererProps", () => {
    expectTypeOf<DefaultRendererPropsMap["number"]>().toEqualTypeOf<NumberRendererProps>()
  })

  it("所有键映射正确", () => {
    expectTypeOf<DefaultRendererPropsMap["text"]>().toEqualTypeOf<TextRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["textarea"]
    >().toEqualTypeOf<TextAreaRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["switch"]>().toEqualTypeOf<SwitchRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["radio"]>().toEqualTypeOf<RadioRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["checkbox"]
    >().toEqualTypeOf<CheckboxRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["date"]>().toEqualTypeOf<DateRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["calendar"]
    >().toEqualTypeOf<CalendarRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["selector"]
    >().toEqualTypeOf<SelectorRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["rate"]>().toEqualTypeOf<RateRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["slider"]>().toEqualTypeOf<SliderRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["stepper"]
    >().toEqualTypeOf<StepperRendererProps>()
    expectTypeOf<DefaultRendererPropsMap["upload"]>().toEqualTypeOf<UploadRendererProps>()
    expectTypeOf<
      DefaultRendererPropsMap["cascader"]
    >().toEqualTypeOf<CascaderRendererProps>()
  })
})

describe("CustomRendererPropsMap 扩展测试", () => {
  it("CustomRendererPropsMap 应为可扩展的空接口", () => {
    expectTypeOf<CustomRendererPropsMap>().toEqualTypeOf<{}>()
  })

  it("RendererPropsMap 应合并默认和自定义映射", () => {
    // 默认情况下 RendererPropsMap 应包含所有默认映射
    expectTypeOf<RendererPropsMap>().toHaveProperty("input")
    expectTypeOf<RendererPropsMap>().toHaveProperty("picker")
  })
})

describe("SchemaBaseColumn 泛型化测试", () => {
  it("指定 componentType 为 input 时，componentProps 应收窄为 InputRendererProps", () => {
    type InputColumn = SchemaBaseColumn<FormValues, "input">
    expectTypeOf<InputColumn["componentType"]>().toEqualTypeOf<"input">()
    expectTypeOf<InputColumn["componentProps"]>().toEqualTypeOf<
      DynamicProp<InputRendererProps> | undefined
    >()
  })

  it("指定 componentType 为 switch 时，componentProps 应收窄为 SwitchRendererProps", () => {
    type SwitchColumn = SchemaBaseColumn<FormValues, "switch">
    expectTypeOf<SwitchColumn["componentType"]>().toEqualTypeOf<"switch">()
    expectTypeOf<SwitchColumn["componentProps"]>().toEqualTypeOf<
      DynamicProp<SwitchRendererProps> | undefined
    >()
  })

  it("未指定泛型参数时应保持向后兼容", () => {
    type DefaultColumn = SchemaBaseColumn
    // componentType 应为所有渲染器类型的联合
    expectTypeOf<DefaultColumn["componentType"]>().toEqualTypeOf<keyof RendererPropsMap>()
  })

  it("应保留 FormValues 泛型参数 T 的功能", () => {
    type TypedValues = { name: string; age: number }
    type TypedColumn = SchemaBaseColumn<TypedValues, "input">
    // name 应被约束为 TypedValues 的路径
    expectTypeOf<TypedColumn["componentType"]>().toEqualTypeOf<"input">()
  })
})

describe("SchemaBaseColumnUnion 分布式联合类型测试", () => {
  it("SchemaBaseColumnUnion 应为所有具体 SchemaBaseColumn 的联合", () => {
    // 应能赋值 input 类型的列
    const inputCol: SchemaBaseColumnUnion = {
      name: "test",
      componentType: "input",
    }
    expectTypeOf(inputCol).toMatchTypeOf<SchemaBaseColumnUnion>()

    // 应能赋值 picker 类型的列
    const pickerCol: SchemaBaseColumnUnion = {
      name: "test",
      componentType: "picker",
    }
    expectTypeOf(pickerCol).toMatchTypeOf<SchemaBaseColumnUnion>()
  })

  it("SchemaColumn 应包含 SchemaBaseColumnUnion", () => {
    const col: SchemaColumn = {
      name: "test",
      componentType: "input",
    }
    expectTypeOf(col).toMatchTypeOf<SchemaColumn>()
  })
})
