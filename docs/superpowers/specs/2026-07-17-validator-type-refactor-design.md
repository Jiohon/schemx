# Validator 类型体系重构设计

## 背景

当前 Validator 以 `StandardSchemaV1` 作为唯一可执行规则，同时把 Schemx 内置必填语义包装成 Standard Schema。该设计可以复用 Zod 等验证库，但公开 API、类型推导和运行时语义之间存在明显偏差：

- `required` 只控制必填标记，不执行必填校验；任意非空 `rules` 又会让字段显示必填标记。
- `createRequiredRule`、`createSelectRequiredRule` 和 `createUploadRequiredRule` 接收完整字段 Schema，实际只读取 `label` 生成提示。
- ValidationEffect 为所有规则统一传入必填提示，导致普通格式规则与必填语义混合。
- `SchemxRules` 表示单条规则却使用复数命名；`ValidatorsEntry` 等类型也存在相同问题。
- 字段规则无法根据 `name` 精确推导字段值类型。
- `SchemxRuleDefinition` 的 value 不参与 Registry 类型约束，声明合并实际只约束规则名称。
- `StandardSchemaV1<Input, Output>` 的输出不会写回 Store，但公开类型没有明确表达这一点。
- `FieldError.field` 退化成 `string`，`ValidateResult` 使用 `error.errors` 嵌套结构，字段错误和表单错误通过 `"$form"` 伪路径混合。
- `getFieldError()` 在无错误时可能返回 `undefined` 或 `[]`，状态语义不稳定。
- 异步校验缺少运行版本或取消信号，旧结果可能覆盖新结果。

本次允许破坏性更新，不提供旧 API 兼容层。

## 目标

- 分离字段配置、命名规则解析、可执行规则和校验状态。
- 让 `required` 成为真正的字段必填语义，删除 3 个必填 Schema 工厂。
- 根据字段 `name` 推导 `required`、Standard Schema 和注册规则的输入类型。
- 统一公开命名，明确单条规则、规则集合、Registry 和 Validator 的职责。
- 明确 Standard Schema 只用于校验，其转换输出不会更新表单值。
- 使用稳定、可判别的校验结果和错误类型。
- 防止异步旧结果覆盖新状态，并为后续 adapter 提供必要的内部上下文。

## 非目标

- 本次不实现 async-validator 或 Zod adapter。
- 本次不让 Standard Schema 的转换输出写回 Store。
- 本次不改变字段之间的顺序校验策略，也不引入并行校验。
- 本次只定义最小的公共 `ValidationRule` 协议，不实现 adapter 注册、生命周期或自动发现机制。
- 本次不保留 `createRequiredRule` 等旧 API 的弃用过渡期。

## 总体架构

校验系统分为 4 层：

1. 字段配置层：接收 `required`、Standard Schema 和注册规则名称。
2. 规则解析层：ValidationRuleRegistry 将名称解析为具体规则或规则工厂结果。
3. 执行层：所有来源归一化为 `ValidationRule`，由 Validator 调度。
4. 结果与状态层：Validator 维护字段错误和异步运行状态，并返回 `ValidationResult`。

数据流如下：

```text
字段 required + rules
        │
        ├── required ──────────────┐
        │                          │
        ├── Standard Schema ───────┼──> ValidationRule[]
        │                          │
        └── 注册规则名称 ─> Registry ┘
                                       │
                                       v
                                   Validator
                                       │
                                       v
                              ValidationResult
```

## 字段必填语义

### 配置类型

`required` 同时表达必填校验和必填标记，不再只是展示属性：

```ts
export interface RequiredOptions<TValue = unknown> {
  message?: string
  isEmpty?: (value: TValue | null | undefined) => boolean
}

export type RequiredRule<TValue = unknown> = boolean | RequiredOptions<TValue>
```

基本用法：

```ts
{
  name: "username",
  required: true
}
```

自定义提示和空值判断：

```ts
{
  name: "files",
  required: {
    message: "请上传文件",
    isEmpty: files => !files?.length
  }
}
```

默认空值判断覆盖以下值：

- `undefined`
- `null`
- 空字符串 `""`
- 空数组 `[]`

数值 `0`、布尔值 `false`、非空对象和非空数组均视为有效值。

### 运行时语义

- `required: false` 或未设置时，不创建必填执行规则。
- `required: true` 时，使用默认提示；存在字段 `label` 时提示为 `${label}为必填项`，否则提示为 `此项为必填项`。
- `required` 为配置对象时，优先使用 `message`。提供 `isEmpty` 时，它会完整替换默认空值判断，并接收 `TValue | null | undefined`。
- 必填标记只由 `required` 决定，不能根据是否存在普通 `rules` 推导。
- 全局默认配置中的 `required` 具有相同语义；设为 `true` 会让未覆盖该配置的字段同时显示必填标记并执行必填校验。
- 动态依赖对 `required` 的覆盖类型同步扩展为 `RequiredRule<TValue>`。

删除以下 API 和注册名称：

```text
createRequiredRule
createSelectRequiredRule
createUploadRequiredRule
required
selectRequired
uploadRequired
defaultMessage
```

上表中的 3 个字符串表示旧的内置 Registry 规则名称；字段属性 `required` 保留并升级为真正的必填语义。

## 字段规则类型

### 基础类型

`rules` 只承载必填之外的附加校验：

```ts
export type DefinedFieldValue<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = Exclude<FieldValue<TValues, TName>, undefined>

export type FieldRule<
  TValues extends Values,
  TName extends NamePath<TValues>,
  TValue = DefinedFieldValue<TValues, TName>,
> =
  | ValidationRuleName<TValue>
  | ValidationRule<TValue, TValues, TName>
  | StandardSchemaV1<TValue, unknown>

export type FieldRules<
  TValues extends Values,
  TName extends NamePath<TValues>,
> =
  | FieldRule<TValues, TName>
  | readonly FieldRule<TValues, TName>[]
```

Standard Schema 的第二个泛型固定为 `unknown`，表示 Schemx 不消费其输出。Validator 始终返回校验时的原始 `TValues` 快照，不使用 Schema 的转换结果更新 Store。若未来需要值转换，应设计独立的 `parse()` 流程。

`FieldValue<TValues, TName>` 因运行时路径可能尚未初始化而始终包含 `undefined`。规则配置改用 `DefinedFieldValue` 表达表单模型声明的值类型，使 `email: string` 可以接受 `z.string()`。Validator 执行自定义规则时仍会把可能缺失的值表示为 `TValue | undefined`。Standard Schema 的 `validate()` 本身接收 `unknown`，因此仍能处理缺失值并返回 issue。

### 字段路径推导

`SchemxBase` 新增 `TName` 泛型，并使用 `DefinedFieldValue<TValues, TName>` 约束字段规则：

```ts
export interface SchemxBase<
  TValues extends Values,
  TName extends NamePath<TValues>,
  TComponent extends ComponentType<TValues>,
> {
  name: TName
  required?: RequiredRule<DefinedFieldValue<TValues, TName>>
  rules?: FieldRules<TValues, TName>
  componentType: TComponent
}
```

`SchemxBaseField<TValues>` 需要同时保留字段路径和渲染器组件的分布式联合，使下列行为成立：

```ts
interface FormValues {
  email: string
  age: number
  files: File[]
}

// 正确
const emailField = {
  name: "email",
  componentType: "input",
  rules: [z.string().email()]
}

// 类型错误：age 的值类型是 number
const ageField = {
  name: "age",
  componentType: "input",
  rules: [z.string()]
}
```

按 `NamePath × componentType` 展开的联合类型可能增加 TypeScript 的计算量。实现阶段必须增加类型性能基准，覆盖深层字段和多个 Renderer 的组合。若开销不可接受，应通过 `defineSchema()` 一类辅助函数提供字段级精确推导，不能直接退回全局 `unknown`。

## 注册规则类型

### 声明合并

使用单数命名 `ValidationRuleDefinition`，其 value 表示规则适用的字段值类型：

```ts
export interface ValidationRuleDefinition {}

declare module "@schemx/core" {
  interface ValidationRuleDefinition {
    email: string
    positive: number
    fileSize: File[]
  }
}
```

`ValidationRuleName<TValue>` 根据字段值类型筛选可用名称：

```ts
export type ValidationRuleName<TValue> = {
  [K in keyof ValidationRuleDefinition]:
    TValue extends ValidationRuleDefinition[K] ? K : never
}[keyof ValidationRuleDefinition]
```

实现时需要处理空声明：未扩展 `ValidationRuleDefinition` 时，规则名称回退为 `string`，保证 JavaScript 和无需严格声明的项目仍可使用 Registry。

### Registry

公开类型统一使用以下名称：

```text
ValidatorsRegistry        → ValidationRuleRegistry
ValidatorsRegistryOptions → ValidationRuleRegistryOptions
ValidatorsFactory         → ValidationRuleFactory
ValidatorsEntry           → ValidationRuleEntry
ValidatorsEntryMap        → ValidationRuleMap
createValidatorsRegistry  → createValidationRuleRegistry
```

规则工厂不再接收完整 `SchemxBaseField`，只接收稳定且与校验有关的上下文：

```ts
export interface ValidationRuleFactoryContext<
  TName extends PropertyKey = string,
> {
  readonly name: TName
  readonly label: string
  readonly required: boolean
}

export type ValidationRuleFactory<TValue> = (
  context: ValidationRuleFactoryContext
) => ValidationRule<TValue> | StandardSchemaV1<TValue, unknown>

export type ValidationRuleEntry<TValue> =
  | ValidationRule<TValue>
  | StandardSchemaV1<TValue, unknown>
  | ValidationRuleFactory<TValue>

export type ValidationRuleMap = {
  [K in keyof ValidationRuleDefinition]:
    ValidationRuleEntry<ValidationRuleDefinition[K]>
}
```

Registry 的 `register()`、`registerAll()` 和 `get()` 必须同时约束规则名称及其声明的值类型。Registry 只负责命名规则，不再预注册任何 Schemx 内置必填规则。

## 内部执行协议

字段配置和可执行规则使用不同类型。所有规则在进入 Validator 前归一化为最小公共协议：

```ts
export interface ValidationRuleContext<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  readonly name: TName
  readonly values: Readonly<TValues>
  readonly signal: AbortSignal
}

export interface ValidationRuleIssue {
  readonly message: string
  readonly code?: string
  readonly cause?: unknown
}

export type ValidationRuleResult =
  | { valid: true }
  | { valid: false; issues: readonly ValidationRuleIssue[] }

export interface ValidationRule<
  TValue = unknown,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  validate(
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleResult | Promise<ValidationRuleResult>
}
```

归一化来源如下：

- `required` 转换为 Schemx 内部必填规则。
- Standard Schema 转换为 Standard Schema wrapper。
- 字符串名称先经 ValidationRuleRegistry 解析，再转换为 wrapper。

`ValidationRule`、`ValidationRuleResult`、`ValidationRuleIssue` 和 `ValidationRuleContext` 是公共低层协议。字段配置可以直接使用 `ValidationRule`，ValidationRuleRegistry 也可以注册它。未来 async-validator adapter 可以返回该协议；`ValidationRuleContext.values` 可以映射为 async-validator 的完整 `source`，当前 Standard Schema wrapper 不使用它。

## 执行语义

### 单字段规则顺序

单字段规则按以下顺序执行：

1. 先执行 `required`。
2. `required` 失败时记录必填错误，并停止该字段的后续规则。
3. `required` 通过或未配置时，按声明顺序执行其他规则。
4. 收集其他规则返回的全部 issue。

没有配置 `required` 时，空值仍会传给 Standard Schema。可选语义由 Schema 自己表达，例如使用 `z.string().email().optional()`，Schemx 不隐式跳过空值。

字段之间继续顺序执行。本次不改变全量校验的时序和并发行为。

### 规则异常

规则抛出的异常转换为当前字段的校验错误，但不阻止其他字段继续校验。`createValidator()` 接受可选异常处理器：

```ts
export interface CreateValidatorOptions<TValues extends Values> {
  onRuleError?: (
    error: unknown,
    context: ValidationRuleContext<TValues, NamePath<TValues>>
  ) => string
}
```

默认错误信息为 `校验执行失败`。业务方可以在处理器中上报异常，并返回适合展示的提示。Validator 不再用固定 `console.warn()` 作为唯一异常通道。

### 异步竞争

Validator 为每个字段维护独立运行状态：

```ts
interface ValidationRun {
  readonly version: number
  readonly controller: AbortController
}
```

- 新一轮字段校验开始前中止上一轮 `AbortController`。
- 每次写入字段错误前检查运行版本。
- 旧规则可以自然结束，但不得覆盖新一轮结果。
- 支持取消的规则可以监听 `ValidationRuleContext.signal` 提前终止。
- Validator 销毁或字段规则移除时，中止该字段尚未完成的校验。
- 因中止产生的异常不转换成用户可见错误。
- 每次方法调用使用本轮局部 issue 构造返回值；响应式错误状态只接受仍为最新版本的写入。

## 校验结果与错误类型

### 错误类型

字段错误和表单错误使用判别联合，不再使用 `"$form"` 伪字段路径：

```ts
export interface FieldValidationError<TName extends PropertyKey = string> {
  readonly scope: "field"
  readonly name: TName
  readonly messages: readonly string[]
}

export interface FormValidationError {
  readonly scope: "form"
  readonly messages: readonly string[]
}

export type ValidationError<TName extends PropertyKey = string> =
  | FieldValidationError<TName>
  | FormValidationError
```

依赖解析超时等表单级问题返回 `FormValidationError`。字段 pending 等能够定位字段的问题返回 `FieldValidationError`。

### 结果类型

```ts
export interface ValidationSuccess<TValues extends Values> {
  readonly valid: true
  readonly values: TValues
  readonly errors: readonly []
}

export interface ValidationFailure<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly valid: false
  readonly values: TValues
  readonly errors: readonly ValidationError<TName>[]
}

export type ValidationResult<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = ValidationSuccess<TValues> | ValidationFailure<TValues, TName>
```

使用示例：

```ts
const result = await form.validate()

if (!result.valid) {
  for (const error of result.errors) {
    if (error.scope === "field") {
      console.log(error.name, error.messages)
    } else {
      console.log(error.messages)
    }
  }
}
```

公开命名调整如下：

```text
ValidateResult      → ValidationResult
ValidateError       → 删除，由 ValidationResult 失败分支表达
FieldError          → FieldValidationError
FieldError.field    → FieldValidationError.name
FieldError.message  → FieldValidationError.messages
result.ok           → result.valid
result.error.errors → result.errors
```

成功和失败分支都包含 `values` 与 `errors`。成功时 `errors` 是只读空元组，调用方无需处理 `undefined`。需要单独引用失败分支时使用 `ValidationFailure`，例如 `onFinishFailed` 的参数类型。

## Validator API

Validator 只保留 `TValues` 泛型，各字段方法自行推导 `TName`：

```ts
export interface Validator<TValues extends Values> {
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: readonly ValidationRule<
      DefinedFieldValue<TValues, TName>,
      TValues,
      TName
    >[]
  ): void

  removeFieldRules(name: NamePath<TValues>): void

  getFieldErrors(name: NamePath<TValues>): readonly string[]

  setFieldErrors(
    name: NamePath<TValues>,
    messages: readonly string[]
  ): void

  clearFieldErrors(name: NamePath<TValues>): void

  clearErrors(): void

  validateField<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): Promise<ValidationResult<TValues, TName>>

  validate(values: TValues): Promise<ValidationResult<TValues>>
}
```

方法命名变化如下：

```text
register()       → setFieldRules()
unregister()     → removeFieldRules()
getFieldError()  → getFieldErrors()
setFieldError()  → setFieldErrors()
reset(paths)     → clearFieldErrors() 或 clearErrors()
```

`setFieldRules()` 使用替换语义，不再隐式追加。调用方传入的规则和错误数组在存储前复制，Getter 只返回只读数据，避免外部修改内部响应式状态。

Validator 内部只维护以下状态：

```ts
rules: Map<NamePath<TValues>, readonly ValidationRule[]>
errors: SignalMap<NamePath<TValues>, readonly string[]>
runs: Map<NamePath<TValues>, ValidationRun>
```

表单级错误不写入字段错误 Map，只存在于当次 `ValidationResult`。

## Form 与字段运行时集成

ValidationEffect 从字段有效状态中读取 `required`、`rules`、`visible`、`readonly`、`disabled` 和必要的字段元数据：

- 字段不可见、只读或禁用时，移除字段规则并清空字段错误。
- `required` 或 `rules` 变化时，重新解析并一次性调用 `setFieldRules()`。
- 不再构造通用 `defaultMessage`。
- 字段存在普通规则时，不自动修改 `required`。
- FormItem 根据有效 `required` 配置决定是否展示必填标记。

Form API 同步调整为复数错误命名和新的结果类型。`submit()` 和 `validate()` 返回 `ValidationResult`；`onFinish` 接收成功值，`onFinishFailed` 接收 `ValidationFailure`，不再依赖 `ValidateError`。

## 测试设计

### 类型测试

- 字符串字段接受 `StandardSchemaV1<string, unknown>`，拒绝 number Schema。
- number 字段接受 number Schema，拒绝 string Schema。
- `required.isEmpty` 参数推导为当前字段值类型。
- 声明合并后，注册规则名称按字段值类型过滤。
- 未声明规则映射时，Registry 名称回退为 `string`。
- `validateField("email")` 的字段错误名称收窄为 `"email"`。
- `ValidationError` 可通过 `scope` 收窄。
- Standard Schema 输出类型不会改变 `ValidationResult.values`。
- 深层字段和多 Renderer 联合的类型检查时间处于可接受范围。

### 运行时测试

- `required` 默认识别 `undefined`、`null`、空字符串和空数组。
- `0` 与 `false` 不会触发必填错误。
- 自定义 `message` 和 `isEmpty` 生效。
- `required` 失败后不执行其他规则。
- 非必填字段的空值仍传给 Standard Schema。
- 多条规则的 issue 会完整聚合。
- 规则异常通过 `onRuleError` 转换。
- 异步旧结果不能覆盖新结果。
- 移除字段规则或销毁 Validator 会中止未完成的校验。
- `getFieldErrors()` 在无错误时稳定返回 `[]`。
- `setFieldRules()` 替换旧规则，不会追加。
- ValidationRuleRegistry 工厂只收到精简上下文。
- 表单依赖超时返回 `scope: "form"`。
- 字段 pending 返回 `scope: "field"`。

### 回归测试

- 字段可见性、只读和禁用状态仍能正确注册或移除规则。
- 动态依赖更新 `required` 或 `rules` 后会重新校验。
- FormItem 必填标记只跟随 `required`。
- `validateField()`、`validate()` 和 `submit()` 的回调及状态更新保持一致。
- Vue 和 Vant 的表单公开类型与 Core 保持一致。

## 迁移示例

旧写法：

```ts
const registry = createValidatorsRegistry()

registry.registerAll({
  required: createRequiredRule,
  selectRequired: createSelectRequiredRule,
  uploadRequired: createUploadRequiredRule
})

const field = {
  name: "city",
  rules: ["selectRequired"]
}
```

新写法：

```ts
const registry = createValidationRuleRegistry()

const field = {
  name: "city",
  required: {
    message: "请选择城市"
  }
}
```

普通命名规则迁移：

```ts
declare module "@schemx/core" {
  interface ValidationRuleDefinition {
    email: string
  }
}

const registry = createValidationRuleRegistry()
registry.register("email", z.string().email("邮箱格式错误"))
```

结果处理迁移：

```ts
// 旧写法
if (!result.ok) {
  consume(result.error.errors)
}

// 新写法
if (!result.valid) {
  consume(result.errors)
}
```

## 实施边界

本次重构会修改 Core 的类型、Validator、ValidationRuleRegistry、ValidationEffect、Form API、默认配置、测试和文档，并同步更新 Vue、Vant 与示例中的公开类型和调用方式。

实现应按以下依赖顺序推进：

1. 建立新的规则、结果和错误类型及类型测试。
2. 实现公共 `ValidationRule` 协议、Standard Schema wrapper 和 `required` 归一化。
3. 重构 Validator API、错误状态和异步运行状态。
4. 重构 ValidationRuleRegistry 及声明合并类型。
5. 更新字段 Schema、ValidationEffect 和 Form 集成。
6. 更新 Vue、Vant、示例与文档。
7. 运行包边界、类型、单元、格式和构建验证。

## 验收标准

- 不再导出或使用 3 个 `create*RequiredRule` 工厂及对应内置 Registry 名称。
- `required` 同时决定必填校验和必填标记，普通规则不会隐式改变必填状态。
- 字段规则和 `required.isEmpty` 能根据字段路径推导值类型。
- 声明合并可以约束命名规则适用的字段值类型。
- Standard Schema 的转换输出不会改变 Store 或 `ValidationResult.values` 类型。
- 校验结果统一使用 `{ valid, values, errors }`，字段错误和表单错误可判别。
- Validator Getter 不暴露可变数组，无错误时稳定返回只读空数组。
- 异步旧结果不会覆盖新结果。
- Core、Vue、Vant、示例、测试和文档不再引用旧命名。
- 全部类型检查、单元测试、格式检查、包边界检查和构建通过。
