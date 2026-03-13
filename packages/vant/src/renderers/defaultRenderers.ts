import type { Component } from "vue"

import CalendarRenderer from "./CalendarRenderer"
import CascaderRenderer from "./CascaderRenderer"
import CheckboxRenderer from "./CheckboxRenderer"
import DateRenderer from "./DateRenderer"
import InputRenderer from "./InputRenderer"
import NumberRenderer from "./NumberRenderer"
import PickerRenderer from "./PickerRenderer"
import RadioRenderer from "./RadioRenderer"
import RateRenderer from "./RateRenderer"
import SelectorRenderer from "./SelectorRenderer"
import SliderRenderer from "./SliderRenderer"
import StepperRenderer from "./StepperRenderer"
import SwitchRenderer from "./SwitchRenderer"
import TextAreaRenderer from "./TextAreaRenderer"
import TextRenderer from "./TextRenderer"
import UploadRenderer from "./UploadRenderer"

import type { RendererRegistry } from "@jonhn/schema-form-core/core/rendererRegistry"

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
 * @param renderer - 渲染器注册表实例
 */
export const registerDefaultRenderers = (renderer: RendererRegistry): void => {
  renderer.register("input", InputRenderer)
  renderer.register("text", TextRenderer)
  renderer.register("textarea", TextAreaRenderer)
  renderer.register("number", NumberRenderer)
  renderer.register("switch", SwitchRenderer)
  renderer.register("radio", RadioRenderer)
  renderer.register("checkbox", CheckboxRenderer)
  renderer.register("date", DateRenderer)
  renderer.register("calendar", CalendarRenderer)
  renderer.register("picker", PickerRenderer)
  renderer.register("selector", SelectorRenderer)
  renderer.register("rate", RateRenderer)
  renderer.register("slider", SliderRenderer)
  renderer.register("stepper", StepperRenderer)
  renderer.register("upload", UploadRenderer)
  renderer.register("cascader", CascaderRenderer)
}

/**
 * 检查是否所有默认渲染器都已注册
 *
 * @param renderer - 渲染器注册表实例
 *
 * @returns 是否所有默认渲染器都已注册
 */
export const hasAllDefaultRenderers = (renderer: RendererRegistry): boolean => {
  return DEFAULT_RENDERER_TYPES.every((type) => renderer.hasRenderer(type))
}

/**
 * 获取缺失的默认渲染器类型
 *
 * @param renderer - 渲染器注册表实例
 *
 * @returns 缺失的渲染器类型列表
 */
export const getMissingDefaultRenderers = (renderer: RendererRegistry): string[] => {
  return DEFAULT_RENDERER_TYPES.filter((type) => !renderer.hasRenderer(type))
}
