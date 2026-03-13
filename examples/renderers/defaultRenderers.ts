import type { Component } from "vue"

import { defineRenderers } from "schemaForm-core"

import { InputRenderer, NumberRenderer, TextAreaRenderer, TextRenderer } from "."

/**
 * 默认渲染器类型列表
 */
export const DEFAULT_RENDERER_TYPES = ["input", "text", "textarea", "number"] as const

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
 */
export const registerDefaultRenderers = (): void => {
  defineRenderers({
    input: InputRenderer,
    text: TextRenderer,
    textarea: TextAreaRenderer,
    number: NumberRenderer,
  })
}
