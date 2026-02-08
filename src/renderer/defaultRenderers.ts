import type { Component } from "vue"

import {
  CalendarRendererWrapped,
  CascaderRendererWrapped,
  CheckboxRendererWrapped,
  DateRendererWrapped,
  InputRendererWrapped,
  NumberRendererWrapped,
  PickerRendererWrapped,
  RadioRendererWrapped,
  RateRendererWrapped,
  SelectorRendererWrapped,
  SliderRendererWrapped,
  StepperRendererWrapped,
  SwitchRendererWrapped,
  TextAreaRendererWrapped,
  TextRendererWrapped,
  UploadRendererWrapped,
} from "../renderers"

import type { ISchemaRegistry } from "./createRegistry"

/**
 * 默认渲染器类型列表
 */
export const DEFAULT_RENDERER_TYPES = [
  "input",
  "text",
  "textarea",
  "number",
  "switch",
  "radio",
  "checkbox",
  "date",
  "calendar",
  "picker",
  "selector",
  "rate",
  "slider",
  "stepper",
  "upload",
  "cascader",
] as const

/**
 * 默认渲染器类型
 */
export type DefaultRendererType = (typeof DEFAULT_RENDERER_TYPES)[number]

/**
 * 渲染器注册配置
 */
export interface RendererRegistrationConfig {
  /** 渲染器类型 */
  type: string
  /** 渲染器组件 */
  renderer: Component
}

/**
 * 注册默认渲染器到指定的渲染器实例
 *
 * 注册的是经过 createRenderWrapper 包装的组件，
 * 包含状态合并、默认属性、占位符生成等增强逻辑。
 */
export const registerDefaultRenderers = (renderer: ISchemaRegistry): void => {
  renderer.register("input", InputRendererWrapped)
  renderer.register("text", TextRendererWrapped)
  renderer.register("textarea", TextAreaRendererWrapped)
  renderer.register("number", NumberRendererWrapped)
  renderer.register("switch", SwitchRendererWrapped)
  renderer.register("radio", RadioRendererWrapped)
  renderer.register("checkbox", CheckboxRendererWrapped)
  renderer.register("date", DateRendererWrapped)
  renderer.register("calendar", CalendarRendererWrapped)
  renderer.register("picker", PickerRendererWrapped)
  renderer.register("selector", SelectorRendererWrapped)
  renderer.register("rate", RateRendererWrapped)
  renderer.register("slider", SliderRendererWrapped)
  renderer.register("stepper", StepperRendererWrapped)
  renderer.register("upload", UploadRendererWrapped)
  renderer.register("cascader", CascaderRendererWrapped)
}

/**
 * 检查是否所有默认渲染器都已注册
 */
export const hasAllDefaultRenderers = (renderer: ISchemaRegistry): boolean => {
  return DEFAULT_RENDERER_TYPES.every((type) => renderer.hasRenderer(type))
}

/**
 * 获取缺失的默认渲染器类型
 */
export const getMissingDefaultRenderers = (renderer: ISchemaRegistry): string[] => {
  return DEFAULT_RENDERER_TYPES.filter((type) => !renderer.hasRenderer(type))
}
