/**
 * 开发阶段类型桩文件
 *
 * 确保 CustomRenderer 在 core 包独立编译时至少有一个键，
 * 避免 SchemxBaseField 因 `keyof CustomRenderer` 为 `never` 而坍塌。
 *
 * 消费者通过声明合并注册真实渲染器类型后，`__stub` 只是联合类型中多出的一个成员，
 * 不影响实际的 componentType 类型收窄。
 */
import type { CustomRenderer } from "./renderer"
import type { CustomRule } from "./rule"

declare module "./renderer" {
  interface CustomField {
    /** 开发阶段占位类型，确保 keyof CustomRenderer 不为 never */
    __stub: Record<string, any>
  }

  interface CustomRenderer {
    /** 开发阶段占位类型，确保 keyof CustomRenderer 不为 never */
    __stub: Record<string, any>
  }
}

declare module "./rule" {
  interface CustomRule {
    /** 开发阶段占位类型，确保 keyof CustomRule 不为 never */
    __stub: Record<string, any>
  }
}
