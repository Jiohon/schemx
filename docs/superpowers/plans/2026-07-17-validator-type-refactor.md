# Validator 类型体系重构实施计划

> **执行代理须知：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务实施。使用复选框跟踪步骤；每个任务完成测试和审查后再进入下一项。

**目标：** 重构 Schemx 校验类型和运行时，使 `required` 成为真正的必填语义，字段规则按路径推导值类型，并统一 Validator、ValidationRuleRegistry、错误和结果 API。

**架构：** 字段配置保留 `required`、原生 `ValidationRule`、Standard Schema 和命名规则；ValidationController 负责解析配置并归一化为 `ValidationRule[]`；Validator 只执行规则、维护字段错误和异步运行状态。Standard Schema 仅参与校验，不把转换输出写回 Store。

**技术栈：** TypeScript、Vitest、fast-check、Standard Schema v1、`@preact/signals-core`、pnpm workspace、Vite。

## 全局约束

- 允许破坏性更新，不提供旧 API 兼容层。
- 不实现 async-validator 或 Zod adapter。
- 不使用 Standard Schema 输出更新 Store。
- 字段之间继续顺序校验，不引入并行校验。
- 不修改或提交工作区中与本计划无关的现有改动。
- 执行命令前使用 Node.js 22.13 或更高版本；当前 pnpm 11.12.0 无法在 Node.js 20.16.0 下运行。
- 面向用户的文档、注释和提交说明使用简体中文；代码标识符和第三方库名称保留英文。

---

## 文件结构

### 新增文件

- `packages/core/src/validator/types.ts`：公共 `ValidationRule`、结果、错误和 Validator 接口。
- `packages/core/src/validator/rules.ts`：`required` 与 Standard Schema 到 `ValidationRule` 的归一化函数。
- `packages/core/src/validator/validationController.ts`：连接字段配置、ValidationRuleRegistry 与 Validator。
- `packages/core/src/validator/__tests__/rules.test.ts`：内置必填与 Standard Schema wrapper 测试。
- `packages/core/src/validator/__tests__/validationController.test.ts`：配置解析与 Registry 集成测试。
- `packages/core/src/__tests__/types/validation.types.ts`：字段路径、Schema 输入和规则名称类型测试。
- `packages/core/tsconfig.type-tests.json`：只编译类型测试的独立配置。

### 重命名文件

- `packages/core/src/registry/validatorRegistry.ts` → `packages/core/src/registry/validationRuleRegistry.ts`。
- `packages/core/src/registry/__tests__/validatorRegistry.test.ts`（若当前测试仍内联在其他文件，则新建）→ `packages/core/src/registry/__tests__/validationRuleRegistry.test.ts`。

### 删除文件

- `packages/core/src/validator/defaultRules.ts`。
- `packages/core/src/validator/__tests__/defaultRules.test.ts`。

### 主要修改文件

- Core 类型与导出：`packages/core/src/types/rule.ts`、`types/schema.ts`、`types/form.ts`、`types/dependencies.ts`、`types/index.ts`、`validator/index.ts`、`registry/index.ts`、`src/index.ts`。
- Core 运行时：`packages/core/src/validator/validator.ts`、`field/validationEffect.ts`、`field/runtimeState.ts`、`descriptor/createDescriptor.ts`、`descriptor/types.ts`、`schemxContext.ts`、`createForm.ts`、`createField.ts`。
- Core 测试：`validator/__tests__/validator.test.ts`、`field/__tests__/validationEffect.test.ts`、`field/__tests__/runtimeState.test.ts`、`compiler/__tests__/compiler.test.ts`、`src/__tests__/createForm.test.ts`、`src/__tests__/createField.test.ts`。
- 框架包与文档：`packages/vue/src/**`、`packages/vant/src/**`、3 个 package README、根 `README.md` 和受影响示例。

---

### Task 1：建立公共校验类型和字段级类型推导

**Files:**

- Create: `packages/core/src/validator/types.ts`
- Create: `packages/core/src/__tests__/types/validation.types.ts`
- Create: `packages/core/tsconfig.type-tests.json`
- Modify: `packages/core/src/types/rule.ts`
- Modify: `packages/core/src/types/schema.ts`
- Modify: `packages/core/src/types/index.ts`
- Modify: `packages/core/src/validator/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`

**Interfaces:**

- Produces: `RequiredOptions`、`RequiredRule`、`DefinedFieldValue`、`ValidationRuleDefinition`、`ValidationRuleName`、`FieldRule`、`FieldRules`。
- Produces: `ValidationRuleContext`、`ValidationRuleIssue`、`ValidationRuleResult`、`ValidationRule`、`FieldValidationError`、`FormValidationError`、`ValidationError`、`ValidationSuccess`、`ValidationFailure`、`ValidationResult`。
- Later tasks consume these exact names; do not add legacy aliases.

- [ ] **Step 1：添加失败的字段级类型测试**

在 `packages/core/src/__tests__/types/validation.types.ts` 写入可独立编译的断言：

```ts
import type {
  FieldRules,
  RequiredRule,
  SchemxBaseField,
  StandardSchemaV1,
  ValidationError,
  ValidationResult,
} from "../../index"

interface FormValues {
  email: string
  age: number
  files: File[]
}

declare const stringSchema: StandardSchemaV1<string, string>
declare const numberSchema: StandardSchemaV1<number, number>

const fields: SchemxBaseField<FormValues>[] = [
  {
    name: "email",
    label: "邮箱",
    componentType: "input",
    required: { isEmpty: (value) => value === undefined || value === "" },
    rules: [stringSchema],
  },
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    rules: [numberSchema],
  },
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    // @ts-expect-error age 字段不能使用 string Schema。
    rules: [stringSchema],
  },
]

declare module "../../index" {
  interface ValidationRuleDefinition {
    emailRule: string
    positive: number
  }
}

const emailRules: FieldRules<FormValues, "email"> = ["emailRule"]
// @ts-expect-error email 字段不能使用 number 规则名。
const invalidEmailRules: FieldRules<FormValues, "email"> = ["positive"]

const required: RequiredRule<File[]> = {
  isEmpty: (files) => !files?.length,
}

declare const result: ValidationResult<FormValues, "email">
if (!result.valid) {
  const error: ValidationError<"email"> = result.errors[0]
  if (error.scope === "field") {
    const name: "email" = error.name
    void name
  }
}

void fields
void emailRules
void invalidEmailRules
void required
```

- [ ] **Step 2：添加类型测试 tsconfig 和脚本**

创建 `packages/core/tsconfig.type-tests.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true
  },
  "include": ["src/__tests__/types/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

在 `packages/core/package.json` 的 `scripts` 中增加：

```json
"type-test": "tsc -p tsconfig.type-tests.json --noEmit"
```

- [ ] **Step 3：运行类型测试并确认失败**

Run: `pnpm --filter @schemx/core type-test`

Expected: FAIL，至少包含 `Module '"../../index"' has no exported member 'FieldRules'` 或 `ValidationResult` 尚不存在的错误。

- [ ] **Step 4：实现公共校验协议和结果类型**

在 `packages/core/src/validator/types.ts` 定义：

```ts
import type { NamePath, Values } from "../types/form"

export interface ValidationRuleContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
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
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly issues: readonly ValidationRuleIssue[]
      readonly bail?: boolean
    }

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

- [ ] **Step 5：实现字段规则和声明合并类型**

重写 `packages/core/src/types/rule.ts` 的公共类型，保留中文注释但使用以下签名：

```ts
import type { ValidationRule } from "../validator/types"
import type { FieldValue, NamePath, Values } from "./form"
import type { StandardSchemaV1 } from "./standardSchema"

export interface RequiredOptions<TValue = unknown> {
  message?: string
  isEmpty?: (value: TValue | null | undefined) => boolean
}

export type RequiredRule<TValue = unknown> = boolean | RequiredOptions<TValue>

export type DefinedFieldValue<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = Exclude<FieldValue<TValues, TName>, undefined>

export interface ValidationRuleDefinition {}

type DeclaredRuleName = Extract<keyof ValidationRuleDefinition, string>

export type ValidationRuleName<TValue> = [DeclaredRuleName] extends [never]
  ? string
  : {
      [K in DeclaredRuleName]: TValue extends ValidationRuleDefinition[K]
        ? K
        : never
    }[DeclaredRuleName]

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
> = FieldRule<TValues, TName> | readonly FieldRule<TValues, TName>[]
```

- [ ] **Step 6：让字段 Schema 捕获具体路径**

在 `packages/core/src/types/schema.ts` 中把 `SchemxBase` 泛型改为 `TValues, TName, TKey`，并把字段联合拆成按名称和 Renderer 两层分发：

```ts
export interface SchemxBase<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TKey extends string = SchemxComponentTypeKey<TValues>,
> {
  name: TName
  required?: RequiredRule<DefinedFieldValue<TValues, TName>>
  rules?: FieldRules<TValues, TName>
  componentType: TKey
  // 其余现有字段保持不变。
}

type SchemxBaseFieldByName<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = [Extract<keyof SchemxRendererDefinition<TValues>, string>] extends [never]
  ? SchemxBase<TValues, TName, string>
  : {
      [TKey in Extract<keyof SchemxRendererDefinition<TValues>, string>]:
        SchemxBase<TValues, TName, TKey>
    }[Extract<keyof SchemxRendererDefinition<TValues>, string>]

export type SchemxBaseField<TValues extends Values = Values> = {
  [TName in NamePath<TValues>]: SchemxBaseFieldByName<TValues, TName>
}[NamePath<TValues>]
```

同步修正本文件内所有 `SchemxBase<TValues, TKey>` 引用的泛型顺序。

- [ ] **Step 7：导出新类型并运行类型测试**

从 `types/index.ts`、`validator/index.ts` 和 Core 根入口导出 Task 1 新增类型。为保证中间提交可编译，旧 `SchemxRuleDefinition`、`SchemxRules` 暂时作为内部迁移别名保留到 Task 7；不得在新代码中继续使用。

Run: `pnpm --filter @schemx/core type-test`

Expected: PASS，无 TypeScript diagnostics。

Run: `pnpm --filter @schemx/core type-check`

Expected: PASS。若旧运行时代码因泛型顺序变化失败，在本步骤同步调整纯类型引用，不改变运行时行为。

- [ ] **Step 8：提交类型契约**

```bash
git add packages/core/src/validator/types.ts packages/core/src/types packages/core/src/validator/index.ts packages/core/src/index.ts packages/core/src/__tests__/types/validation.types.ts packages/core/tsconfig.type-tests.json packages/core/package.json
git commit -m "refactor(core): 重建校验类型契约"
```

---

### Task 2：实现 required 与 Standard Schema 规则归一化

**Files:**

- Create: `packages/core/src/validator/rules.ts`
- Create: `packages/core/src/validator/__tests__/rules.test.ts`
- Modify: `packages/core/src/validator/index.ts`

**Interfaces:**

- Consumes: Task 1 的 `RequiredRule`、`ValidationRule`、`ValidationRuleContext` 和 `StandardSchemaV1`。
- Produces: `createRequiredValidationRule()` 与 `createStandardSchemaValidationRule()`；仅 Validator 子模块内部使用，不从 Core 根入口导出。

- [ ] **Step 1：编写 required 和 Standard Schema wrapper 失败测试**

在 `rules.test.ts` 覆盖：

```ts
it.each([undefined, null, "", []])("默认 required 拒绝空值 %#", async (value) => {
  const rule = createRequiredValidationRule({ required: true, label: "用户名" })
  const result = await rule.validate(value, createContext())

  expect(result).toEqual({
    valid: false,
    issues: [{ message: "用户名为必填项", code: "required" }],
    bail: true,
  })
})

it.each([0, false, "value", [1]])("默认 required 接受非空值 %#", async (value) => {
  const rule = createRequiredValidationRule({ required: true, label: "字段" })
  await expect(rule.validate(value, createContext())).resolves.toEqual({ valid: true })
})

it("自定义 isEmpty 完整替换默认判断", async () => {
  const rule = createRequiredValidationRule<string>({
    required: { message: "请选择有效值", isEmpty: (value) => value === "N/A" },
    label: "值",
  })

  await expect(rule.validate("N/A", createContext())).resolves.toMatchObject({
    valid: false,
  })
  await expect(rule.validate("", createContext())).resolves.toEqual({ valid: true })
})

it("Standard Schema wrapper 只映射 issues，不返回转换值", async () => {
  const schema = createSchema(() => ({ value: 123 }))
  const rule = createStandardSchemaValidationRule(schema)

  await expect(rule.validate("123", createContext())).resolves.toEqual({ valid: true })
})
```

- [ ] **Step 2：运行测试并确认失败**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/rules.test.ts`

Expected: FAIL，提示无法解析 `../rules`。

- [ ] **Step 3：实现两个归一化函数**

在 `rules.ts` 实现以下边界：

```ts
export function createRequiredValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(options: {
  required: Exclude<RequiredRule<TValue>, false>
  label: string
}): ValidationRule<TValue, TValues, TName> {
  const config = options.required === true ? {} : options.required
  const isEmpty = config.isEmpty ?? defaultIsEmpty
  const message = config.message ??
    (options.label ? `${options.label}为必填项` : "此项为必填项")

  return {
    validate(value) {
      return isEmpty(value)
        ? { valid: false, issues: [{ message, code: "required" }], bail: true }
        : { valid: true }
    },
  }
}

export function createStandardSchemaValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(schema: StandardSchemaV1<TValue, unknown>): ValidationRule<TValue, TValues, TName> {
  return {
    async validate(value) {
      const result = await schema["~standard"].validate(value)
      return result.issues
        ? {
            valid: false,
            issues: result.issues.map((issue) => ({ message: issue.message })),
          }
        : { valid: true }
    },
  }
}
```

`defaultIsEmpty()` 必须只判断 `undefined`、`null`、`""` 和空数组。

- [ ] **Step 4：运行规则测试**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/rules.test.ts`

Expected: PASS，全部 required 和 wrapper 用例通过。

- [ ] **Step 5：提交归一化规则**

```bash
git add packages/core/src/validator/rules.ts packages/core/src/validator/__tests__/rules.test.ts packages/core/src/validator/index.ts
git commit -m "refactor(core): 归一化必填与标准校验规则"
```

---

### Task 3：重写 Validator 执行器和异步状态

**Files:**

- Modify: `packages/core/src/validator/types.ts`
- Modify: `packages/core/src/validator/validator.ts`
- Modify: `packages/core/src/validator/__tests__/validator.test.ts`
- Modify: `packages/core/src/validator/index.ts`

**Interfaces:**

- Consumes: `ValidationRule<TValue, TValues, TName>`。
- Produces: `CreateValidatorOptions<TValues>`、`Validator<TValues>`、`createValidator<TValues>(options?)`。
- `Validator` methods: `setFieldRules`、`removeFieldRules`、`getFieldErrors`、`setFieldErrors`、`clearFieldErrors`、`clearErrors`、`validateField`、`validate`、`destroy`。

- [ ] **Step 1：将 Validator 测试改写为新 API**

保留现有 fast-check 属性测试，并增加以下核心用例：

```ts
it("setFieldRules 使用替换语义", async () => {
  const validator = createValidator<TestForm>()
  validator.setFieldRules("name", [failingRule("旧错误")])
  validator.setFieldRules("name", [passingRule()])

  await expect(validator.validateField("name", baseValues)).resolves.toEqual({
    valid: true,
    values: baseValues,
    errors: [],
  })
})

it("getFieldErrors 无错误时稳定返回只读空数组", () => {
  const validator = createValidator<TestForm>()
  expect(validator.getFieldErrors("name")).toEqual([])
})

it("规则异常通过 onRuleError 转换", async () => {
  const validator = createValidator<TestForm>({
    onRuleError: (error) => `执行异常: ${(error as Error).message}`,
  })
  validator.setFieldRules("name", [throwingRule(new Error("boom"))])

  const result = await validator.validateField("name", baseValues)
  expect(result).toMatchObject({
    valid: false,
    errors: [{ scope: "field", name: "name", messages: ["执行异常: boom"] }],
  })
})

it("旧异步结果不能覆盖新状态", async () => {
  const first = deferred<ValidationRuleResult>()
  const second = deferred<ValidationRuleResult>()
  const validator = createValidator<TestForm>()
  validator.setFieldRules("name", [sequencedRule(first.promise, second.promise)])

  const oldRun = validator.validateField("name", { ...baseValues, name: "old" })
  const newRun = validator.validateField("name", { ...baseValues, name: "new" })

  second.resolve({ valid: true })
  await newRun
  first.resolve({ valid: false, issues: [{ message: "旧错误" }] })
  await oldRun

  expect(validator.getFieldErrors("name")).toEqual([])
})

it("destroy 中止运行并清空全部状态", async () => {
  const validator = createValidator<TestForm>()
  const signals: AbortSignal[] = []
  validator.setFieldRules("name", [captureSignalRule(signals)])
  void validator.validateField("name", baseValues)

  validator.destroy()
  validator.destroy()

  expect(signals[0].aborted).toBe(true)
  expect(validator.getFieldErrors("name")).toEqual([])
})
```

- [ ] **Step 2：运行 Validator 测试并确认失败**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/validator.test.ts`

Expected: FAIL，旧 Validator 不存在 `setFieldRules()`、`valid` 和 `destroy()`。

- [ ] **Step 3：在 types.ts 补齐 Validator 接口**

按规格加入：

```ts
export interface CreateValidatorOptions<TValues extends Values> {
  onRuleError?: (
    error: unknown,
    context: ValidationRuleContext<TValues, NamePath<TValues>>
  ) => string
}

export interface Validator<TValues extends Values> {
  setFieldRules<TName extends NamePath<TValues>>(
    name: TName,
    rules: readonly ValidationRule<DefinedFieldValue<TValues, TName>, TValues, TName>[]
  ): void
  removeFieldRules(name: NamePath<TValues>): void
  getFieldErrors(name: NamePath<TValues>): readonly string[]
  setFieldErrors(name: NamePath<TValues>, messages: readonly string[]): void
  clearFieldErrors(name: NamePath<TValues>): void
  clearErrors(): void
  validateField<TName extends NamePath<TValues>>(
    name: TName,
    values: TValues
  ): Promise<ValidationResult<TValues, TName>>
  validate(values: TValues): Promise<ValidationResult<TValues>>
  destroy(): void
}
```

- [ ] **Step 4：重写 ValidatorImpl**

在 `validator.ts` 使用 3 张 Map：

```ts
private readonly rules = new Map<NamePath<TValues>, readonly ValidationRule[]>()
private readonly errors = createSignalMap<NamePath<TValues>, readonly string[]>()
private readonly runs = new Map<NamePath<TValues>, ValidationRun>()
private nextVersion = 0
private destroyed = false
```

每次 `validateField()`：

1. 为目标字段创建新 `AbortController`，中止旧 controller。
2. 使用局部 `messages` 收集本轮结果。
3. 规则抛出异常时，若 `signal.aborted` 则忽略；否则调用 `onRuleError`。
4. 失败结果包含 `bail: true` 时停止当前字段的剩余规则；普通失败继续聚合。
5. 返回值由局部 messages 构造。
6. 只有当前 Map 中 version 与本轮相同才更新响应式 errors。

`validate()` 顺序等待每个字段，并从每个局部结果聚合错误。`setFieldErrors()` 与 `setFieldRules()` 均复制输入数组；`getFieldErrors()` 返回新数组或共享冻结空数组。`destroy()` 中止所有 controller，清空 3 张 Map，并保持幂等。

- [ ] **Step 5：运行 Validator 测试和属性测试**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/validator.test.ts`

Expected: PASS，包括 fast-check 100 次属性测试和异步竞争测试。

- [ ] **Step 6：提交 Validator 执行器**

```bash
git add packages/core/src/validator/types.ts packages/core/src/validator/validator.ts packages/core/src/validator/__tests__/validator.test.ts packages/core/src/validator/index.ts
git commit -m "refactor(core): 重写 Validator 执行与异步状态"
```

---

### Task 4：重构 ValidationRuleRegistry

**Files:**

- Create: `packages/core/src/registry/validationRuleRegistry.ts`
- Create: `packages/core/src/registry/__tests__/validationRuleRegistry.test.ts`
- Modify: `packages/core/src/registry/index.ts`
- Modify: `packages/core/src/index.ts`
- Delete later in Task 7: `packages/core/src/registry/validatorRegistry.ts`

**Interfaces:**

- Produces: `ValidationRuleFactoryContext`、`ValidationRuleFactory`、`ValidationRuleEntry`、`ValidationRuleMap`、`ValidationRuleRegistryOptions`、`ValidationRuleRegistry`、`createValidationRuleRegistry()`。
- Registry stores only named rules and never registers built-in required rules.

- [ ] **Step 1：编写 Registry 失败测试**

```ts
declare module "../../types/rule" {
  interface ValidationRuleDefinition {
    email: string
    positive: number
  }
}

it("注册、查询和 override=false 保持一致", () => {
  const registry = createValidationRuleRegistry()
  const first = stringSchema("first")
  const second = stringSchema("second")

  registry.register("email", first)
  registry.register("email", second, { override: false })

  expect(registry.get("email")).toBe(first)
  expect(registry.has("email")).toBe(true)
})

it("工厂只收到精简字段上下文", () => {
  const factory = vi.fn(() => stringSchema("email"))
  const registry = createValidationRuleRegistry()
  registry.register("email", factory)

  registry.resolve("email", {
    name: "user.email",
    label: "邮箱",
    required: true,
  })

  expect(factory).toHaveBeenCalledWith({
    name: "user.email",
    label: "邮箱",
    required: true,
  })
})
```

- [ ] **Step 2：运行 Registry 测试并确认失败**

Run: `pnpm --filter @schemx/core exec vitest run src/registry/__tests__/validationRuleRegistry.test.ts`

Expected: FAIL，提示 `createValidationRuleRegistry` 不存在。

- [ ] **Step 3：实现新 Registry**

沿用旧 Registry 的 `register`、`registerAll`、`get`、`has`、`unregister`、`getNames`、`clear` 和 `size` 行为，但将 Schema 解析从整字段方法改成单名称方法：

```ts
type DeclaredValidationRuleName = Extract<keyof ValidationRuleDefinition, string>

type ValidationRuleKey = [DeclaredValidationRuleName] extends [never]
  ? string
  : DeclaredValidationRuleName

type ValidationRuleValue<K extends ValidationRuleKey> =
  K extends DeclaredValidationRuleName
    ? ValidationRuleDefinition[K]
    : unknown

export type ValidationRuleMap = [DeclaredValidationRuleName] extends [never]
  ? Record<string, ValidationRuleEntry<unknown>>
  : {
      [K in DeclaredValidationRuleName]:
        ValidationRuleEntry<ValidationRuleDefinition[K]>
    }
```

`register()` 和 `get()` 使用 `K extends ValidationRuleKey`，条目类型使用 `ValidationRuleEntry<ValidationRuleValue<K>>`。运行时解析接收 `string`，因为字段配置层已经负责静态名称约束：

```ts
resolve<TName extends PropertyKey>(
  name: string,
  context: ValidationRuleFactoryContext<TName>
): ValidationRuleEntry<unknown> | undefined
```

若条目是工厂则调用工厂，否则原样返回；未注册名称返回 `undefined`。字段配置数组遍历和 warning 属于 ValidationController，不属于 Registry。

- [ ] **Step 4：更新导出并临时保留旧文件供后续迁移**

从 `registry/index.ts` 与 Core 根入口导出新 Registry。旧 `validatorRegistry.ts` 暂不从根入口导出新别名，但文件保留到 Task 7，避免尚未迁移的 `createForm.ts` 在本任务中断裂。

- [ ] **Step 5：运行 Registry 测试**

Run: `pnpm --filter @schemx/core exec vitest run src/registry/__tests__/validationRuleRegistry.test.ts`

Expected: PASS。

- [ ] **Step 6：提交 Registry**

```bash
git add packages/core/src/registry/validationRuleRegistry.ts packages/core/src/registry/__tests__/validationRuleRegistry.test.ts packages/core/src/registry/index.ts packages/core/src/index.ts
git commit -m "refactor(core): 新增 ValidationRuleRegistry"
```

---

### Task 5：新增 ValidationController 并迁移字段运行时

**Files:**

- Create: `packages/core/src/validator/validationController.ts`
- Create: `packages/core/src/validator/__tests__/validationController.test.ts`
- Modify: `packages/core/src/validator/index.ts`
- Modify: `packages/core/src/schemxContext.ts`
- Modify: `packages/core/src/field/validationEffect.ts`
- Modify: `packages/core/src/field/runtimeState.ts`
- Modify: `packages/core/src/descriptor/createDescriptor.ts`
- Modify: `packages/core/src/descriptor/types.ts`
- Modify: `packages/core/src/types/dependencies.ts`
- Modify: `packages/core/src/createForm.ts`
- Modify: `packages/core/src/field/__tests__/validationEffect.test.ts`
- Modify: `packages/core/src/field/__tests__/runtimeState.test.ts`
- Modify: `packages/core/src/compiler/__tests__/compiler.test.ts`

**Interfaces:**

- Produces: internal `FieldValidationConfig<TValues, TName>` and `ValidationController<TValues>`.
- `ValidationController.syncField(config)` resolves required, native rules, Standard Schema and named rules, then calls `validator.setFieldRules()` exactly once.
- `SchemxContext.validation` exposes the controller to ValidationEffect without routing internal registration through public Form APIs.

- [ ] **Step 1：编写 ValidationController 失败测试**

```ts
it("required 始终排在附加规则之前", async () => {
  const validator = createValidator<FormValues>()
  const registry = createValidationRuleRegistry()
  const controller = createValidationController({ validator, registry })
  const extra = vi.fn(() => ({ valid: false, issues: [{ message: "格式错误" }] }))

  controller.syncField({
    name: "email",
    label: "邮箱",
    required: true,
    rules: [{ validate: extra }],
  })

  const result = await validator.validateField("email", { email: "" })
  expect(result).toMatchObject({
    errors: [{ messages: ["邮箱为必填项"] }],
  })
  expect(extra).not.toHaveBeenCalled()
})

it("未注册名称输出 warning 并忽略该规则", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
  controller.syncField({
    name: "email",
    label: "邮箱",
    required: false,
    rules: ["missing"],
  })

  expect(warn).toHaveBeenCalledWith('[schemx] 未找到名为 "missing" 的校验规则')
})
```

- [ ] **Step 2：运行 Controller 测试并确认失败**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/validationController.test.ts`

Expected: FAIL，提示无法解析 `../validationController`。

- [ ] **Step 3：实现 ValidationController**

接口使用：

```ts
export interface FieldValidationConfig<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  readonly name: TName
  readonly label: string
  readonly required: RequiredRule<DefinedFieldValue<TValues, TName>> | undefined
  readonly rules: FieldRules<TValues, TName> | undefined
}

export interface ValidationController<TValues extends Values> {
  syncField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): void
  removeField(name: NamePath<TValues>): void
}
```

`syncField()` 按 required、原生 ValidationRule、Standard Schema、Registry 名称的顺序归一化。区分原生规则和 Standard Schema 时使用 `"~standard" in value`，不能用 `typeof value === "function"` 推断规则类型。最终调用一次 `validator.setFieldRules(name, normalized)`；无规则时调用 `removeFieldRules(name)`。

- [ ] **Step 4：运行 Controller 测试**

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/validationController.test.ts`

Expected: PASS。

- [ ] **Step 5：让 required 在 Descriptor 和 RuntimeState 中保留完整配置**

修改 `createDescriptor.ts`：

```ts
const mergedRequired = required ?? defaultProps.required ?? defaultConfig.required
```

删除“存在 rules 时自动 required=true”的分支。`FieldEffectiveSchema.required`、动态依赖 `required` 和 Descriptor 类型使用 `RequiredRule<...>`，不再固定为 boolean。FormItem 的展示判断在框架迁移任务中统一改成 `Boolean(required)`。

- [ ] **Step 6：ValidationEffect 通过 Context 使用 Controller**

给 `SchemxContext<TValues>` 增加：

```ts
readonly validation: ValidationController<TValues>
```

在 `createForm.ts` 中创建 ValidationRuleRegistry、Validator 和 ValidationController，并把 controller 放入 Context；此步骤暂时保留旧公开 Form 方法，Task 6 再统一改名。`ValidationController.removeField()` 同时调用 `removeFieldRules()` 和 `clearFieldErrors()`。

`ValidationRegistrationSnapshot` 增加 `required`；注册条件改为字段可校验且 `required` 启用或 `rules` 非空：

```ts
if (!visible || readonly || disabled || (!required && !hasRules(rules))) {
  context.validation.removeField(name)
  return
}

context.validation.syncField({ name, label, required, rules })
```

删除 `defaultMessage` 和 `registerRules()` 调用。

- [ ] **Step 7：更新字段运行时测试**

将旧 `{ required: true } as any` 规则夹具改为真实 `required: true`。增加断言：

```ts
it("普通规则不会把字段推导为必填", () => {
  const descriptor = createFieldDescriptor({
    required: undefined,
    rules: [passingSchema],
  })
  expect(descriptor.staticSchema.required).toBe(false)
})
```

Run: `pnpm --filter @schemx/core exec vitest run src/validator/__tests__/validationController.test.ts src/field/__tests__/validationEffect.test.ts src/field/__tests__/runtimeState.test.ts src/compiler/__tests__/compiler.test.ts`

Expected: PASS。

- [ ] **Step 8：提交 Controller 和字段运行时**

```bash
git add packages/core/src/validator packages/core/src/schemxContext.ts packages/core/src/field packages/core/src/descriptor packages/core/src/types/dependencies.ts packages/core/src/compiler/__tests__/compiler.test.ts
git commit -m "refactor(core): 接入字段校验控制器"
```

---

### Task 6：迁移 CreateForm、CreateField 和结果 API

**Files:**

- Modify: `packages/core/src/createForm.ts`
- Modify: `packages/core/src/createField.ts`
- Modify: `packages/core/src/types/form.ts`
- Modify: `packages/core/src/__tests__/createForm.test.ts`
- Modify: `packages/core/src/__tests__/createField.test.ts`
- Modify: `packages/core/src/field/validationEffect.ts`

**Interfaces:**

- Form methods: `getFieldErrors`、`setFieldErrors`、`clearFieldErrors`、`setFieldRules`、`removeFieldRules`。
- Field methods: `getErrors`、`setErrors`、`clearErrors`、`setRules`、`removeRules`。
- `validate()`、`validateField()` 和 `submit()` return `ValidationResult`；`onFinishFailed` consumes `ValidationFailure`。

- [ ] **Step 1：先把 Form 和 Field 测试改成新 API**

核心断言：

```ts
it("validateField 返回字段名收窄的扁平错误", async () => {
  const form = createForm<FormValues>({
    initialValues: { email: "" },
    schemas: [{ name: "email", label: "邮箱", componentType: "input", required: true }],
  })

  const result = await form.validateField("email")
  expect(result).toEqual({
    valid: false,
    values: { email: "" },
    errors: [{ scope: "field", name: "email", messages: ["邮箱为必填项"] }],
  })
})

it("依赖等待超时返回表单级错误", async () => {
  const result = await form.submit()
  expect(result).toMatchObject({
    valid: false,
    errors: [{ scope: "form", messages: ["表单依赖解析超时，请稍后重试"] }],
  })
})

it("createField 暴露复数错误和替换规则 API", () => {
  const field = createField(form, "email")
  field.setErrors(["错误"])
  expect(field.getErrors()).toEqual(["错误"])
  field.clearErrors()
  expect(field.getErrors()).toEqual([])
})
```

- [ ] **Step 2：运行集成测试并确认失败**

Run: `pnpm --filter @schemx/core exec vitest run src/__tests__/createForm.test.ts src/__tests__/createField.test.ts`

Expected: FAIL，旧 API 仍返回 `ok/error.errors`，且缺少复数方法。

- [ ] **Step 3：完成 CreateForm 新组件的公开配置**

沿用 Task 5 已完成的 Registry、Validator 和 ValidationController 装配，并在 `CreateFormOptions` 暴露新名称和异常处理器：

```ts
validationRuleRegistry?: ValidationRuleRegistry
onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
```

删除旧 `validatorRegistry` 选项和 3 个内置必填规则注册调用。`destroy()` 必须调用 `validator.destroy()`。

- [ ] **Step 4：迁移校验结果和错误状态**

所有结果改用：

```ts
{
  valid: false,
  values: snapshot,
  errors: [{ scope: "form", messages: [message] }],
}
```

字段 pending 使用：

```ts
{
  scope: "field",
  name: field as NamePath<TValues>,
  messages,
}
```

成功分支判断统一改成 `result.valid`；`onFinishFailed?.(result)` 直接接收失败分支。

- [ ] **Step 5：迁移 Form 和 Field 方法名**

在 `SchemxInstance`、`SchemxFormApi` 和实现中完成以下替换：

```text
getFieldError   → getFieldErrors
setFieldError   → setFieldErrors
registerRules   → setFieldRules
unregisterRules → removeFieldRules
```

在 `SchemxFieldInstance` 中完成：

```text
getError        → getErrors
setError        → setErrors
clearError      → clearErrors
registerRules   → setRules
unregisterRules → removeRules
```

`setFieldRules(name, rules)` 从当前字段 RuntimeState 读取有效 `label` 与 `required`，再调用 `validation.syncField()`；找不到字段节点时使用空 label 和 `required: false`。`removeFieldRules()` 调用 `validation.removeField()`。

- [ ] **Step 6：运行 Core 集成测试**

Run: `pnpm --filter @schemx/core exec vitest run src/__tests__/createForm.test.ts src/__tests__/createField.test.ts src/field/__tests__/validationEffect.test.ts`

Expected: PASS。

Run: `pnpm --filter @schemx/core type-test`

Expected: PASS。

- [ ] **Step 7：提交 Form 集成**

```bash
git add packages/core/src/createForm.ts packages/core/src/createField.ts packages/core/src/types/form.ts packages/core/src/__tests__/createForm.test.ts packages/core/src/__tests__/createField.test.ts packages/core/src/field/validationEffect.ts
git commit -m "refactor(core): 迁移表单校验公开 API"
```

---

### Task 7：删除旧实现并统一 Core 导出和文档

**Files:**

- Delete: `packages/core/src/validator/defaultRules.ts`
- Delete: `packages/core/src/validator/__tests__/defaultRules.test.ts`
- Delete: `packages/core/src/registry/validatorRegistry.ts`
- Modify: `packages/core/src/registry/index.ts`
- Modify: `packages/core/src/validator/index.ts`
- Modify: `packages/core/src/types/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/README.md`
- Modify: `README.md`
- Test: all `packages/core/src/**/*.test.ts`

**Interfaces:**

- Removes every legacy public name listed in the design spec.
- Core root exports only new validation names.

- [ ] **Step 1：添加旧导出消失的类型断言**

在类型测试文件增加：

```ts
import * as Core from "../../index"

// @ts-expect-error 旧必填工厂已删除。
Core.createRequiredRule
// @ts-expect-error 旧 Registry 工厂已删除。
Core.createValidatorsRegistry
```

在源代码扫描步骤中要求旧标识为零结果。

- [ ] **Step 2：删除旧文件和临时引用**

删除旧 default rules 与旧 Registry 文件，清理所有 barrel export。不得保留 deprecated alias。

- [ ] **Step 3：更新 Core README**

README 必须包含以下可运行示例：

```ts
const registry = createValidationRuleRegistry()
registry.register("email", z.string().email("邮箱格式错误"))

const schemas = [
  {
    name: "email",
    label: "邮箱",
    componentType: "input",
    required: { message: "请输入邮箱" },
    rules: ["email"],
  },
]
```

同时更新 API 表：`ValidationRule`、`ValidationResult`、`ValidationFailure`、`ValidationRuleRegistry`、复数错误方法和 `valid` 判别字段。

- [ ] **Step 4：扫描旧标识**

Run:

```bash
rg -n 'createRequiredRule|createSelectRequiredRule|createUploadRequiredRule|createValidatorsRegistry|ValidatorsRegistry|ValidatorsEntry|SchemxRules|ValidateResult|ValidateError|getFieldError|setFieldError|registerRules|unregisterRules|result\.ok|error\.errors' packages/core README.md --glob '!**/validation.types.ts'
```

Expected: exit code 1 且无输出。设计文档和迁移说明中的历史名称不纳入扫描目标。

- [ ] **Step 5：运行 Core 全量验证**

Run: `pnpm --filter @schemx/core type-test`

Expected: PASS。

Run: `pnpm --filter @schemx/core check`

Expected: PASS。

Run: `pnpm --filter @schemx/core test`

Expected: PASS，无失败测试。

Run: `pnpm --filter @schemx/core build`

Expected: PASS，并生成不含旧导出的声明文件。

- [ ] **Step 6：提交 Core 清理**

```bash
git add packages/core README.md
git commit -m "refactor(core): 移除旧校验 API"
```

---

### Task 8：迁移 Vue、Vant 和示例调用方

**Files:**

- Modify: `packages/vue/src/**/*.ts`
- Modify: `packages/vue/src/**/*.tsx`
- Modify: `packages/vue/README.md`
- Modify: `packages/vant/src/**/*.ts`
- Modify: `packages/vant/src/**/*.tsx`
- Modify: `packages/vant/README.md`
- Modify: `examples/vant/src/**/*.{ts,tsx,vue}` 中命中旧 API 的文件
- Modify: `examples/uniapp-vant/src/**/*.{ts,tsx,vue}` 中命中旧 API 的文件

**Interfaces:**

- Vue and Vant re-export the new Core types without aliases.
- FormItem renders the required mark from `Boolean(schema.required)`.
- Examples use `result.valid` and plural error methods.

- [ ] **Step 1：扫描并记录框架层旧调用**

Run:

```bash
rg -l 'SchemxRules|ValidateResult|ValidateError|FieldError|ValidatorsRegistry|ValidatorsEntry|getFieldError|setFieldError|registerRules|unregisterRules|result\.ok|error\.errors' packages/vue packages/vant examples
```

Expected: 输出所有需要迁移的文件；将完整列表作为本任务修改范围，不能用全局替换改动无关文件。

- [ ] **Step 2：先更新框架测试断言**

将 Vue/Vant 测试中的表单 mock 改成复数方法，并增加 FormItem 断言：普通 `rules` 不显示星号，`required: true` 或配置对象显示星号。

示例断言统一为：

```ts
const result = await form.validate()
if (!result.valid) {
  console.log(result.errors)
}
```

- [ ] **Step 3：运行框架测试并确认失败**

Run: `pnpm --filter @schemx/vue test`

Expected: FAIL，旧 mock 或导出名称不匹配。

Run: `pnpm --filter @schemx/vant test`

Expected: FAIL，旧 Core API 不再存在或必填标记断言未满足。

- [ ] **Step 4：迁移框架实现和导出**

更新所有 Core re-export、hook 返回类型、Form mock 和 FormItem：

```ts
const renderRequired = (): VNodeChild => {
  if (!Boolean(schema().required) || schema().disabled || schema().readonly) {
    return null
  }
  return <span class="schemx-item__required">*</span>
}
```

框架包不得重新引入旧名称别名。

- [ ] **Step 5：更新示例和 README**

把必填示例从 `rules: ["required"]`、`selectRequired` 或 `uploadRequired` 改成 `required: true` 或 `RequiredOptions`。结果读取改成 `{ valid, errors }`。Vue 和 Vant README 的 API 表与 Core 保持一致。

- [ ] **Step 6：运行框架验证**

Run: `pnpm --filter @schemx/vue check && pnpm --filter @schemx/vue test && pnpm --filter @schemx/vue build`

Expected: 3 个命令全部 PASS。

Run: `pnpm --filter @schemx/vant check && pnpm --filter @schemx/vant test && pnpm --filter @schemx/vant build`

Expected: 3 个命令全部 PASS。

- [ ] **Step 7：确认旧标识清零**

Run:

```bash
rg -n 'SchemxRules|ValidateResult|ValidateError|FieldError|ValidatorsRegistry|ValidatorsEntry|getFieldError|setFieldError|registerRules|unregisterRules|result\.ok|error\.errors|selectRequired|uploadRequired' packages/vue packages/vant examples
```

Expected: exit code 1 且无输出。

- [ ] **Step 8：提交框架迁移**

```bash
git add packages/vue packages/vant examples/vant examples/uniapp-vant
git commit -m "refactor: 迁移框架层校验 API"
```

---

### Task 9：执行全仓验证和类型性能检查

**Files:**

- Modify only if verification exposes a defect: files already listed in Tasks 1–8
- Verify: `packages/core/dist/index.d.ts`
- Verify: workspace package boundary scripts

**Interfaces:**

- No new public API.
- Produces final evidence that implementation matches the design spec.

- [ ] **Step 1：运行规格覆盖扫描**

Run:

```bash
rg -n 'createRequiredRule|createSelectRequiredRule|createUploadRequiredRule|createValidatorsRegistry|ValidatorsRegistry|ValidatorsEntry|SchemxRules|ValidateResult|ValidateError|getFieldError|setFieldError|registerRules|unregisterRules|result\.ok|error\.errors|selectRequired|uploadRequired' packages examples README.md --glob '!**/validation.types.ts'
```

Expected: exit code 1 且无输出。

- [ ] **Step 2：运行 Core 类型性能检查**

Run: `pnpm --filter @schemx/core exec tsc -p tsconfig.type-tests.json --noEmit --extendedDiagnostics`

Expected: PASS；记录 `Check time` 与 `Total time`。若类型测试总时间超过普通 `pnpm --filter @schemx/core type-check` 的 2 倍，停止执行并回到设计评审，不能在验证阶段临时引入未设计的 `defineSchema()` API。

- [ ] **Step 3：运行全仓静态检查**

Run: `pnpm check`

Expected: PASS。

- [ ] **Step 4：运行全仓测试**

Run: `pnpm test`

Expected: PASS，无失败测试和未处理 Promise rejection。

- [ ] **Step 5：运行包边界检查**

Run: `pnpm check:packages`

Expected: PASS，所有 package 配置和 bundle boundary 合法。

- [ ] **Step 6：运行全仓构建**

Run: `pnpm build`

Expected: PASS。

- [ ] **Step 7：检查声明输出**

Run:

```bash
rg -n 'ValidationRule|ValidationResult|ValidationRuleRegistry|RequiredRule' packages/core/dist/index.d.ts
```

Expected: 4 个新公共类型均能命中。

Run:

```bash
rg -n 'ValidateResult|SchemxRules|ValidatorsRegistry|createRequiredRule' packages/core/dist
```

Expected: exit code 1 且无输出。

- [ ] **Step 8：检查工作区差异**

Run: `git status --short`

Expected: 只包含用户原有未提交改动；本计划相关文件均已提交。确认没有暂存或提交 `examples/vant/src/basic/createCachedRequest.ts` 等与本计划无关的现有文件，除非用户后来明确把它们加入范围。

- [ ] **Step 9：处理验证失败**

若任一验证失败，返回引入该缺陷的任务，补充对应失败测试、最小修复和该任务列出的精确提交；Task 9 不创建笼统的验证修正提交。若全部通过，不创建空提交。

---

## 最终验收清单

- [ ] `required` 同时控制必填校验和必填标记，普通规则不再隐式设置必填。
- [ ] 3 个 `create*RequiredRule` 和 3 个内置 Registry 名称全部删除。
- [ ] 字段 Schema、原生 ValidationRule 和命名规则按 `name` 推导值类型。
- [ ] ValidationRuleRegistry 的声明合并约束规则名称和值类型。
- [ ] Standard Schema 输出不更新 Store，也不改变 `ValidationResult.values` 类型。
- [ ] Validator 使用复数错误 API、扁平结果和稳定空数组。
- [ ] 字段错误与表单错误通过 `scope` 判别。
- [ ] 异步旧结果不覆盖新状态，`destroy()` 中止运行并保持幂等。
- [ ] Core、Vue、Vant、示例和 README 不再引用旧 API。
- [ ] 类型测试、静态检查、单元测试、包边界检查和构建全部通过。
