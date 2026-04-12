/**
 * 开发阶段类型桩文件
 *
 * 确保 RendererDefinition 在 core 包独立编译时至少有一个键，
 * 避免 SchemaBaseColumnUnion 因 `keyof RendererDefinition` 为 `never` 而坍塌。
 *
 * 消费者通过声明合并注册真实渲染器类型后，`__stub` 只是联合类型中多出的一个成员，
 * 不影响实际的 componentType 类型收窄。
 */
import type { RendererDefinition } from "@schemx/core"
import type { RuleDefinition } from "@schemx/core"
import type { FieldDefinition } from "@schemx/core"

import type { UseDictionaryOptions } from "@/hooks/useDependency"

declare module "@schemx/core" {
  interface FieldDefinition {
    /** 字典数据请求配置，用于远程加载选项列表 */
    dict?: UseDictionaryOptions
  }
  // interface RendererDefinition {
  //   /** 开发阶段占位类型，确保 keyof RendererDefinition 不为 never */
  //   __stub: Record<string, any>
  // }

  // declare module "@schemx/core" {
  interface RuleDefinition {
    /** 开发阶段占位类型，确保 keyof RuleDefinition 不为 never */
    __stub: Record<string, any>
  }
}
