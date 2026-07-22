# @schemx/core

`@schemx/core` 是框架无关的 Schema 表单运行时。它负责字段值、校验、动态依赖、运行时 Schema 与可渲染 ViewSchemas，不依赖 Vue、React 或具体组件库。

## 安装

```bash
pnpm add @schemx/core zod
```

`zod` 只用于下面的 Standard Schema 示例；也可以换成任何实现 Standard Schema v1 的校验库，或直接编写 `ValidationRule`。

## 快速开始

```ts
import { createForm, createValidationRuleRegistry } from "@schemx/core"
import { z } from "zod"

interface LoginValues {
  email: string
}

const registry = createValidationRuleRegistry()
registry.register("email", z.string().email("邮箱格式错误"))

const form = createForm<LoginValues>({
  initialValues: { email: "" },
  schemas: [
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      required: { message: "请输入邮箱" },
      rules: ["email"],
    },
  ],
  validationRuleRegistry: registry,
})

const result = await form.validate()
if (result.valid) {
  console.log(result.values)
} else {
  console.log(result.errors)
}
```

`required` 是字段自身的一等配置，不需要在 Registry 中注册。`showRequiredMark` 只控制必填视觉标记，不改变校验；未配置时会跟随当前有效的 `required`。命名规则由 `ValidationRuleRegistry` 保存，并在字段同步到 Validator 时解析。

## Schema

普通字段必须提供 `name`、`label` 与 `componentType`；无可见标签时仍需传入 `label: ""`。公开 TypeScript 类型要求 `componentType` 必填；仅在处理 JavaScript 等未经类型检查的输入时，运行时才会使用显式传给 `createForm` 的 `defaultRendererType` 补齐缺失值。`required` 接受 `boolean` 或配置对象；`rules` 接受命名规则、`ValidationRule`、Standard Schema，或这些规则的只读数组。

```ts
const schemas = [
  {
    name: "password",
    label: "密码",
    componentType: "password",
    required: {
      message: "请输入密码",
      isEmpty: (value: string | undefined) => !value?.trim(),
    },
    rules: [z.string().min(8, "密码至少 8 位")],
  },
]
```

Group 使用 `children` 声明静态子树；Dependency 使用 `to` 与 `renderer` 声明动态子树。字段和容器都可通过 `dependencies.triggerFields` 监听其他字段，并动态计算 `visible`、`readonly`、`disabled` 等状态。

## 校验结果

所有公开校验入口都返回以 `valid` 为判别字段的 `ValidationResult`：

```ts
type ValidationResult<TValues> =
  | { valid: true; values: TValues; errors: readonly [] }
  | { valid: false; values: TValues; errors: readonly ValidationError[] }
```

失败分支的具体类型是 `ValidationFailure`。字段错误包含 `scope: "field"`、`name` 和 `messages`；表单错误包含 `scope: "form"` 与 `messages`。

```ts
const result = await form.submit()

if (!result.valid) {
  for (const error of result.errors) {
    if (error.scope === "field") {
      console.log(error.name, error.issues)
    } else {
      console.log(error.issues)
    }
  }
}
```

## 命名规则 Registry

`createValidationRuleRegistry()` 创建独立的 `ValidationRuleRegistry`。注册条目可以是 `ValidationRule`、Standard Schema 或接收字段上下文的规则工厂。

```ts
import {
  createValidationRuleRegistry,
  type ValidationRule,
  type ValidationRuleFactory,
} from "@schemx/core"

const registry = createValidationRuleRegistry()

const positive: ValidationRule<number> = {
  validate(value) {
    return value !== undefined && value > 0
      ? { valid: true }
      : { valid: false, issues: [{ message: "必须大于 0" }] }
  },
}

const minLength: ValidationRuleFactory<string> = ({ label, required }) => ({
  validate(value) {
    if (!required && !value) return { valid: true }
    return value !== undefined && value.length >= 8
      ? { valid: true }
      : { valid: false, issues: [{ message: `${label}至少需要 8 个字符` }] }
  },
})

registry.register("positive", positive)
registry.register("minLength", minLength)
```

可以通过声明合并让命名规则与字段值类型关联：

```ts
declare module "@schemx/core" {
  interface ValidationRuleDefinition {
    email: string
    positive: number
  }
}
```

### `ValidationRuleRegistry`

| 成员                             | 说明                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `register(name, rule, options?)` | 注册规则；默认覆盖同名项，`override: false` 时保留原项。 |
| `registerAll(rules)`             | 批量注册规则。                                           |
| `get(name)`                      | 返回原始注册条目，不执行工厂。                           |
| `resolve(name, context)`         | 使用字段 `name`、`label`、`required` 解析条目。          |
| `has(name)`                      | 判断规则是否存在。                                       |
| `unregister(name)`               | 删除规则并返回是否曾存在。                               |
| `keys()`                         | 返回规则名称快照。                                       |
| `clear()`                        | 清空全部规则。                                           |
| `size()`                         | 返回规则数量。                                           |

## Form API

### 值与字段状态

| 成员                                                                | 说明                                         |
| ------------------------------------------------------------------- | -------------------------------------------- |
| `getFieldValue(name)` / `getFieldsValue(names?)`                    | 读取字段值或值快照。                         |
| `setFieldValue(name, value)` / `setFieldsValue(values)`             | 写入一个或多个字段值。                       |
| `setInitialValues(values)`                                          | 更新重置使用的初始值。                       |
| `setFieldTouched(name, touched)` / `isFieldTouched(name)`           | 写入或读取 touched 状态。                    |
| `setFieldPending(name, pending, message?)` / `isFieldPending(name)` | 写入或读取异步操作状态。                     |
| `resetFields(names)` / `reset()`                                    | 恢复字段或全表初始状态；规则保留，错误清除。 |

### 校验

| 成员                             | 返回值或语义                                                         |
| -------------------------------- | -------------------------------------------------------------------- |
| `validateField(name)`            | `Promise<ValidationResult<TValues, TName>>`；校验单个字段。          |
| `validate()`                     | `Promise<ValidationResult<TValues>>`；等待初始化规则同步后校验全表。 |
| `submit()`                       | 等待依赖并校验；成功调用 `onFinish`，失败调用 `onFinishFailed`。     |
| `getFieldErrors(name)`           | 返回只读错误消息快照；无错误时返回稳定空数组。                       |
| `setFieldErrors(name, messages)` | 替换字段的全部错误消息。                                             |
| `clearFieldErrors(name)`         | 清除字段错误消息。                                                   |
| `setFieldRules(name, rules)`     | 使用字段运行时标签与必填状态替换全部规则。                           |
| `removeFieldRules(name)`         | 移除字段规则并清除错误。                                             |

### Schema、订阅与 Registry

| 成员                                                                           | 说明                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| `getSchemas()` / `setSchemas(schemas)` / `updateSchemas(updater)`              | 读取或更新根 Schema。                     |
| `updateFieldSchema(name, patch)`                                               | 更新字段的非结构属性。                    |
| `getViewSchemas()` / `subscribeViewSchemas(callback)`                          | 读取或订阅渲染投影。                      |
| `effect(callback)` / `batch(callback)`                                         | 创建响应式副作用或批处理更新。            |
| `registerRenderer(type, renderer)` / `getRenderer(type)` / `hasRenderer(type)` | 操作当前表单的 Renderer Registry。        |
| `registerRule(name, rule, options?)` / `getRule(name)` / `hasRule(name)`       | 操作当前表单的 Validation Rule Registry。 |
| `destroy()`                                                                    | 幂等释放运行时资源并终止校验生命周期。    |

## 底层 Validator

`createValidator<TValues>()` 创建不持有 Store 的独立 Validator。调用方需要把当前全量值传给校验方法。

| 成员                                       | 说明                                 |
| ------------------------------------------ | ------------------------------------ |
| `setFieldRules(name, rules)`               | 替换字段的全部 `ValidationRule`。    |
| `removeFieldRules(name)`                   | 移除规则并中止该字段正在执行的校验。 |
| `getFieldErrors(name)`                     | 获取不可变错误快照。                 |
| `setFieldErrors(name, messages)`           | 替换错误消息。                       |
| `clearFieldErrors(name)` / `clearErrors()` | 清除字段或全部错误。                 |
| `validateField(name, values)`              | 返回字段级 `ValidationResult`。      |
| `validate(values)`                         | 返回全表 `ValidationResult`。        |
| `destroy()`                                | 中止执行并清空规则与错误。           |

## 核心校验类型

| 类型                                                       | 用途                                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `ValidationRule<TValue, TValues, TName>`                   | 原生规则接口，`validate` 可同步或异步返回规则结果。 |
| `ValidationResult<TValues, TName>`                         | 以 `valid` 判别成功或失败的联合类型。               |
| `ValidationFailure<TValues, TName>`                        | `valid: false` 的失败结果及扁平 `errors`。          |
| `ValidationError<TName>`                                   | 字段级与表单级错误联合。                            |
| `ValidationRuleRegistry`                                   | 命名规则注册中心实例。                              |
| `ValidationRuleEntry<TValue>`                              | 原生规则、Standard Schema 或规则工厂。              |
| `ValidationRuleFactory<TValue>`                            | 根据字段元数据创建规则的工厂。                      |
| `FieldRule<TValues, TName>` / `FieldRules<TValues, TName>` | Schema 字段可接受的单条或多条规则。                 |

## Renderer Registry

`createRendererRegistry()` 保存 `componentType` 到 Renderer 的映射。Core 不约束 Renderer 的框架与组件形态；`register`、`registerAll`、`get`、`resolve`、`has`、`unregister`、`keys`、`setFallback`、`getFallback`、`clear` 和 `size` 构成其公开操作。

## 其他入口

- `createSchemas()`：创建可替换、可订阅的根 Schema source。
- `createField()`：创建绑定到指定字段路径的控制器。
- `createEffect()`、`createWatch()`、`createWatchField()`、`createWatchFields()`、`createWatchAll()`：构建响应式监听。
- `getViewSchemas()` 与 `subscribeViewSchemas()`：向 UI 适配层提供稳定投影。

业务代码与框架适配层应从 `@schemx/core` 根入口导入公开 API；未由根入口导出的内部模块不属于稳定契约。
