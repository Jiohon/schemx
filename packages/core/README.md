# @schemx/core

基于 JSON Schema 配置的 Vue 3 动态表单引擎（UI 无关核心）。

## Runtime 模块边界

- `compiler/`：负责 schema normalize、静态校验与 runtime node 编译决策。
- `runtime/`：负责 `Runtime` 装配、`RuntimeGraph` 结构 ownership、resolved schema、idle tracking、node factory，以及字段 runtime state / field lifecycle 基础设施。
- `engine/`：负责具体执行器，包括 field lifecycle 编排、dynamic prop 解析、dependency subtree 执行和 validation bridge。
- `scheduler/`：负责 runtime job 的 phase、dedupe、batch boundary 与 flush ownership。
- `validator/`：只负责 rules、errors 与 validate API，不直接依赖 runtime node。

框架适配层应通过 core public API、resolved schemas 和 internal hooks 中的稳定 runtime root 访问能力，不直接依赖 `engine/` 或 `runtime/graph` 内部实现。

## Runtime 公开入口

`createForm()` 仍保留以下公开入口，业务侧和适配层可以用它们消费 runtime 结果：

- `form.waitForDependencies()`：等待 dependency renderer 与 dependencies 解析完成。
- `form.getResolvedSchemas()`：读取 dependency 展开、dependencies 已解析后的 schema 列表。
- `form.getSchemas()`：`getResolvedSchemas()` 的兼容别名。
- `form.getRenderer()` / `form.registerRenderer()` / `form.hasRenderer()`：注册和查询渲染器。
- `form.getRule()` / `form.registerRule()` / `form.hasRule()`：注册和查询规则条目。

```ts
import { createForm } from "@schemx/core"

const form = createForm({
  initialValues: { mode: "simple" },
  schemas: [
    { componentType: "select", name: "mode", label: "模式" },
    {
      componentType: "dependency",
      to: ["mode"],
      renderer: async (values) =>
        values.mode === "advanced"
          ? [{ componentType: "input", name: "detail", label: "详情" }]
          : [],
    },
  ],
})

await form.waitForDependencies()
const schemas = form.getResolvedSchemas()
```

## Dependency 与 Dynamic Props

`dependency.renderer` 和 `dependencies.*` 条件函数可以返回同步值或 Promise。Runtime 会为每次触发维护独立版本；如果旧异步结果晚于新结果返回，旧结果会被丢弃，不会覆盖最新 resolved schema 或校验规则。

```ts
const schemas = [
  {
    componentType: "input",
    name: "email",
    label: "邮箱",
    dependencies: {
      triggerFields: ["mode"],
      componentProps: async (values) => ({
        clearable: values.mode === "advanced",
      }),
      rules: async (values) => (values.mode === "advanced" ? "required" : undefined),
    },
  },
]
```

本次 runtime type upgrade 是 core 内部 breaking change：不要依赖 `RuntimeNode` 的旧顶层字段，如 `node.field`、`node.loading`、`node.subtree`、`node.run` 或旧 `disposeBag.dispose()`。框架或调试工具需要 runtime tree 时，应从 `form.getInternalHooks().getRuntimeRoot()` 进入，并按 `fieldRuntime`、`dependencyRuntime` 和 `disposed.value` 读取新契约。
