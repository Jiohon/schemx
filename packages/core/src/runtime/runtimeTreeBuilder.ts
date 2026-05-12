/**
 * Runtime 树构建器。
 *
 * 负责 schema 编译和运行时节点管理：
 * - 编译 schema 列表为运行时节点
 * - 创建/更新/销毁三种节点（field/group/dependency）
 * - 管理字段生命周期
 * - 处理依赖解析器注册
 *
 * @module core/runtime/runtimeTreeBuilder
 */

import { createDependenciesResolver } from "../engine/dependenciesEngine"
import { createDependencyEngine } from "../engine/dependencyEngine"
import { createFieldEngine } from "../engine/fieldEngine"
import { createSignal } from "../reactivity"
import { isBaseSchema, isDependencySchema, isGroupSchema } from "../utils"

import { createDisposeBag } from "./disposeBag"
import { applyFieldProps, createFieldRuntime, resolveStaticProps } from "./fieldProps"
import { getRuntimeNodeKey } from "./identity"
import { normalizeSchemas } from "./normalize"
import { type CompileNodeContext, reconcileChildren } from "./reconcile"
import { staticValidateSchemas } from "./staticValidate"

import type { FormRuntimeContext } from "./context"
import type { RuntimeScheduler } from "../scheduler"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
  RuntimeSchema,
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"

/**
 * Runtime 树构建器配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeTreeBuilderOptions<T extends Values = Values> {
  /**
   * runtime 面向 createForm 的上下文。
   *
   * 封装表单实例和字段生命周期。
   */
  context: FormRuntimeContext<T>
  /**
   * 统一运行时调度器。
   *
   * 用于 dependency/dependencies/validation/cleanup 等 engine job。
   */
  scheduler: RuntimeScheduler
  /**
   * 提交 dependency subtree。
   *
   * 由 RuntimeGraph 维护 owner/parent/revision。
   *
   * @param node - dependency 节点
   * @param nextChildren - 新的子节点列表
   */
  commitDependencySubtree: (
    node: DependencyRuntimeNode<T>,
    nextChildren: RuntimeNode<T>[]
  ) => void
  /**
   * runtime resolved schema 发生变化时的回调。
   *
   * 用于递增 engine revision。
   */
  onTreeChange: () => void
}

/**
 * Runtime 树构建器。
 *
 * 负责 schema 编译和运行时节点管理。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const builder = createRuntimeTreeBuilder<FormValues>({
 *   context,
 *   scheduler,
 *   commitDependencySubtree: graph.replaceSubtree,
 *   onTreeChange: bumpRevision,
 * })
 *
 * // 编译根节点
 * const rootNodes = builder.compileRoot(schemas)
 *
 * // 编译子节点（用于 dependency renderer）
 * const childNodes = builder.compile(previous, childSchemas, parentNode, 'parent-key')
 * ```
 */
export class RuntimeTreeBuilder<T extends Values = Values> {
  /**
   * 下一个节点 ID。
   */
  private nextId = 1

  /**
   * 字段引擎实例。
   */
  private readonly fieldEngine

  /**
   * 字段解析器映射表。
   *
   * 用于在更新字段时释放旧的解析器。
   */
  private readonly fieldResolvers = new WeakMap<FieldRuntimeNode<T>, () => void>()

  /**
   * 创建 RuntimeTreeBuilder 实例。
   *
   * @param options - 构建器配置选项
   */
  constructor(private readonly options: RuntimeTreeBuilderOptions<T>) {
    this.fieldEngine = createFieldEngine<T>({
      context: this.options.context,
    })
  }

  // ===== 公共 API =====

  /**
   * 编译 schema 列表为运行时节点。
   *
   * @param previous - 旧节点列表（用于增量复用），默认为空数组
   * @param schemas - schema 列表
   * @param parent - 父节点，默认为 null
   * @param ownerPath - 所有者路径，默认为 "root"
   * @returns 编译后的运行时节点数组
   */
  compile(
    previous: RuntimeNode<T>[] = [],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null = null,
    ownerPath: string = "root"
  ): RuntimeNode<T>[] {
    const normalized = normalizeSchemas(schemas)
    staticValidateSchemas(normalized)

    return reconcileChildren(previous, normalized, parent, ownerPath, {
      compileNode: this.compileNode,
    })
  }

  /**
   * 编译根节点。
   *
   * 等同于 `compile([], schemas, null, "root")`。
   *
   * @param schemas - schema 列表
   * @returns 编译后的运行时节点数组
   */
  compileRoot(schemas: SchemxField<T>[]): RuntimeNode<T>[] {
    return this.compile([], schemas, null, "root")
  }

  // ===== 节点编译 =====

  /**
   * 编译单个节点。
   *
   * 根据类型判断创建新节点还是复用旧节点。
   */
  private readonly compileNode = (
    schema: RuntimeSchema<T>,
    context: CompileNodeContext<T>,
    existing?: RuntimeNode<T>
  ): RuntimeNode<T> => {
    const key = getRuntimeNodeKey(schema, context.ownerPath, context.index)

    // 类型和 key 都匹配时复用节点，只更新 schema/parent，保留节点上的运行时状态。
    if (existing && existing.type === "field" && isBaseSchema(schema)) {
      this.updateFieldNode(existing, schema, context.parent)

      return existing
    }

    if (existing && existing.type === "group" && isGroupSchema(schema)) {
      this.updateGroupNode(existing, schema, context.parent, key)

      return existing
    }

    if (existing && existing.type === "dependency" && isDependencySchema(schema)) {
      this.updateDependencyNode(existing, schema, context.parent)

      return existing
    }

    // 类型变化或身份变化时释放旧节点，避免旧 effect/subtree 泄漏。
    existing?.dispose()

    if (isDependencySchema(schema)) {
      return this.createDependencyNode(schema, key, context.parent)
    }

    if (isGroupSchema(schema)) {
      return this.createGroupNode(schema, key, context.parent)
    }

    return this.createFieldNode(schema as SchemxBaseField<T>, key, context.parent)
  }

  // ===== 字段节点 =====

  /**
   * 创建字段运行时节点。
   *
   * @param schema - 字段 schema
   * @param key - 节点键值
   * @param parent - 父节点
   * @returns 字段运行时节点
   */
  private createFieldNode(
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

  /**
   * 更新字段运行时节点。
   *
   * 当字段 schema 发生变化但 key 保持稳定时，复用现有节点并更新其状态。
   * 会先释放旧的动态属性监听，再注册新的解析器。
   *
   * @param node - 要更新的字段节点
   * @param schema - 新的字段 schema
   * @param parent - 新的父节点
   */
  private updateFieldNode(
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

  // ===== 组节点 =====

  /**
   * 创建组运行时节点。
   *
   * 组节点是结构容器，用于组织子节点的层级关系。
   *
   * @param schema - 组 schema
   * @param key - 节点键值
   * @param parent - 父节点
   * @returns 组运行时节点
   */
  private createGroupNode(
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

    node.children = this.compile([], schema.children as SchemxField<T>[], node, key)

    return node
  }

  /**
   * 更新组运行时节点。
   *
   * 当组 schema 发生变化但 key 保持稳定时，复用现有节点并更新其子节点。
   *
   * @param node - 要更新的组节点
   * @param schema - 新的组 schema
   * @param parent - 新的父节点
   * @param key - 节点键值
   */
  private updateGroupNode(
    node: GroupRuntimeNode<T>,
    schema: SchemxGroupField<T>,
    parent: RuntimeNode<T> | null,
    key: string
  ): void {
    node.schema = schema
    node.parent = parent
    node.children = this.compile(
      node.children,
      schema.children as SchemxField<T>[],
      node,
      key
    )
    node.mounted = true
  }

  // ===== 依赖节点 =====

  /**
   * 创建依赖运行时节点。
   *
   * 依赖节点用于处理动态 schema 渲染，会根据表单值动态产出子节点。
   *
   * @param schema - 依赖 schema
   * @param key - 节点键值
   * @param parent - 父节点
   * @returns 依赖运行时节点
   *
   * @throws 如果 schema 不是有效的依赖 schema
   */
  private createDependencyNode(
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
      compileChildren: this.compile.bind(this),
      commitSubtree: this.options.commitDependencySubtree,
    })

    node.dependencyRuntime.run = runner.run
    disposeBag.add(runner.dispose)

    return node
  }

  /**
   * 更新依赖运行时节点。
   *
   * 当依赖 schema 发生变化但 key 保持稳定时，复用现有节点并调度重新执行。
   *
   * @param node - 要更新的依赖节点
   * @param schema - 新的依赖 schema
   * @param parent - 新的父节点
   */
  private updateDependencyNode(
    node: DependencyRuntimeNode<T>,
    schema: SchemxDependencyField<T>,
    parent: RuntimeNode<T> | null
  ): void {
    node.schema = schema
    node.parent = parent
    node.mounted = true
    node.dirty = true
    this.options.scheduler.queue({
      channel: "dependency",
      key: node.key,
      run: () => {
        node.dirty = false

        return node.dependencyRuntime.run().catch((error: unknown) => {
          node.dependencyRuntime.error.value =
            error instanceof Error ? error : new Error(String(error))
          node.dependencyRuntime.loading.value = false
        })
      },
    })
  }

  // ===== 生命周期管理 =====

  /**
   * 挂载字段节点。
   *
   * @param node - 字段运行时节点
   */
  private mountField(node: FieldRuntimeNode<T>): void {
    this.fieldEngine.mount(node)
  }

  /**
   * 卸载字段节点。
   *
   * @param node - 字段运行时节点
   */
  private unmountField(node: FieldRuntimeNode<T>): void {
    this.fieldEngine.unmount(node)
  }

  /**
   * 同步字段静态属性。
   *
   * 当 schema 被复用但静态属性变化时，把 field signals 拉回新的静态基线。
   *
   * @param node - 字段运行时节点
   */
  private syncStaticFieldProps(node: FieldRuntimeNode<T>): void {
    // schema 被复用但静态属性变化时，需要把 field signals 拉回新的静态基线。
    const changed = applyFieldProps(
      node.fieldRuntime,
      resolveStaticProps(
        node.schema,
        this.options.context.resolveFieldDefaults(node.schema)
      )
    )

    if (!changed) return

    this.notifyFieldUpdate(node)
    this.options.onTreeChange()
  }

  /**
   * 注册字段依赖解析器。
   *
   * 解析器只关心字段 dependencies；字段校验生命周期由 createForm 回调处理。
   *
   * @param node - 字段运行时节点
   */
  private registerFieldResolver(node: FieldRuntimeNode<T>): void {
    // resolver 只关心字段 dependencies；字段校验生命周期由 createForm 回调处理。
    const resolver = createDependenciesResolver(node, {
      form: this.options.context.form,
      resolveDefaults: this.options.context.resolveFieldDefaults,
      scheduler: this.options.scheduler,
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

  /**
   * 通知字段更新。
   *
   * 字段属性变化时只通知字段生命周期，不重新 mount。
   *
   * @param node - 字段运行时节点
   */
  private readonly notifyFieldUpdate = (node: FieldRuntimeNode<T>): void => {
    // 字段属性变化时只通知字段生命周期，不重新 mount。
    this.fieldEngine.update(node)
  }
}

/**
 * 创建 Runtime 树构建器。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 构建器配置选项
 * @returns Runtime 树构建器实例
 *
 * @example
 * ```ts
 * const builder = createRuntimeTreeBuilder<FormValues>({
 *   context,
 *   scheduler,
 *   commitDependencySubtree: (node, children) => graph.replaceSubtree(node, children),
 *   onTreeChange: () => revision++,
 * })
 *
 * const rootNodes = builder.compileRoot(schemas)
 * ```
 */
export function createRuntimeTreeBuilder<T extends Values>(
  options: RuntimeTreeBuilderOptions<T>
): RuntimeTreeBuilder<T> {
  return new RuntimeTreeBuilder<T>(options)
}
