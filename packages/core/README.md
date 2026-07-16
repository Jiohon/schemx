# @schemx/core

框架无关的 Schema 驱动表单核心。它处理表单状态、字段依赖、校验、Schema 更新和可渲染 ViewSchemas，不绑定任何 UI 框架。

`@schemx/core` 适合用来构建 Vue、React、小程序、低代码表单、动态问卷、配置化后台表单等上层适配器。

## 为什么使用

- **Headless core**：核心不渲染 DOM，通过表单实例、ViewSchemas 和 renderer/rule registry 提供能力。
- **Schema driven**：用 `schemas` 描述字段、分组、动态依赖和渲染器类型。
- **细粒度响应式**：字段级依赖追踪，`effect` 与字段 / 字段组 Watch 响应实际读取的字段；全表 Watch 的当前限制见后文。
- **Standard Schema 校验**：可直接接入 Zod、Valibot、ArkType 等实现 Standard Schema 的验证库。
- **动态表单优先**：支持字段动态属性、动态子树、异步 dependency renderer 和依赖完成等待。
- **TypeScript 优先**：字段路径、schema、renderer props 和表单值类型可逐步收窄。
- **适配器友好**：通过 `getViewSchemas()` / `subscribeViewSchemas()` 给 UI 层消费稳定的渲染投影。

## 安装

```bash
pnpm add @schemx/core
```

```bash
npm install @schemx/core
```

```bash
yarn add @schemx/core
```

如果需要使用 Zod、Valibot、ArkType 等校验库，请在业务项目中额外安装对应依赖。

## 快速开始

```ts
import { createForm } from "@schemx/core"
import { z } from "zod"

type LoginValues = {
  email: string
  password: string
}

const form = createForm<LoginValues>({
  initialValues: {
    email: "",
    password: "",
  },
  onFinish(values) {
    console.log("submit:", values)
  },
  onFinishFailed(error) {
    console.log("errors:", error.errors)
  },
})

form.registerRules("email", z.string().email("请输入正确的邮箱"))
form.registerRules("password", z.string().min(6, "密码至少 6 位"))

form.setFieldValue("email", "hello@example.com")
form.setFieldValue("password", "123456")

await form.submit()

form.destroy()
```

## Schema 完整语法

`schemas` 的元素类型是 `SchemxField<TValues>`，可以是普通字段、分组（Group）或动态子树（Dependency）。Core 不提供默认导出；本节示例均从包根入口使用命名导出。

```ts
import { createForm, createSchemas } from "@schemx/core"

type UserValues = {
  name: string
  email: string
}

const form = createForm<UserValues>({
  initialValues: {
    name: "",
    email: "",
  },
  schemas: createSchemas<UserValues>([
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      rules: "required",
      placeholder: "请输入姓名",
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      rules: ["required"],
      placeholder: "请输入邮箱",
    },
  ]),
})

const viewSchemas = form.getViewSchemas()
```

### 普通字段 Schema

普通字段对应 `SchemxBase<TValues, TKey>` / `SchemxBaseField<TValues>`。`name`、`label`、`componentType` 是仅有的必填字段。

| 字段                  | 类型                                                                  | 必填 | 说明                                                                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`                 | `string`                                                              | 否   | ViewSchema 的稳定标识。未设置时 Core 会生成位置 key，但不会修改传入的 Raw Schema。动态插入、删除或排序时建议业务显式配置稳定 key。                                                                                                                                             |
| `name`                | `NamePath<TValues>`                                                   | 是   | 字段路径，支持 `"user.name"` 等字符串路径及类型安全的深层路径。                                                                                                                                                                                                                |
| `label`               | `string`                                                              | 是   | 字段标签。                                                                                                                                                                                                                                                                     |
| `componentType`       | `TKey`                                                                | 是   | 渲染器键；声明合并 `SchemxRendererDefinition` 后可收窄可选值及 `componentProps`。                                                                                                                                                                                              |
| `dependencies`        | `SchemxDependencies<TValues>`                                         | 否   | 结构化动态属性配置，详见下文。                                                                                                                                                                                                                                                 |
| `componentProps`      | `SchemxComponentProps<TValues, TKey>`                                 | 否   | 渲染组件的静态 Props。Core 会组合渲染器专属 Props 与公共 Props。                                                                                                                                                                                                               |
| `placeholder`         | `string`                                                              | 否   | 静态占位文本。                                                                                                                                                                                                                                                                 |
| `required`            | `boolean`                                                             | 否   | 是否显示必填标记；未显式设置时还会根据 `rules` 推断。默认 `false`。                                                                                                                                                                                                            |
| `readonly`            | `boolean`                                                             | 否   | 是否只读。默认 `false`。                                                                                                                                                                                                                                                       |
| `readonlyPlaceholder` | `string`                                                              | 否   | 只读且字段值为空时使用的占位文本。规范化时 `componentProps.readonlyPlaceholder` 优先于该顶层值；合并结果会同时进入规范化字段和组件 Props。Core 只传递该值，是否及如何显示由渲染器决定。                                                                                        |
| `disabled`            | `boolean`                                                             | 否   | 是否禁用。默认 `false`。                                                                                                                                                                                                                                                       |
| `visible`             | `boolean`                                                             | 否   | 是否可见。不可见时不渲染，并清除规则和错误。默认 `true`。                                                                                                                                                                                                                      |
| `initialValue`        | `FieldValue<TValues, NamePath<TValues>>`                              | 否   | 类型源码注释将其描述为 `reset()` 的还原目标，但当前运行时行为与该描述存在偏差：字段首次挂载且当前值为 `undefined` 时，它只写入当前值，不更新 Store 的初始值基准，并会相对现有基准重新计算 touched。需要控制 `reset()` 目标时，请使用 `initialValues` 或 `setInitialValues()`。 |
| `rules`               | `SchemxRules \| SchemxRules[]`                                        | 否   | Standard Schema、内置规则名或经声明合并注册的规则名。内置规则为 `required`、`selectRequired`、`uploadRequired`。                                                                                                                                                               |
| `labelIcon`           | `string`                                                              | 否   | 标签旁的图标标识。默认空字符串。                                                                                                                                                                                                                                               |
| `labelAlign`          | `"left" \| "center" \| "right"`                                       | 否   | 标签对齐方式。默认 `left`。                                                                                                                                                                                                                                                    |
| `labelPosition`       | `"left" \| "top" \| "right"`                                          | 否   | 标签位置。默认 `left`。                                                                                                                                                                                                                                                        |
| `labelWidth`          | `string`                                                              | 否   | 标签宽度。默认 `auto`。                                                                                                                                                                                                                                                        |
| `contentAlign`        | `"left" \| "center" \| "right"`                                       | 否   | 内容区域对齐方式。默认 `right`。                                                                                                                                                                                                                                               |
| `colon`               | `boolean`                                                             | 否   | 是否在标签后显示冒号。默认 `true`。                                                                                                                                                                                                                                            |
| `validationTrigger`   | `ValidationTrigger \| ValidationTrigger[]`                            | 否   | 校验触发时机，支持 `onBlur` / `blur`、`onChange` / `change`、`onSubmit` / `submit`。默认 `blur`。                                                                                                                                                                              |
| `onChange`            | `(value: FieldValue<TValues>, form: SchemxInstance<TValues>) => void` | 否   | 交给 UI 适配层消费的字段值变化处理函数；Core 本身不产生 UI 事件。                                                                                                                                                                                                              |
| `onBlur`              | `(form: SchemxInstance<TValues>) => void`                             | 否   | 交给 UI 适配层消费的字段失焦处理函数；Core 本身不产生 UI 事件。                                                                                                                                                                                                                |

以下名称常见于 UI 适配层，但不是当前 Core `SchemxBase` 的内置字段：

| 名称              | 类型   | 必填 | 当前 Core 中的对应方式                                           |
| ----------------- | ------ | ---- | ---------------------------------------------------------------- |
| `description`     | 未定义 | 否   | 未内置；可通过 TypeScript 声明合并扩展 `SchemxFieldDefinition`。 |
| `class`           | 未定义 | 否   | 未内置；可声明合并，或按渲染器约定放入 `componentProps`。        |
| `style`           | 未定义 | 否   | 未内置；可声明合并，或按渲染器约定放入 `componentProps`。        |
| `validateTrigger` | 未定义 | 否   | 字段名是 `validationTrigger`，不是 `validateTrigger`。           |

`SchemxFieldDefinition` 是公开的空扩展接口。自定义字段会保留在普通字段的静态 Schema 与 ViewSchema 中：

```ts
import type { CSSProperties } from "@schemx/core"

declare module "@schemx/core" {
  interface SchemxFieldDefinition {
    description?: string
    class?: string
    style?: CSSProperties
  }
}
```

顶层 `readonlyPlaceholder` 与 `componentProps.readonlyPlaceholder` 是两个配置入口。两者同时存在时，组件 Props 中的值优先：

```ts
import { createForm } from "@schemx/core"

const form = createForm({
  schemas: [
    {
      name: "companyName",
      label: "企业名称",
      componentType: "input",
      readonly: true,
      readonlyPlaceholder: "顶层只读占位文本",
      componentProps: {
        readonlyPlaceholder: "组件 Props 只读占位文本",
      },
    },
  ],
})
```

上例最终传给渲染器的是 `"组件 Props 只读占位文本"`。如果只配置顶层字段，Core 会把顶层值同步注入组件 Props。

### `Dynamic<T, V>`

`Dynamic<T, V>` 是公开工具类型：

```ts
type Dynamic<T, V extends Values = Values> = T | ((values: V) => T | Promise<T>)
```

它表示静态值，或接收当前表单值并返回同步/异步结果的函数。当前普通字段的内置属性并未直接声明为 `Dynamic`；字段联动应使用 `dependencies`，动态子树应使用 `componentType: "dependency"`。业务方扩展 `SchemxFieldDefinition` 时也可以复用此类型。

### Group Schema

Group 对应 `SchemxGroupField<TValues>`，用于组织嵌套字段。

| 字段                | 类型                                   | 必填 | 说明                                                                                  |
| ------------------- | -------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `key`               | `string`                               | 否   | 稳定身份；未设置时由 Core 为 Descriptor 和 ViewSchema 生成，不修改传入的 Raw Schema。 |
| `label`             | `string`                               | 是   | 分组标签。                                                                            |
| `componentType`     | `"group"`                              | 是   | 固定值。                                                                              |
| `children`          | `SchemxField<TValues>[]`               | 是   | 子字段、子分组或子 Dependency 列表。                                                  |
| `visible`           | `boolean`                              | 否   | 是否显示整棵子树；隐藏时后代停止校验并清空错误，但保留字段值。                        |
| `readonly`          | `boolean`                              | 否   | 是否强制后代字段只读。                                                                |
| `disabled`          | `boolean`                              | 否   | 是否强制后代字段禁用。                                                                |
| `dependencies`      | `SchemxContainerDependencies<TValues>` | 否   | 根据表单值动态覆盖 `visible`、`readonly`、`disabled`。                                |
| `collapsible`       | `boolean`                              | 否   | 是否允许折叠。                                                                        |
| `defaultCollapsed`  | `boolean`                              | 否   | 非受控模式下的初始折叠状态。                                                          |
| `collapsed`         | `boolean`                              | 否   | 受控折叠状态。                                                                        |
| `onCollapsedChange` | `(collapsed: boolean) => void`         | 否   | 用户切换折叠状态后的回调。                                                            |
| `destroyOnCollapse` | `boolean`                              | 否   | 折叠时是否卸载后代 Renderer，默认 `true`。                                            |

`SchemxGroupFieldDefinition` 也是可通过声明合并扩展的公开空接口。

```ts
import { createForm } from "@schemx/core"

const form = createForm({
  schemas: [
    {
      componentType: "group",
      label: "基础信息",
      dependencies: {
        triggerFields: ["editable"],
        readonly: (values) => !values.editable,
      },
      children: [
        { name: "name", label: "姓名", componentType: "input" },
        { name: "phone", label: "手机号", componentType: "input" },
      ],
    },
  ],
})
```

### Dependency Schema

Dependency 对应 `SchemxDependencyField<TValues, TNames>`，根据依赖字段生成一段动态子树。

| 字段            | 类型                                                                                   | 必填 | 说明                                                                     |
| --------------- | -------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `key`           | `string`                                                                               | 否   | 稳定身份；未设置时由 Core 生成，不修改传入的 Raw Schema。                |
| `componentType` | `"dependency"`                                                                         | 是   | 固定值。                                                                 |
| `to`            | `TNames`                                                                               | 是   | 触发重新执行结构 `renderer` 的字段路径列表。                             |
| `renderer`      | `(values, form, context) => SchemxField<TValues>[] \| Promise<SchemxField<TValues>[]>` | 是   | 同步或异步生成子 Schema。                                                |
| `visible`       | `boolean`                                                                              | 否   | 是否呈现动态子树；隐藏时 `renderer` 仍继续响应 `to`。                    |
| `readonly`      | `boolean`                                                                              | 否   | 是否强制动态子树中的字段只读。                                           |
| `disabled`      | `boolean`                                                                              | 否   | 是否强制动态子树中的字段禁用。                                           |
| `dependencies`  | `SchemxContainerDependencies<TValues>`                                                 | 否   | 独立于 `to` 的状态依赖，用于动态覆盖 `visible`、`readonly`、`disabled`。 |

泛型参数 `TNames` 的约束是 `TNames extends readonly NamePath<TValues>[]`，因此 `to` 必须是只读或可变的字段路径数组。

容器状态采用统一的继承规则：`visible` 与祖先状态做逻辑与，`readonly` 和 `disabled` 与祖先状态做逻辑或。后代字段不能通过显式 `false` 解除祖先 Group 或 Dependency 的约束。

Dependency 的 `to` 只负责结构更新，`dependencies.triggerFields` 只负责状态更新。即使二者监听相同字段，也需要分别显式声明。`visible=false` 不会暂停结构 renderer；恢复可见后会直接展示最新动态子树。

`renderer` 的参数如下：

| 参数      | 类型                           | 说明                                                                   |
| --------- | ------------------------------ | ---------------------------------------------------------------------- |
| `values`  | `TValues`                      | 执行时的完整表单值。                                                   |
| `form`    | 精简表单 API                   | 包含值、快照、重置、pending、touched、校验和错误操作；可用成员见下表。 |
| `context` | `{ abortSignal: AbortSignal }` | 执行上下文。`abortSignal` 用于取消过期的异步工作。                     |

这里的 `form` 不是完整的 `SchemxInstance`，其可用成员如下。这个精简 API 的类型名未从包根入口导出，无需也不能从 `@schemx/core` 单独导入：

| 成员            | 签名                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| `setValue`      | `<TName>(name: TName, value: FieldValue<TValues, TName> \| undefined) => void` |
| `setValues`     | `(values: Partial<TValues>) => void`                                           |
| `getValue`      | `<TName>(name: TName) => FieldValue<TValues, TName> \| undefined`              |
| `getValues`     | `() => TValues`；`(names?: TName[]) => Partial<TValues>`                       |
| `getSnapshots`  | `(names?: TName[]) => Partial<TValues>`                                        |
| `resetFields`   | `(names: TName[]) => void`                                                     |
| `reset`         | `() => void`                                                                   |
| `setPending`    | `(name: TName, pending: boolean) => void`                                      |
| `isPending`     | `(name: TName) => boolean`                                                     |
| `setTouched`    | `(name: TName, value: boolean) => void`                                        |
| `isTouched`     | `(name: TName) => boolean`                                                     |
| `validateField` | `(name: TName) => Promise<ValidateResult<TValues>>`                            |
| `validate`      | `() => Promise<ValidateResult<TValues>>`                                       |
| `setError`      | `(name: TName, errors: string[]) => void`                                      |
| `getError`      | `(name: TName) => string[] \| undefined`                                       |

同一 Dependency 因依赖值变化而开始新一轮执行，或该 Dependency 被销毁时，上一轮的 `abortSignal` 会进入 aborted 状态。异步任务应把它传给支持取消的 API，并自行避免吞掉非取消错误。

同步示例：

```ts
import { createForm } from "@schemx/core"

type SurveyValues = {
  mode: "simple" | "advanced"
  detail?: string
}

const form = createForm<SurveyValues>({
  initialValues: { mode: "simple" },
  schemas: [
    { name: "mode", label: "模式", componentType: "select" },
    {
      componentType: "dependency",
      to: ["mode"],
      renderer(values, formApi) {
        if (values.mode !== "advanced") return []

        formApi.setTouched("detail", false)
        return [{ name: "detail", label: "详情", componentType: "input" }]
      },
    },
  ],
})

await form.waitForDependencies()
```

异步示例：

```ts
import { createForm } from "@schemx/core"

const form = createForm({
  schemas: [
    {
      componentType: "dependency",
      to: ["category"],
      async renderer(values, _form, { abortSignal }) {
        const response = await fetch(`/api/forms/${values.category}`, {
          signal: abortSignal,
        })
        return response.json()
      },
    },
  ],
})

const ready = await form.waitForDependencies(5_000)
if (!ready) console.warn("依赖解析超时")
```

`waitForDependencies(timeout?)` 等待当前已调度的字段依赖和 Dependency renderer 完成，默认超时为 `10_000 ms`；全部完成返回 `true`，超时返回 `false`。`submit()` 会先用相同机制等待依赖；等待超时会直接结束，不执行校验和提交回调。

### `SchemxDependencies`

普通字段的 `dependencies` 共享一组 `triggerFields`，用于动态覆盖该字段的呈现属性。

| 字段                  | 类型                                                                                  | 必填 | 说明                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `triggerFields`       | `NamePath<TValues>[]`                                                                 | 是   | 依赖字段路径。至少提供 1 个路径才会创建依赖监听。                                                                                                         |
| `componentProps`      | `SchemxConditionFn<TValues, SchemxComponentProps>`                                    | 否   | 动态组件 Props。                                                                                                                                          |
| `placeholder`         | `SchemxConditionFn<TValues, string>`                                                  | 否   | 动态占位文本。                                                                                                                                            |
| `required`            | `SchemxConditionFn<TValues, boolean>`                                                 | 否   | 动态必填标记。                                                                                                                                            |
| `readonly`            | `SchemxConditionFn<TValues, boolean>`                                                 | 否   | 动态只读状态。                                                                                                                                            |
| `readonlyPlaceholder` | `SchemxConditionFn<TValues, NonNullable<SchemxBase<TValues>["readonlyPlaceholder"]>>` | 否   | 动态计算顶层只读占位文本。执行异常或返回空值时，解析结果为 `undefined`。当前实现会触发并解析该函数，但结果尚未进入最终 ViewSchema，暂不会动态覆盖静态值。 |
| `disabled`            | `SchemxConditionFn<TValues, boolean>`                                                 | 否   | 动态禁用状态。                                                                                                                                            |
| `visible`             | `SchemxConditionFn<TValues, boolean>`                                                 | 否   | 动态可见状态。                                                                                                                                            |
| `rules`               | `SchemxConditionFn<TValues, SchemxRules \| SchemxRules[] \| undefined>`               | 否   | 动态校验规则。                                                                                                                                            |
| `trigger`             | `SchemxConditionFn<TValues, void>`                                                    | 否   | 与属性解析并行执行的副作用函数。                                                                                                                          |

`SchemxConditionFn<T, R>` 接收当前值 `values` 和上表所示的精简表单 API，返回 `R | Promise<R>`。依赖监听创建后会先执行 1 次；任一 `triggerFields` 值变化时重新执行。已配置的属性函数通过 `Promise.all` 并行解析，`trigger` 与整组属性解析也并行执行。新一轮结果优先，过期的异步结果不会覆盖最新状态。属性函数抛错时 Core 会记录错误并令该项回退到静态值；`trigger` 抛错只记录错误，不阻断其他属性解析。

下面的示例同时覆盖 `visible`、`required`、`rules` 和 `componentProps`：

```ts
import { createForm } from "@schemx/core"

type AccountValues = {
  accountType: "personal" | "company"
  companyName?: string
}

const form = createForm<AccountValues>({
  initialValues: { accountType: "personal", companyName: "" },
  schemas: [
    { name: "accountType", label: "账号类型", componentType: "select" },
    {
      name: "companyName",
      label: "企业名称",
      componentType: "input",
      componentProps: { readonlyPlaceholder: "暂无企业名称" },
      dependencies: {
        triggerFields: ["accountType"],
        visible: (values) => values.accountType === "company",
        required: (values) => values.accountType === "company",
        readonlyPlaceholder: (values) =>
          values.accountType === "company" ? "暂无企业名称" : "不适用",
        rules: (values) => (values.accountType === "company" ? ["required"] : undefined),
        componentProps: async (values) => ({
          readonlyPlaceholder:
            values.accountType === "company" ? "暂无企业名称" : "不适用",
        }),
      },
    },
  ],
})

await form.waitForDependencies()
```

这里的 `dependencies.readonlyPlaceholder` 会在初始化及 `accountType` 变化时执行，并遵循最新异步结果优先、异常或空值解析为 `undefined` 的通用规则。不过，当前运行时尚未把该解析结果合并进最终 ViewSchema，因此示例中的动态顶层值暂不生效；`componentProps.readonlyPlaceholder` 仍按组件 Props 的既有路径生效。

## 创建表单

`createForm<TValues>(options?)` 是 Core 唯一的表单装配入口，返回 `SchemxInstance<TValues>`。它是命名导出，不存在默认导出。

### `CreateFormOptions`

`CreateFormOptions<TValues, TName>` 的所有字段均可选。字段规范化通常按“字段配置 → 表单级默认配置 → Core 固定默认值”合并；`required` 是例外，字段未显式配置且存在非空 `rules` 时会优先推导为 `true`。

| 字段                  | 类型                                                                                                | 说明                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `schemas`             | `SchemxSchemasInput<TValues>`                                                                       | 静态 Schema 数组或 `createSchemas()` 返回的可更新 Schema source；Dependency 会在运行时展开。                              |
| `initialValues`       | `TValues`                                                                                           | 表单初始值与 `reset()` 基准。输入会被深拷贝。                                                                             |
| `modelValue`          | `TValues`                                                                                           | 创建时合并到 `initialValues`，同名顶层键覆盖后者；当前选项只用于初始化，不会建立后续双向受控同步。                        |
| `rendererRegistry`    | `RendererRegistryType`                                                                              | 当前实例使用的渲染器注册表；省略时创建实例私有注册表。                                                                    |
| `defaultRendererType` | `SchemxRendererKey`                                                                                 | 创建默认渲染器注册表时设置回退类型；仅当未传 `rendererRegistry` 时参与该注册表的创建。                                    |
| `validatorRegistry`   | `ValidatorsRegistryType`                                                                            | 当前实例使用的规则注册表；省略时创建实例私有注册表。Core 会用 `registerAll()` 注册 3 个内置规则，并覆盖传入表中的同名项。 |
| `required`            | `boolean`                                                                                           | 表单级必填默认值；字段未显式配置且存在非空 `rules` 时，规则推导优先。                                                     |
| `readonly`            | `boolean`                                                                                           | 表单级只读默认值；字段自身配置优先。                                                                                      |
| `disabled`            | `boolean`                                                                                           | 表单级禁用默认值；字段自身配置优先。                                                                                      |
| `visible`             | `boolean`                                                                                           | 表单级可见性默认值；字段自身配置优先，均未配置时为 `true`。                                                               |
| `labelIcon`           | `string`                                                                                            | 表单级标签图标默认值。                                                                                                    |
| `labelAlign`          | `"left" \| "center" \| "right"`                                                                     | 表单级标签对齐默认值；字段自身配置优先。                                                                                  |
| `labelPosition`       | `"left" \| "top" \| "right"`                                                                        | 表单级标签位置默认值；字段自身配置优先。                                                                                  |
| `labelWidth`          | `string`                                                                                            | 表单级标签宽度默认值；字段自身配置优先。                                                                                  |
| `contentAlign`        | `"left" \| "center" \| "right"`                                                                     | 表单级内容对齐默认值；字段为只读时会强制使用 `right`。                                                                    |
| `validationTrigger`   | `ValidationTrigger \| ValidationTrigger[]`                                                          | 表单级校验触发时机默认值；字段自身配置优先。                                                                              |
| `colon`               | `boolean`                                                                                           | 表单级标签冒号默认值；字段自身配置优先。                                                                                  |
| `onFinish`            | `(values: Readonly<TValues>) => void \| Promise<void>`                                              | `submit()` 等待依赖并校验成功后调用；`submit()` 会等待其 Promise。                                                        |
| `onFinishFailed`      | `(error: ValidateError<TValues>) => void`                                                           | `submit()` 校验失败后调用；依赖等待超时不会调用。                                                                         |
| `onValuesChange`      | `(changedValues: Readonly<Partial<TValues>>, latestSnapshot: Readonly<TValues> \| TValues) => void` | 初始装配不调用；值快照发生叶子路径变化后调用。参数分别是本轮变化片段和最新的非响应式快照。                                |
| `onFieldsChange`      | `(changedFields: TName[], allFields: TName[]) => void`                                              | 与 `onValuesChange` 同一条件触发。参数分别是本轮变化的叶子路径、当前所有已知值的叶子路径。                                |
| `lifecycleHooks`      | 生命周期钩子对象                                                                                    | 高级内部观察入口。其具体类型和回调参数类型未从包根入口导出，不应依赖观察值的内部形状。                                    |

`schemas` 省略时等价于空列表，`initialValues` 省略时等价于空对象。字段 Schema 的显式值始终优先于表单级默认配置。

回调的调用条件与参数可进一步归纳如下：

| 回调             | 参数                              | 调用条件                                                                           |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `onFinish`       | `values`：校验成功的只读值        | `submit()` 等待依赖成功且全表校验通过。异步返回值会被等待。                        |
| `onFinishFailed` | `error`：`ValidateError<TValues>` | `submit()` 等待依赖成功但全表校验失败，包括存在 pending 字段的情况。               |
| `onValuesChange` | `changedValues`、`latestSnapshot` | 初始化不调用；当前值相对上一快照存在叶子路径变化时调用。批处理中的多次写入会合并。 |
| `onFieldsChange` | `changedFields`、`allFields`      | 与 `onValuesChange` 同时触发；前者是变化叶子路径，后者是当前值中的全部叶子路径。   |

### 完整创建示例

```ts
import {
  createForm,
  createRendererRegistry,
  createSchemas,
  createValidatorsRegistry,
} from "@schemx/core"

type ProfileValues = {
  name: string
  email: string
}

const schemas = createSchemas<ProfileValues>([
  { name: "name", label: "姓名", componentType: "input", rules: "required" },
  { name: "email", label: "邮箱", componentType: "input" },
])

const form = createForm<ProfileValues>({
  schemas,
  initialValues: { name: "", email: "" },
  rendererRegistry: createRendererRegistry("input"),
  validatorRegistry: createValidatorsRegistry(),
  validationTrigger: ["change", "blur"],
  onValuesChange(changedValues, latestSnapshot) {
    console.log(changedValues, latestSnapshot)
  },
  onFieldsChange(changedFields, allFields) {
    console.log(changedFields, allFields)
  },
  async onFinish(values) {
    await saveProfile(values)
  },
  onFinishFailed(error) {
    console.error(error.errors)
  },
})
```

## 表单实例 API

`SchemxInstance<TValues>` 的全部公开成员按职责列于下文。签名均以当前源码为准。

### 值与快照

| 成员                | 签名                                                                           | 说明                                                                             |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `getFieldValue`     | `<TName>(name: TName) => FieldValue<TValues, TName> \| undefined`              | 读取字段响应式值；在 `effect` 中调用会建立依赖。                                 |
| `getFieldsValue`    | `() => TValues`；`(names: TName[]) => Partial<TValues>`                        | 读取全部或指定字段的响应式值集合；返回每次组装的新对象，内部字段读取会建立依赖。 |
| `setFieldValue`     | `<TName>(name: TName, value: FieldValue<TValues, TName> \| undefined) => void` | 写入单个字段，并按当前值与初始值的深比较更新 touched。                           |
| `setFieldsValue`    | `(values: Partial<TValues>) => void`                                           | 按叶子路径批量写入，并批处理响应式通知。                                         |
| `getFieldSnapshot`  | `<TName>(name: TName) => FieldValue<TValues, TName> \| undefined`              | 不建立响应式依赖，读取字段当前快照。                                             |
| `getFieldsSnapshot` | `() => TValues`；`(paths: TName[]) => Partial<TValues>`                        | 不建立响应式依赖，返回全部或指定字段组装成的普通对象快照。                       |

### 初始值

| 成员               | 签名                                                              | 说明                                                                                                                          |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `getInitialValue`  | `<TName>(name: TName) => FieldValue<TValues, TName> \| undefined` | 返回字段初始值。                                                                                                              |
| `getInitialValues` | `() => Partial<TValues>`；`(paths: TName[]) => Partial<TValues>`  | 无参调用返回全部初始值的深拷贝。传入 `paths` 时会重建外层结果，但嵌套值可能仍保留内部引用；请把返回值视为只读，不要直接修改。 |
| `setInitialValues` | `(values: Partial<TValues>) => void`                              | 按叶子路径更新初始值基准；不会把当前值强制改成新初始值，但会重新计算 touched。                                                |

### Touched 与 Pending

| 成员               | 签名                                                                           | 说明                                                                                 |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `isFieldTouched`   | `<TName>(name: TName) => boolean`                                              | 读取字段 touched 状态；该状态默认由当前值与初始值深比较得出。                        |
| `setFieldTouched`  | `<TName>(name: TName, value: boolean) => void`                                 | 手动设置 touched。                                                                   |
| `getTouchedFields` | `() => NamePath<TValues>[]`                                                    | 返回全部 touched 字段路径。                                                          |
| `setFieldPending`  | `<TName>(name: TName, pending: boolean, message?: string \| string[]) => void` | 设置异步处理中状态及可选提示。                                                       |
| `isFieldPending`   | `<TName>(name: TName) => boolean`                                              | 读取字段 pending 状态。                                                              |
| `getPendingFields` | `() => Array<{ field: NamePath<TValues>; message: string[] }>`                 | 返回 pending 字段及提示列表。存在 pending 字段时，全表校验会直接失败并写入对应错误。 |

### 校验与错误

| 成员              | 签名                                                                                         | 说明                                                             |
| ----------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `validateField`   | `<TName>(name: TName) => Promise<ValidateResult<TValues>>`                                   | 校验单个字段。                                                   |
| `validate`        | `() => Promise<ValidateResult<TValues>>`                                                     | 校验全部已注册字段；调用有并发锁，pending 字段会使校验直接失败。 |
| `getFieldError`   | `<TName>(name: TName) => string[] \| undefined`                                              | 读取字段错误；可在 `effect` 中建立依赖。                         |
| `setFieldError`   | `<TName>(name: TName, errors: string[]) => void`                                             | 手动设置字段错误。                                               |
| `registerRules`   | `<TName>(name: TName, rules: SchemxRules \| SchemxRules[], defaultMessage?: string) => void` | 解析并替换字段当前规则；无法解析出规则时不会注册。               |
| `unregisterRules` | `<TName>(name: TName) => void`                                                               | 注销字段规则，同时清除错误。                                     |

### 提交与重置

| 成员          | 签名                              | 说明                                                                                             |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `submit`      | `() => Promise<void>`             | 先等待依赖，再校验；成功调用 `onFinish`，失败调用 `onFinishFailed`。并发调用复用同一个 Promise。 |
| `resetFields` | `<TName>(names: TName[]) => void` | 把指定字段恢复为当前初始值，并清除这些字段的 touched 与 pending；不会统一清除校验错误。          |
| `reset`       | `() => void`                      | 把全表恢复为当前初始值，并清除全部校验错误。                                                     |

### 响应式订阅

| 成员     | 签名                             | 说明                                                                           |
| -------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `effect` | `(fn: () => void) => () => void` | 立即执行并自动追踪其中读取的值或错误；返回取消函数，`destroy()` 也会统一清理。 |
| `batch`  | `(fn: () => void) => void`       | 合并函数内多次响应式写入，使相关 effect 在批次结束后统一响应。                 |

### Schema 更新

| 成员                | 签名                                                                                                                                      | 说明                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `setSchemas`        | `(schemas: readonly SchemxField<TValues>[]) => void`                                                                                      | 替换根 Schema。已有字段的值、错误与 touched 按字段路径保留；移除字段的相关资源会释放。修改过的条目必须使用新的对象引用。 |
| `updateSchemas`     | `(updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]) => void`                                        | 基于当前根 Schema 派生下一版；应为变化条目创建新对象，并复用未变化条目的引用。                                           |
| `updateFieldSchema` | `(name: NamePath<TValues>, patch: Partial<Omit<SchemxBaseField<TValues>, "name" \| "key" \| "componentType" \| "dependencies">>) => void` | 合并字段静态呈现配置；`componentProps` 浅合并。不能修改被排除的结构字段，这些应通过根 Schema 更新。字段不存在时无操作。  |

### 默认配置

| 成员                 | 签名                                                                                                                                                                                                                                                                                                                                                                 | 说明                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateDefaultProps` | `(partial: { required?: boolean; readonly?: boolean; disabled?: boolean; visible?: boolean; labelIcon?: string; labelAlign?: "left" \| "center" \| "right"; labelPosition?: "left" \| "top" \| "right"; labelWidth?: string; contentAlign?: "left" \| "center" \| "right"; validationTrigger?: ValidationTrigger \| ValidationTrigger[]; colon?: boolean }) => void` | 合并表单级默认配置，并使后续字段规范化重新读取。优先级通常为字段配置 → 表单默认配置 → core 固定默认值；`required` 还会在字段未显式配置时优先由非空 `rules` 推导为 `true`。 |

### ViewSchemas 与依赖等待

| 成员                   | 签名                                                                                | 说明                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `getViewSchemas`       | `() => readonly SchemxViewSchema<TValues>[]`                                        | 获取当前可渲染投影。                                                    |
| `subscribeViewSchemas` | `(callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void) => () => void` | 订阅投影变化，返回取消函数。                                            |
| `waitForDependencies`  | `(timeout?: number) => Promise<boolean>`                                            | 等待异步依赖任务；默认 `10_000 ms`，完成返回 `true`，超时返回 `false`。 |

### Renderer 与 Validator

| 成员                | 签名                                                                                          | 说明                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `getRenderer`       | `(type: SchemxRendererKey) => unknown \| undefined`                                           | 查询渲染器；未命中时尝试默认类型。                        |
| `registerRenderer`  | `(type: SchemxRendererKey, renderer: unknown) => void`                                        | 注册或按注册表策略处理同名渲染器。                        |
| `hasRenderer`       | `(type: SchemxRendererKey) => boolean`                                                        | 判断渲染器是否存在。                                      |
| `getValidator`      | `(name: string) => ValidatorsEntry<TValues> \| undefined`                                     | 查询原始规则条目，不执行工厂解析。                        |
| `registerValidator` | `(name: string, rule: ValidatorsEntry<TValues>, options?: ValidatorsRegistryOptions) => void` | 注册 Standard Schema 或规则工厂；`options` 控制注册行为。 |
| `hasValidator`      | `(name: string) => boolean`                                                                   | 判断当前实例的规则注册表中是否存在该名称。                |

### 生命周期销毁

| 成员      | 签名         | 说明                                                                               |
| --------- | ------------ | ---------------------------------------------------------------------------------- |
| `destroy` | `() => void` | 幂等销毁实例，清理 effect、Schema 订阅、字段与依赖资源。销毁后不应继续使用该实例。 |

### 综合示例

```ts
import { createForm } from "@schemx/core"

const form = createForm({ initialValues: { name: "" } })

const stop = form.effect(() => {
  console.log(form.getFieldValue("name"), form.getFieldError("name"))
})

form.batch(() => {
  form.setFieldValue("name", "Schemx")
  form.setFieldTouched("name", true)
})

const snapshot = form.getFieldsSnapshot()
const result = await form.validate()

if (!result.ok) console.error(result.error.errors)
console.log(snapshot)

stop()
form.destroy()
```

## Schema 集合

`createSchemas` 把根 Schema 数组包装为可读取、替换和订阅的 source。它有 2 个重载：

```ts
function createSchemas<TValues extends Values = Values>(): SchemxSchemas<TValues>
function createSchemas<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[]
): SchemxSchemas<TValues>
```

空参数重载以 `[]` 初始化；数组重载保留传入数组作为初始值。`createForm({ schemas })` 可以直接接收该 source，并在 source 更新后重建根 Schema。

`SchemxSchemas<TValues>` 的全部公开成员如下：

| 成员        | 签名或类型                                                                                         | 语义                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `signal`    | 只读 Schema 数组 signal                                                                            | 底层只读 signal。其具体类型不从包根入口导出；通常使用 `value`、`peek()` 和 `subscribe()` 即可。 |
| `value`     | `readonly SchemxField<TValues>[]`                                                                  | 响应式读取；在 `createEffect` 等依赖收集上下文中访问会建立依赖。                                |
| `peek`      | `() => readonly SchemxField<TValues>[]`                                                            | 无依赖追踪读取。                                                                                |
| `set`       | `(schemas: readonly SchemxField<TValues>[]) => void`                                               | 替换整个数组。更新按引用写入，不会深拷贝。                                                      |
| `update`    | `(updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]) => void` | 用当前无追踪值计算并替换下一版。                                                                |
| `subscribe` | `(listener: SchemxSchemasListener<TValues>) => () => void`                                         | 只在后续值变化时通知，不会立即发送初始值；返回的函数用于取消订阅。                              |

`SchemxSchemasInput<TValues>` 是 `readonly SchemxField<TValues>[] | SchemxSchemas<TValues>`；`SchemxSchemasListener<TValues>` 是 `(schemas: readonly SchemxField<TValues>[]) => void`。

`isSchemxSchemas<TValues>(schemas)` 接受 `SchemxSchemasInput<TValues> | undefined`，通过 `peek`、`set`、`update`、`subscribe` 这 4 个函数成员进行结构判断，并收窄为 `SchemxSchemas<TValues>`；普通数组和 `undefined` 返回 `false`。

```ts
import { createSchemas, isSchemxSchemas } from "@schemx/core"

type Values = { name: string; email: string }

const schemas = createSchemas<Values>()
const stop = schemas.subscribe((next) => console.log(next))

schemas.set([{ name: "name", label: "姓名", componentType: "input" }])
schemas.update((current) => [
  ...current,
  { name: "email", label: "邮箱", componentType: "input" },
])

console.log(isSchemxSchemas(schemas), schemas.peek())
stop()
```

## Watch 与 Effect

### `createEffect`

```ts
function createEffect(callback: EffectCallback): CreateEffectReturn
type EffectCallback = () => CleanupFn | void
type CleanupFn = () => void
type CreateEffectReturn = () => void
```

`createEffect` 不需要 form。它立即执行回调，并自动追踪回调中读取的 Core reactive value；依赖变化时，先执行上一轮 cleanup，再重新收集依赖并执行回调。返回的 dispose 会停止 effect 并执行最后一轮 cleanup，多次调用是安全的。

```ts
import { createEffect, createSchemas } from "@schemx/core"

const schemas = createSchemas()
const stop = createEffect(() => {
  console.log(schemas.value.length)
  return () => console.log("清理上一轮")
})

schemas.set([{ name: "name", label: "姓名", componentType: "input" }])
stop()
```

### Watch 函数签名

`createWatch` 是 3 个重载的统一分发入口，`options` 可省略：

```ts
declare function createWatch<TValues extends Values = Values>(
  form: SchemxInstance<TValues>,
  callback: WatchAllCallback<TValues>,
  options?: CreateWatchOptions
): CreateWatchReturn

declare function createWatch<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  name: TName,
  callback: WatchFieldCallback<TValues, TName>,
  options?: CreateWatchOptions
): CreateWatchReturn

declare function createWatch<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  names: TName[],
  callback: WatchFieldsCallback<TValues>,
  options?: CreateWatchOptions
): CreateWatchReturn
```

底层函数的 `options` 参数当前是必填参数；不需要选项时传 `{}`：

```ts
declare function createWatchField<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  name: TName,
  callback: WatchFieldCallback<TValues, TName>,
  options: CreateWatchOptions
): CreateWatchReturn

declare function createWatchFields<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  names: TName[],
  callback: WatchFieldsCallback<TValues>,
  options: CreateWatchOptions
): CreateWatchReturn

declare function createWatchAll<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  form: SchemxInstance<TValues>,
  callback: WatchAllCallback<TValues>,
  options: CreateWatchOptions
): CreateWatchReturn
```

所有函数都返回 `CreateWatchReturn`，即 `() => void` 取消函数；调用后停止后续通知。`CreateWatchOptions` 有 2 个可选字段：`immediate?: boolean` 在建立监听时调用一次 callback，`inequality?: boolean` 使用深比较跳过相等的新旧值，两者默认均为 `false`。

| 函数                | 依赖与回调载荷                                                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createWatchField`  | 通过 `getFieldValue(name)` 追踪 1 个字段。callback 接收 `{ value, prevValue }` 与最新全表快照；`immediate` 时 `prevValue` 为 `undefined`。                                                                                                                                           |
| `createWatchFields` | 通过 `getFieldsValue(names)` 追踪指定字段。callback 接收 `{ changedPaths, changedValues, prevValues }` 与最新全表快照；`immediate` 时 `changedPaths` 为全部传入路径、`changedValues` 为当前选择值、`prevValues` 为 `{}`。                                                            |
| `createWatchAll`    | 当前实现只在 effect 中读取 `getFieldsSnapshot()`，该读取不建立响应式依赖，因此普通字段更新不会触发重新执行。`immediate: true` 仍会同步调用 1 次，此时 `changedPaths` 为 `[]`、`changedValues` 为全量快照、`prevValues` 为 `{}`。这是当前实现限制，不应把它当作可持续的全表变更订阅。 |

`WatchFieldCallback`、`WatchFieldsCallback`、`WatchAllCallback` 分别描述上表载荷；它们的第二个参数都是变化后的 `TValues` 全表快照。Watch callback 不支持返回 cleanup；需要释放外部资源时应自行在下一次回调中处理，并在最终调用取消函数。

```ts
import { createForm, createWatch, createWatchFields } from "@schemx/core"

const form = createForm({ initialValues: { firstName: "", lastName: "" } })

const stopFirstName = createWatch(
  form,
  "firstName",
  ({ value, prevValue }, snapshot) => {
    console.log(prevValue, value, snapshot)
  },
  { immediate: true, inequality: true }
)

const stopNames = createWatchFields(
  form,
  ["firstName", "lastName"],
  ({ changedPaths, changedValues, prevValues }) => {
    console.log(changedPaths, changedValues, prevValues)
  },
  {}
)

stopFirstName()
stopNames()
form.destroy()
```

## 单字段控制器

```ts
function createField<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(form: SchemxInstance<TValues>, name: TName): SchemxFieldInstance<TValues, TName>
```

`createField` 不创建独立 Store。它保存 `form` 与 `name`，把完整表单实例的方法收窄到一个字段，因此通过 field 写入的值、错误、规则、touched、pending 和初始值都与原 `form` 完全共享。

`SchemxFieldInstance` 的全部公开成员如下：

| 成员              | 签名                                                                     | 与 `form` 的关系                                                                       |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `getValue`        | `() => FieldValue<TValues, TName> \| undefined`                          | 调用 `form.getFieldValue(name)`，可参与依赖追踪。                                      |
| `setValue`        | `(value: FieldValue<TValues, TName> \| undefined) => void`               | 调用 `form.setFieldValue(name, value)`。                                               |
| `getInitialValue` | `() => FieldValue<TValues, TName> \| undefined`                          | 读取同一字段的 reset baseline。                                                        |
| `setInitialValue` | `(value: FieldValue<TValues, TName>) => void`                            | 按路径构造局部对象并调用 `form.setInitialValues()`；更新 baseline，不同时覆盖当前值。  |
| `getValues`       | `() => Readonly<TValues>`                                                | 返回全表响应式值，不只返回当前字段。                                                   |
| `getSnapshot`     | `() => TValues`                                                          | 返回全表无追踪快照。                                                                   |
| `validate`        | `() => Promise<ValidateResult<TValues>>`                                 | 调用 `form.validateField(name)`。                                                      |
| `getError`        | `() => string[] \| undefined`                                            | 读取当前字段错误，可参与依赖追踪。                                                     |
| `setError`        | `(errors: string[]) => void`                                             | 写入当前字段错误。                                                                     |
| `clearError`      | `() => void`                                                             | 把当前字段错误设为 `[]`。                                                              |
| `registerRules`   | `(rules: SchemxRules \| SchemxRules[], defaultMessage?: string) => void` | 通过表单实例注册当前字段规则。                                                         |
| `unregisterRules` | `() => void`                                                             | 注销当前字段规则并清除错误。                                                           |
| `isTouched`       | `() => boolean`                                                          | 读取当前字段 touched；底层没有状态时回退为 `false`。                                   |
| `reset`           | `() => void`                                                             | 调用 `form.resetFields([name])`，回到当前初始值 baseline。                             |
| `setPending`      | `(pending: boolean, message?: string \| string[]) => void`               | 设置当前字段 pending 及提示。                                                          |
| `isPending`       | `() => boolean`                                                          | 读取当前字段 pending；底层没有状态时回退为 `false`。                                   |
| `effect`          | `(fn: () => void) => () => void`                                         | 委托 `form.effect(fn)`；立即执行，追踪实际读取的任意表单状态，而非强制只追踪当前字段。 |

field 没有独立的 `destroy()`。应保存 `effect()` 的返回函数来停止该订阅；`form.destroy()` 也会统一清理表单 effect 和字段资源。

```ts
import { createField, createForm } from "@schemx/core"

const form = createForm({ initialValues: { name: "" } })
const field = createField(form, "name")

const stop = field.effect(() => {
  console.log(field.getValue(), field.getError(), field.isPending())
})

field.setInitialValue("anonymous")
field.setValue("Schemx")
field.reset()

stop()
form.destroy()
```

## Registry 与 Validator

### Renderer Registry

```ts
function createRendererRegistry<T extends SchemxRendererKey, R = unknown>(
  defaultType?: T
): RendererRegistryType<T, R>
```

Core 只存储 renderer 值，不限定 Vue、React 或其他框架的组件形态。

| 成员          | 签名                                                        | 语义                                                                                  |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `register`    | `(type: T, renderer: R, options?: RegistryOptions) => void` | 默认覆盖同名 renderer；`{ override: false }` 时保留旧值。                             |
| `registerAll` | `(renderers: RendererMap<T, R>) => void`                    | 批量注册并直接覆盖同名项。                                                            |
| `getRenderer` | `(type: T) => R \| undefined`                               | 命中时返回对应值；未命中时尝试 `defaultType`；都不存在时返回 `undefined`。            |
| `hasRenderer` | `(type: T) => boolean`                                      | 只检查指定 key 是否直接存在，不把默认回退算作命中。                                   |
| `unregister`  | `(type: T) => boolean`                                      | 删除并返回结果；删除当前默认项后，如仍有 renderer，会把第 1 个剩余 key 设为新默认项。 |
| `getTypes`    | `() => T[]`                                                 | 按注册顺序返回全部 key。                                                              |
| `setDefault`  | `(type: T) => void`                                         | 只允许把已注册 key 设为默认值。                                                       |
| `getDefault`  | `() => T \| undefined`                                      | 返回当前默认 key。                                                                    |
| `clear`       | `() => void`                                                | 清空 renderer；当前实现不会同时清除 `defaultType`。                                   |
| `size`        | `() => number`                                              | 返回注册数量。                                                                        |

`RegistryOptions` 只有 `override?: boolean`；`RendererMap<T, R>` 是 `Record<T, R>`；`RendererRegistryType<T, R>` 是注册表实例类型。

### Validators Registry

```ts
function createValidatorsRegistry<
  TValues extends Values = Values,
>(): ValidatorsRegistryType<TValues>
```

该工厂创建空注册表。`createForm()` 会通过 `registerAll()` 向最终采用的注册表注册 `required`、`selectRequired`、`uploadRequired` 3 个内置规则工厂；这个步骤会覆盖传入 registry 中已有的同名条目。需要自定义这 3 个名称时，应先创建 form，再调用 `form.registerValidator()` 重新注册。直接调用 `createValidatorsRegistry()` 不会预填内置规则，3 个内置工厂函数本身也未从 Core 根入口导出。

| 成员                        | 签名                                                                                   | 语义                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `register`                  | `(name, entry: ValidatorsEntry<TValues>, options?: ValidatorsRegistryOptions) => void` | 默认覆盖同名规则；`{ override: false }` 时保留旧值。                                    |
| `registerAll`               | `(entries: ValidatorsEntryMap<TValues>) => void`                                       | 批量注册并直接覆盖同名项。                                                              |
| `get`                       | `(name) => ValidatorsEntry<TValues> \| undefined`                                      | 返回原始 Standard Schema 或工厂，不执行工厂。                                           |
| `resolveValidatorsBySchema` | `(schema: SchemxBaseField<TValues>) => StandardSchemaV1[]`                             | 解析 `rules`；字符串查表，工厂接收字段 Schema 后执行，Standard Schema 原样返回。        |
| `has`                       | `(name) => boolean`                                                                    | 判断规则名是否存在。                                                                    |
| `unregister`                | `(name) => boolean`                                                                    | 删除并返回结果。                                                                        |
| `getNames`                  | `() => SchemxRuleKey[]`                                                                | 返回全部已注册规则名；该内部 key 别名不从根入口导出，调用方通常让 TypeScript 自动推断。 |
| `clear`                     | `() => void`                                                                           | 清空注册表。                                                                            |
| `size`                      | `() => number`                                                                         | 返回注册数量。                                                                          |

`ValidatorsEntry<TValues>` 是 `StandardSchemaV1 | ValidatorsFactory<TValues>`；工厂签名为 `(schema?: SchemxBaseField<TValues>) => StandardSchemaV1`。`ValidatorsEntryMap<TValues>` 是规则名到条目的映射，`ValidatorsRegistryOptions` 只有 `override?: boolean`。

### 底层 Validator

`createValidator<TValues, TName>()` 创建不持有 form / Store 的独立校验器。调用方负责把最新全量值传给校验方法。

| 成员            | 签名                                                                                  | 语义                                                       |
| --------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `register`      | `(path, rules: StandardSchemaV1 \| StandardSchemaV1[], defaultMessage?) => void`      | 注册字段规则；同一路径多次调用会追加，而不是替换。         |
| `unregister`    | `(path) => void`                                                                      | 删除规则和该字段错误。                                     |
| `getFieldError` | `(path) => string[] \| undefined`                                                     | 获取响应式错误。                                           |
| `setFieldError` | `(path, errors: string[]) => void`                                                    | 手动设置错误。                                             |
| `validateField` | `(path: TName \| TName[], latestValues: TValues) => Promise<ValidateResult<TValues>>` | 重置指定路径错误后逐字段、逐规则校验。                     |
| `validate`      | `(latestValues: TValues) => Promise<ValidateResult<TValues>>`                         | 重置错误并校验所有已注册路径。                             |
| `reset`         | `(paths?: TName[]) => void`                                                           | 重置指定或全部已注册字段错误，并清除没有规则但残留的错误。 |

`ValidateResult<TValues>` 是 `{ ok: true; values: TValues } | { ok: false; error: ValidateError<TValues> }`；`ValidateError` 包含校验时的 `values` 与 `FieldError[]`，每个 `FieldError` 为 `{ field: string; message: string[] }`。

### 声明合并

下面的扩展只使用 Core 根入口公开的类型。声明 renderer 后，`componentType` 与 `componentProps` 会关联；声明规则后，字符串规则名会收窄。

```ts
import {
  createRendererRegistry,
  createValidatorsRegistry,
  type StandardSchemaV1,
  type Values,
} from "@schemx/core"

type TextInputProps = { maxlength?: number }

declare module "@schemx/core" {
  interface SchemxRendererDefinition<T extends Values> {
    input: TextInputProps & { valuesType?: T }
  }

  interface SchemxRuleDefinition {
    phone: StandardSchemaV1<string>
  }
}

const renderers = createRendererRegistry<"input", (props: TextInputProps) => unknown>()
renderers.register("input", (props) => props.maxlength)

const validators = createValidatorsRegistry()
const phoneRule: StandardSchemaV1<string> = {
  "~standard": {
    version: 1,
    vendor: "app",
    validate(value) {
      return typeof value === "string" && /^1\d{10}$/.test(value)
        ? { value }
        : { issues: [{ message: "手机号格式错误" }] }
    },
  },
}
validators.register("phone", phoneRule)
```

## ViewSchemas

3 个层级的 Schema 用途不同：

| 层级            | 公开类型                       | 用途                                                                                                                      |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 原始 Schema     | `SchemxField<TValues>`         | 业务输入；联合普通字段、Group 和 Dependency，允许 `dependencies` 与 Dependency renderer。                                 |
| Resolved Schema | `SchemxResolvedField<TValues>` | Core 解析后的静态字段 / Group 联合；普通字段不再含 `dependencies`，Group 的 children 也递归解析；它不是最终 UI 订阅载荷。 |
| ViewSchema      | `SchemxViewSchema<TValues>`    | UI 适配层消费的渲染投影；动态属性已合并，Dependency 已透明展开，只剩字段和 Group。                                        |

| 类型                    | 字段与语义                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SchemxViewFieldSchema` | 基于解析后的普通字段；`key: string` 必有，`debug?: Readonly<SchemxViewDebugMeta>` 可选。包含最终的 `componentProps`、`visible`、`readonly`、`disabled`、`required`、`placeholder`、`rules`。    |
| `SchemxViewGroupSchema` | 基于解析后的 Group；`key: string` 必有，`children: readonly SchemxViewSchema<TValues>[]` 递归只读且不含 Dependency，`debug` 可选。                                                              |
| `SchemxViewSchema`      | `SchemxViewFieldSchema \| SchemxViewGroupSchema` 联合。由于 renderer 也可能使用字符串 `"group"`，应通过 `children` 属性编写用户侧类型守卫，不要用 `componentType` 或 Resolved Schema 守卫收窄。 |
| `SchemxViewDebugMeta`   | 可选诊断数据：`runtimeNodeId`、`runtimeNodeType`、`hasRuntimeState`、`hasDependencyEffect`、`lastUpdatedBy?`、`overriddenKeys?`、`error?`。这些字段只用于观察来源和覆盖结果。                   |

ViewSchema 并非整体深层只读，也不会在运行时自动冻结。返回数组、Group 的 `children`、`key`、`debug` 及 debug 成员带有部分 `readonly` 标注，但普通字段的其他属性并非全部 `readonly`。调用方仍应把投影视为只读输入，通过 Schema API 更新源数据，而不是原地修改投影。

读取与订阅都通过 `SchemxInstance`，不需要也不应深层导入 view 实现：

```ts
import {
  createForm,
  type SchemxViewGroupSchema,
  type SchemxViewSchema,
  type Values,
} from "@schemx/core"

type ProfileValues = { name: string }

function isViewGroup<TValues extends Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewGroupSchema<TValues> {
  return "children" in schema
}

const form = createForm<ProfileValues>({
  schemas: [{ name: "name", label: "姓名", componentType: "input" }],
})

function render(schemas: readonly SchemxViewSchema<ProfileValues>[]) {
  for (const schema of schemas) {
    if (isViewGroup(schema)) render(schema.children)
    else console.log(schema.key, schema.name, schema.componentProps)
  }
}

await form.waitForDependencies()
render(form.getViewSchemas())

const unsubscribe = form.subscribeViewSchemas(render)
unsubscribe()
form.destroy()
```

## 公开工具

Core 根入口只公开下列 Schema 判断和路径工具。其他 `utils` 源码符号不属于包根公共 API。

| 工具                       | 签名摘要                                                         | 用途                                                                            |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `isBaseSchema`             | `(schema: SchemxField<T>) => schema is SchemxBaseField<T>`       | 判断原始普通字段。                                                              |
| `isGroupSchema`            | `(schema: SchemxField<T>) => schema is SchemxGroupField<T>`      | 判断原始 Group。                                                                |
| `isDependencySchema`       | `(schema: SchemxField<T>) => schema is SchemxDependencyField<T>` | 判断原始 Dependency。                                                           |
| `isBaseResolvedSchema`     | `(schema: SchemxResolvedField<T>) => boolean` 类型守卫           | 判断解析后的普通字段；收窄目标类型未单独从根入口导出。                          |
| `isGroupResolvedSchema`    | `(schema: SchemxResolvedField<T>) => boolean` 类型守卫           | 判断 Resolved Schema 中的 Group；不要用它收窄 ViewSchema。                      |
| `getByPath`                | `(obj: Partial<TValues>, path: TName) => TValue \| undefined`    | 按公开的 `NamePath<TValues>` 点号字符串路径读取；路径不存在时返回 `undefined`。 |
| `setByPath`                | `(obj: Partial<TValues>, path: TName, value: TValue) => void`    | 按点号字符串路径原地写入 `Partial<TValues>`，并按需创建中间结构。               |
| `collectObjectPathsByLeaf` | `(obj: Partial<TValues>, prefix?: string) => TName[]`            | 收集叶子路径；普通对象使用点号路径，数组元素的运行时结果使用如 `items[0]`。     |

当前根入口的 `NamePath<TValues>` 是点号字符串路径，因而 `getByPath` / `setByPath` 的公共类型参数也是字符串路径。底层路径实现虽然能兼容数字和数组形式，但这些形式不在当前根入口类型契约内；业务代码不应通过断言绕过公共类型。

## 类型参考

复杂 Schema 与表单字段已在「Schema 完整语法」「CreateFormOptions」「表单实例 API」中逐字段说明。下面补充根入口其他类型的结构与用途；完整的 62 个公开类型还会在「完整导出清单」中逐项列出。

### 基础与字段类型

| 类型                         | 用途                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `Values`                     | `Record<string, any>`，Core 泛型值对象的基础约束。                                                 |
| `NamePath<T>`                | 从值类型推导点号分隔的字符串深路径，最大推导深度为 5；不包含数字或数组路径。                       |
| `FieldValue<TValues, TName>` | 根据 `NamePath<TValues>` 点号字符串路径提取字段值类型，并包含运行时可能返回的 `undefined`。        |
| `Dynamic<T, V>`              | 静态 `T` 或 `(values: V) => T \| Promise<T>`。                                                     |
| `DeepReadonly<T>`            | 递归只读化对象、数组、元组、Map、Set 和 Promise；只影响类型，不会执行 `Object.freeze()`。          |
| `CSSProperties`              | 基于 `csstype` 的 CSS 属性对象类型。                                                               |
| `ValidationTrigger`          | `onBlur` / `blur`、`onChange` / `change`、`onSubmit` / `submit` 联合。                             |
| `StandardSchemaV1`           | Standard Schema v1 协议类型。                                                                      |
| `SchemxBaseComponentProps`   | renderer 公共 Props：只读、禁用、占位、对齐、form item、form 实例、值及更新 / change / blur 回调。 |
| `SchemxComponentProps`       | renderer 专属 Props 与 `SchemxBaseComponentProps` 的交叉类型。                                     |
| `SchemxFormItemProps`        | `SchemxBase` 去掉 `componentProps` 后的表单项 Props。                                              |

### Schema、依赖与扩展类型

| 类型                             | 用途                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `SchemxBase` / `SchemxBaseField` | 普通字段基础接口 / 按 `componentType` 分布展开的普通字段联合。完整字段见「普通字段 Schema」。 |
| `SchemxGroupField`               | Group 原始 Schema，含 children 与折叠配置。                                                   |
| `SchemxDependencyField`          | Dependency 原始 Schema，含 `to` 与异步兼容的 renderer。                                       |
| `SchemxField`                    | 普通字段、Group、Dependency 的原始 Schema 联合。                                              |
| `SchemxResolvedField`            | 解析后的普通字段 / Group 联合，不含 Dependency 分支。                                         |
| `SchemxDependencies`             | 字段动态覆盖配置，含 `triggerFields`、7 个可解析属性与 `trigger` 副作用。                     |
| `SchemxContainerDependencies`    | Group 和 Dependency 的动态状态配置，支持 `visible`、`readonly` 与 `disabled`。                |
| `SchemxConditionFn<T, R>`        | `(values: T, form) => R \| Promise<R>`，动态属性条件函数。                                    |
| `SchemxDependenciesStaticProps`  | 从依赖条件函数提取静态返回类型，排除 `triggerFields` 与 `trigger`。                           |
| `SchemxFieldDefinition`          | 空扩展接口；声明合并后向普通字段添加业务字段。                                                |
| `SchemxGroupFieldDefinition`     | 空扩展接口；声明合并后向 Group 添加业务字段。                                                 |
| `SchemxRendererDefinition`       | renderer key → 专属 Props 的声明合并接口。                                                    |
| `SchemxRuleDefinition`           | 自定义规则名 → Standard Schema 类型的声明合并接口。                                           |

### 表单与上下文类型

| 类型                  | 用途                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CreateFormOptions`   | `createForm()` 选项；字段已在前文逐项说明。                                                                          |
| `SchemxInstance`      | 完整表单实例公共接口；成员已在「表单实例 API」逐项说明。                                                             |
| `SchemxProps`         | UI 组件可复用的表单 Props，含默认呈现字段、值、Schema、可选 form / Registry 与回调；`schemas` 在此类型中是必填数组。 |
| `SchemxGlobalContext` | 从 `SchemxProps` 选出的 `readonly`、`disabled`、`validationTrigger` 配置。                                           |
| `SchemxContext`       | `createForm()` 的实例级高级上下文类型。它包含 Core 实现服务，不应由普通业务代码手动构造或依赖其内部成员。            |

所有类型均从 `@schemx/core` 根入口使用 `import type` 导入；不要使用 `@schemx/core/src/...` 或 `@schemx/core/dist/...` 深层路径。

## 完整导出清单

Core 根入口当前共有 82 个命名导出：20 个运行时值和 62 个类型。包没有默认导出；`createForm` 是命名导出，必须使用 `import { createForm } from "@schemx/core"`。

### 运行时值（20 个）

| 分类          | 导出                       | 用途                                 |
| ------------- | -------------------------- | ------------------------------------ |
| 表单          | `createForm`               | 创建表单实例。                       |
| 字段          | `createField`              | 创建绑定到 form 与字段路径的控制器。 |
| Schema source | `createSchemas`            | 创建可更新根 Schema source。         |
| Schema source | `isSchemxSchemas`          | 判断并收窄 Schema source。           |
| Effect        | `createEffect`             | 创建底层自动依赖追踪 effect。        |
| Watch         | `createWatch`              | 统一分发 Watch 重载。                |
| Watch         | `createWatchField`         | 监听单字段。                         |
| Watch         | `createWatchFields`        | 监听指定字段组。                     |
| Watch         | `createWatchAll`           | 全表 Watch；当前存在无追踪快照限制。 |
| Registry      | `createRendererRegistry`   | 创建 renderer 注册表。               |
| Registry      | `createValidatorsRegistry` | 创建字符串规则注册表。               |
| Validator     | `createValidator`          | 创建独立底层校验器。                 |
| Schema 守卫   | `isBaseSchema`             | 判断原始普通字段。                   |
| Schema 守卫   | `isGroupSchema`            | 判断原始 Group。                     |
| Schema 守卫   | `isDependencySchema`       | 判断原始 Dependency。                |
| Schema 守卫   | `isBaseResolvedSchema`     | 判断解析后的普通字段。               |
| Schema 守卫   | `isGroupResolvedSchema`    | 判断解析后的 Group。                 |
| 路径          | `getByPath`                | 读取嵌套路径。                       |
| 路径          | `setByPath`                | 写入嵌套路径。                       |
| 路径          | `collectObjectPathsByLeaf` | 收集对象叶子路径。                   |

### 类型（62 个）

| 分类               | 导出                            | 用途                                    |
| ------------------ | ------------------------------- | --------------------------------------- |
| Effect             | `CleanupFn`                     | effect 单轮清理函数。                   |
| Effect             | `EffectCallback`                | 可返回 cleanup 的 effect 回调。         |
| Effect             | `CreateEffectReturn`            | `createEffect` 的幂等 dispose。         |
| Watch              | `CreateWatchOptions`            | `immediate` 与 `inequality` 选项。      |
| Watch              | `CreateWatchReturn`             | Watch 取消函数。                        |
| Watch              | `WatchFieldCallback`            | 单字段 Watch callback。                 |
| Watch              | `WatchFieldsCallback`           | 多字段 Watch callback。                 |
| Watch              | `WatchAllCallback`              | 全表 Watch callback。                   |
| 表单               | `CreateFormOptions`             | `createForm` 选项。                     |
| 表单               | `SchemxInstance`                | 表单实例公共 API。                      |
| 表单               | `SchemxProps`                   | UI 适配层可复用的表单 Props。           |
| 表单               | `SchemxGlobalContext`           | 全局只读、禁用与校验触发配置。          |
| 表单               | `SchemxContext`                 | 实例级高级上下文。                      |
| 基础               | `Values`                        | 表单值基础约束。                        |
| 基础               | `Dynamic`                       | 静态值或同步 / 异步值函数。             |
| 路径               | `NamePath`                      | 类型安全字段路径。                      |
| 路径               | `FieldValue`                    | 从字段路径提取值类型。                  |
| 工具类型           | `DeepReadonly`                  | 深层只读类型。                          |
| 工具类型           | `CSSProperties`                 | CSS 属性类型。                          |
| Schema source      | `SchemxSchemas`                 | 可更新 Schema source 接口。             |
| Schema source      | `SchemxSchemasInput`            | 数组或 Schema source 输入联合。         |
| Schema source      | `SchemxSchemasListener`         | Schema source 变化 listener。           |
| 字段               | `SchemxFieldInstance`           | 单字段控制器接口。                      |
| Schema             | `SchemxBase`                    | 普通字段基础接口。                      |
| Schema             | `SchemxBaseField`               | 按 renderer key 分布的普通字段联合。    |
| Schema             | `SchemxGroupField`              | 原始 Group Schema。                     |
| Schema             | `SchemxDependencyField`         | 原始 Dependency Schema。                |
| Schema             | `SchemxField`                   | 全部原始 Schema 联合。                  |
| Schema             | `SchemxResolvedField`           | 解析后普通字段 / Group 联合。           |
| Schema             | `SchemxBaseComponentProps`      | renderer 公共 Props。                   |
| Schema             | `SchemxComponentProps`          | renderer 专属与公共 Props 组合。        |
| Schema             | `SchemxFormItemProps`           | 去除组件 Props 的表单项字段配置。       |
| 扩展               | `SchemxFieldDefinition`         | 普通字段声明合并接口。                  |
| 扩展               | `SchemxGroupFieldDefinition`    | Group 声明合并接口。                    |
| 依赖               | `SchemxDependencies`            | 字段动态依赖配置。                      |
| 依赖               | `SchemxContainerDependencies`   | Group/Dependency 容器动态状态配置。     |
| 依赖               | `SchemxConditionFn`             | 动态属性条件函数。                      |
| 依赖               | `SchemxDependenciesStaticProps` | 依赖条件函数静态返回值映射。            |
| ViewSchema         | `SchemxViewDebugMeta`           | ViewSchema 可选诊断元数据。             |
| ViewSchema         | `SchemxViewFieldSchema`         | 最终字段渲染投影。                      |
| ViewSchema         | `SchemxViewGroupSchema`         | 最终 Group 渲染投影。                   |
| ViewSchema         | `SchemxViewSchema`              | 字段 / Group 渲染投影联合。             |
| Renderer           | `SchemxRendererKey`             | renderer key 类型。                     |
| Renderer           | `SchemxRendererDefinition`      | renderer Props 声明合并接口。           |
| Renderer Registry  | `RendererRegistryType`          | renderer 注册表实例类型。               |
| Renderer Registry  | `RegistryOptions`               | renderer 覆盖选项。                     |
| Renderer Registry  | `RendererMap`                   | renderer 批量映射。                     |
| Validator          | `Validator`                     | 底层 Validator 实例类型。               |
| Validator          | `ValidateResult`                | 校验成功 / 失败判别联合。               |
| Validator          | `ValidateError`                 | 校验失败详情。                          |
| Validator          | `FieldError`                    | 单字段错误。                            |
| Validator          | `ValidationTrigger`             | 校验触发时机联合。                      |
| Validator          | `StandardSchemaV1`              | Standard Schema v1 协议。               |
| Rule               | `SchemxRuleDefinition`          | 自定义规则声明合并接口。                |
| Rule               | `SchemxRuleDefinitionKey`       | 声明合并推导的规则 key。                |
| Rule               | `SchemxRuleBuiltinKey`          | 3 个内置规则 key。                      |
| Rule               | `SchemxRules`                   | Standard Schema、内置或自定义规则联合。 |
| Validator Registry | `ValidatorsRegistryType`        | validators 注册表实例类型。             |
| Validator Registry | `ValidatorsRegistryOptions`     | validators 覆盖选项。                   |
| Validator Registry | `ValidatorsFactory`             | 按字段 Schema 生成规则的工厂。          |
| Validator Registry | `ValidatorsEntry`               | Standard Schema 或工厂联合。            |
| Validator Registry | `ValidatorsEntryMap`            | 规则名到条目的批量映射。                |

## 公共边界

业务代码和框架适配层应通过 `SchemxInstance` 操作表单状态、校验、Schema 和注册表，通过 `getViewSchemas()` 或 `subscribeViewSchemas()` 获取可渲染投影。除根入口明确导出的 API 外，其余实现细节不属于稳定的公共契约。

## 相关包

- `@schemx/vue`：Vue 3 适配层。
- `@schemx/vant`：基于 Vant 的 renderer 适配包。
- `@schemx/core`：当前包，框架无关表单引擎。
