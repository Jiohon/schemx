/**
 * 开发阶段类型桩文件
 *
 * 确保 CustomRenderer 在 core 包独立编译时至少有一个键，
 * 避免 SchemaBaseColumnUnion 因 `keyof CustomRenderer` 为 `never` 而坍塌。
 *
 * 消费者通过声明合并注册真实渲染器类型后，`__stub` 只是联合类型中多出的一个成员，
 * 不影响实际的 componentType 类型收窄。
 */
import type { CustomRenderer } from "@schemx/core"
import type { CustomRule } from "@schemx/core"
import type { CustomField } from "@schemx/core"

import type { UseDictionaryOptions } from "@/hooks/useDependency"

declare module "@schemx/core" {
  interface CustomField {
    /** 字典数据请求地址，用于远程加载选项列表 */
    dict: UseDictionaryOptions
  }
  interface CustomRenderer {
    /** 开发阶段占位类型，确保 keyof CustomRenderer 不为 never */
    __stub: Record<string, any>
  }
  // }

  // declare module "@schemx/core" {
  interface CustomRule {
    /** 开发阶段占位类型，确保 keyof CustomRule 不为 never */
    __stub: Record<string, any>
  }
}
