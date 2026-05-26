# @schemx/vue

基于 `@schemx/core` 的 Vue 3 动态表单适配层。

## Adapter 边界

Vue 适配层只负责把 core 暴露的 form instance 和 ViewSchemas 渲染成 Vue 组件树。descriptor 编译、dependency execution、dependencies 解析、validation bridge、scheduler 和 graph ownership 都由 `@schemx/core` 内部负责。

适配层不应直接 import `packages/core/src/engine`、`packages/core/src/graph`、`packages/core/src/field` 等 core 内部模块。

## Projection Consumption

Vue 渲染层默认通过 `form.getViewSchemas()` / `form.subscribeViewSchemas()` 消费 core 处理后的 schemas。字段组件接收到的 schema 已经包含 core 内部解析后的 `visible`、`readonly`、`disabled`、`required`、`placeholder`、`componentProps` 和 `rules`，因此 FormItem 不再重新执行 dependencies 或 dependency renderer。

```ts
const form = createForm({
  schemas,
})

await form.waitForDependencies()
const viewSchemas = form.getViewSchemas()
```

若需要注册 Vue 组件渲染器，使用 internal hooks：

```ts
form.getInternalHooks().registerRenderer("input", InputRenderer)
```
