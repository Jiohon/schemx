# Schemx Runtime 最优目标架构方案

## 目标

本方案不以当前实现为约束，而是从最终设计目标反推 Runtime 的最优结构。

目标不是继续维护一个“表单引擎 + 若干补丁”的系统，而是建立：

```txt
Reactive Runtime Kernel
```

在这个模型中：

- Runtime Core 不知道 schema。
- Runtime Core 不知道 form。
- Runtime Core 不知道 validation。
- Runtime Core 只管理 fiber、scope、effect、scheduler、reconcile。
- Form Runtime 是 Runtime Core 上的一层领域模型。
- View Runtime 是面向 adapter 的投影模型。
- Schema DSL 只是 Form Runtime 的输入来源之一。

最终架构应当让系统从：

```txt
schema 驱动 runtime
```

变成：

```txt
runtime kernel 承载 form/view/schema DSL
```

---

# 一、核心判断

当前系统中最根本的问题不是模块拆得不够细，而是对象模型混淆：

```txt
RuntimeNode = tree node + schema node + field state + dynamic state + lifecycle carrier + adapter input
```

这个模型必须彻底拆开。

最终不再以 `RuntimeNode` 作为统一核心对象，而是拆为：

```txt
Fiber        : runtime 结构单元
Scope        : 资源生命周期单元
Effect       : 响应式副作用单元
FieldState   : 表单字段状态单元
FieldModel   : 字段领域模型
DynamicSlot  : 动态子树插槽
Validation   : 校验派生状态
ViewModel    : adapter 渲染输入
```

其中 `Fiber` 是 runtime core 的唯一结构实体；`FieldState`、`Validation`、`DynamicSlot` 都是挂载在 fiber 上的领域能力，而不是 fiber 自身的字段。

---

# 二、目标分层

## 1. Runtime Core

Runtime Core 是框架无关、领域无关的 reactive kernel。

```txt
runtime/core/
  fiber.ts
  scope.ts
  effect.ts
  scheduler.ts
  reconciler.ts
  owner.ts
  resource.ts
```

Runtime Core 负责：

- fiber 创建、复用、移动、销毁。
- scope 创建、嵌套、释放。
- effect 注册、调度、取消。
- async task 跟踪。
- subtree reconcile。
- ownership 管理。

Runtime Core 不负责：

- 解析 schema。
- 读取或写入 form values。
- 注册 validation rules。
- 生成 UI schema。
- 暴露 renderer component props。

## 2. Form Runtime

Form Runtime 是表单领域层。

```txt
runtime/form/
  formRuntime.ts
  fieldState.ts
  fieldModel.ts
  fieldDerivation.ts
  validationEffect.ts
  dynamicScope.ts
  schemaCompiler.ts
```

Form Runtime 负责：

- 把 schema DSL 编译成 form descriptors。
- 创建 field state。
- 维护 name path 索引。
- 运行 dynamic props derivation。
- 运行 validation effect。
- 运行 dynamic schema renderer。
- 把领域状态挂载到 fiber。

Form Runtime 不负责：

- 直接给 adapter 输出 UI。
- 手写 tree dispose。
- 手动维护 scheduler phase。
- 让 schema node 等同于 runtime node。

## 3. View Runtime

View Runtime 是 adapter 消费层。

```txt
runtime/view/
  viewModel.ts
  projectViewTree.ts
  viewAdapterContract.ts
```

View Runtime 负责：

- 从 fiber tree + form state 投影出 render tree。
- 隐藏 dynamic slot / validation / field state 内部结构。
- 给 adapter 提供稳定、最小、只读的 view model。

Adapter 只应消费 ViewModel，不应直接消费 Fiber、FieldState、DynamicScope。

---

# 三、核心实体

## Fiber

Fiber 是 runtime core 的结构节点。

```ts
interface Fiber {
  id: number
  key: string
  kind: string
  parent: Fiber | null
  children: Fiber[]
  scope: RuntimeScope
  resources: ResourceMap
  disposed: Signal<boolean>
}
```

Fiber 只表达：

- 身份
- 父子结构
- 所有权
- 生命周期
- 可扩展资源槽

Fiber 不表达：

- 字段名
- schema
- rules
- componentProps
- validation errors
- dependency renderer

## RuntimeScope

Scope 是资源生命周期边界。

```ts
interface RuntimeScope {
  readonly disposed: boolean
  add(dispose: DisposeFn): DisposeHandle
  child(): RuntimeScope
  dispose(): void
}
```

Scope 规则：

- dispose 幂等。
- 子 scope 先释放，父 scope 后释放。
- cleanup 抛错不阻断后续 cleanup。
- disposed 后 `add()` 立即执行 cleanup 并返回已释放 handle。
- scope dispose 会取消关联 scheduler task。
- scope dispose 会 abort 关联 async computation。

## Effect

Effect 是响应式副作用。

```ts
interface RuntimeEffect {
  id: string
  scope: RuntimeScope
  run(): void | Promise<void>
  dispose(): void
}
```

Effect 必须：

- 挂到 scope。
- 通过 scheduler 调度。
- 可被 idle tracking 等待。
- dispose 后不再写入 state。

## AsyncComputation

AsyncComputation 是异步派生状态。

```ts
interface AsyncComputation<T> {
  value: Signal<T>
  loading: Signal<boolean>
  error: Signal<Error | null>
  version: number
  run(): Promise<void>
  dispose(): void
}
```

规则：

- 每次 run 自增 version。
- 新 run abort 旧 run。
- 旧 result 不能覆盖新 result。
- dispose 后 result 必须丢弃。
- 所有 run 必须进入 scheduler idle tracking。

## FieldState

FieldState 是表单字段的真实状态容器。

```ts
interface FieldState<TValue = unknown> {
  name: NamePath
  value: Signal<TValue>
  initialValue: Signal<TValue | undefined>
  touched: Signal<boolean>
  pending: Signal<FieldPending | null>
  errors: Signal<string[]>
}
```

FieldState 不知道 UI，也不持有 schema。

## FieldModel

FieldModel 是字段领域模型。

```ts
interface FieldModel {
  name: NamePath
  state: FieldState
  props: FieldPropsModel
  validation: ValidationModel
  scope: RuntimeScope
}
```

FieldModel 负责连接：

- FieldState
- dynamic props
- validation
- schema descriptor

## FieldPropsModel

字段 props 全部是派生状态。

```ts
interface FieldPropsModel {
  visible: AsyncComputation<boolean>
  readonly: AsyncComputation<boolean>
  disabled: AsyncComputation<boolean>
  required: AsyncComputation<boolean>
  placeholder: AsyncComputation<string>
  componentProps: AsyncComputation<Record<string, unknown>>
  rules: AsyncComputation<RuleInput | undefined>
}
```

所有字段属性统一建模，不再区分“静态 props 写入”和“动态 props 覆盖”。

静态配置只是 derivation 的 baseline。

## ValidationModel

Validation 是字段状态的 effect，不是 lifecycle bridge。

```ts
interface ValidationModel {
  registered: Signal<boolean>
  validating: Signal<boolean>
  validate(): Promise<ValidationResult>
  dispose(): void
}
```

Validation effect 依赖：

- field value
- rules
- visible
- readonly
- disabled

规则：

- `visible=false` 时 unregister rules 并 clear errors。
- `readonly=true` 时 unregister rules 并 clear errors。
- `disabled=true` 时 unregister rules 并 clear errors。
- rules 改变时自动重新注册。
- field dispose 时自动 unregister。

## DynamicSlot

DynamicSlot 是动态子树插槽。

```ts
interface DynamicSlot {
  owner: Fiber
  subtree: Signal<Fiber[]>
  loading: Signal<boolean>
  error: Signal<Error | null>
  run(): Promise<void>
  dispose(): void
}
```

DynamicSlot 负责：

- 执行 renderer。
- 管理 async version。
- 管理 abort。
- 把 renderer 结果编译为 descriptors。
- 调用 reconciler 更新 subtree。

DynamicSlot 不是 tree node。

## ViewModel

ViewModel 是 adapter 的唯一输入。

```ts
interface ViewNode {
  id: number
  key: string
  type: "field" | "group" | "fragment"
  renderer?: RendererKey
  name?: NamePath
  props: Readonly<Record<string, unknown>>
  state?: Readonly<FieldViewState>
  children: ViewNode[]
}
```

ViewModel 规则：

- 不暴露 Fiber。
- 不暴露 DynamicSlot。
- 不暴露 schema 原始对象。
- 不暴露 mutable FieldState。
- dependency 不作为 ViewNode 类型出现。
- dynamic subtree 被投影为普通 children。

---

# 四、目标数据流

## 初始化

```txt
schema DSL
  -> schemaCompiler
  -> FormDescriptor[]
  -> reconciler
  -> Fiber[]
  -> attach FieldModel / DynamicSlot
  -> projectViewTree
  -> ViewNode[]
```

## 字段值变化

```txt
setFieldValue
  -> FieldState.value
  -> FieldPropsModel derivations
  -> ValidationEffect
  -> DynamicSlot effects
  -> ViewModel projection invalidation
```

## dynamic props

```txt
trigger fields changed
  -> AsyncComputation.run
  -> version + abort guard
  -> props signal update
  -> validation/view projection reacts
```

## dynamic schema

```txt
trigger fields changed
  -> DynamicSlot.run
  -> renderer result
  -> descriptors
  -> reconcile slot subtree
  -> old subtree scope dispose
  -> ViewModel projection reacts
```

## validation

```txt
value / rules / visible / readonly / disabled changed
  -> ValidationEffect
  -> register/unregister rules
  -> validate when requested or configured
  -> FieldState.errors
  -> ViewModel projection reacts
```

## dispose

```txt
fiber.dispose
  -> child scopes dispose
  -> dynamic slots dispose
  -> validation effects dispose
  -> async computations abort
  -> scheduler tasks cancel
  -> disposed signal update
```

---

# 五、目标模块边界

## runtime/core/fiber.ts

只包含 fiber 数据结构和创建函数。

不 import：

- schema
- form
- validator
- renderer

## runtime/core/reconciler.ts

输入 descriptor，输出 fiber。

```ts
reconcileChildren(parent, previous, descriptors, options)
```

reconciler 不知道 field 细节，只通过 hooks 创建资源：

```ts
interface ReconcileHooks {
  mount(fiber, descriptor): void
  update(fiber, descriptor): void
  unmount(fiber): void
}
```

## runtime/form/schemaCompiler.ts

把 schema DSL 编译成 FormDescriptor。

```ts
type FormDescriptor =
  | FieldDescriptor
  | GroupDescriptor
  | DynamicDescriptor
```

Descriptor 是不可变结构描述，不持有运行时状态。

## runtime/form/formRuntime.ts

FormRuntime 是领域装配入口。

负责：

- 创建 root fiber。
- 维护 field index。
- 维护 scheduler。
- 维护 view projection。
- 提供 form API。

## runtime/view/projectViewTree.ts

只做 projection。

```txt
Fiber tree + attached models -> ViewNode tree
```

不做：

- validation
- dynamic renderer
- scheduler queue
- field state mutation

---

# 六、关键设计决策

## 1. Fiber 不对应 schema node

Fiber 对应 runtime ownership 单元，不对应 schema node。

一个 schema field 通常会生成一个 field fiber，但这不是核心假设。

未来可以出现：

- 一个 schema 生成多个 fiber。
- 多个 schema 合并为一个 view fiber。
- dynamic slot 没有对应 view node。
- fragment fiber 只用于 ownership，不用于渲染。

## 2. name path 索引属于 Form Runtime

FieldState 通过 `FieldRegistry` 索引：

```ts
interface FieldRegistry {
  get(name: NamePath): FieldModel | undefined
  register(model: FieldModel): void
  unregister(name: NamePath): void
}
```

Fiber 不负责 name path 查询。

## 3. ViewModel 是 adapter 唯一输入

Adapter 不读取 RuntimeNode/Fiber/Schema。

Adapter 只消费：

```txt
ViewNode[]
RendererRegistry
Form API
```

这可以彻底切断 adapter 对 runtime 内部结构的依赖。

## 4. DynamicScope 挂在 DynamicSlot 上，不挂在 field 上

Dynamic schema renderer 产生的是 subtree ownership，不是字段属性。

因此：

```txt
DynamicDescriptor -> DynamicSlot -> subtree fibers
```

而不是：

```txt
DependencyRuntimeNode -> children
```

## 5. ValidationEffect 挂在 FieldModel 上

Validation 依赖 field state 和 field props，因此属于 FieldModel。

它不属于：

- Fiber core
- ViewModel
- Scheduler channel
- lifecycle callback bridge

## 6. Projection 返回 render model，不返回 schema

最终 `getResolvedSchemas()` 不应是 adapter 的主要输入。

目标输入是：

```txt
getViewTree(): ViewNode[]
```

如果需要兼容 schema projection，应作为调试/迁移 API，而不是核心路径。

## 7. Runtime Core 可以完全不依赖 schema/form/validation

Runtime Core 的输入是 descriptor，不是 schema。

领域层决定 descriptor 的含义。

这使 runtime core 可以复用到：

- form
- wizard
- workflow
- visual editor
- future non-form DSL

## 8. 不长期保留 dual model

可以短期使用 dual model 迁移，但最终目标必须删除旧模型。

迁移原则：

```txt
旧 RuntimeNode model 只作为 compatibility adapter
新系统内部不再以它为核心
```

---

# 七、最终目录结构

```txt
packages/core/src/runtime/
  core/
    fiber.ts
    scope.ts
    effect.ts
    scheduler.ts
    reconciler.ts
    resource.ts
    owner.ts

  form/
    formRuntime.ts
    schemaCompiler.ts
    descriptor.ts
    fieldRegistry.ts
    fieldState.ts
    fieldModel.ts
    fieldPropsModel.ts
    asyncComputation.ts
    validationEffect.ts
    dynamicSlot.ts

  view/
    viewModel.ts
    projectViewTree.ts
    adapterContract.ts

  compat/
    projectResolvedSchemas.ts
    legacyRuntimeNodeAdapter.ts
```

---

# 八、模块最终示例代码

以下代码不是当前实现的补丁，而是目标架构下各模块应收敛到的形态示例。重点是展示依赖方向、对象边界和运行时语义。

示例代码约定：

- 模块公开工厂函数使用 `export function`，便于 API 搜索和文档生成。
- 有内部状态、明确生命周期的小服务使用 `class`，例如 registry、resource map、reconciler。
- 函数内部的局部 helper、callback、闭包方法统一使用箭头函数。
- 不使用 `as never`、隐式 `any`、浏览器专属全局对象，core 示例默认运行在通用 JavaScript 环境。
- 必要的泛型边界断言集中在 typed resource 读取处，不向业务层扩散。

## runtime/core/fiber.ts

`Fiber` 是 Runtime Core 的唯一结构节点。它不感知 schema、form、validation、renderer。

```ts
export type FiberKind = "root" | "field" | "group" | "slot" | "fragment"

export interface Fiber {
  readonly id: number
  readonly key: string
  readonly kind: FiberKind

  parent: Fiber | null
  children: Fiber[]

  scope: RuntimeScope
  resources: ResourceMap
  disposed: Signal<boolean>
}

export interface CreateFiberOptions {
  id: number
  key: string
  kind: FiberKind
  parent?: Fiber | null
  scope?: RuntimeScope
}

export function createFiber(options: CreateFiberOptions): Fiber {
  const {
    id,
    key,
    kind,
    parent = null,
    scope = createRuntimeScope(),
  } = options

  return {
    id,
    key,
    kind,
    parent,
    children: [],
    scope,
    resources: createResourceMap(),
    disposed: createSignal(false),
  }
}

export function disposeFiber(fiber: Fiber): void {
  if (fiber.disposed.value) return

  for (const child of fiber.children) {
    disposeFiber(child)
  }

  fiber.children = []
  fiber.scope.dispose()
  fiber.resources.clear()
  fiber.parent = null
  fiber.disposed.value = true
}
```

## runtime/core/scope.ts

`RuntimeScope` 是所有 effect、async task、dynamic subtree、validation 的释放边界。

```ts
export type DisposeFn = () => void

export interface DisposeHandle {
  readonly disposed: boolean
  dispose(): void
}

export interface RuntimeScope {
  readonly disposed: boolean
  add(dispose: DisposeFn): DisposeHandle
  child(): RuntimeScope
  dispose(): void
}

export function createRuntimeScope(): RuntimeScope {
  let disposed = false
  const cleanups = new Set<DisposeFn>()
  const children = new Set<RuntimeScope>()

  const addCleanup = (dispose: DisposeFn): DisposeHandle => {
    if (disposed) {
      runCleanup(dispose)

      return createDisposedHandle()
    }

    let handleDisposed = false
    cleanups.add(dispose)

    const disposeHandle = (): void => {
      if (handleDisposed) return

      handleDisposed = true
      cleanups.delete(dispose)
      runCleanup(dispose)
    }

    return {
      get disposed() {
        return handleDisposed
      },
      dispose: disposeHandle,
    }
  }

  const createChildScope = (): RuntimeScope => {
    const childScope = createRuntimeScope()
    children.add(childScope)

    addCleanup(() => {
      children.delete(childScope)
      childScope.dispose()
    })

    return childScope
  }

  const disposeScope = (): void => {
    if (disposed) return

    disposed = true

    for (const childScope of Array.from(children).reverse()) {
      childScope.dispose()
    }

    children.clear()

    for (const cleanup of Array.from(cleanups).reverse()) {
      runCleanup(cleanup)
    }

    cleanups.clear()
  }

  return {
    get disposed() {
      return disposed
    },
    add: addCleanup,
    child: createChildScope,
    dispose: disposeScope,
  }
}

const createDisposedHandle = (): DisposeHandle => {
  return {
    disposed: true,
    dispose: noop,
  }
}

const noop = (): void => {}

const runCleanup = (cleanup: DisposeFn): void => {
  try {
    cleanup()
  } catch (error) {
    reportRuntimeCleanupError(error)
  }
}
```

## runtime/core/resource.ts

`ResourceMap` 是领域层挂载模型的唯一扩展点，避免把字段状态塞进 `Fiber`。

```ts
export interface ResourceKey<T> {
  readonly id: symbol
  readonly description: string
}

export interface ResourceMap {
  set<T>(key: ResourceKey<T>, value: T): void
  get<T>(key: ResourceKey<T>): T | undefined
  require<T>(key: ResourceKey<T>): T
  delete<T>(key: ResourceKey<T>): void
  clear(): void
}

export function createResourceKey<T>(description: string): ResourceKey<T> {
  return {
    id: Symbol(description),
    description,
  }
}

export class RuntimeResourceMap implements ResourceMap {
  #resources = new Map<symbol, unknown>()

  set<T>(key: ResourceKey<T>, value: T): void {
    this.#resources.set(key.id, value)
  }

  get<T>(key: ResourceKey<T>): T | undefined {
    const value = this.#resources.get(key.id)

    return value === undefined ? undefined : (value as T)
  }

  require<T>(key: ResourceKey<T>): T {
    const value = this.get(key)

    if (value == null) {
      throw new Error(`Missing runtime resource: ${key.description}`)
    }

    return value
  }

  delete<T>(key: ResourceKey<T>): void {
    this.#resources.delete(key.id)
  }

  clear(): void {
    this.#resources.clear()
  }
}

export function createResourceMap(): ResourceMap {
  return new RuntimeResourceMap()
}
```

## runtime/core/reconciler.ts

Reconciler 只处理结构复用和生命周期 hook，不理解 descriptor 的领域含义。

```ts
export interface RuntimeDescriptor {
  key: string
  kind: FiberKind
  children?: RuntimeDescriptor[]
  data?: unknown
}

export interface ReconcileHooks {
  mount(fiber: Fiber, descriptor: RuntimeDescriptor): void
  update(fiber: Fiber, descriptor: RuntimeDescriptor): void
  unmount(fiber: Fiber): void
}

export interface Reconciler {
  reconcileChildren(
    parent: Fiber,
    previous: Fiber[],
    descriptors: RuntimeDescriptor[],
    hooks: ReconcileHooks
  ): Fiber[]
}

export class RuntimeReconciler implements Reconciler {
  #nextId = 1

  reconcileChildren(
    parent: Fiber,
    previous: Fiber[],
    descriptors: RuntimeDescriptor[],
    hooks: ReconcileHooks
  ): Fiber[] {
    const previousByKey = new Map(previous.map((fiber) => [fiber.key, fiber]))
    const next: Fiber[] = []

    for (const descriptor of descriptors) {
      const existing = previousByKey.get(descriptor.key)

      if (existing && existing.kind === descriptor.kind) {
        previousByKey.delete(descriptor.key)
        existing.parent = parent
        hooks.update(existing, descriptor)
        next.push(existing)
        continue
      }

      const fiber = createFiber({
        id: this.#nextId++,
        key: descriptor.key,
        kind: descriptor.kind,
        parent,
        scope: parent.scope.child(),
      })

      hooks.mount(fiber, descriptor)
      next.push(fiber)
    }

    for (const removed of previousByKey.values()) {
      hooks.unmount(removed)
      disposeFiber(removed)
    }

    parent.children = next

    return next
  }
}

export function createReconciler(): Reconciler {
  return new RuntimeReconciler()
}
```

## runtime/core/scheduler.ts

Scheduler 是通用 task 调度器，不存在 `validation/dependency/renderer` 业务 channel。

```ts
export type TaskPriority = "sync" | "pre" | "normal" | "post"

export interface ScheduledTask {
  id: string
  priority: TaskPriority
  scope?: RuntimeScope
  run(): void | Promise<void>
  onError?(error: unknown): void
}

export interface RuntimeScheduler {
  schedule(task: ScheduledTask): void
  flush(): Promise<void>
  whenIdle(timeout?: number): Promise<boolean>
  track<T>(promise: Promise<T>): Promise<T>
  dispose(): void
}

const PRIORITY_ORDER: TaskPriority[] = ["sync", "pre", "normal", "post"]

export function createRuntimeScheduler(): RuntimeScheduler {
  const queues = new Map<TaskPriority, Map<string, ScheduledTask>>(
    PRIORITY_ORDER.map((priority) => [priority, new Map()])
  )

  const idleResolvers = new Set<(idle: boolean) => void>()
  let pendingAsync = 0
  let disposed = false
  let currentFlush: Promise<void> | null = null

  const flush = async (): Promise<void> => {
    if (disposed) return
    if (currentFlush) return currentFlush

    currentFlush = flushOnce().finally(() => {
      currentFlush = null
      notifyIdleIfNeeded()
    })

    return currentFlush
  }

  const flushOnce = async (): Promise<void> => {
    const batch = takeBatch()

    for (const task of batch) {
      if (disposed || task.scope?.disposed) continue

      try {
        const result = task.run()

        if (isPromiseLike(result)) {
          await track(result)
        }
      } catch (error) {
        task.onError?.(error)
      }
    }
  }

  const schedule = (task: ScheduledTask): void => {
    if (disposed || task.scope?.disposed) return

    queues.get(task.priority)?.set(task.id, task)
    queueMicrotask(() => void flush())
  }

  const takeBatch = (): ScheduledTask[] => {
    const batch: ScheduledTask[] = []

    for (const priority of PRIORITY_ORDER) {
      const queue = queues.get(priority)

      if (!queue) continue

      batch.push(...queue.values())
      queue.clear()
    }

    return batch
  }

  const track = async <T>(promise: Promise<T>): Promise<T> => {
    pendingAsync += 1

    try {
      return await promise
    } finally {
      pendingAsync -= 1
      notifyIdleIfNeeded()
    }
  }

  const whenIdle = (timeout = 10000): Promise<boolean> => {
    if (isIdle()) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        idleResolvers.delete(resolve)
        resolve(false)
      }, timeout)

      idleResolvers.add((idle) => {
        globalThis.clearTimeout(timeoutId)
        resolve(idle)
      })
    })
  }

  const isIdle = (): boolean => {
    return !currentFlush && pendingAsync === 0 && !hasQueuedTasks()
  }

  const hasQueuedTasks = (): boolean => {
    return Array.from(queues.values()).some((queue) => queue.size > 0)
  }

  const notifyIdleIfNeeded = (): void => {
    if (!isIdle()) return

    const resolvers = Array.from(idleResolvers)
    idleResolvers.clear()
    resolvers.forEach((resolve) => resolve(true))
  }

  const dispose = (): void => {
    disposed = true
    queues.forEach((queue) => queue.clear())
    notifyIdleIfNeeded()
  }

  return {
    schedule,
    flush,
    whenIdle,
    track,
    dispose,
  }
}
```

## runtime/form/descriptor.ts

Form descriptor 是 schema DSL 编译后的中间表示。它是不可变输入，不承载运行时状态。

```ts
export type FormDescriptor =
  | FieldDescriptor
  | GroupDescriptor
  | DynamicDescriptor

export interface FieldDescriptor {
  kind: "field"
  key: string
  name: NamePath
  renderer: RendererKey
  baseline: FieldPropsBaseline
  derivations: FieldDerivationMap
  validation: ValidationDescriptor
}

export interface GroupDescriptor {
  kind: "group"
  key: string
  children: FormDescriptor[]
}

export interface DynamicDescriptor {
  kind: "slot"
  key: string
  trigger: NamePath[]
  render: DynamicRenderer
}

export interface FieldPropsBaseline {
  visible: boolean
  readonly: boolean
  disabled: boolean
  required: boolean
  placeholder: string
  componentProps: Record<string, unknown>
  rules?: RuleInput
}
```

## runtime/form/asyncComputation.ts

所有 async 派生状态统一使用这个抽象，包括 dynamic props 和 dynamic slot renderer。

```ts
export interface AsyncComputation<T> {
  readonly value: Signal<T>
  readonly loading: Signal<boolean>
  readonly error: Signal<Error | null>
  readonly scope: RuntimeScope
  run(): Promise<void>
  dispose(): void
}

export interface AsyncComputationOptions<T> {
  id: string
  scope: RuntimeScope
  scheduler: RuntimeScheduler
  initialValue: T
  compute(signal: AbortSignal): Promise<T> | T
}

export function createAsyncComputation<T>(
  options: AsyncComputationOptions<T>
): AsyncComputation<T> {
  const value = createSignal(options.initialValue)
  const loading = createSignal(false)
  const error = createSignal<Error | null>(null)

  let version = 0
  let controller: AbortController | null = null

  const run = async (): Promise<void> => {
    if (options.scope.disposed) return

    const currentVersion = ++version
    controller?.abort()
    controller = new AbortController()

    loading.value = true
    error.value = null

    await options.scheduler.track(runCurrentComputation(currentVersion, controller))
  }

  const runCurrentComputation = async (
    currentVersion: number,
    currentController: AbortController
  ): Promise<void> => {
    try {
      const nextValue = await options.compute(currentController.signal)

      if (isStale(currentVersion, currentController)) return

      value.value = nextValue
    } catch (cause) {
      if (isStale(currentVersion, currentController)) return

      error.value = normalizeError(cause)
    } finally {
      if (!isStale(currentVersion, currentController)) {
        loading.value = false
      }
    }
  }

  const isStale = (
    currentVersion: number,
    currentController: AbortController
  ): boolean => {
    return (
      options.scope.disposed ||
      currentController.signal.aborted ||
      currentVersion !== version
    )
  }

  const dispose = (): void => {
    version += 1
    controller?.abort()
  }

  options.scope.add(dispose)

  return {
    value,
    loading,
    error,
    scope: options.scope,
    run,
    dispose,
  }
}

const normalizeError = (cause: unknown): Error => {
  return cause instanceof Error ? cause : new Error(String(cause))
}
```

## runtime/form/fieldRegistry.ts

字段索引属于 Form Runtime，不进入 Runtime Core。

```ts
export interface FieldRegistry {
  register(model: FieldModel): void
  unregister(name: NamePath): void
  get(name: NamePath): FieldModel | undefined
  list(): FieldModel[]
}

export class RuntimeFieldRegistry implements FieldRegistry {
  #fields = new Map<string, FieldModel>()

  register(model: FieldModel): void {
    this.#fields.set(normalizeNamePath(model.name), model)
  }

  unregister(name: NamePath): void {
    this.#fields.delete(normalizeNamePath(name))
  }

  get(name: NamePath): FieldModel | undefined {
    return this.#fields.get(normalizeNamePath(name))
  }

  list(): FieldModel[] {
    return Array.from(this.#fields.values())
  }
}

export function createFieldRegistry(): FieldRegistry {
  return new RuntimeFieldRegistry()
}
```

## runtime/form/fieldModel.ts

FieldModel 是字段领域聚合根，连接 FieldState、Props、Validation。

```ts
export const FIELD_MODEL = createResourceKey<FieldModel>("schemx.fieldModel")

export interface FieldModel {
  name: NamePath
  fiber: Fiber
  state: FieldState
  props: FieldPropsModel
  validation: ValidationModel
  scope: RuntimeScope
}

export function mountFieldModel(
  fiber: Fiber,
  descriptor: FieldDescriptor,
  context: FormRuntimeContext
): FieldModel {
  const scope = fiber.scope.child()
  const state = context.fields.getOrCreateState(descriptor.name)

  const props = createFieldPropsModel({
    descriptor,
    scope,
    scheduler: context.scheduler,
    getSnapshot: context.getSnapshot,
  })

  const validation = createValidationEffect({
    state,
    props,
    scope,
    scheduler: context.scheduler,
    validator: context.validator,
  })

  const model: FieldModel = {
    name: descriptor.name,
    fiber,
    state,
    props,
    validation,
    scope,
  }

  fiber.resources.set(FIELD_MODEL, model)
  context.registry.register(model)

  scope.add(() => {
    context.registry.unregister(model.name)
    fiber.resources.delete(FIELD_MODEL)
  })

  return model
}
```

## runtime/form/fieldPropsModel.ts

静态 props 只是 baseline，所有最终 props 都通过 computation 暴露。

```ts
export interface FieldPropsModel {
  visible: AsyncComputation<boolean>
  readonly: AsyncComputation<boolean>
  disabled: AsyncComputation<boolean>
  required: AsyncComputation<boolean>
  placeholder: AsyncComputation<string>
  componentProps: AsyncComputation<Record<string, unknown>>
  rules: AsyncComputation<RuleInput | undefined>
}

export function createFieldPropsModel(
  options: CreateFieldPropsModelOptions
): FieldPropsModel {
  const { descriptor, scope, scheduler, getSnapshot } = options
  const createPropComputation = <K extends keyof FieldPropsBaseline>(
    key: K
  ): AsyncComputation<FieldPropsBaseline[K]> => {
    return createAsyncComputation({
      id: `${descriptor.key}:props:${String(key)}`,
      scope,
      scheduler,
      initialValue: descriptor.baseline[key],
      compute: async (signal) => {
        const derive = descriptor.derivations[key]

        if (!derive) return descriptor.baseline[key]

        return derive({
          snapshot: getSnapshot(),
          signal,
          fallback: descriptor.baseline[key],
        })
      },
    })
  }

  return {
    visible: createPropComputation("visible"),
    readonly: createPropComputation("readonly"),
    disabled: createPropComputation("disabled"),
    required: createPropComputation("required"),
    placeholder: createPropComputation("placeholder"),
    componentProps: createPropComputation("componentProps"),
    rules: createPropComputation("rules"),
  }
}
```

## runtime/form/validationEffect.ts

Validation 是 FieldModel 的 effect，不再是 field lifecycle bridge。

```ts
export interface ValidationModel {
  registered: Signal<boolean>
  validating: Signal<boolean>
  validate(): Promise<ValidationResult>
  dispose(): void
}

export function createValidationEffect(
  options: CreateValidationEffectOptions
): ValidationModel {
  const registered = createSignal(false)
  const validating = createSignal(false)
  const { state, props, validator, scope, scheduler } = options

  const disposeEffect = createRuntimeEffect({
    id: `validation:${normalizeNamePath(state.name)}`,
    scope,
    scheduler,
    run: () => {
      const visible = props.visible.value.value
      const readonly = props.readonly.value.value
      const disabled = props.disabled.value.value
      const rules = props.rules.value.value

      if (!visible || readonly || disabled || !hasRules(rules)) {
        validator.unregisterRules(state.name)
        state.errors.value = []
        registered.value = false

        return
      }

      validator.registerRules(state.name, rules)
      registered.value = true
    },
  })

  scope.add(disposeEffect)
  scope.add(() => {
    validator.unregisterRules(state.name)
    state.errors.value = []
    registered.value = false
  })

  const validate = async (): Promise<ValidationResult> => {
    validating.value = true

    try {
      return await validator.validateField(state.name)
    } finally {
      validating.value = false
    }
  }

  const dispose = (): void => {
    scope.dispose()
  }

  return {
    registered,
    validating,
    validate,
    dispose,
  }
}
```

## runtime/form/dynamicSlot.ts

DynamicSlot 负责动态子树，不再作为 tree node 出现在 view tree。

```ts
export const DYNAMIC_SLOT = createResourceKey<DynamicSlot>("schemx.dynamicSlot")

export interface DynamicSlot {
  owner: Fiber
  subtree: Signal<Fiber[]>
  loading: Signal<boolean>
  error: Signal<Error | null>
  run(): Promise<void>
  dispose(): void
}

export function mountDynamicSlot(
  fiber: Fiber,
  descriptor: DynamicDescriptor,
  context: FormRuntimeContext
): DynamicSlot {
  const scope = fiber.scope.child()
  const subtree = createSignal<Fiber[]>([])
  const initialDescriptors: FormDescriptor[] = []

  const computation = createAsyncComputation({
    id: `${descriptor.key}:dynamic`,
    scope,
    scheduler: context.scheduler,
    initialValue: initialDescriptors,
    compute: async (signal) => {
      return descriptor.render(context.getSnapshot(), {
        signal,
        form: context.formApi,
      })
    },
  })

  const run = async (): Promise<void> => {
    await computation.run()

    if (scope.disposed) return

    const nextFibers = context.reconciler.reconcileChildren(
      fiber,
      subtree.value,
      computation.value.value.map(toRuntimeDescriptor),
      context.reconcileHooks
    )

    subtree.value = nextFibers
  }

  const dispose = (): void => {
    scope.dispose()
  }

  const slot: DynamicSlot = {
    owner: fiber,
    subtree,
    loading: computation.loading,
    error: computation.error,
    run,
    dispose,
  }

  fiber.resources.set(DYNAMIC_SLOT, slot)
  scope.add(() => fiber.resources.delete(DYNAMIC_SLOT))

  return slot
}
```

## runtime/form/formRuntime.ts

FormRuntime 是领域层装配入口，组合 core 和 form/view 模块。

```ts
export interface FormRuntime {
  readonly root: Fiber
  readonly scheduler: RuntimeScheduler
  readonly fields: FieldRegistry

  compile(schemas: SchemxField[]): void
  getViewTree(): ViewNode[]
  waitForIdle(timeout?: number): Promise<boolean>
  dispose(): void
}

export function createFormRuntime(options: CreateFormRuntimeOptions): FormRuntime {
  const scheduler = createRuntimeScheduler()
  const reconciler = createReconciler()
  const fields = createFieldRegistry()
  const root = createFiber({
    id: 0,
    key: "root",
    kind: "root",
  })

  const context = createFormRuntimeContext({
    ...options,
    scheduler,
    reconciler,
    fields,
  })

  const compile = (schemas: SchemxField[]): void => {
    const descriptors = compileSchema(schemas, options.schemaOptions)

    reconciler.reconcileChildren(
      root,
      root.children,
      descriptors.map(toRuntimeDescriptor),
      createFormReconcileHooks(context)
    )
  }

  const getViewTree = (): ViewNode[] => {
    return projectViewTree(root)
  }

  const waitForIdle = (timeout?: number): Promise<boolean> => {
    return scheduler.whenIdle(timeout)
  }

  const dispose = (): void => {
    disposeFiber(root)
    scheduler.dispose()
  }

  return {
    root,
    scheduler,
    fields,
    compile,
    getViewTree,
    waitForIdle,
    dispose,
  }
}
```

## runtime/view/viewModel.ts

ViewModel 是 adapter 唯一输入。

```ts
export type ViewNodeType = "field" | "group" | "fragment"

export interface ViewNode {
  id: number
  key: string
  type: ViewNodeType
  renderer?: RendererKey
  name?: NamePath
  props: Readonly<Record<string, unknown>>
  state?: Readonly<FieldViewState>
  children: ViewNode[]
}

export interface FieldViewState {
  value: unknown
  touched: boolean
  pending: FieldPending | null
  errors: string[]
  validating: boolean
}
```

## runtime/view/projectViewTree.ts

Projection 展开 DynamicSlot，但不暴露 DynamicSlot。

```ts
export function projectViewTree(root: Fiber): ViewNode[] {
  return root.children.flatMap(projectFiber)
}

const projectFiber = (fiber: Fiber): ViewNode[] => {
  if (fiber.disposed.value) return []

  const slot = fiber.resources.get(DYNAMIC_SLOT)

  if (slot) {
    return slot.subtree.value.flatMap(projectFiber)
  }

  const field = fiber.resources.get(FIELD_MODEL)

  if (field) {
    return [projectFieldViewNode(fiber, field)]
  }

  return [
    {
      id: fiber.id,
      key: fiber.key,
      type: fiber.kind === "group" ? "group" : "fragment",
      props: {},
      children: fiber.children.flatMap(projectFiber),
    },
  ]
}

const projectFieldViewNode = (fiber: Fiber, model: FieldModel): ViewNode => {
  return {
    id: fiber.id,
    key: fiber.key,
    type: "field",
    renderer: model.props.componentProps.value.value.renderer,
    name: model.name,
    props: {
      visible: model.props.visible.value.value,
      readonly: model.props.readonly.value.value,
      disabled: model.props.disabled.value.value,
      required: model.props.required.value.value,
      placeholder: model.props.placeholder.value.value,
      componentProps: model.props.componentProps.value.value,
    },
    state: {
      value: model.state.value.value,
      touched: model.state.touched.value,
      pending: model.state.pending.value,
      errors: model.state.errors.value,
      validating: model.validation.validating.value,
    },
    children: [],
  }
}
```

---

# 九、实施策略

虽然本方案不以当前实现为约束，但实施仍应避免一次性大爆炸。

推荐策略是：

```txt
新 runtime 并行实现
旧 runtime 保持工作
新 adapter contract 先跑通
再逐步切换 createForm
最后删除旧 runtime
```

## 阶段 A：Kernel Spike

实现最小 Runtime Core：

- Fiber
- Scope
- Scheduler
- Reconciler
- ResourceMap

只验证：

- create fiber tree
- keyed reuse
- dispose order
- scoped async task cancellation
- idle tracking

## 阶段 B：Form Spike

实现最小 Form Runtime：

- FieldState
- FieldRegistry
- FieldModel
- FieldPropsModel
- ValidationEffect

只支持：

- field
- group
- static schema
- visible/disabled/rules derivation
- validation rules registration

## 阶段 C：Dynamic Spike

实现 DynamicSlot：

- renderer run
- abort
- version
- subtree reconcile
- old subtree dispose

只支持一层 dynamic slot，先不做 nested dynamic。

## 阶段 D：ViewModel Adapter

实现：

- projectViewTree
- ViewNode contract
- adapter mock tests

验证 adapter 不再读取 runtime 内部对象。

## 阶段 E：createForm 切换

让 `createForm` 使用新 FormRuntime。

兼容 API 可以保留，但内部不再走旧 RuntimeNode。

## 阶段 F：删除旧模型

删除：

- RuntimeNode 作为核心模型
- DependencyRuntimeNode
- lifecycle bridge validation
- business channel scheduler
- resolved schema 作为主渲染输入

---

# 十、验收标准

## Kernel 验收

- keyed reconcile 正确复用 fiber。
- removed fiber dispose 顺序稳定。
- scope dispose 幂等。
- disposed scope 下 async result 不写入。
- scheduler `whenIdle()` 等待所有 async task。

## Form 验收

- field state 可通过 name path 查询。
- initialValue 只初始化一次。
- dynamic props 旧结果不能覆盖新结果。
- rules 变化自动影响 validation。
- invisible/disabled/readonly 自动清理 validation。

## Dynamic 验收

- renderer 首次执行。
- trigger field 变化重新执行。
- 旧 renderer 被 abort。
- 旧 result 被丢弃。
- subtree reconcile 复用稳定。
- old subtree dispose 稳定。
- nested dynamic slot 最终可支持。

## View 验收

- adapter 只消费 ViewNode。
- ViewNode 不暴露 Fiber。
- DynamicSlot 不出现在 view tree。
- schema 原始对象不作为 view tree 主输入。
- View projection 能响应 field props、errors、dynamic subtree 变化。

---

# 十一、最终状态

完成后，系统应变成：

```txt
Schema DSL
  -> FormDescriptor
  -> Runtime Core Fiber
  -> Form Models
  -> ViewModel
  -> Adapter
```

而不是：

```txt
Schema
  -> RuntimeNode
  -> mutate props
  -> validation bridge
  -> dependency node
  -> adapter reads runtime internals
```

最终删除 `RuntimeNode` 作为核心概念，只保留 `Fiber` 和各类领域 model。

---

# 十二、一句话方案

最优方案不是继续改造当前 RuntimeNode，而是用 `Fiber + Scope + Effect + FormModel + ViewModel` 重新定义 runtime：

```txt
Runtime Core 负责运行时结构和生命周期
Form Runtime 负责表单领域状态和派生
View Runtime 负责 adapter 投影
Schema DSL 只是输入，不再支配 runtime 内核
```
