/**
 * 开发阶段类型桩文件
 *
 * 确保 CustomRendererMap 在 core 包独立编译时至少有一个键，
 * 避免 SchemaBaseField 因 `keyof CustomRendererMap` 为 `never` 而坍塌。
 *
 * 消费者通过声明合并注册真实渲染器类型后，`__stub` 只是联合类型中多出的一个成员，
 * 不影响实际的 component 类型收窄。
 */
import type { CustomRendererMap } from "./renderer"
import type { CustomRuleMap } from "./rule"

declare module "./renderer" {
  interface CustomRendererMap {
    /** 开发阶段占位类型，确保 keyof CustomRendererMap 不为 never */
    __stub: Record<string, any>
  }
}

declare module "./rule" {
  interface CustomRuleMap {
    /** 开发阶段占位类型，确保 keyof CustomRuleMap 不为 never */
    __stub: Record<string, any>
  }
}
