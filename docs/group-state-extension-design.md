# Group 与 Dependency 容器状态扩展方案

## 文档状态

- 状态：已实现
- 落地日期：2026-07-15
- 适用范围：`@schemx/core`、`@schemx/vue`
- 目标类型：`componentType: "group"`、`componentType: "dependency"`

## 背景（改造前）

改造前，Group 主要承担 Schema 结构分组和折叠展示职责，只包含 `label`、`children`、`collapsible`、`defaultCollapsed` 等配置。Core 将其视为纯结构容器，Group RuntimeNode 没有独立运行时状态，也不会创建 dependencies effect。

改造前，Dependency 根据 `to` 和 `renderer` 生成动态子树。它也是透明结构容器，自身不产生 ViewSchema，且无法对子树统一施加可见、只读或禁用状态。

这会产生以下限制：

- Group 无法整体控制后代字段的可见、只读和禁用状态。
- Group 无法根据表单值动态更新状态。
- Dependency 只能改变子树结构，不能独立控制整棵动态子树的呈现状态。
- 仅在 Vue 层隐藏 Group 时，后代字段仍可能注册校验规则并保留错误信息。
- `defaultCollapsed` 只在组件初始化时读取，无法受控或通过 Schema 更新。
- 折叠会卸载后代 Renderer，Renderer 的局部状态可能丢失，但这一行为目前没有显式配置。

本方案将 Group 和 Dependency 统一建模为带呈现状态的容器节点，同时保持二者不拥有字段值和普通字段校验规则。Group 继续产生容器 ViewSchema，Dependency 继续作为透明节点展开 children。

## 设计目标

本次扩展需要满足以下目标：

1. Group 和 Dependency 支持静态 `visible`、`readonly`、`disabled` 配置。
2. 两类容器支持通过 `dependencies` 动态计算上述状态。
3. 容器状态能够递归传递给嵌套 Group、Dependency 和普通字段。
4. 后代字段的渲染、交互和校验读取同一份有效状态。
5. Group 支持稳定、可控且语义明确的折叠行为。
6. Group 和 Dependency 复用同一个 ContainerRuntimeState 与动态属性 effect。
7. Core 保持框架无关，布局和 DOM 表现继续由适配层负责。

## 非目标

本次不把 Group 或 Dependency 设计成普通字段。以下属性不应直接加入这两类容器：

- `name`
- `initialValue`
- `rules`
- `required`
- `placeholder`
- `readonlyPlaceholder`
- `componentProps`
- `validationTrigger`
- 字段级 `onChange`、`onBlur`

Group 和 Dependency 都不拥有表单值。如果业务需要“组内至少填写一个字段”等约束，应使用表单级校验，或另行设计 Group validation 机制。

Dependency 仍是透明节点，因此不增加 `label`、`collapsible`、`class` 或 `style`。它的结构职责继续由 `to` 和 `renderer` 表达。

## 属性规划

### 第一阶段：核心状态能力

| 属性           | 类型                                   | 默认值        | 说明                                                       |
| -------------- | -------------------------------------- | ------------- | ---------------------------------------------------------- |
| `key`          | `string`                               | Core 自动生成 | Group 的稳定身份。动态插入、删除或排序时建议业务显式配置。 |
| `visible`      | `boolean`                              | `true`        | 是否渲染 Group；同时参与后代字段的有效可见状态计算。       |
| `readonly`     | `boolean`                              | `false`       | 是否强制后代字段只读。                                     |
| `disabled`     | `boolean`                              | `false`       | 是否强制后代字段禁用。                                     |
| `dependencies` | `SchemxContainerDependencies<TValues>` | `undefined`   | 根据表单值动态覆盖 Group 状态。                            |

Group 与 Dependency 使用相同的状态属性。Dependency 的 `key`、`to` 和 `renderer` 保持现有语义：

| 属性           | 类型                                   | 默认值      | 说明                                             |
| -------------- | -------------------------------------- | ----------- | ------------------------------------------------ |
| `visible`      | `boolean`                              | `true`      | 是否呈现动态子树，并控制后代字段的有效可见状态。 |
| `readonly`     | `boolean`                              | `false`     | 是否强制动态子树中的字段只读。                   |
| `disabled`     | `boolean`                              | `false`     | 是否强制动态子树中的字段禁用。                   |
| `dependencies` | `SchemxContainerDependencies<TValues>` | `undefined` | 根据表单值动态覆盖容器状态。                     |

### 第一阶段：折叠能力补全

| 属性                | 类型                           | 默认值      | 说明                                 |
| ------------------- | ------------------------------ | ----------- | ------------------------------------ |
| `collapsible`       | `boolean`                      | `false`     | 是否允许用户折叠 Group。             |
| `defaultCollapsed`  | `boolean`                      | `false`     | 非受控模式下的初始折叠状态。         |
| `collapsed`         | `boolean`                      | `undefined` | 受控折叠状态；配置后优先于内部状态。 |
| `onCollapsedChange` | `(collapsed: boolean) => void` | `undefined` | 用户切换折叠状态后的回调。           |
| `destroyOnCollapse` | `boolean`                      | 见兼容策略  | 折叠时是否卸载后代 Renderer。        |

### 第二阶段：可选展示能力

以下属性可以根据实际业务需求后续增加：

| 属性或能力                 | 建议归属        | 说明                                                                          |
| -------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `description`              | Core 或适配层   | Group 标题下的辅助说明。                                                      |
| `icon`                     | Vue/Vant 适配层 | 图标通常依赖具体 UI 框架。                                                    |
| Header/Extra Slot          | Vue 适配层      | 自定义标题、提示和操作区，比持续增加展示属性更灵活。                          |
| `variant`                  | Vue/Vant 适配层 | 如 `card`、`section`、`plain`。                                               |
| `layout`、`columns`、`gap` | Vue/Vant 适配层 | 属于 CSS Grid 或设计系统布局能力，不进入 Core。                               |
| Group API                  | Core/Form API   | 如 `expandGroup()`、`collapseGroup()`、`scrollToGroup()`、`validateGroup()`。 |

## Schema 类型设计

### 容器 dependencies

Group 和 Dependency 不应直接复用完整的 `SchemxDependencies`。普通字段 dependencies 中的 `componentProps`、`placeholder`、`required` 和 `rules` 对容器没有明确语义，应定义受限类型：

```ts
export interface SchemxContainerDependencies<T extends Values = Values> {
  triggerFields: NamePath<T>[]

  readonly?: SchemxConditionFn<T, boolean>
  disabled?: SchemxConditionFn<T, boolean>
  visible?: SchemxConditionFn<T, boolean>
}
```

容器 dependencies 不提供 `trigger`。副作用属于字段联动能力，而容器配置只负责计算后代的有效呈现状态；如需执行副作用，应使用普通字段 dependencies 或显式的表单 effect。

如果第二阶段确认折叠状态需要参与动态联动，可以再增加：

```ts
collapsed?: SchemxConditionFn<T, boolean>
```

### Group Schema

建议的完整基础接口如下：

```ts
export interface SchemxGroupField<
  TValues extends Values = Values,
> extends SchemxGroupFieldDefinition {
  key?: string
  label: string
  componentType: "group"
  children: SchemxField<TValues>[]

  visible?: boolean
  readonly?: boolean
  disabled?: boolean
  dependencies?: SchemxContainerDependencies<TValues>

  collapsible?: boolean
  defaultCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  destroyOnCollapse?: boolean
}
```

编译后的 Group Schema 不应继续携带 dependencies 条件函数：

```ts
export type SchemxResolvedGroupField<TValues extends Values = Values> = Omit<
  SchemxGroupField<TValues>,
  "children" | "dependencies"
> & {
  children: SchemxResolvedField<TValues>[]
}
```

### Dependency Schema

Dependency 增加容器状态后，建议接口如下：

```ts
export interface SchemxDependencyField<
  TValues extends Values = Values,
  TNames extends readonly NamePath<TValues>[] = readonly NamePath<TValues>[],
> {
  key?: string
  componentType: "dependency"

  to: TNames
  renderer: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: SchemxDependencyRendererContext
  ) => SchemxField<TValues>[] | Promise<SchemxField<TValues>[]>

  visible?: boolean
  readonly?: boolean
  disabled?: boolean
  dependencies?: SchemxContainerDependencies<TValues>
}
```

其中两套依赖的职责不同：

| 配置                         | 职责                                     |
| ---------------------------- | ---------------------------------------- |
| `to`                         | 监听字段值，并重新执行结构 renderer。    |
| `renderer`                   | 决定动态子树包含哪些 Schema。            |
| `dependencies.triggerFields` | 监听字段值，并重新计算容器呈现状态。     |
| `dependencies.visible` 等    | 计算整棵动态子树的可见、只读和禁用状态。 |

即使二者监听相同字段，也建议保留显式的 `triggerFields`，不要默认复用 `to`。显式配置能避免结构依赖和状态依赖被隐式绑定。

示例：

```ts
{
  key: "enterprise-fields",
  componentType: "dependency",
  to: ["accountType"],
  dependencies: {
    triggerFields: ["status", "permission"],
    visible: values => values.status !== "deleted",
    readonly: values => values.permission !== "write",
    disabled: values => values.status === "locked",
  },
  renderer: values => {
    if (values.accountType !== "enterprise") {
      return []
    }

    return [
      {
        name: "companyName",
        label: "企业名称",
        componentType: "input",
      },
    ]
  },
}
```

## 状态继承规则

容器状态是对子树施加的约束。嵌套 Group、Dependency 和字段均使用以下规则计算有效状态：

```text
effectiveVisible  = parentVisible  && ownVisible
effectiveReadonly = parentReadonly || ownReadonly
effectiveDisabled = parentDisabled || ownDisabled
```

规则说明：

- `visible` 使用逻辑与。任一祖先不可见，整个后代子树均不可见。
- `readonly` 和 `disabled` 使用逻辑或。任一祖先施加约束，后代均不能绕过。
- 后代显式配置 `readonly: false` 或 `disabled: false`，不能解除祖先容器的约束。
- Dependency 是透明结构节点，但不是状态透明节点。后代必须合并它的 ContainerRuntimeState。
- 查找继承状态时，应沿父节点链合并所有 Group 和 Dependency 容器状态。
- Form 全局默认值仍按现有字段规范化规则生效，容器约束在字段自身状态之外再次合并。

示例：

```ts
{
  key: "profile",
  componentType: "group",
  label: "个人资料",
  readonly: true,
  children: [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
      readonly: false,
    },
  ],
}
```

`nickname` 的最终 `readonly` 仍为 `true`。

## 可见性、校验和数据语义

容器的 `visible=false` 不能只在 Vue 层执行条件渲染。后代字段的 `FieldRuntimeState.effectiveSchema.visible` 必须同时变为 `false`，让 ValidationEffect 完成以下操作：

- 注销后代字段的校验规则；
- 清空后代字段的错误信息；
- 阻止后代字段触发交互校验；
- 让 ViewSchema 与校验状态保持一致。

隐藏 Group 或 Dependency 时默认保留字段值，并保持与普通字段现有语义一致：

- `getValues()` 仍返回隐藏字段值；
- 表单提交结果仍包含隐藏字段值；
- 重新显示 Group 后恢复原值。

本阶段不增加 `clearOnHide`。如果后续确有隐藏时清值的需求，应为普通字段和容器统一设计 `preserveValue`，默认值应为 `true`。

### Dependency 隐藏时的 renderer 策略

Dependency 的 `visible=false` 默认只影响呈现和校验，不暂停结构 renderer：

- 已生成的 RuntimeNode 继续保留；
- `to` 对应字段变化时仍重新执行 renderer；
- 后代字段保留值，但暂停校验并清空错误；
- 恢复可见后立即展示最新的动态子树。

这样可以避免 Dependency 在隐藏期间停止更新，重新显示后出现结构过期。如果未来大型表单确有性能需求，可以另行设计 `suspendWhenHidden`，但不应让 `visible=false` 默认承担暂停或销毁语义。

## 折叠行为

### 受控与非受控模式

折叠状态遵循以下优先级：

```text
collapsed（受控值） > 内部状态 > defaultCollapsed（初始值）
```

- 未配置 `collapsed` 时，组件维护内部状态，并使用 `defaultCollapsed` 初始化。
- 配置 `collapsed` 后，组件进入受控模式，不自行持久化新状态。
- 从受控模式切换回非受控模式时，内部状态延续最后一次受控值，避免界面跳回旧状态。
- 用户触发切换后调用 `onCollapsedChange`。
- Schema 更新时，`defaultCollapsed` 不重置已经存在的内部状态。

### 折叠与卸载

当前实现使用条件渲染，折叠时会卸载后代 Renderer。字段值保存在 Core 中，但 Renderer 的以下局部状态可能丢失：

- 焦点、输入法状态；
- 远程选项缓存；
- 上传组件的临时状态；
- Renderer 自身的展开或加载状态。

因此需要通过 `destroyOnCollapse` 显式表达行为：

- `false`：隐藏 Group Body，但保留 Vue 组件实例；推荐作为长期默认值。
- `true`：卸载 Group Body 中的后代组件，降低大型表单的渲染开销。

为保持现有行为兼容，首次发布可以将默认值设为 `true`，在下一个主版本再评估是否调整为 `false`。

折叠只影响 UI 展示，不改变字段的 `visible`，也不注销校验规则。提交或主动校验时，折叠区域内的字段仍参与校验。

## 运行时架构

### 数据流

```text
Raw Group Schema -----------\
                              -> GroupDescriptor / DependencyDescriptor
Raw Dependency Schema ------/   -> ContainerRuntimeState
                                  -> 后代 Group/Dependency/Field 的有效状态
                                  -> ValidationEffect + ViewSchema
                                  -> Vue FormGroup/FormItem
```

### 容器 Descriptor

GroupDescriptor 和 DependencyDescriptor 需要共享容器静态状态与动态属性描述：

```ts
export interface ContainerStaticState {
  readonly visible: boolean
  readonly readonly: boolean
  readonly disabled: boolean
}

export interface ContainerDynamicPropsDescriptor<TValues extends Values = Values> {
  readonly triggerFields: readonly NamePath<TValues>[]
  readonly dependencies: SchemxContainerDependencies<TValues>
}

export interface GroupDescriptor<
  TValues extends Values = Values,
> extends BaseDescriptor<TValues> {
  readonly type: "group"
  readonly staticSchema: SchemxResolvedGroupField<TValues>
  readonly staticState: ContainerStaticState
  readonly dynamicProps?: ContainerDynamicPropsDescriptor<TValues> | null
  readonly children: readonly FormDescriptor<TValues>[]
}

export interface DependencyDescriptor<
  TValues extends Values = Values,
> extends BaseDescriptor<TValues> {
  readonly type: "dependency"
  readonly triggerFields: readonly NamePath<TValues>[]
  readonly renderer: DependencyRenderer<TValues>
  readonly staticState: ContainerStaticState
  readonly dynamicProps?: ContainerDynamicPropsDescriptor<TValues> | null
}
```

编译时应从静态 Schema 中移除 `children` 和 `dependencies`，并补齐容器状态默认值。Dependency 的 `to` 和 `renderer` 继续编译到现有结构 dependency descriptor 字段。

### ContainerRuntimeState

Group 和 Dependency RuntimeNode 共享同一种容器状态：

```ts
export interface ContainerEffectiveState {
  visible: boolean
  readonly: boolean
  disabled: boolean
}

export interface ContainerRuntimeState {
  readonly staticState: Signal<ContainerStaticState>
  readonly dynamicOverrides: Signal<Partial<ContainerEffectiveState>>
  readonly effectiveState: ComputedSignal<ContainerEffectiveState>
}
```

两类 RuntimeNode 相应增加：

```ts
containerState: ContainerRuntimeState | null
containerEffectDispose: RuntimeDispose | null
```

DependencyRuntimeNode 仍保留现有的结构 `effectState` 和 `dependencyDispose`。容器状态 effect 与结构 renderer effect 使用独立作用域，避免更新状态 dependencies 时无意重建动态子树。

### 后代状态注入

创建 FieldRuntimeState 时，应注入祖先容器的有效状态：

```ts
interface CreateFieldRuntimeStateOptions<TValues> {
  // 现有配置省略
  inheritedState: ComputedSignal<ContainerEffectiveState>
}
```

FieldRuntimeState 在合并静态 Schema 与动态覆盖后，再合并 `inheritedState`。ValidationEffect 继续只读取 `effectiveSchema`，无需感知具体容器类型。

嵌套 Group 和 Dependency 同样读取父容器的 `effectiveState`，形成完整的状态传播链。

### dependencies effect

现有字段 dependencies effect 已包含异步执行、任务取消、竞态保护和 `trigger` 错误隔离。建议将其抽取为通用动态属性 effect：

```ts
createDynamicPropsEffect({
  triggerFields,
  dependencies,
  allowedKeys,
  formApi,
  scheduler,
  scope,
  onSuccess,
})
```

普通字段使用完整的字段动态属性列表，Group 和 Dependency 容器只允许：

```ts
const CONTAINER_DEPENDENCIES_PROP_KEYS = ["visible", "readonly", "disabled"] as const
```

不建议为 Group 和 Dependency 各复制一份功能近似的 dependencies effect，以免异步竞态和销毁逻辑逐渐分叉。

### 生命周期

Group 的领域资源生命周期调整为：

```text
挂载：创建 ContainerRuntimeState -> 创建 dependencies effect -> 创建 ViewState
更新：更新 staticState -> 按需复用或重建 dependencies effect -> 更新 ViewState
卸载：销毁 dependencies effect -> 删除 ViewState -> 清理 containerState
```

更新时需要特别处理：

- 移除 dependencies 后必须清空旧的动态覆盖；
- dependencies 的 `triggerFields` 变化后必须取消旧任务并重建订阅；
- dependencies 对象引用和 `triggerFields` 都未变化时复用 effect，避免无效执行；
- dependencies 变化时保留上一轮覆盖，直到新一轮异步计算成功，避免状态闪回静态值；
- 只修改容器状态时不应卸载或重建 children；
- 旧异步结果不得覆盖新一轮计算结果。

Dependency 除了维持现有结构 renderer 生命周期，还需增加独立的容器状态生命周期：

```text
挂载：创建 ContainerRuntimeState -> 创建状态 dependencies effect
更新：更新 staticState -> 按需复用或重建状态 dependencies effect
卸载：销毁状态 dependencies effect -> 清理 containerState
```

`to` 或 `renderer` 变化只影响结构 effect；状态 dependencies 变化只影响容器状态 effect。两条链路不能互相触发重建。

## Vue 适配层

FormGroup 应直接消费 Core 已解析完成的 ViewSchema：

```tsx
if (!schema.visible) {
  return null
}

return (
  <div
    class={classnames("schemx-group", {
      "is-readonly": schema.readonly,
      "is-disabled": schema.disabled,
    })}
    aria-disabled={schema.disabled || undefined}
  >
    {/* Group Header 和 Group Body */}
  </div>
)
```

`readonly` 和 `disabled` 的主要效果由 Core 传递给后代字段。Vue 层只负责容器样式、折叠交互和可访问性。

Dependency 不产生独立 DOM，也不需要新增 Vue 组件。Core 展开 Dependency children 时，后代 ViewSchema 已包含继承后的有效状态，现有 FormItem 可以直接消费。

### `class` 与 `style`

`@schemx/vue` 已通过 declaration merging 为 Group 增加 `class` 和 `style`。落地时需要确认：

- 发布产物包含对应的类型声明增强；
- `class` 和 `style` 均绑定到 Group 根节点；
- `packages/vue/README.md` 与实际实现保持一致。

这些属性属于 Vue 适配层，不需要进入 Core 通用 Schema。

### 可访问性

可折叠标题至少应提供：

```tsx
<div
  id={headerId}
  role="button"
  tabindex={schema.disabled ? -1 : 0}
  aria-expanded={!collapsed}
  aria-controls={bodyId}
  aria-disabled={schema.disabled || undefined}
/>

<div
  id={bodyId}
  role="group"
  aria-labelledby={headerId}
/>
```

`headerId` 和 `bodyId` 不能只依赖规范化后的 `schema.key`。实现优先组合 Core RuntimeNode ID；直接挂载 `FormGroup`、没有调试元数据时使用 Vue 组件实例 ID 作为本地兜底，以避免不同 Group 的 key 规范化后发生 DOM ID 冲突。

交互语义建议如下：

- `readonly=true` 时仍允许展开和折叠，因为折叠不修改表单值。
- `disabled=true` 时禁止鼠标和键盘切换折叠状态。
- `visible=false` 时不保留可聚焦 DOM。
- Enter 和 Space 均可切换折叠状态。

## 稳定 key

Core 已支持业务显式配置 `key`，但 Group 未配置 key 时会使用层级位置生成：

```text
group:${parentKey}/${index}
```

同级 Group 插入、删除或排序后，位置 key 可能变化，从而导致 RuntimeNode 和 Vue 组件重新创建。以下场景必须显式配置 `key`：

- Group 顺序会动态变化；
- Group 来自后端配置；
- 需要保留非受控折叠状态；
- 后代 Renderer 包含重要局部状态。

文档应明确：Core 使用生成后的 key 构建 Descriptor 和 ViewSchema，但不会原地修改传入的 Raw Schema。

协调器会在提交前检查同级 Descriptor key 和现有 RuntimeNode key。重复 key 会立即抛错，不再使用 `Map` 静默覆盖；这能在错误关联字段状态或卸载节点之前暴露配置问题。

## 实现后架构复核

本功能落地后对编译、协调、运行时资源和 Vue 适配层进行了二次复核。结论是“容器状态链路”和“Dependency 结构链路”保持分离是必要复杂度，但部分缓存、生命周期和类型抽象可以进一步收敛。

| 复核项                | 问题或风险                                                                           | 最终处理                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Descriptor 缓存       | 仅按 Schema 对象引用缓存时，同一对象出现在不同位置会错误复用包含旧 key 的 Descriptor | 缓存键扩展为“Schema 引用 + parentKey + index”；同时明确 Schema 更新采用不可变对象约定         |
| 重复 key              | 协调阶段使用 `Map` 时可能静默覆盖同级重复项                                          | Descriptor 与 RuntimeNode 两侧都进行 fail-fast 检查                                           |
| Dependency 编译失效   | renderer 每次成功都使编译器版本递增，造成不必要的全局缓存失效                        | 删除 renderer 成功后的重复 `invalidate()`，版本只由真实编译配置变更驱动                       |
| 容器状态 effect       | 每次 Descriptor 更新都销毁并重建 effect，会重复执行条件函数并产生状态闪回            | dependencies 引用和触发路径未变化时复用；变化时保留旧覆盖直到新结果成功；移除配置时才重置覆盖 |
| 动态属性模块          | 通用 effect 放在 `field` 目录会让容器反向依赖字段领域                                | 移到 `dynamicProps` 模块，由字段与容器共同依赖                                                |
| 容器类型抽象          | `trigger`、固定 `source` 字段、未参与类型推导的泛型和单用途 key 常量增加了 API 面积  | 容器 dependencies 只保留三种状态函数；删除无行为价值的字段、泛型和常量                        |
| 父节点约束            | 容器继承状态要求 parent，但构造 API 仍允许创建游离节点                               | 保留可独立构造能力用于测试和装配；在正式 `mount` 边界强制校验 parent，避免半初始化运行态      |
| FormGroup 状态与 ARIA | 受控转非受控可能跳回旧值，仅用 key 生成 DOM ID 可能冲突                              | 切换模式时同步最后受控值，并将运行时或组件实例身份纳入 ARIA ID                                |
| 发布边界检查          | Core 已移除 `simple-async-context`，检查脚本仍要求产物保留该 external import         | 删除过期的 Core 必需依赖断言，继续保留下游包不得泄漏该依赖的约束                              |

未采用 Schema 深克隆或深冻结。Schema 中可能包含组件 Props、函数和第三方对象，深处理成本高且语义不稳定；位置感知缓存配合不可变更新约定，能以更小复杂度保证正确性。也未把 RuntimeNode 的 `parent` 改为构造期必填，因为节点创建与挂载是两个明确阶段，在挂载边界校验更符合现有架构。

## 实施范围

### `@schemx/core`

主要改造位置：

- `packages/core/src/types/schema.ts`：增加 Group、Dependency 容器状态和 dependencies 类型。
- `packages/core/src/types/dependencies.ts`：导出受限的 Container dependencies 类型并复用通用条件函数类型。
- `packages/core/src/descriptor/types.ts`：增加 Container static state 和 dynamic props descriptor。
- `packages/core/src/descriptor/createDescriptor.ts`：编译 Group、Dependency 静态状态和 dependencies。
- `packages/core/src/node/types.ts`：为 GroupRuntimeNode 和 DependencyRuntimeNode 增加容器状态资源。
- `packages/core/src/node/runtimeLifecycle.ts`：挂载、更新和卸载容器状态资源。
- `packages/core/src/field/runtimeState.ts`：合并祖先容器的有效状态。
- `packages/core/src/dynamicProps/effect.ts`：承载字段和容器共用的动态属性 effect。
- `packages/core/src/field/dependenciesEffect.ts`：将字段动态属性结果写入 FieldRuntimeState。
- `packages/core/src/field/dependencyEffect.ts`：保持结构 renderer effect 与容器状态 effect 相互独立。
- `packages/core/src/view/createViewState.ts`：从 ContainerRuntimeState 构建 Group ViewSchema；Dependency 继续透明展开 children。

### `@schemx/vue`

主要改造位置：

- `packages/vue/src/components/FormGroup/index.tsx`：处理可见性、受控折叠、卸载策略和 ARIA 属性。
- `packages/vue/src/components/FormGroup/index.css`：Group 继续复用全局 `is-readonly`、`is-disabled` 状态样式，无需新增专属规则。
- `packages/vue/src/types/index.ts`：让 Group 扩展类型直接进入发布声明入口。
- `packages/vue/README.md`：更新 Group Schema 和 FormGroup 行为说明。

发布构建已确认 `dist/index.d.ts` 会经由 `./types` 引入声明合并，普通消费者可以直接使用 Group 的 `class` 和 `style` 类型增强。

## 分阶段实施

### 阶段 1：状态链路

1. 增加 Group、Dependency Schema 和 Container dependencies 类型。
2. 增加容器 Descriptor 状态和 ContainerRuntimeState。
3. 实现祖先状态传播。
4. 让 ValidationEffect 通过字段有效状态自动响应容器状态。
5. 分离 Dependency 的结构 effect 与容器状态 effect。
6. 让 Group ViewSchema 输出解析后的状态，Dependency 继续透明展开。

### 阶段 2：Vue 行为

1. FormGroup 消费 `visible`、`readonly`、`disabled`。
2. 增加受控 `collapsed`。
3. 增加 `destroyOnCollapse`。
4. 补齐键盘交互和 ARIA 属性。

### 阶段 3：文档与扩展能力

1. 更新 Core 和 Vue README。
2. 修正 key 回写、`class` 和 `style` 等文档与实现不一致的问题。
3. 根据业务反馈评估 description、Header Slot、布局属性和 Group API。

## 验收标准

### Core

- [x] 静态 `visible=false` 能让整个 Group 或 Dependency 子树进入不可见状态。
- [x] 容器隐藏后，后代字段注销校验规则并清空错误。
- [x] 静态 `readonly` 和 `disabled` 能递归传递到普通字段、嵌套 Group 和 Dependency。
- [x] 后代字段不能通过显式 `false` 绕过祖先约束。
- [x] Group dependencies 能动态切换 `visible`、`readonly` 和 `disabled`。
- [x] Dependency 的静态状态和 dependencies 能动态控制整棵动态子树。
- [x] Dependency `visible=false` 时 renderer 仍响应 `to`，恢复可见后展示最新子树。
- [x] Dependency 状态更新不会重建结构 renderer effect 或 children RuntimeNode。
- [x] Dependency 的结构更新不会丢失容器动态状态。
- [x] 异步 dependencies 的旧结果不能覆盖新结果。
- [x] 移除 dependencies 后不会残留旧动态覆盖。
- [x] Dependency renderer 动态生成的 Group 能正确继承所有外层容器状态。
- [x] 只修改容器状态不会卸载或重建 children RuntimeNode。

### Vue

- [x] `visible=false` 时不渲染 Group DOM。
- [x] `readonly` 和 `disabled` 状态具有对应类名和 ARIA 属性。
- [x] `disabled=true` 时不能通过鼠标、Enter 或 Space 切换折叠状态。
- [x] 非受控模式使用 `defaultCollapsed` 初始化，并在更新后保留内部状态。
- [x] 受控模式完全由 `collapsed` 驱动，并触发 `onCollapsedChange`。
- [x] `destroyOnCollapse=false` 时保留后代 Renderer 实例。
- [x] `destroyOnCollapse=true` 时卸载后代 Renderer，但保留 Core 字段值。
- [x] Group 重新排序且 key 稳定时，折叠状态和组件实例不丢失。

## 决策记录

| 决策项                             | 推荐方案     | 说明                             |
| ---------------------------------- | ------------ | -------------------------------- |
| `destroyOnCollapse` 当前版本默认值 | `true`       | 保持现有条件渲染行为兼容。       |
| `destroyOnCollapse` 长期默认值     | `false`      | 优先保留 Renderer 局部状态。     |
| `disabled` 是否禁止折叠            | 是           | 与禁用容器的交互预期一致。       |
| `readonly` 是否禁止折叠            | 否           | 折叠属于浏览行为，不修改表单值。 |
| 隐藏是否清除字段值                 | 否           | 与普通字段当前语义保持一致。     |
| 折叠是否注销校验                   | 否           | 折叠只影响展示，不代表字段无效。 |
| dependencies 是否支持 `collapsed`  | 第二阶段评估 | 避免第一阶段扩大动态属性范围。   |
| Dependency 隐藏是否暂停 renderer   | 否           | 保持动态子树结构为最新状态。     |
| 是否默认复用 `to` 作为状态触发字段 | 否           | 结构依赖和状态依赖保持显式分离。 |

## 最终建议

第一阶段应优先建立完整的 Core 容器状态链路，而不是只修改 Group、Dependency 类型和 Vue 条件渲染。推荐的最小完整范围是：

1. `visible`、`readonly`、`disabled`、`dependencies`；
2. ContainerRuntimeState 和祖先状态传播；
3. 后代字段校验与容器状态同步；
4. 稳定 key 的公开使用约定；
5. 受控折叠和 `destroyOnCollapse`；
6. 可访问性和完整测试。

完成以上能力后，Group 和 Dependency 才能成为状态、渲染、交互和校验语义一致的容器节点。展示型属性、布局能力和 Group API 可以根据实际使用反馈继续扩展。
