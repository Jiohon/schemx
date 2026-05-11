# Schemx Runtime Architecture

# 一、核心目标

Schemx 不应该只是某个框架里的 Form 组件，而应该是：

```txt
Framework Agnostic Reactive Schema Runtime
```

即：

```txt
Schema 配置
  ↓
Core Runtime
  ↓
React / Vue / Solid Renderer Adapter
```

核心原则：

```txt
core 不依赖 framework
framework adapter 依赖 core
```

---

# 二、总体架构

```txt
@schemx/core
├─ schema compiler
├─ runtime graph
├─ field runtime
├─ reactive engine
├─ dependency engine
├─ dynamic prop engine
├─ validation engine
├─ scheduler
└─ renderer adapter protocol
```

外层框架包：

```txt
@schemx/vue
@schemx/react
@schemx/solid
```

---

# 三、核心认知

不要把动态逻辑解析成：

```txt
最终静态 schema
```

而应该：

```txt
Raw Schema
  ↓
Runtime Tree
  ↓
Runtime State
  ↓
Renderer
```

即：

```txt
Schema 是输入
RuntimeNode 是结构
FieldState 是状态
Renderer 是视图投影
```

---

# 四、模块拆分与边界

## 4.1 Schema Compiler

职责：

```txt
schema → runtime node
```

负责：

- normalize schema
- 默认值补全
- schema 基础校验
- 识别 field/group/dependency
- 构建 RuntimeNode
- 构建初始 runtime tree

不负责：

- 不执行 dependency renderer
- 不执行 disabled/visible
- 不执行 validation
- 不触发 UI render
- 不执行 scheduler

模块边界：

```txt
Compiler 只回答：
“这个 schema 应该变成什么 runtime node？”
```

---

## 4.2 Runtime Graph

职责：

```txt
维护运行时节点树
```

负责：

- parent/children
- subtree
- node replace
- node insert/remove
- runtime node reuse
- dependency subtree mount/unmount

不负责：

- 不计算 disabled
- 不执行 validation
- 不关心 UI
- 不处理 scheduler

模块边界：

```txt
Runtime Graph 只回答：
“当前有哪些 runtime node，它们是什么关系？”
```

---

## 4.3 Field Runtime

职责：

```txt
维护字段运行时状态
```

负责：

- value
- touched
- dirty
- validating
- errors
- visible
- disabled
- required
- loading

不负责：

- 不编译 schema
- 不生成 dependency subtree
- 不调度任务
- 不渲染组件

模块边界：

```txt
Field Runtime 只回答：
“这个字段当前是什么状态？”
```

---

## 4.4 Reactive Engine

职责：

```txt
提供底层响应式能力
```

负责：

- signal
- computed
- effect
- subscribe
- dependency tracking
- dispose

不负责：

- 不理解 schema
- 不理解 field
- 不理解 validation
- 不理解 renderer

模块边界：

```txt
Reactive Engine 只提供响应式原语。
```

---

## 4.5 Dependency Engine

职责：

```txt
处理动态 schema subtree
```

负责：

- 监听 dependency.to
- 执行 dependency.renderer
- async dependency
- version 防竞态
- subtree compile
- subtree replace
- dispose old subtree

不负责：

- 不处理 disabled/visible
- 不处理 validation
- 不直接 render UI
- 不修改 raw schema

模块边界：

```txt
Dependency Engine 只处理结构变化。
```

---

## 4.6 Dynamic Prop Engine

职责：

```txt
处理动态字段属性
```

负责：

- disabled
- visible
- required
- label
- componentProps
- dynamic rules

例如：

```ts
disabled: {
  to: ['status'],
  when: ({ status }) => status === 'locked'
}
```

内部流程：

```txt
watch deps
  ↓
compute prop
  ↓
update field runtime state
```

不负责：

- 不新增字段
- 不删除字段
- 不生成 subtree
- 不处理 mount/unmount

模块边界：

```txt
Dynamic Prop Engine 只处理属性变化。
```

---

## 4.7 Validation Engine

职责：

```txt
处理字段校验
```

负责：

- field validate
- form validate
- async validate
- validation versioning
- errors update
- validation lifecycle

不负责：

- 不生成 schema
- 不处理 dependency subtree
- 不修改 runtime graph
- 不直接 render

模块边界：

```txt
Validation Engine 只回答：
“字段是否合法？”
```

---

## 4.8 Scheduler

职责：

```txt
统一调度 runtime job
```

负责：

- job dedupe
- batching
- microtask flush
- priority
- pre/main/post phase
- recursive protection
- future time slicing

调度对象：

- dependency job
- dynamic prop job
- validation job
- renderer notify job
- cleanup job

不负责：

- 不执行业务逻辑
- 不理解 schema
- 不关心 renderer

模块边界：

```txt
Scheduler 只回答：
“什么时候执行？”
“执行顺序是什么？”
```

---

## 4.9 Renderer Adapter

职责：

```txt
runtime → framework ui
```

负责：

- RuntimeNode → Vue
- RuntimeNode → React
- RuntimeNode → Solid
- mount/update/unmount
- component registry
- ui bridge

不负责：

- 不编译 schema
- 不处理 dependency
- 不执行 validation
- 不修改 runtime graph

模块边界：

```txt
Renderer Adapter 只回答：
“runtime node 怎么显示？”
```

---

# 五、变化类型拆分

```txt
结构变化 → dependency engine
属性变化 → dynamic prop engine
值变化   → field runtime
错误变化 → validation engine
执行顺序 → scheduler
UI 更新  → renderer adapter
```

---

# 六、典型流程

## 6.1 Dynamic Prop Flow

```txt
用户修改 status
  ↓
field runtime 更新 value
  ↓
reactive engine 通知依赖
  ↓
dynamic prop engine 标记 dirty
  ↓
scheduler 批处理
  ↓
重新计算 disabled
  ↓
field runtime 更新 disabled
  ↓
renderer adapter 更新 UI
```

---

## 6.2 Dependency Flow

```txt
用户修改 type
  ↓
field runtime 更新 value
  ↓
dependency engine 标记 dirty
  ↓
scheduler flush
  ↓
执行 dependency renderer
  ↓
得到新的 schema subtree
  ↓
compiler 编译 subtree
  ↓
runtime graph replace subtree
  ↓
dispose old subtree
  ↓
renderer adapter 更新 UI
```

---

# 七、推荐 Runtime 数据结构

## RuntimeNode

```ts
type RuntimeNode = FieldRuntimeNode | GroupRuntimeNode | DependencyRuntimeNode
```

## FieldRuntimeNode

```ts
interface FieldRuntimeNode {
  type: "field"
  id: string
  name: string
  schema: NormalizedFieldSchema
  state: FieldState
  props: FieldDynamicProps
}
```

## DependencyRuntimeNode

```ts
interface DependencyRuntimeNode {
  type: "dependency"
  id: string
  deps: NamePath[]
  subtree: RuntimeNode[]
  loading: Signal<boolean>
  error: Signal<Error | null>
  version: number
  dispose: () => void
}
```

## RuntimeProp

```ts
interface RuntimeProp<T> {
  value: Signal<T>
  deps: NamePath[]
  compute: () => T | Promise<T>
  version: number
  dispose: () => void
}
```

---

# 八、Reactive Computation 抽象

底层都可以抽象成：

```txt
Reactive Computation
```

例如：

```ts
ReactiveComputation<boolean>
ReactiveComputation<Schema[]>
ReactiveComputation<string[]>
```

分别对应：

```txt
disabled/visible
dependency subtree
validation errors
```

共享底层能力：

```txt
deps tracking
scheduler
versioning
dispose
batching
```

---

# 九、最终设计目标

最终目标不是：

```txt
最终静态 schema
```

而是：

```txt
稳定 runtime tree + 局部动态更新
```

核心思想：

```txt
结构和状态分离
动态属性和动态结构分离
runtime 和 renderer 分离
core 和 framework 分离
```

# Runtime Stability Constraints

# 一、Scheduler Flush Ownership

## 问题

@preact/signals-core 的 effect 是同步触发的。

若：

```txt
Scheduler flush
  ↓
flush 中 signal 写操作
  ↓
preact effect 同步触发
  ↓
新的 effect 重入
```

则：

```txt
Scheduler recursive protection 失效
```

因为：

```txt
重入来自 Reactive Engine
Scheduler 本身无法感知
```

---

## 强制约束

Scheduler 必须是：

```txt
唯一 flush 控制者
```

Reactive Engine：

```txt
只能 markDirty + queueJob
不能执行业务逻辑
不能主动 flush
```

---

## 强制 batch 边界

规定：

```txt
所有 runtime signal 写操作
必须发生在 scheduler 顶层 batch() 内
```

例如：

```ts
function flushJobs() {
  batch(() => {
    flushPreJobs()
    flushMainJobs()
    flushPostJobs()
  })
}
```

---

# 二、Reactive Engine 与 Scheduler 职责边界

Reactive Engine：

```txt
只负责 dependency tracking 与 signal propagation
```

effect 内：

```txt
只能 markDirty + queueJob
```

禁止：

```txt
effect 内执行业务逻辑
effect 内直接 compile subtree
effect 内直接 validation
effect 内直接 render
```

Scheduler：

```txt
拥有唯一执行控制权
```

包括：

- dependency resolve
- dynamic prop compute
- validation
- renderer notify
- cleanup

---

# 三、Async Dependency Cancellation

version 只能：

```txt
结果回来后丢弃
```

不能：

```txt
中断正在执行的副作用
```

---

# 强制约束

dependency renderer：

```txt
必须支持 AbortSignal
```

---

# 推荐 renderer 签名

```ts
renderer(
  values,
  form,
  context: {
    signal: AbortSignal
  }
)
```

---

# 执行策略

```txt
new run starts
  ↓
abort previous controller
  ↓
version++
  ↓
run renderer
  ↓
if aborted return
  ↓
if version outdated return
  ↓
commit result
```

---

# 四、Nested Dependency Commit Order

Nested dependency：

```txt
只能在父 subtree commit 完成后执行 initialRun
```

---

# 正确流程

```txt
A.renderer resolve
  ↓
compile A subtree
  ↓
collect nested dependency nodes
  ↓
commit A subtree
  ↓
queue B.initialRun
```

---

# 五、Subtree Initialization Order

必须保证：

```txt
FieldRuntime 初始化
早于 nested dependency initialRun
```

---

# 正确顺序

```txt
compile subtree
  ↓
create RuntimeNode
  ↓
create FieldRuntime
  ↓
register fields
  ↓
mount runtime graph
  ↓
initialize dynamic props
  ↓
queue nested dependency initialRun
```

---

# 六、Subtree Mount Sequence

```txt
1. compile subtree
2. create RuntimeNode
3. create FieldRuntime
4. register fields
5. register dependency listeners
6. compute initial dynamic props
7. run validateOnMount validation
8. commit subtree
9. queue nested dependency initialRun
10. renderer notify
```

---

# 七、DisposeBag 强制机制

每个 RuntimeNode：

```txt
必须拥有 DisposeBag
```

---

# 推荐结构

```ts
class DisposeBag {
  private disposers = []

  add(disposer) {
    this.disposers.push(disposer)
  }

  dispose() {
    for (const dispose of this.disposers.splice(0)) {
      dispose()
    }
  }
}
```

---

# 必须注册到 DisposeBag 的对象

- signal subscription
- computed subscription
- effect
- validation watcher
- dynamic prop watcher
- dependency watcher
- renderer subscription
- AbortController
- scheduler cleanup hook

---

# 八、React StrictMode Constraint

React Adapter：

```txt
mount/unmount 必须幂等
```

原则：

```txt
重复 mount 不重复注册
重复 unmount 不重复 dispose
```

---

# 九、Computed Lifecycle Constraint

computed/effect：

```txt
必须绑定 RuntimeNode 生命周期
```

---

# 十、核心运行时协议

```txt
Reactive Engine
负责发现变化

Scheduler
负责安排变化

Engine
负责执行业务

Runtime Graph
负责提交结构

Renderer Adapter
负责显示结果
```

---

# 十一、最终原则

这些约束：

```txt
不是实现细节
而是 Runtime Protocol
```

必须：

```txt
先于功能开发确定
```

---

# 十二、当前代码状态与后续拆分路线

当前代码已经完成的拆分：

```txt
reactivity/
├─ signal
├─ effect
├─ batch
└─ reactiveMap
```

Reactive Engine 已经独立为 `reactivity` 模块，后续 runtime 拆分不再改动它。

当前仍然耦合较重的部分：

```txt
runtime/
├─ engine.ts
├─ nodes.ts
├─ fieldRuntime.ts
├─ dependencyRunner.ts
├─ projection.ts
├─ idle.ts
└─ types.ts
```

其中：

- `fieldRuntime.ts` 同时包含 Field Runtime state 与 Dynamic Prop Engine
- `dependencyRunner.ts` 已经是 Dependency Engine 雏形，但仍挂在 runtime 下
- `nodes.ts` 同时承担 node factory、field lifecycle、dependency runner 装配
- `createForm.ts` 仍负责 validator lifecycle 与 runtime field lifecycle 桥接
- `scheduler/dependencyScheduler.ts` 只调度 dependency，尚未成为统一 runtime scheduler

## 12.1 建议目标目录

```txt
packages/core/src/
├─ runtime/
│  ├─ engine.ts
│  ├─ graph.ts
│  ├─ nodeFactory.ts
│  ├─ projection.ts
│  ├─ idle.ts
│  └─ types.ts
├─ field/
│  ├─ fieldRuntime.ts
│  ├─ fieldLifecycle.ts
│  └─ types.ts
├─ dynamic-prop/
│  ├─ dynamicPropEngine.ts
│  ├─ dynamicPropResolver.ts
│  └─ types.ts
├─ dependency/
│  ├─ dependencyEngine.ts
│  ├─ dependencyRunner.ts
│  └─ types.ts
├─ validation/
│  ├─ validationEngine.ts
│  ├─ validationLifecycle.ts
│  └─ types.ts
├─ scheduler/
│  ├─ runtimeScheduler.ts
│  ├─ microtaskScheduler.ts
│  └─ fieldInitScheduler.ts
└─ reactivity/
   └─ ...
```

## 12.2 Runtime 拆分边界

`runtime` 最终只保留运行时树和装配入口。

负责：

- 创建 RuntimeEngine
- 持有 runtime root
- 维护 graph revision
- 暴露 getRoot / getResolvedSchemas / getFieldSchema
- 装配 compiler、graph、scheduler、各 engine

不负责：

- 不解析 dependencies 字段
- 不执行 dependency renderer
- 不直接处理 validation rules
- 不拥有 field dynamic prop 计算逻辑

迁移方向：

```txt
runtime/fieldRuntime.ts
  → field/fieldRuntime.ts
  → dynamic-prop/dynamicPropResolver.ts

runtime/dependencyRunner.ts
  → dependency/dependencyRunner.ts

runtime/nodes.ts
  → runtime/nodeFactory.ts
  → field/fieldLifecycle.ts
  → dependency/dependencyEngine.ts
```

## 12.3 Field Runtime 拆分边界

Field Runtime 只表示字段状态，不再知道 dependencies 字段如何计算。

保留：

- schema
- mounted
- visible
- readonly
- disabled
- required
- placeholder
- componentProps
- rules
- dispose

移出：

- `FIELD_DEPENDENCY_PROP_KEYS`
- `createFieldDependencyResolver`
- `resolveFieldProps`
- `resolvePropertyCondition`

目标边界：

```txt
Field Runtime 只回答：
“字段现在的 resolved state 是什么？”
```

## 12.4 Dynamic Prop Engine 拆分边界

`dependencies` 字段属于 Dynamic Prop Engine，不属于 Dependency Engine。

这里的命名容易混淆，需要强制区分：

```txt
schema.dependencies
  → dynamic prop dependencies
  → 改字段属性
  → 不改 runtime tree 结构

schema.componentType === "dependency"
  → dependency schema node
  → 生成/替换 subtree
  → 改 runtime tree 结构
```

Dynamic Prop Engine 负责：

- 监听 `dependencies.triggerFields`
- 执行 visible / disabled / readonly / required / placeholder / componentProps / rules
- 执行 `dependencies.trigger`
- 处理 async condition versioning
- 写回 FieldRuntime signals
- 通知 field update lifecycle
- 通知 projection revision

不负责：

- 不创建 RuntimeNode
- 不 replace subtree
- 不注册 validation rules
- 不直接读写 validator

建议接口：

```ts
interface DynamicPropEngine<T> {
  mountField(node: FieldRuntimeNode<T>): Disposable
  computeField(node: FieldRuntimeNode<T>): Promise<void>
}
```

## 12.5 Dependency Engine 拆分边界

Dependency Engine 专门处理动态结构。

负责：

- 监听 dependency node 的 `to`
- 调度 dependency runner
- 执行 renderer
- async version / AbortSignal
- 编译 renderer 返回的 schemas
- commit subtree 到 Runtime Graph
- dispose old subtree
- nested dependency initial run

不负责：

- 不处理 `schema.dependencies`
- 不处理 visible / disabled / rules
- 不直接注册 validator rules

建议接口：

```ts
interface DependencyEngine<T> {
  mountNode(node: DependencyRuntimeNode<T>): Disposable
  runNode(node: DependencyRuntimeNode<T>): Promise<void>
}
```

## 12.6 Validation 拆分边界

当前 `validator/validator.ts` 是底层校验器，`createForm.ts` 负责 field lifecycle 到 validator lifecycle 的桥接。

后续应拆成：

```txt
validator/
  只做 rule registry、error map、validateField、validate

validation/
  负责 runtime field lifecycle 与 validator 的关系
```

Validation Engine 负责：

- field mount 时注册可校验 rules
- dynamic rules/visible/disabled/readonly 变化时同步 rules
- field unmount 时清理 rules/errors
- validateOnMount / validateOnChange / validateOnSubmit
- async validate versioning
- 等待 runtime idle 后再 submit validation

不负责：

- 不计算 dynamic rules
- 不决定 field 是否 visible
- 不修改 runtime tree

目标边界：

```txt
Dynamic Prop Engine 计算 rules
Field Runtime 保存 resolved rules
Validation Engine 根据 Field Runtime 同步 validator
Validator 执行具体规则校验
```

## 12.7 Scheduler 拆分边界

当前只有 `DependencyScheduler`，dynamic prop 仍使用 `queueMicrotask` 自行排队。

后续 scheduler 应统一调度：

- dependency job
- dynamic prop job
- validation job
- renderer notify job
- cleanup job

目标：

```txt
Reactive effect 只 markDirty + enqueue job
RuntimeScheduler 拥有唯一 flush 权
所有 runtime signal 写入发生在 scheduler batch 内
```

建议先保留 `microtaskScheduler.ts`，新增更高层：

```txt
scheduler/runtimeScheduler.ts
```

再逐步替换：

```txt
DependencyScheduler
DynamicProp queueMicrotask
Validation async lifecycle
```

## 12.8 推荐迁移顺序

第一阶段：文件拆分，不改变行为。

```txt
1. fieldRuntime.ts 拆出 dynamic-prop/dynamicPropResolver.ts
2. dependencyRunner.ts 移到 dependency/
3. nodes.ts 改名 nodeFactory.ts，并只保留 node 创建/复用
4. projection.ts 改为依赖 field read props 的稳定出口
```

第二阶段：生命周期拆分。

```txt
1. 从 createForm.ts 抽出 validation/validationLifecycle.ts
2. RuntimeNodeFactory 不再直接理解 validator lifecycle
3. Field mount/update/unmount 事件统一走 FieldLifecycle bus
```

第三阶段：scheduler 统一。

```txt
1. 新增 RuntimeScheduler
2. dependency job 接入 RuntimeScheduler
3. dynamic prop job 接入 RuntimeScheduler
4. validation job 接入 RuntimeScheduler
5. 移除各模块内部 queueMicrotask
```

第四阶段：Runtime Graph 独立。

```txt
1. graph 管 parent/children/replace/dispose
2. compiler 只产出节点创建/复用计划
3. dependency engine 只向 graph 提交 subtree replace
4. engine 只持有 graph root 与 revision
```

## 12.9 拆分后的依赖方向

最终依赖方向应该是单向的：

```txt
reactivity
  ↑
scheduler
  ↑
field / dependency / validation
  ↑
runtime
  ↑
framework adapter
```

更准确地说：

```txt
runtime 装配各 engine
engine 依赖 field/runtime types
field 不依赖 dynamic-prop
validator 不依赖 runtime
validation lifecycle 同时依赖 runtime field 与 validator
renderer adapter 只依赖 runtime projection
```

禁止反向依赖：

```txt
field → dynamic-prop
validator → runtime
dependency → validation
renderer → compiler
reactivity → scheduler
```
