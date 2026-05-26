/**
 * FiberManager - 单个 Fiber 生命周期执行器。
 *
 * Reconciler 负责决定创建、复用、移动和销毁哪些 Fiber；FiberManager 负责执行
 * 单个 Fiber 的创建、挂载、更新和释放，并把字段、dependency 等领域资源挂到 Fiber。
 *
 * @module core/graph/fiberManager
 */

import {
  type DependencyDescriptor,
  type FieldDescriptor,
  type FormDescriptor,
  type GroupDescriptor,
  isDependencyDescriptor,
  isFieldDescriptor,
  isGroupDescriptor,
} from "../descriptor"
import {
  createDependenciesEffect,
  createDependencyEffect,
  createFieldModel,
  createValidationEffect,
  mountDependencyEffect,
  updateFieldModel,
} from "../field"
import { createSignal } from "../reactivity"

import { getChildFibers, hasDescriptor, isContainerFiber, setChildFibers } from "./fiber"
import { createScope } from "./scope"

import type { SchemxFormContext } from "../createForm"
import type { FieldRegistry } from "../field"
import type { LifecycleBus } from "../lifecycle"
import type { NamePath, Values } from "../types"
import type {
  ContainerFiber,
  DependencyFiber,
  DescribedFiber,
  Fiber,
  FieldFiber,
  GroupFiber,
  RootFiber,
} from "./fiber"

/**
 * 表单 runtime graph 的默认 Fiber 生命周期管理器。
 *
 * @typeParam TValues - 表单值类型。
 */
class RuntimeFiberManager<TValues extends Values = Values> {
  /** 下一个非 root Fiber 的自增 id；root 固定使用 0。 */
  private nextId = 1
  /** 当前表单运行时上下文的延迟访问器。 */
  private readonly context: SchemxFormContext<TValues>
  /** 字段运行时索引，用于按字段路径查找 model 与 Fiber。 */
  private readonly fieldRegistry: FieldRegistry<TValues>
  /** Fiber 生命周期事件总线。 */
  private readonly lifecycleBus: LifecycleBus<Fiber<TValues>, FormDescriptor<TValues>>

  constructor(context: SchemxFormContext<TValues>) {
    this.context = context

    this.fieldRegistry = context.fieldRegistry
    this.lifecycleBus = context.lifecycleBus
  }

  /**
   * 创建透明根 Fiber。
   *
   * @returns root Fiber，不对应任何表单 descriptor。
   */
  createRoot(): RootFiber {
    return {
      id: 0,
      key: "schemx:root",
      type: "root",
      parent: null,
      scope: createScope(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      childFibers: [],
    }
  }

  /**
   * 根据 descriptor 创建单个未挂载 Fiber。
   *
   * @param descriptor - 编译后的表单节点描述符。
   * @param parent - 新 Fiber 所属的容器 Fiber。
   */
  create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerFiber<TValues>
  ): Fiber<TValues> {
    if (descriptor.type === "field") {
      return this.createField(descriptor, parent)
    }

    if (descriptor.type === "group") {
      return this.createGroup(descriptor, parent)
    }

    if (descriptor.type === "dependency") {
      return this.createDependency(descriptor, parent)
    }

    throwUnknownDescriptor(descriptor)
  }

  /**
   * 挂载单个 Fiber 的运行期资源。
   *
   * @param fiber - 要挂载的 Fiber。
   *
   * @remarks
   * Group Fiber 只表示结构，不会创建领域资源；Field 和 Dependency 会在这里
   * 创建各自的模型、effect 与资源 scope。
   */
  mount(fiber: Fiber<TValues>): void {
    if (!hasDescriptor(fiber)) {
      return
    }

    this.lifecycleBus.emitBeforeMount(fiber)

    switch (fiber.type) {
      case "field":
        this.mountField(fiber, fiber.descriptor)
        break
      case "group":
        this.mountGroup(fiber)
        break
      case "dependency":
        this.mountDependency(fiber)
        break
    }

    fiber.mounted.value = true
    this.lifecycleBus.emitMount(fiber, fiber.descriptor)
  }

  /**
   * 更新单个 Fiber 的 descriptor 快照和运行期资源。
   *
   * @param fiber - 要更新的 Fiber。
   * @param next - 更新后的表单 descriptor。
   *
   * @remarks
   * descriptor 快照会先写入 Fiber，再由具体 update 分支决定复用还是重启资源。
   * 结构层面的 children reconcile 不在这里处理。
   */
  update(fiber: Fiber<TValues>, next: FormDescriptor<TValues>): void {
    if (!hasDescriptor(fiber)) {
      return
    }

    switch (fiber.type) {
      case "field": {
        if (!isFieldDescriptor(next)) {
          throwUnexpectedDescriptor(fiber, next)
        }

        const previous = fiber.descriptor

        this.lifecycleBus.emitBeforeUpdate(fiber, previous)
        fiber.descriptor = next
        this.updateField(fiber, next, previous)
        this.lifecycleBus.emitUpdate(fiber, next)
        this.lifecycleBus.emitUpdated(fiber, previous)
        break
      }

      case "group": {
        if (!isGroupDescriptor(next)) {
          throwUnexpectedDescriptor(fiber, next)
        }

        const previous = fiber.descriptor

        this.lifecycleBus.emitBeforeUpdate(fiber, previous)
        fiber.descriptor = next
        this.updateGroup(fiber, next)
        this.lifecycleBus.emitUpdate(fiber, next)
        this.lifecycleBus.emitUpdated(fiber, previous)
        break
      }

      case "dependency": {
        if (!isDependencyDescriptor(next)) {
          throwUnexpectedDescriptor(fiber, next)
        }

        const previous = fiber.descriptor

        this.lifecycleBus.emitBeforeUpdate(fiber, previous)
        fiber.descriptor = next
        this.updateDependency(fiber, next, previous)
        this.lifecycleBus.emitUpdate(fiber, next)
        this.lifecycleBus.emitUpdated(fiber, previous)
        break
      }
    }
  }

  /**
   * 卸载单个 Fiber 的运行期资源。
   *
   * @param fiber - 要卸载的 Fiber。
   *
   * @remarks
   * 这个方法不递归销毁子节点；需要销毁整棵子树时使用 `disposeTree`。
   */
  unmount(fiber: Fiber<TValues>): void {
    if (!hasDescriptor(fiber)) {
      return
    }

    switch (fiber.type) {
      case "field":
        this.unmountField(fiber)
        break
      case "group":
        this.unmountGroup(fiber)
        break
      case "dependency":
        this.unmountDependency(fiber)
        break
    }

    fiber.mounted.value = false
  }

  /**
   * 递归销毁 Fiber 子树。
   *
   * @param fiber - 要销毁的子树根 Fiber。
   *
   * @remarks
   * 销毁顺序是：标记 disposed、递归销毁 runtime 子节点、卸载自身领域资源、
   * 释放 Fiber scope、断开 parent。这样可以确保子资源先于父资源释放。
   */
  disposeTree(fiber: Fiber<TValues>): void {
    if (fiber.disposed.value) {
      return
    }

    if (fiber.type !== "root") {
      this.lifecycleBus.emitBeforeUnmount(fiber)
    }

    fiber.disposed.value = true

    if (isContainerFiber(fiber)) {
      for (const child of getChildFibers(fiber)) {
        this.disposeTree(child)
      }

      setChildFibers(fiber, [])
    }

    this.unmount(fiber)
    fiber.scope.dispose()

    fiber.parent = null

    if (fiber.type !== "root") {
      this.lifecycleBus.emitUnmount(fiber)
    }
  }

  private createField(
    descriptor: FieldDescriptor<TValues>,
    parent: ContainerFiber<TValues>
  ): FieldFiber<TValues> {
    const fieldModel = createFieldModel(descriptor)

    const fiber: FieldFiber<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      fieldModel,
      fieldResourceScope: null,
      fieldDependenciesScope: null,
    }

    return fiber
  }

  private createGroup(
    descriptor: GroupDescriptor<TValues>,
    parent: ContainerFiber<TValues>
  ): GroupFiber<TValues> {
    const fiber: GroupFiber<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      childFibers: [],
    }

    return fiber
  }

  private createDependency(
    descriptor: DependencyDescriptor<TValues>,
    parent: ContainerFiber<TValues>
  ): DependencyFiber<TValues> {
    const fiber: DependencyFiber<TValues> = {
      id: this.nextId++,
      key: descriptor.key,
      type: descriptor.type,
      parent,
      scope: parent.scope.child(),
      disposed: createSignal(false),
      mounted: createSignal(false),
      descriptor,
      dependencySlot: null,
      dependencyResourceScope: null,
      subChildren: [],
    }

    return fiber
  }

  private mountField(
    fiber: FieldFiber<TValues>,
    descriptor: FieldDescriptor<TValues>
  ): void {
    const resourceScope = fiber.scope.child()

    const model = fiber.fieldModel
    if (!model) {
      return
    }

    fiber.fieldResourceScope = resourceScope
    this.fieldRegistry.register({
      name: descriptor.schema.name,
      fiber: fiber,
      descriptor,
      model,
    })
    resourceScope.add(() => {
      this.fieldRegistry.unregister(descriptor.schema.name, fiber)

      if (fiber.fieldResourceScope === resourceScope) {
        fiber.fieldResourceScope = null
      }
    })

    this.mountFieldValidation(fiber, descriptor, model, resourceScope)
    this.mountOrRestartFieldDependencies(fiber, descriptor, model)
  }

  private mountGroup(_fiber: GroupFiber<TValues>): void {
    // group 只参与结构生命周期，不创建领域资源。
  }

  private mountDependency(fiber: DependencyFiber<TValues>): void {
    const resourceScope = fiber.scope.child()
    const slot = createDependencyEffect(fiber)

    fiber.dependencyResourceScope = resourceScope
    fiber.dependencySlot = slot

    resourceScope.add(() => {
      if (fiber.dependencyResourceScope === resourceScope) {
        fiber.dependencyResourceScope = null
      }
    })

    mountDependencyEffect<TValues>(
      fiber,
      fiber.descriptor,
      this.context,
      slot,
      resourceScope
    )
  }

  private updateField(
    fiber: FieldFiber<TValues>,
    descriptor: FieldDescriptor<TValues>,
    previous?: FieldDescriptor<TValues>
  ): void {
    const model = fiber.fieldModel

    if (model && previous && previous.schema.name === descriptor.schema.name) {
      updateFieldModel(model, descriptor)
      this.fieldRegistry.register({
        name: descriptor.schema.name,
        fiber: fiber,
        descriptor,
        model,
      })
      this.mountOrRestartFieldDependencies(fiber, descriptor, model)

      return
    }

    this.unmountField(fiber)
    this.mountField(fiber, descriptor)
  }

  private updateGroup(
    _fiber: GroupFiber<TValues>,
    _descriptor: GroupDescriptor<TValues>
  ): void {
    // group 没有领域资源，descriptor 快照已由 update() 写入。
  }

  private updateDependency(
    fiber: DependencyFiber<TValues>,
    descriptor: DependencyDescriptor<TValues>,
    previous?: DependencyDescriptor<TValues>
  ): void {
    // trigger 订阅属于 dependencyResourceScope；trigger 列表变化时必须重启 effect。
    if (
      !fiber.dependencySlot ||
      !previous ||
      !isSameNamePathList(previous.trigger, descriptor.trigger)
    ) {
      this.unmountDependency(fiber)
      this.mountDependency(fiber)
    }
  }

  private mountFieldValidation(
    fiber: FieldFiber<TValues>,
    descriptor: FieldDescriptor<TValues>,
    model = fiber.fieldModel,
    scope = fiber.fieldResourceScope
  ): void {
    if (!model || !scope) {
      return
    }

    createValidationEffect<TValues>({
      name: descriptor.schema.name,
      fieldModel: model,
      context: this.context,
      scope,
    })
  }

  private mountOrRestartFieldDependencies(
    fiber: FieldFiber<TValues>,
    descriptor: FieldDescriptor<TValues>,
    model = fiber.fieldModel
  ): void {
    fiber.fieldDependenciesScope?.dispose()

    if (!model || !descriptor.dependencies) {
      fiber.fieldDependenciesScope = null

      return
    }

    const dependenciesScope = fiber.scope.child()
    fiber.fieldDependenciesScope = dependenciesScope
    dependenciesScope.add(() => {
      if (fiber.fieldDependenciesScope === dependenciesScope) {
        fiber.fieldDependenciesScope = null
      }
    })

    createDependenciesEffect<TValues>({
      descriptor,
      fieldModel: model,
      context: this.context,
      scope: dependenciesScope,
    })
  }

  private unmountField(fiber: FieldFiber<TValues>): void {
    fiber.fieldDependenciesScope?.dispose()
    fiber.fieldDependenciesScope = null
    fiber.fieldResourceScope?.dispose()
    fiber.fieldResourceScope = null
  }

  private unmountGroup(_fiber: GroupFiber<TValues>): void {
    // group 只参与结构生命周期，不创建领域资源。
  }

  private unmountDependency(fiber: DependencyFiber<TValues>): void {
    fiber.dependencyResourceScope?.dispose()
    fiber.dependencyResourceScope = null
    fiber.dependencySlot = null
  }
}

/**
 * FiberManager 的实例类型。
 */
export type FiberManager<TValues extends Values = Values> = InstanceType<
  typeof RuntimeFiberManager<TValues>
>

/**
 * 创建表单运行时 FiberManager。
 *
 * @param context - manager 所需的上下文、注册表和生命周期总线。
 * @returns 新的 RuntimeFiberManager 实例。
 */
export function createFiberManager<TValues extends Values = Values>(
  context: SchemxFormContext<TValues>
): RuntimeFiberManager<TValues> {
  return new RuntimeFiberManager(context)
}

function isSameNamePathList(a: NamePath[], b: NamePath[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((name, index) => name === b[index])
}

function throwUnknownDescriptor(descriptor: never): never {
  throw new Error(`unknown type: ${(descriptor as { type?: string }).type ?? "unknown"}`)
}

function throwUnexpectedDescriptor<TValues extends Values>(
  fiber: DescribedFiber<TValues>,
  descriptor: FormDescriptor<TValues>
): never {
  throw new Error(
    `unexpected descriptor type: fiber ${fiber.type} cannot update with ${descriptor.type}`
  )
}
