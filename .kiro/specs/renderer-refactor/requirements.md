# Requirements Document

## Introduction

本文档定义了渲染器模块重构的需求。目标是将 `createRegistry.ts` 和 `createRenderWrapper.ts` 的职责拆分清晰，使 Registry 成为纯粹的注册中心，而 Renderer 承担所有渲染相关的逻辑。

## Glossary

- **Registry**: 渲染器注册中心，负责管理渲染器组件的注册、获取和移除
- **Renderer**: 渲染包装器，负责属性转换、状态合并、插槽处理和实际渲染
- **RendererWrapper**: 包含渲染器组件和属性转换函数的包装对象
- **DynamicProp**: 动态属性，可以是静态值或接收表单值返回属性值的函数
- **ColumnConfig**: 字段配置对象，定义表单字段的类型、属性和行为
- **SchemaFormInstance**: 表单实例，提供表单操作方法

## Requirements

### Requirement 1: Registry 纯注册功能

**User Story:** 作为开发者，我希望 Registry 只负责渲染器的注册和管理，以便职责单一、易于维护。

#### Acceptance Criteria

1. THE Registry SHALL provide a `register` method to register a single renderer with a type identifier
2. THE Registry SHALL provide a `registerAll` method to batch register multiple renderers
3. THE Registry SHALL provide a `getRenderer` method to retrieve a renderer by type (may return RendererWrapper)
4. THE Registry SHALL provide a `getRendererUnpack` method to retrieve the actual component (unwrapping RendererWrapper)
5. THE Registry SHALL provide a `hasRenderer` method to check if a renderer type is registered
6. THE Registry SHALL provide an `unregister` method to remove a renderer by type
7. THE Registry SHALL provide a `clear` method to remove all registered renderers
8. THE Registry SHALL provide a `getTypes` method to list all registered renderer types
9. THE Registry SHALL provide `setDefault` and `getDefault` methods to manage the default renderer type
10. THE Registry SHALL provide a `size` method to return the count of registered renderers
11. THE Registry SHALL NOT contain any render method or rendering-related logic

### Requirement 2: Renderer 渲染职责

**User Story:** 作为开发者，我希望 Renderer 承担所有渲染相关的逻辑，以便渲染行为集中管理。

#### Acceptance Criteria

1. THE Renderer SHALL provide a `render` method that accepts ColumnConfig, SchemaFormInstance, and Slots
2. THE Renderer SHALL accept a Registry instance to retrieve renderer components
3. WHEN rendering a field, THE Renderer SHALL resolve the renderer from Registry using the componentType
4. IF the componentType is not found in Registry, THEN THE Renderer SHALL use the default renderer type and log a warning
5. IF no renderer is found for the resolved type, THEN THE Renderer SHALL return null and log a warning

### Requirement 3: 属性转换

**User Story:** 作为开发者，我希望 Renderer 处理属性转换，以便渲染器可以自定义属性处理逻辑。

#### Acceptance Criteria

1. WHEN a RendererWrapper has a transformProps function, THE Renderer SHALL apply it to the ColumnConfig before rendering
2. WHEN a renderer is a plain Component without transformProps, THE Renderer SHALL pass the ColumnConfig unchanged
3. THE Renderer SHALL support nested renderer object format with optional transformProps

### Requirement 4: 状态合并

**User Story:** 作为开发者，我希望 Renderer 合并表单级和字段级的状态，以便状态管理一致。

#### Acceptance Criteria

1. THE Renderer SHALL merge readonly state from props, formItemProps, and form context using OR logic
2. THE Renderer SHALL merge disabled state from props, formItemProps, and form context using OR logic
3. THE Renderer SHALL retrieve field error from form context

### Requirement 5: 动态属性解析

**User Story:** 作为开发者，我希望 Renderer 解析动态属性，以便属性可以根据表单值动态变化。

#### Acceptance Criteria

1. WHEN componentProps is a function, THE Renderer SHALL call it with current form values to get resolved props
2. WHEN componentProps is a static object, THE Renderer SHALL use it directly
3. IF componentProps is null or undefined, THE Renderer SHALL use an empty object as default
4. IF evaluating a dynamic prop throws an error, THEN THE Renderer SHALL catch the error, log it, and return the default value

### Requirement 6: 插槽合并

**User Story:** 作为开发者，我希望 Renderer 合并配置插槽和模板插槽，以便灵活定制渲染内容。

#### Acceptance Criteria

1. THE Renderer SHALL extract field-specific slots from parent slots using "fieldName:slotName" format
2. THE Renderer SHALL merge field-specific slots with componentProps.slots
3. WHEN both sources have the same slot name, THE Renderer SHALL prioritize componentProps.slots (config slots override template slots)

### Requirement 7: 渲染配置创建

**User Story:** 作为开发者，我希望 Renderer 创建完整的渲染配置，以便渲染器组件接收所有必要的属性。

#### Acceptance Criteria

1. THE Renderer SHALL create render config containing resolved componentProps
2. THE Renderer SHALL include formInstance in render config
3. THE Renderer SHALL include formItemProps (column config excluding componentProps) in render config
4. IF the column is a DependencyColumnConfig, THEN THE Renderer SHALL return null and log a warning

### Requirement 8: 类型定义调整

**User Story:** 作为开发者，我希望类型定义位置合理，以便导入路径清晰。

#### Acceptance Criteria

1. THE ISchemaRegistry interface SHALL remain in createRegistry.ts and be exported
2. THE ISchemaRenderer interface SHALL be defined in createRenderWrapper.ts
3. THE RendererWrapper and RendererMap types SHALL be defined in types/index.ts
4. THE renderer/index.ts SHALL export both createRegistry and createRenderWrapper with their interfaces

### Requirement 9: 向后兼容

**User Story:** 作为开发者，我希望重构后的 API 保持向后兼容，以便现有代码无需大量修改。

#### Acceptance Criteria

1. THE createRegistry function signature SHALL remain unchanged
2. THE createRenderWrapper function SHALL continue to return RendererWrapper
3. WHEN migrating existing code, THE consumer SHALL be able to create a Renderer instance with a Registry instance
4. THE FormItem component SHALL be updated to use Renderer.render instead of Registry.render

### Requirement 10: useRenderer Hook

**User Story:** 作为开发者，我希望通过 Hook 方式创建和提供渲染器注册中心，以便解耦 Registry 的生命周期管理，并支持自定义渲染器注册。

#### Acceptance Criteria

1. THE useRenderer hook SHALL create a Registry instance and register default renderers
2. THE useRenderer hook SHALL accept an options object with optional `skipDefaults` boolean to skip default renderer registration
3. THE useRenderer hook SHALL accept an optional `setup` callback that receives the Registry instance for custom registration
4. THE useRenderer hook SHALL provide the Registry instance via Vue's provide/inject mechanism
5. THE useRendererContext hook SHALL retrieve the Registry instance from the inject context
6. THE useRendererContext hook SHALL throw an error if called outside of a useRenderer provider
7. THE SchemaForm component SHALL use useRenderer instead of directly creating Registry
8. THE FormItem component SHALL use useRendererContext instead of receiving Registry via props
