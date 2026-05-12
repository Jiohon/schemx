# @schemx/vue

基于 `@schemx/core` 的 Vue 3 动态表单适配层。

## Adapter 边界

Vue 适配层只负责把 core 暴露的 form instance、resolved schemas projection 和 runtime root 投影成 Vue 组件树。runtime 编译、dependency execution、dependencies 解析、validation bridge、scheduler 和 graph ownership 都由 `@schemx/core` 内部负责。

适配层不应直接 import `packages/core/src/engine` 或 `packages/core/src/runtime/graph`。

## Runtime Consumption

Vue 渲染层默认消费 `form.getResolvedSchemas()` 或 internal hooks 中的 runtime root。字段组件接收到的 schema 已经包含 core runtime 解析后的 `visible`、`readonly`、`disabled`、`required`、`placeholder`、`componentProps` 和 `rules`，因此 FormItem 不再重新执行 dependencies 或 dependency renderer。

```ts
const form = createForm({
  schemas,
})

await form.waitForDependencies()
const renderedSchemas = form.getResolvedSchemas()
```

若需要注册 Vue 组件渲染器，继续使用公开快捷方法：

```ts
form.registerRenderer("input", InputRenderer)
```
