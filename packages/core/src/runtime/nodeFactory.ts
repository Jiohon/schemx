/**
 * Runtime 节点工厂与生命周期辅助。
 *
 * 编译器只负责结构决策，真正创建 signal、注册 effect、触发表单字段
 * mount/update/unmount 生命周期都集中在这里。
 *
 * @module core/runtime/nodeFactory
 */

import { createDependencyEngine } from "../engine/dependencyEngine"
import { createDynamicPropResolver } from "../engine/dynamicPropEngine"
import { createFieldEngine } from "../engine/fieldEngine"
import {
  applyFieldRuntimeProps,
  createFieldRuntime,
  getStaticFieldResolvedProps,
} from "../field"
import { createSignal } from "../reactivity"
import { isDependencySchema } from "../utils"

import { createDisposeBag } from "./disposeBag"

import type { FormRuntimeContext } from "../core"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
} from "./types"
import type { DependencyScheduler, RuntimeScheduler } from "../scheduler"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"

export interface RuntimeNodeFactoryOptions<T extends Values> {
  /** runtime 面向 createForm 的上下文，封装表单实例和字段生命周期 */
  context: FormRuntimeContext<T>
  /** dependency subtree 的脏队列调度器 */
  scheduler: DependencyScheduler<T>
  /** runtime 通用调度器，用于 field/dynamic prop/validation 等 engine job */
  runtimeScheduler: RuntimeScheduler
  /** 递归编译 children，由 RuntimeTreeCompiler 注入 */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
  /** 提交 dependency subtree，由 RuntimeGraph 维护 owner/parent/revision。 */
  commitDependencySubtree: (
    node: DependencyRuntimeNode<T>,
    nextChildren: RuntimeNode<T>[]
  ) => void
  /** 统一通知 idle tracker 增减 pending 数 */
  onPendingChange: (delta: number) => void
  /** runtime projection 发生变化时递增 engine revision */
  onTreeChange: () => void
}

/**
 * 创建和更新 runtime nodes。
 *
 * 这层是 compiler 与 runtime 副作用的边界：compiler 调用工厂方法，
 * 工厂负责维护节点上的运行时状态、依赖监听和生命周期回调。
 */
export class RuntimeNodeFactory<T extends Values = Values> {
  private nextId = 1
  private readonly fieldEngine
  private readonly fieldResolvers = new WeakMap<FieldRuntimeNode<T>, () => void>()

  constructor(private readonly options: RuntimeNodeFactoryOptions<T>) {
    this.fieldEngine = createFieldEngine<T>({
      context: this.options.context,
    })
  }

  createFieldNode(
    schema: SchemxBaseField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): FieldRuntimeNode<T> {
    const disposeBag = createDisposeBag()
    const node: FieldRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "field",
      schema,
      parent,
      mounted: false,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => {
        if (node.disposed.value) return

        try {
          this.unmountField(node)
          disposeBag.flush()
        } catch (error) {
          console.error("[schemx] field node dispose 执行错误:", error)
        } finally {
          node.parent = null
          node.mounted = false
          node.disposed.value = true
        }
      },
      // 字段动态属性状态在节点创建时初始化，后续通过 resolver 增量更新。
      fieldRuntime: createFieldRuntime(
        schema,
        this.options.context.resolveFieldDefaults(schema)
      ),
      dispose: () => {
        node.disposeSelf()
      },
    }

    // 字段 resolver 必须在 mount 前创建，这样 mount 生命周期能拿到初始 resolved props。
    this.registerFieldResolver(node)
    this.mountField(node)

    return node
  }

  updateFieldNode(
    node: FieldRuntimeNode<T>,
    schema: SchemxBaseField<T>,
    parent: RuntimeNode<T> | null
  ): void {
    // 稳定 key 复用字段节点时，先释放旧 schema 的动态属性监听。
    this.fieldResolvers.get(node)?.()
    node.schema = schema
    node.parent = parent
    // 先同步静态属性，再注册新 dependencies resolver，避免旧动态结果残留。
    this.syncStaticFieldProps(node)
    this.registerFieldResolver(node)
    this.mountField(node)
  }

  createGroupNode(
    schema: SchemxGroupField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): GroupRuntimeNode<T> {
    const disposeBag = createDisposeBag()
    const node: GroupRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "group",
      schema,
      parent,
      children: [],
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => {
        if (node.disposed.value) return

        try {
          disposeBag.flush()
        } catch (error) {
          console.error("[schemx] group node dispose 执行错误:", error)
        } finally {
          node.parent = null
          node.mounted = false
          node.disposed.value = true
        }
      },
      dispose() {
        if (node.disposed.value) return

        node.children.forEach((child) => child.dispose())
        node.disposeSelf()
      },
    }

    node.children = this.options.compileChildren(
      [],
      schema.children as SchemxField<T>[],
      node,
      key
    )

    return node
  }

  updateGroupNode(
    node: GroupRuntimeNode<T>,
    schema: SchemxGroupField<T>,
    parent: RuntimeNode<T> | null,
    key: string
  ): void {
    node.schema = schema
    node.parent = parent
    node.children = this.options.compileChildren(
      node.children,
      schema.children as SchemxField<T>[],
      node,
      key
    )
    node.mounted = true
  }

  createDependencyNode(
    schema: SchemxDependencyField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): DependencyRuntimeNode<T> {
    if (!isDependencySchema(schema)) {
      throw new Error("[schemx] Expected dependency schema")
    }

    const disposeBag = createDisposeBag()

    const node: DependencyRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "dependency",
      schema,
      parent,
      children: [],
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => {
        if (node.disposed.value) return

        try {
          disposeBag.flush()
        } catch (error) {
          console.error("[schemx] dependency node dispose 执行错误:", error)
        } finally {
          node.parent = null
          node.mounted = false
          node.disposed.value = true
        }
      },
      dependencyRuntime: {
        subtree: createSignal<RuntimeNode<T>[]>([]),
        loading: createSignal(false),
        error: createSignal<Error | null>(null),
        version: 0,
        abortController: null,
        run: async () => {},
      },
      dispose() {
        if (node.disposed.value) return

        node.children.forEach((child) => child.dispose())
        node.disposeSelf()
      },
    }

    const runner = createDependencyEngine(node, {
      form: this.options.context.form,
      scheduler: this.options.scheduler,
      compileChildren: this.options.compileChildren,
      commitSubtree: this.options.commitDependencySubtree,
      onPendingChange: this.options.onPendingChange,
    })

    node.dependencyRuntime.run = runner.run
    disposeBag.add(runner.dispose)

    return node
  }

  updateDependencyNode(
    node: DependencyRuntimeNode<T>,
    schema: SchemxDependencyField<T>,
    parent: RuntimeNode<T> | null
  ): void {
    node.schema = schema
    node.parent = parent
    node.mounted = true
    this.options.scheduler.enqueueDependency(node)
  }

  private mountField(node: FieldRuntimeNode<T>): void {
    this.fieldEngine.mount(node)
  }

  private unmountField(node: FieldRuntimeNode<T>): void {
    this.fieldEngine.unmount(node)
  }

  private syncStaticFieldProps(node: FieldRuntimeNode<T>): void {
    // schema 被复用但静态属性变化时，需要把 field signals 拉回新的静态基线。
    const changed = applyFieldRuntimeProps(
      node.fieldRuntime,
      getStaticFieldResolvedProps(
        node.schema,
        this.options.context.resolveFieldDefaults(node.schema)
      )
    )

    if (!changed) return

    this.notifyFieldUpdate(node)
    this.options.onTreeChange()
  }

  private registerFieldResolver(node: FieldRuntimeNode<T>): void {
    // resolver 只关心字段 dynamic props；字段校验生命周期由 createForm 回调处理。
    const resolver = createDynamicPropResolver(node, {
      form: this.options.context.form,
      resolveDefaults: this.options.context.resolveFieldDefaults,
      onPendingChange: this.options.onPendingChange,
      scheduler: this.options.runtimeScheduler,
      onFieldUpdate: this.notifyFieldUpdate,
      onTreeChange: this.options.onTreeChange,
    })

    let active = true
    const disposeResolver = (): void => {
      if (!active) return

      active = false
      resolver.dispose()
    }

    this.fieldResolvers.set(node, disposeResolver)
    node.disposeBag.add(disposeResolver)
  }

  private readonly notifyFieldUpdate = (node: FieldRuntimeNode<T>): void => {
    // 字段属性变化时只通知字段生命周期，不重新 mount。
    this.fieldEngine.update(node)
  }
}
