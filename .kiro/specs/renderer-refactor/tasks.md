# Implementation Plan: Renderer Refactor

## Overview

将 `createRegistry.ts` 和 `createRenderWrapper.ts` 的职责拆分清晰。Registry 成为纯注册中心，SchemaRenderer 承担所有渲染逻辑。

## Tasks

- [x] 1. 重构 Registry（移除渲染逻辑）
  - [x] 1.1 从 Registry 类中移除 render 方法
    - 删除 `render` 方法
    - 删除 `resolveRenderer` 私有方法
    - 删除 `createRenderConfig` 私有方法
    - 删除 `mergeSlots` 私有方法
    - 保留 `isRendererWrapper` 方法（供外部使用）
    - _Requirements: 1.11_
  - [x] 1.2 更新 ISchemaRegistry 接口
    - 从接口中移除 `render` 方法签名
    - _Requirements: 1.1-1.10, 8.1_
  - [x] 1.3 编写 Registry 属性测试
    - **Property 1: Registry register/get round-trip**
    - **Property 2: Registry unregister removes renderer**
    - **Property 3: Registry clear resets state**
    - **Property 4: Registry default type round-trip**
    - **Validates: Requirements 1.1-1.10**

- [x] 2. 创建 SchemaRenderer 类
  - [x] 2.1 定义 ISchemaRenderer 接口
    - 在 createRenderWrapper.ts 中定义接口
    - 包含 `render` 和 `getRegistry` 方法
    - _Requirements: 2.1, 2.2, 8.2_
  - [x] 2.2 实现 SchemaRenderer 类基础结构
    - 创建类，接收 Registry 实例
    - 实现 `getRegistry` 方法
    - _Requirements: 2.2_
  - [x] 2.3 实现 render 方法核心逻辑
    - 从 Registry 获取渲染器
    - 处理未注册类型的回退逻辑
    - 调用 Vue 的 h 函数创建 VNode
    - _Requirements: 2.3, 2.4, 2.5_
  - [x] 2.4 迁移 resolveRenderer 方法
    - 从 Registry 迁移到 SchemaRenderer
    - 支持 RendererWrapper、函数组件、对象组件
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.5 迁移 createRenderConfig 方法
    - 从 Registry 迁移到 SchemaRenderer
    - 解析动态 componentProps
    - 包含 formInstance 和 formItemProps
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4_
  - [x] 2.6 迁移 mergeSlots 方法
    - 从 Registry 迁移到 SchemaRenderer
    - 提取 fieldName:slotName 格式的插槽
    - 合并配置插槽和模板插槽
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 2.7 迁移 resolveDynamicProp 工具函数
    - 从 createRegistry.ts 迁移到 createRenderWrapper.ts
    - 处理函数类型和静态值
    - 错误处理和默认值
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Checkpoint - 确保 SchemaRenderer 实现完整
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 创建工厂函数和导出
  - [x] 4.1 创建 createSchemaRenderer 工厂函数
    - 接收 Registry 实例
    - 返回 SchemaRenderer 实例
    - _Requirements: 9.3_
  - [x] 4.2 更新 renderer/index.ts 导出
    - 导出 ISchemaRenderer 接口
    - 导出 createSchemaRenderer 函数
    - 保持现有导出不变
    - _Requirements: 8.4_
  - [x] 4.3 编写 SchemaRenderer 属性测试
    - **Property 5: Renderer resolves correct renderer with fallback**
    - **Property 6: Renderer applies transformProps correctly**
    - **Property 7: Renderer merges state with OR logic**
    - **Property 8: Renderer resolves dynamic props**
    - **Property 9: Renderer merges slots with correct priority**
    - **Validates: Requirements 2.3-2.5, 3.1-3.3, 4.1-4.2, 5.1-5.3, 6.1-6.3**

- [x] 5. 更新消费者代码
  - [x] 5.1 创建 useRenderer Hook
    - 创建 `src/hooks/useRenderer.ts`
    - 实现 `useRenderer` 函数：创建 Registry、注册默认渲染器、provide
    - 实现 `useRendererContext` 函数：inject Registry
    - 支持 `skipDefaults` 和 `setup` 选项
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 5.2 更新 SchemaForm.tsx
    - 使用 `useRenderer()` 替代直接创建 Registry
    - 移除 `createRegistry` 和 `registerDefaultRenderers` 的直接调用
    - _Requirements: 10.7_
  - [x] 5.3 更新 FormItem.tsx
    - 使用 `useRendererContext()` 替代 props 接收 Registry
    - 移除 `schemaRenderer` prop
    - _Requirements: 10.8, 9.4_
  - [x] 5.4 更新导出
    - 在 `src/hooks/index.ts` 中导出 useRenderer 和 useRendererContext
    - 确保 types/index.ts 中的类型正确导出
    - 添加 ISchemaRenderer 到类型导出
    - _Requirements: 8.2, 8.3_

- [ ] 6. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 确保向后兼容性
  - 如有问题请询问用户

## Notes

- 每个任务都引用了具体的需求以便追溯
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
