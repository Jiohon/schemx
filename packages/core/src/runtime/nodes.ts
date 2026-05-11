/**
 * Runtime 节点工厂与生命周期辅助。
 *
 * 编译器只负责结构决策，真正创建 signal、注册 effect、触发表单字段
 * mount/update/unmount 生命周期都集中在这里。
 *
 * @module core/runtime/nodes
 */

import { createSignal } from "../reactivity"
import { isDependencySchema } from "../utils"

import { createDependencyRunner } from "./dependencyRunner"
import {
  applyFieldRuntimeProps,
  createFieldDependencyResolver,
  createFieldRuntime,
  getStaticFieldResolvedProps,
} from "./fieldRuntime"

import type { FormRuntimeContext } from "../core"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
} from "./types"
import type { DependencyScheduler } from "../scheduler/dependencyScheduler"
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
  /** 递归编译 children，由 RuntimeTreeCompiler 注入 */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
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

  constructor(private readonly options: RuntimeNodeFactoryOptions<T>) {}

  createFieldNode(
    schema: SchemxBaseField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): FieldRuntimeNode<T> {
    const node: FieldRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "field",
      schema,
      parent,
      mounted: true,
      dirty: false,
      disposed: false,
      // 字段动态属性状态在节点创建时初始化，后续通过 resolver 增量更新。
      field: createFieldRuntime(
        schema,
        this.options.context.resolveFieldDefaults(schema)
      ),
      dispose: () => {
        if (node.disposed) return

        node.field.dispose()
        this.unmountField(node)
        node.parent = null
        node.mounted = false
        node.disposed = true
      },
    }

    // 字段 resolver 必须在 mount 前创建，这样 mount 生命周期能拿到初始 resolved props。
    node.field.dispose = this.createFieldResolver(node).dispose
    this.mountField(node)

    return node
  }

  updateFieldNode(
    node: FieldRuntimeNode<T>,
    schema: SchemxBaseField<T>,
    parent: RuntimeNode<T> | null
  ): void {
    // 稳定 key 复用字段节点时，先释放旧 schema 的动态属性监听。
    node.field.dispose()
    node.schema = schema
    node.field.schema = schema
    node.parent = parent
    node.mounted = true
    // 先同步静态属性，再注册新 dependencies resolver，避免旧动态结果残留。
    this.syncStaticFieldProps(node)
    node.field.dispose = this.createFieldResolver(node).dispose
    this.mountField(node)
  }

  createGroupNode(
    schema: SchemxGroupField<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): GroupRuntimeNode<T> {
    const node: GroupRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "group",
      schema,
      parent,
      children: [],
      mounted: true,
      dirty: false,
      disposed: false,
      dispose() {
        // group 本身不持有 effect，只负责递归释放 children。
        node.children.forEach((child) => child.dispose())
        node.mounted = false
        node.disposed = true
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

    let disposeRunner = (): void => {}

    const node: DependencyRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "dependency",
      schema,
      parent,
      children: [],
      subtree: createSignal<RuntimeNode<T>[]>([]),
      loading: createSignal(false),
      error: createSignal<unknown | null>(null),
      version: 0,
      mounted: true,
      dirty: false,
      disposed: false,
      run: async () => {},
      dispose() {
        // dependency 节点持有 renderer watcher，销毁时必须先释放 runner。
        disposeRunner()
        node.children.forEach((child) => child.dispose())
        node.mounted = false
        node.disposed = true
      },
    }

    const runner = createDependencyRunner(node, {
      form: this.options.context.form,
      scheduler: this.options.scheduler,
      compileChildren: this.options.compileChildren,
      onPendingChange: this.options.onPendingChange,
      onTreeChange: this.options.onTreeChange,
    })

    node.run = runner.run
    disposeRunner = runner.dispose

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
    if (node.field.mounted) return

    node.field.mounted = true
    this.options.context.onFieldMount?.(node)
  }

  private unmountField(node: FieldRuntimeNode<T>): void {
    if (!node.field.mounted) return

    node.field.mounted = false
    this.options.context.onFieldUnmount?.(node)
  }

  private syncStaticFieldProps(node: FieldRuntimeNode<T>): void {
    // schema 被复用但静态属性变化时，需要把 field signals 拉回新的静态基线。
    const changed = applyFieldRuntimeProps(
      node.field,
      getStaticFieldResolvedProps(
        node.schema,
        this.options.context.resolveFieldDefaults(node.schema)
      )
    )

    if (!changed) return

    this.notifyFieldUpdate(node)
    this.options.onTreeChange()
  }

  private createFieldResolver(node: FieldRuntimeNode<T>) {
    // resolver 只关心字段 dynamic props；字段校验生命周期由 createForm 回调处理。
    return createFieldDependencyResolver(node, {
      form: this.options.context.form,
      resolveDefaults: this.options.context.resolveFieldDefaults,
      onPendingChange: this.options.onPendingChange,
      onFieldUpdate: this.notifyFieldUpdate,
      onTreeChange: this.options.onTreeChange,
    })
  }

  private readonly notifyFieldUpdate = (node: FieldRuntimeNode<T>): void => {
    if (!node.field.mounted || node.disposed) return

    // 字段属性变化时只通知字段生命周期，不重新 mount。
    this.options.context.onFieldUpdate?.(node)
  }
}
