/**
 * 表单实例工厂 - 框架无关的核心实现。
 *
 * createForm 是表单内核的唯一公开装配入口。
 *
 * @module core/createForm
 */

import { compileToDescriptors } from "./descriptor"
import { createFieldRegistry, type FieldRegistry } from "./field"
import {
  type ContainerFiber,
  createReconciler,
  type Fiber,
  type FiberManager,
  type Reconciler,
  type RootFiber,
} from "./graph"
import { createFiberManager } from "./graph/fiberManager"
import {
  createLifecycleBus,
  type LifecycleBus,
  type SchemxLifecycleHooks,
} from "./lifecycle/lifecycle"
import { batchUpdates, createReactiveEffect } from "./reactivity"
import {
  createRendererRegistry,
  createRulesRegistry,
  RendererRegistry,
  type RulesRegistry,
} from "./registry"
import { createRuntimeScheduler, type RuntimeScheduler } from "./scheduler"
import { createStore, Store } from "./store"
import { collectObjectPathsByLeaf, diff, withLock } from "./utils"
import {
  createRequiredRule,
  createSelectRequiredRule,
  createUploadRequiredRule,
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "./validator"
import {
  createViewRevision,
  projectViewTree,
  subscribeViewTree,
  type ViewRevision,
} from "./view"

import type { CompileOptions, FormDescriptor } from "./descriptor"
import type {
  NamePath,
  SchemxDefaultContext,
  SchemxField,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
  SchemxRules,
  StandardSchemaV1,
  Values,
} from "./types"
import type { ViewNode } from "./view"

type Callbacks<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = Pick<
  CreateFormOptions<TValues, TName>,
  "onValuesChange" | "onFinish" | "onFinishFailed" | "onFieldsChange"
>

export interface SchemxFormContext<
  TValues extends Values = Values,
> extends SchemxDefaultContext {
  /** 校验规则注册表，解析字符串规则名称到 StandardSchema 或规则工厂 */
  readonly rulesRegistry: RulesRegistry<TValues>
  /** 表单状态存储，管理字段值、初始值和订阅 */
  readonly store: Store<TValues>
  /** 字段校验器，维护规则、错误状态和校验执行流程 */
  readonly validator: Validator<TValues>
  /** 运行时异步调度器，用于追踪 dependency renderer 和字段动态依赖 */
  readonly scheduler: RuntimeScheduler
  /** descriptor 到 Fiber tree 的协调器，负责创建、复用和销毁节点 */
  readonly reconciler: Reconciler<TValues>
  /** graph 生命周期事件总线，连接 reconciler 与字段资源挂载流程 */
  readonly lifecycleBus: LifecycleBus<Fiber, FormDescriptor<TValues>>
  /** schema 编译默认选项，供 root 与 dependency 子树复用 */
  readonly compileOptions: CompileOptions
  /** 唯一子节点提交边界，负责 reconcile 后推进 viewRevision */
  commitChildren(
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void
  readonly getFormApi: () => SchemxFormApi<TValues>
}

/**
 * 创建表单实例的配置项。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 字段路径类型
 * @typeParam TValue - 字段值类型
 */
export interface CreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends SchemxDefaultContext {
  schemas?: SchemxField<TValues>[]
  initialValues?: TValues
  modelValue?: TValues
  rendererRegistry?: RendererRegistry
  defaultRendererType?: SchemxRendererKey
  rulesRegistry?: RulesRegistry

  onFinish?: (values: Readonly<TValues>) => void | Promise<void>
  onFinishFailed?: (error: ValidateError<TValues>) => void
  onValuesChange?: (
    changedValues: Readonly<Partial<TValues>>,
    latestSnapshot: Readonly<TValues> | TValues
  ) => void
  onFieldsChange?: (changedFields: TName[], allFields: TName[]) => void
  lifecycleHooks?: SchemxLifecycleHooks<TValues>
}

class CreateForm<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 表单内部上下文，集中持有全局配置和运行时服务 */
  private context: SchemxFormContext<TValues>

  /** 用户传入的表单级回调集合 */
  readonly callbacks: Callbacks<TValues>

  /** 表单状态存储，管理字段值、初始值和订阅 */
  private store: Store<TValues>

  /** 渲染器注册表，解析 schema.componentType 到具体渲染实现 */
  readonly rendererRegistry: RendererRegistry

  /** 校验规则注册表，解析字符串规则名称到 StandardSchema 或规则工厂 */
  readonly rulesRegistry: RulesRegistry<TValues>

  /** 字段校验器，维护规则、错误状态和校验执行流程 */
  readonly validator: Validator<TValues>

  /** Runtime graph 的透明根节点，承载所有编译后的表单描述符节点 */
  readonly root: RootFiber

  /** 运行时异步调度器，用于追踪 dependency renderer 和字段动态依赖 */
  readonly scheduler: RuntimeScheduler

  /** 视图结构版本号，graph 结构变化时推进以触发 ViewTree 重新投影 */
  readonly viewRevision: ViewRevision

  /** descriptor 到 Fiber tree 的协调器，负责创建、复用和销毁节点 */
  readonly reconciler: Reconciler<TValues>

  /** 单个 Fiber 生命周期执行器，负责挂载和释放运行期资源 */
  readonly fiberManager: FiberManager<TValues>

  /** 字段 Fiber 到字段模型的注册表，供表单 API 和视图投影读取 */
  readonly fieldRegistry: FieldRegistry<TValues>

  /** 表单销毁时需要统一释放的副作用 */
  readonly disposers = new Set<() => void>()

  /** 标记表单实例是否已销毁，保证 dispose 幂等 */
  private disposed = false

  /** schema 编译默认选项，root 与 dependency 子树共享 */
  private compileOptions: CompileOptions

  /** graph 生命周期事件总线，连接 reconciler 与字段资源挂载流程 */
  private lifecycleBus: LifecycleBus<Fiber, FormDescriptor<TValues>>

  constructor(options: CreateFormOptions<TValues> = {}) {
    const {
      schemas = [] as SchemxField<TValues>[],
      initialValues = {} as TValues,
      modelValue,
      rendererRegistry,
      defaultRendererType,
      rulesRegistry,
      validationTrigger,
      readonly,
      disabled,
    } = options

    // 统一保存用户回调，后续 effect 和 submit 流程从同一入口读取。
    this.callbacks = {
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onFieldsChange: options.onFieldsChange,
    }

    // 注册表允许外部注入；未注入时创建表单实例私有注册表，避免跨实例污染。
    this.rendererRegistry =
      rendererRegistry ?? createRendererRegistry(defaultRendererType)
    this.rulesRegistry = (rulesRegistry ??
      createRulesRegistry<TValues>()) as RulesRegistry<TValues>

    this.validator = createValidator<TValues, TName>()

    // modelValue 优先覆盖 initialValues，用于受控场景的初始快照对齐。
    this.store = createStore<TValues>({
      initialValues: { ...initialValues, ...(modelValue ?? {}) },
    })

    // 内置必填类规则默认注册到当前表单，用户仍可通过规则注册表覆盖。
    this.rulesRegistry.registerAll({
      required: createRequiredRule,
      selectRequired: createSelectRequiredRule,
      uploadRequired: createUploadRequiredRule,
    })

    // 生命周期总线连接 graph 结构变化与字段模型、依赖资源的挂载和更新流程。
    this.lifecycleBus = createLifecycleBus<Fiber, FormDescriptor<TValues>>()

    // 初始化运行时 graph 所需的核心基础设施。
    this.scheduler = createRuntimeScheduler()
    this.viewRevision = createViewRevision()
    this.fieldRegistry = createFieldRegistry<TValues>()
    this.compileOptions = {
      readonly,
      disabled,
      validationTrigger,
    }

    this.fiberManager = createFiberManager<TValues>({
      getContext: () => this.context,
      fieldRegistry: this.fieldRegistry,
      lifecycleBus: this.lifecycleBus,
    })

    this.reconciler = createReconciler(this.fiberManager)

    this.root = this.fiberManager.createRoot()

    // dependency renderer 运行时需要回写 graph，因此上下文在首次编译前准备好。
    this.context = {
      store: this.store,
      rulesRegistry: this.rulesRegistry,
      validator: this.validator,
      scheduler: this.scheduler,
      reconciler: this.reconciler,
      lifecycleBus: this.lifecycleBus,
      compileOptions: this.compileOptions,
      commitChildren: this.commitChildren,
      getFormApi: () => this.getFormApi(),
    }

    if (options.lifecycleHooks) {
      this.lifecycleBus.on(options.lifecycleHooks)
    }

    // 将外部 schema 编译成内部 descriptor tree，再交给 reconciler 建立 runtime graph。
    const descriptors = compileToDescriptors(schemas, this.compileOptions)

    this.commitChildren(this.root as ContainerFiber<TValues>, descriptors)

    // 注册值变化回调（通过 store.effect 自动追踪依赖）
    if (this.callbacks?.onValuesChange || this.callbacks?.onFieldsChange) {
      let prevSnapshot = this.store.getFieldsSnapshot()

      createReactiveEffect(() => {
        const latestValues = this.store.getFieldsValue()
        const latestSnapshot = this.store.getFieldsSnapshot()

        const changedValues = diff(latestSnapshot, prevSnapshot)

        const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

        if (changedPaths.length > 0) {
          this.callbacks.onValuesChange?.(changedValues, latestSnapshot)

          this.callbacks.onFieldsChange?.(
            changedPaths,
            collectObjectPathsByLeaf(latestValues)
          )
        }

        prevSnapshot = latestSnapshot
      })
    }
  }

  /**
   * 表单实例接口
   *
   * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
   * SchemxInstance 类实现此接口，提供完整的表单操作能力。
   */
  getFormInstance = (): SchemxInstance<TValues> => {
    const instance = {
      setFieldValue: this.store.setFieldValue.bind(this.store),
      setFieldsValue: this.store.setFieldsValue.bind(this.store),
      getFieldValue: this.store.getFieldValue.bind(this.store),
      getFieldsValue: this.store.getFieldsValue.bind(this.store),
      getFieldSnapshot: this.store.getFieldSnapshot.bind(this.store),
      getFieldsSnapshot: this.store.getFieldsSnapshot.bind(this.store),
      getInitialValue: this.store.getInitialValue.bind(this.store),
      getInitialValues: this.store.getInitialValues.bind(this.store),
      setInitialValues: this.store.setInitialValues.bind(this.store),
      isFieldTouched: this.store.isFieldTouched.bind(this.store),
      setFieldTouched: this.store.setFieldTouched.bind(this.store),
      getTouchedFields: this.store.getTouchedFields.bind(this.store),
      setFieldPending: this.store.setFieldPending.bind(this.store),
      isFieldPending: this.store.isFieldPending.bind(this.store),
      getPendingFields: this.store.getPendingFields.bind(this.store),
      resetFields: this.store.resetFields.bind(this.store),
      reset: this.reset.bind(this),

      validateField: this.validateField.bind(this),
      validate: this.validate.bind(this),
      getFieldError: this.validator.getFieldError.bind(this.validator),
      setFieldError: this.validator.setFieldError.bind(this.validator),
      submit: this.submit.bind(this),

      effect: this.effect.bind(this),
      batch: this.batch.bind(this),

      getViewRevision: () => this.viewRevision.revision.value,
      getViewTree: this.getViewTree.bind(this),
      subscribeViewTree: this.subscribeViewTree.bind(this),
      waitForDependencies: this.waitForIdle.bind(this),

      getRenderer: this.rendererRegistry.getRenderer.bind(this.rendererRegistry),
      registerRenderer: this.rendererRegistry.register.bind(this.rendererRegistry),
      hasRenderer: this.rendererRegistry.hasRenderer.bind(this.rendererRegistry),
      getRule: this.rulesRegistry.getRule.bind(this.rulesRegistry),
      registerRule: this.rulesRegistry.register.bind(this.rulesRegistry),
      hasRule: this.rulesRegistry.hasRule.bind(this.rulesRegistry),

      registerRules: this.registerRules.bind(this),
      unregisterRules: this.validator.unregisterRules.bind(this.validator),

      destroy: this.destroy.bind(this),
    } as SchemxInstance<TValues> & { getInternalHooks: () => SchemxInstance<TValues> }

    instance.getInternalHooks = () => instance

    return instance
  }

  /**
   * 表单 API，提供与表单交互的方法。
   *
   * 传递给动态渲染器，允许程序化操作表单。
   */
  private getFormApi = (): SchemxFormApi<TValues> => ({
    setValue: this.store.setFieldValue.bind(this.store),
    setValues: this.store.setFieldsValue.bind(this.store),
    getValue: this.store.getFieldValue.bind(this.store),
    getValues: this.store.getFieldsValue.bind(this.store),
    getSnapshots: this.store.getFieldsSnapshot.bind(this.store),
    setPending: this.store.setFieldPending.bind(this.store),
    isPending: this.store.isFieldPending.bind(this.store),
    setTouched: this.store.setFieldTouched.bind(this.store),
    isTouched: this.store.isFieldTouched.bind(this.store),
    getError: this.validator.getFieldError.bind(this.validator),
    setError: this.validator.setFieldError.bind(this.validator),
    resetFields: this.store.resetFields.bind(this.store),
    reset: this.reset.bind(this),
    validateField: this.validateField.bind(this),
    validate: this.validate.bind(this),
  })

  /**
   * 注册字段校验规则
   */
  private registerRules(
    path: NamePath<TValues>,
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ): void {
    const resolvedRules: StandardSchemaV1[] = []
    const schema = this.fieldRegistry.get(path)?.descriptor.schema

    this.validator.unregisterRules(path)

    if (schema) {
      resolvedRules.push(
        ...this.rulesRegistry.resolveRuleBySchema({
          ...schema,
          rules,
        })
      )
    } else {
      const ruleList = Array.isArray(rules) ? rules : [rules]

      for (const rule of ruleList) {
        if (typeof rule === "string") {
          const entry = this.rulesRegistry.getRule(rule as never)
          const resolved = typeof entry === "function" ? entry(undefined) : entry

          if (resolved) resolvedRules.push(resolved)
        } else if (rule) {
          resolvedRules.push(rule)
        }
      }
    }

    if (resolvedRules.length > 0) {
      this.validator.registerRules(path, resolvedRules, defaultMessage)
    }
  }

  /**
   * 校验指定字段
   */
  private async validateField(
    name: NamePath<TValues> | NamePath<TValues>[]
  ): Promise<ValidateResult<TValues>> {
    const result = await this.validator.validateField(name, this.store.getFieldsValue())

    return result
  }

  /**
   * 校验所有已注册字段
   *
   * 校验前检查是否有字段处于操作中状态，有则直接返回失败结果。
   */
  private validate = withLock(async (): Promise<ValidateResult<TValues>> => {
    const pendingFields = this.store.getPendingFields()

    if (pendingFields.length > 0) {
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((i) => i.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        ok: false,
        error: {
          errors: pendingFields.map(({ field }) => {
            const message = "字段正在处理中，请稍后重试"
            this.validator.setFieldError(field as NamePath<TValues>, [message])

            return {
              field: field as string,
              message: [message],
            }
          }),
          values: this.store.getFieldsSnapshot(),
        },
      }
    }

    const result = await this.validator.validate(this.store.getFieldsValue())

    return result
  })

  /**
   * 重置整个表单到初始值
   */
  private reset(): void {
    this.store.reset()
    this.validator.reset()
  }

  /**
   * 提交表单
   */
  private submit = withLock(async (): Promise<void> => {
    // 等待依赖解析完成
    const depsReady = await this.waitForIdle()
    if (!depsReady) {
      // 超时则拒绝提交
      return
    }

    const result = await this.validate()
    if (result.ok) {
      await this.callbacks.onFinish?.(result.values)
    } else {
      this.callbacks.onFinishFailed?.(result.error)
    }
  })

  /**
   * 创建 reactive effect。
   *
   * 回调内调用 getFieldValue / getFieldError 时自动追踪依赖，
   * 跨越 store 和 validator 的 reactive maps。
   * dispose 函数由 createForm 层面统一管理，destroy 时清理。
   */
  private effect(fn: () => void): () => void {
    const dispose = createReactiveEffect(fn)
    this.disposers.add(dispose)

    return () => {
      dispose()
      this.disposers.delete(dispose)
    }
  }

  /**
   * 批量更新，合并多次 reactive 写入。
   *
   * 将多次 reactive 写入合并为一次 effect 触发，
   * 跨越 store 和 validator 的 reactive maps。
   */
  private batch(fn: () => void): void {
    batchUpdates(fn)
  }

  /**
   * 唯一子节点提交边界。
   *
   * 所有结构输入先编译成 descriptor，再经由这里提交到某个 parent Fiber。
   * Reconciler 只负责 graph 结构；public commit 完成后由这里推进一次 viewRevision。
   */
  private commitChildren = (
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void => {
    this.reconciler.reconcileChildren(parent, descriptors)
    this.viewRevision.bump()
  }

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调和 effect，释放资源。通常在组件卸载时调用。
   */
  private destroy(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true

    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.clear()

    this.fiberManager.disposeTree(this.root)
    this.scheduler.dispose()
    this.store.destroy()
  }

  /**
   * 获取当前 ViewTree。
   */
  private getViewTree(): readonly ViewNode[] {
    return projectViewTree(this.root, this.getFormApi())
  }

  /**
   * 订阅 ViewTree 结构变化。
   */
  private subscribeViewTree(callback: (tree: readonly ViewNode[]) => void): () => void {
    return subscribeViewTree(this.root, this.viewRevision, callback, this.getFormApi())
  }

  /**
   * 等待内部异步任务完成。
   */
  private waitForIdle(timeout: number = 10000): Promise<boolean> {
    return this.scheduler.whenIdle(timeout)
  }
}

/**
 * 创建 Schemx 表单实例。
 *
 * @param options - 表单配置项
 * @returns 表单实例
 */
export function createForm<TValues extends Values = Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  return new CreateForm<TValues>(options).getFormInstance()
}

export default createForm
