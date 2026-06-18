# sensitive-input 组件设计规格

## 背景

需要新增一个 `sensitiveInput` 渲染器，用于手机号、身份证、银行卡等敏感字段。
组件默认展示脱敏字符串，用户点击展示按钮后才显示完整值，并在可编辑场景下进入输入框。

当前项目已有 `SchemxCell` 负责只读/展示态，`SchemxInput` 负责输入态。
新组件应复用这两个基础组件，保持 Vant renderer 的既有结构和类型注册方式。

## 设计目标

- 默认以脱敏展示为主，避免敏感值直接出现在页面上。
- 脱敏逻辑由外部传入，组件不内置固定规则。
- 完整值展示和输入格式化继续使用 `formatter`，避免与脱敏职责混淆。
- 表单值始终保存真实值，脱敏文本仅用于 UI 展示。
- 保持与现有 `@schemx/vant` renderer、schema 类型注册风格一致。

## 非目标

- 不在首版实现权限校验、二次确认、复制审计、显示倒计时。
- 不改变现有 `input`、`text`、`textarea` renderer 的行为。
- 不把脱敏字符串写回 form state。

## 组件定位

采用“展示优先”模式。

默认态渲染脱敏后的展示值；点击展示按钮后：

- 普通可编辑场景：切换为 `SchemxInput`，展示完整值并允许编辑。
- 只读场景：按配置决定是否允许展示完整值；允许时仅展示完整值，不进入可编辑输入框。
- 禁用场景：不允许展示完整值，也不允许编辑。

## 建议文件结构

```text
packages/vant/src/components/SensitiveInput/
  index.vue
  index.ts
  index.scss
  types.ts
  __tests__/SensitiveInput.test.ts

packages/vant/src/renderers/SensitiveInputRenderer/
  index.vue
  index.ts
  types.ts
  __tests__/SensitiveInputRenderer.test.ts
```

还需要更新：

```text
packages/vant/src/renderers/index.ts
packages/vant/src/renderers/defaultRenderers.ts
packages/vant/src/types/schemx.ts
```

## Props 设计

```ts
type SensitiveInputValue = string

type SensitiveMaskFormatter = (
  value: string,
  ctx: {
    placeholder: string
    readonlyPlaceholder: string
  }
) => string

interface SensitiveInputProps extends Omit<SchemxInputProps, "type" | "value" | "onChange"> {
  value?: SensitiveInputValue
  onChange?: (value: string) => void

  /** 完整值格式化，展示完整值和输入时使用 */
  formatter?: (value: string) => string

  /** 脱敏值格式化，默认态使用 */
  maskFormatter?: SensitiveMaskFormatter

  /** 默认是否显示完整值 */
  defaultRevealed?: boolean

  /** 受控显示状态 */
  revealed?: boolean
  onRevealChange?: (revealed: boolean) => void

  /** 是否允许显示完整值 */
  revealable?: boolean

  /** 显示/隐藏按钮文案或图标 */
  revealText?: string
  hideText?: string
  revealIcon?: string
  hideIcon?: string

  /** 展开后是否自动聚焦输入框 */
  focusOnReveal?: boolean

  /** 失焦后是否自动恢复脱敏 */
  hideOnBlur?: boolean

  /** 只读时是否仍允许查看完整值 */
  revealWhenReadonly?: boolean
}
```

建议默认值：

```ts
{
  value: "",
  maskFormatter: defaultMaskFormatter,
  defaultRevealed: false,
  revealable: true,
  revealText: "显示",
  hideText: "隐藏",
  revealIcon: "eye-o",
  hideIcon: "closed-eye",
  focusOnReveal: true,
  hideOnBlur: false,
  revealWhenReadonly: false,
  readonlyPlaceholder: "-",
}
```

## formatter 职责边界

```text
value
  原始真实值。

formatter(value)
  完整值展示或输入格式化，例如手机号加空格。

maskFormatter(value)
  脱敏展示，例如 138****8899。

onChange(value)
  永远回传真实输入值，不回传 formatter 或 maskFormatter 的展示结果。
```

首版需要在文档和类型注释中明确：`maskFormatter` 只负责展示，不参与写入。

## 状态逻辑

内部状态：

```text
revealedState: 当前是否显示完整值
focusedState: 当前输入框是否聚焦
```

受控优先级：

```text
props.revealed !== undefined
  使用 props.revealed
否则
  使用内部 revealedState，初始值来自 defaultRevealed
```

状态规则：

```text
disabled
  始终显示脱敏值，不允许 reveal，不允许编辑。

readonly && !revealWhenReadonly
  始终显示脱敏值，不允许 reveal，不允许编辑。

readonly && revealWhenReadonly
  允许在脱敏值和完整展示值之间切换，但不进入输入态。

normal && !revealed
  显示脱敏值。

normal && revealed
  显示 SchemxInput，允许编辑真实值。
```

点击展示按钮时：

```text
if disabled return
if readonly && !revealWhenReadonly return
if !revealable return

next = !currentRevealed
emit onRevealChange(next)
更新内部 revealedState

if next && focusOnReveal && !readonly
  nextTick 后 focus 输入框
```

输入失焦时：

```text
先透传 onBlur
如果 hideOnBlur 为 true
  切回脱敏态
```

## 空值处理

空值不执行脱敏。

```text
普通展示态空值：显示 placeholder
只读展示态空值：显示 readonlyPlaceholder
展开态空值：显示空输入框和 placeholder
```

空值判断应复用现有 `isEmptyDisplayValue` 语义，保留 `0`、`false` 等有效展示值。
不过首版 `SensitiveInputValue` 建议限定为 `string`，避免布尔值和数字值引入额外歧义。

## Renderer 和 schema 集成

新增 renderer 注册名：

```ts
rendererRegistry.registerAll({
  sensitiveInput: SensitiveInputRenderer,
})
```

类型映射：

```ts
declare module "@schemx/core" {
  interface SchemxRendererPropsMap {
    sensitiveInput: SensitiveInputRendererProps
  }
}
```

schema 使用示例：

```ts
{
  name: "phone",
  label: "手机号",
  componentType: "sensitiveInput",
  componentProps: {
    maskFormatter: (value) => value.replace(/^(\d{3})\d{4}(\d+)$/, "$1****$2"),
    formatter: (value) => value.replace(/(\d{3})(\d{4})(\d+)/, "$1 $2 $3"),
    hideOnBlur: true,
  },
}
```

## 默认脱敏策略

首版提供一个保守默认策略，避免没有传 `maskFormatter` 时直接泄露完整值。

建议规则：

```text
长度 <= 0：返回空字符串
长度 <= 2：全部替换为 *
长度 <= 6：保留首尾各 1 位
长度 > 6：保留前 3 位和后 4 位，中间替换为 ****
```

示例：

```text
"A" => "*"
"AB" => "**"
"ABCDEF" => "A****F"
"13812348899" => "138****8899"
```

## 样式和交互

- 默认态布局应接近 `SchemxCell`，右侧提供显示按钮或图标。
- 展开输入态应接近 `SchemxInput`，右侧提供隐藏按钮或图标。
- 按钮需要支持键盘触发。
- 展示按钮应有明确 `aria-label`，例如“显示完整内容”“隐藏完整内容”。
- 组件根类名建议为 `schemx-sensitive-input`。

## 测试计划

- 默认展示 `maskFormatter` 的返回结果。
- 未传 `maskFormatter` 时使用默认脱敏策略。
- 点击显示后展示完整值并渲染输入框。
- 点击隐藏后回到脱敏态。
- 输入修改后 `onChange` 回传真实值。
- `formatter` 仅影响完整值展示/输入格式化，不影响脱敏值和 `onChange`。
- 空值展示 `placeholder` 或 `readonlyPlaceholder`。
- `disabled` 时不能显示完整值。
- `readonly + revealWhenReadonly=false` 时不能显示完整值。
- `readonly + revealWhenReadonly=true` 时可显示完整值但不能编辑。
- `revealed` 受控模式下点击只触发 `onRevealChange`。
- `hideOnBlur=true` 时失焦后恢复脱敏态。
- `focusOnReveal=true` 时展开后聚焦输入框。

## 预留 TODO

- TODO: 增加 `copyable`，允许复制完整值，并提供 `onCopy` 回调。
- TODO: 增加 `beforeReveal` 钩子，用于权限校验、二次确认或审计上报。
- TODO: 增加 `revealDuration`，显示完整值一段时间后自动恢复脱敏。
- TODO: 增加 `maskMode` 预设，例如 `phone`、`idCard`、`bankCard`。
- TODO: 增加 `renderRevealAction` 插槽，允许业务自定义显示/隐藏按钮。
- TODO: 增加 `auditKey` 或 `fieldKey`，供安全审计场景标识字段。
- TODO: 评估是否需要支持非字符串值，若支持需明确格式化和写回规则。
- TODO: 评估是否在展开前清理剪贴板、截图水印等更高安全等级能力。

## 验收标准

- `sensitiveInput` 可通过 schema 注册和渲染。
- 默认不直接展示完整敏感值。
- 外部可通过 `maskFormatter` 自定义脱敏展示。
- 展开后可以显示完整值，并在普通态下编辑。
- `formatter`、`maskFormatter`、`onChange` 的职责清晰且测试覆盖。
- 只读、禁用、空值、受控显示状态均行为明确。
