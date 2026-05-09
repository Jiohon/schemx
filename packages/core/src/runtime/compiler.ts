/**
 * Runtime 编译器
 *
 * 将 Raw Schema 编译为 RuntimeNode tree，并在 dependency subtree 更新时
 * 通过稳定 key 复用已有 runtime node。编译器只处理 runtime 结构和
 * dependency 执行，不直接参与 UI 渲染。
 *
 * @module core/runtime/compiler
 */

import { signal } from "@preact/signals-core"

import { isBaseSchema, isDependencySchema, isGroupSchema } from "../utils"

import type {
  SchemxBaseField,
  SchemxField,
  SchemxGroupField,
  SchemxInstance,
  Values,
} from "../types"
import type { RuntimeScheduler } from "./scheduler"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
  RuntimeSchema,
} from "./types"

/**
 * RuntimeCompiler 配置。
 *
 * @typeParam T - 表单值类型
 */
interface RuntimeCompilerOptions<T extends Values> {
  /** 当前表单实例，供 dependency renderer 和 effect 使用 */
  form: SchemxInstance<T>
  /** dependency dirty queue 调度器 */
  scheduler: RuntimeScheduler<T>
  /** dependency renderer pending 数量变化回调 */
  onPendingChange: (delta: number) => void
  /** runtime tree 结构变化回调 */
  onTreeChange: () => void
  /** field node 挂载时触发，用于注册校验等生命周期资源 */
  onFieldMount?: (schema: SchemxBaseField<T>) => void
  /** field node 卸载时触发，用于清理校验、错误和订阅等生命周期资源 */
  onFieldUnmount?: (schema: SchemxBaseField<T>) => void
}

/**
 * 单个 schema 编译时的上下文。
 *
 * @typeParam T - 表单值类型
 */
interface CompileContext<T extends Values> {
  /** 父 runtime node，root children 为 null */
  parent: RuntimeNode<T> | null
  /** 当前 owner 路径，用于生成稳定 key */
  ownerPath: string
  /** 当前 schema 在 siblings 中的位置，仅作为 fallback identity */
  index: number
}

/**
 * Schema runtime 编译器。
 *
 * @typeParam T - 表单值类型
 */
export class RuntimeCompiler<T extends Values = Values> {
  /** runtime node 自增 id */
  private nextId = 1

  /**
   * 创建 RuntimeCompiler。
   *
   * @param options - 编译器运行所需的 form、scheduler 和事件回调
   */
  constructor(private readonly options: RuntimeCompilerOptions<T>) {}

  /**
   * 编译根 schema 列表。
   *
   * 入口阶段会先 normalize，再做静态校验，最后构建 runtime root。
   *
   * @param rawSchemas - 外部传入的原始 schema 列表
   * @returns runtime root 节点数组
   */
  compileRoot(rawSchemas: SchemxField<T>[]): RuntimeNode<T>[] {
    const normalized = this.normalize(rawSchemas)

    this.staticValidate(normalized)

    return this.compileChildren([], normalized, null, "root")
  }

  /**
   * 编译 children，并基于 key 复用旧节点。
   *
   * previous 中未被复用的节点会被 dispose，避免旧 dependency watcher
   * 或子树状态泄漏。
   *
   * @param previous - 上一轮已存在的 runtime children
   * @param schemas - 下一轮 schema children
   * @param parent - 父 runtime node
   * @param ownerPath - 当前 owner 路径
   * @returns 下一轮 runtime children
   */
  compileChildren(
    previous: RuntimeNode<T>[],
    schemas: RuntimeSchema<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ): RuntimeNode<T>[] {
    const previousByKey = new Map(previous.map((node) => [node.key, node]))

    const nextNodes = schemas.map((schema, index) => {
      const key = this.getNodeKey(schema, ownerPath, index)
      const existing = previousByKey.get(key)

      previousByKey.delete(key)

      return this.compileNode(
        schema,
        {
          parent,
          ownerPath,
          index,
        },
        existing
      )
    })

    for (const stale of previousByKey.values()) {
      stale.dispose()
    }

    return nextNodes
  }

  /**
   * 规范化 schema。
   *
   * Stage A 仅做浅拷贝和 group children 递归，保证 Raw Schema 不被 runtime
   * 直接修改。后续可在这里继续补默认值、name normalize 等能力。
   *
   * @param schemas - 原始 schema 列表
   * @returns 规范化后的 schema 列表
   */
  private normalize(schemas: SchemxField<T>[]): SchemxField<T>[] {
    return schemas.map((schema) => {
      if (isGroupSchema(schema)) {
        return {
          ...schema,
          children: this.normalize(schema.children as SchemxField<T>[]),
        } as SchemxField<T>
      }

      return { ...schema } as SchemxField<T>
    })
  }

  /**
   * 静态校验 schema。
   *
   * 当前校验 dependency 基本形状，并对重复字段名给出警告。
   * 重名在不同 ownerPath 下的隔离会在 Stage B 继续完善。
   *
   * @param schemas - 待校验 schema 列表
   * @param seen - 已出现的字段名集合
   */
  private staticValidate(schemas: SchemxField<T>[], seen = new Set<string>()): void {
    for (const schema of schemas) {
      if (isDependencySchema(schema)) {
        if (!Array.isArray(schema.to) || typeof schema.renderer !== "function") {
          throw new Error("[schemx] Invalid dependency schema")
        }

        continue
      }

      if (isGroupSchema(schema)) {
        this.staticValidate(schema.children as SchemxField<T>[], seen)
        continue
      }

      const name = String(schema.name)

      if (seen.has(name)) {
        console.warn(`[schemx] duplicate field name: ${name}`)
      }

      seen.add(name)
    }
  }

  /**
   * 编译单个 schema。
   *
   * 如果传入 existing 且类型匹配，会更新其 schema 并复用该 runtime node；
   * 如果类型不匹配，则 dispose 旧节点并创建新节点。
   *
   * @param schema - 待编译 schema
   * @param context - 编译上下文
   * @param existing - 同 key 的旧 runtime node
   * @returns 编译后的 runtime node
   */
  private compileNode(
    schema: RuntimeSchema<T>,
    context: CompileContext<T>,
    existing?: RuntimeNode<T>
  ): RuntimeNode<T> {
    const key = this.getNodeKey(schema, context.ownerPath, context.index)

    if (existing && existing.type === "field" && isBaseSchema(schema)) {
      existing.schema = schema
      existing.field.schema = schema
      existing.parent = context.parent
      existing.mounted = true
      this.mountField(existing)

      return existing
    }

    if (existing && existing.type === "group" && isGroupSchema(schema)) {
      existing.schema = schema
      existing.parent = context.parent
      existing.children = this.compileChildren(
        existing.children,
        schema.children as SchemxField<T>[],
        existing,
        key
      )
      existing.mounted = true

      return existing
    }

    if (existing && existing.type === "dependency" && isDependencySchema(schema)) {
      existing.schema = schema
      existing.parent = context.parent
      existing.mounted = true
      this.options.scheduler.enqueueDependency(existing)

      return existing
    }

    existing?.dispose()

    if (isDependencySchema(schema)) {
      return this.createDependencyNode(schema, key, context.parent)
    }

    if (isGroupSchema(schema)) {
      return this.createGroupNode(schema, key, context.parent)
    }

    return this.createFieldNode(schema as SchemxBaseField<T>, key, context.parent)
  }

  /**
   * 创建基础字段节点。
   *
   * @param schema - 基础字段 schema
   * @param key - 稳定 runtime key
   * @param parent - 父 runtime node
   * @returns field runtime node
   */
  private createFieldNode(
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
      field: {
        schema,
        mounted: false,
      },
      dispose: () => {
        if (node.disposed) return

        this.unmountField(node)
        node.parent = null
        node.mounted = false
        node.disposed = true
      },
    }

    this.mountField(node)

    return node
  }

  /**
   * 执行字段 mount 生命周期。
   *
   * 同一个 field node 多次复用时只会 mount 一次，避免重复注册 rules。
   *
   * @param node - field runtime node
   */
  private mountField(node: FieldRuntimeNode<T>): void {
    if (node.field.mounted) return

    node.field.mounted = true
    this.options.onFieldMount?.(node.schema)
  }

  /**
   * 执行字段 unmount 生命周期。
   *
   * @param node - field runtime node
   */
  private unmountField(node: FieldRuntimeNode<T>): void {
    if (!node.field.mounted) return

    node.field.mounted = false
    this.options.onFieldUnmount?.(node.schema)
  }

  /**
   * 创建分组节点，并递归编译 children。
   *
   * @param schema - group schema
   * @param key - 稳定 runtime key
   * @param parent - 父 runtime node
   * @returns group runtime node
   */
  private createGroupNode(
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
        node.children.forEach((child) => child.dispose())
        node.mounted = false
        node.disposed = true
      },
    }
    node.children = this.compileChildren(
      [],
      schema.children as SchemxField<T>[],
      node,
      key
    )

    return node
  }

  /**
   * 创建 dependency 节点。
   *
   * dependency 节点会通过 form.effect 追踪 `to` 中的字段，并把自身放入
   * RuntimeScheduler。renderer 返回的 schema 只会编译到当前节点的 subtree。
   *
   * @param schema - dependency schema
   * @param key - 稳定 runtime key
   * @param parent - 父 runtime node
   * @returns dependency runtime node
   */
  private createDependencyNode(
    schema: RuntimeSchema<T>,
    key: string,
    parent: RuntimeNode<T> | null
  ): DependencyRuntimeNode<T> {
    if (!isDependencySchema(schema)) {
      throw new Error("[schemx] Expected dependency schema")
    }

    const disposers: Array<() => void> = []
    const subtree = signal<RuntimeNode<T>[]>([])
    const loading = signal(false)
    const error = signal<unknown | null>(null)

    const node: DependencyRuntimeNode<T> = {
      id: this.nextId++,
      key,
      type: "dependency",
      schema,
      parent,
      children: [],
      subtree,
      loading,
      error,
      version: 0,
      mounted: true,
      dirty: false,
      disposed: false,
      run: async () => {
        if (node.disposed) return

        // 每次执行递增 version，较慢的旧 renderer 完成后会被丢弃。
        const currentVersion = ++node.version

        this.options.onPendingChange(1)
        node.loading.value = true
        node.error.value = null

        try {
          const result = await node.schema.renderer(
            this.options.form.getFieldsSnapshot() as T,
            this.options.form
          )

          // 节点已销毁或已有更新的 run 生效时，忽略本次结果。
          if (node.disposed || currentVersion !== node.version) {
            return
          }

          node.children = this.compileChildren(
            node.children,
            Array.isArray(result) ? result : [],
            node,
            `${node.key}/subtree`
          )
          node.subtree.value = node.children
          this.options.onTreeChange()
        } catch (runtimeError) {
          if (node.disposed || currentVersion !== node.version) {
            return
          }

          node.error.value = runtimeError
          // renderer 失败时清空当前 dependency subtree，避免展示过期 schema。
          node.children = this.compileChildren(
            node.children,
            [],
            node,
            `${node.key}/subtree`
          )
          node.subtree.value = node.children
          this.options.onTreeChange()
        } finally {
          if (!node.disposed && currentVersion === node.version) {
            node.loading.value = false
          }

          this.options.onPendingChange(-1)
        }
      },
      dispose() {
        disposers.forEach((dispose) => dispose())
        node.children.forEach((child) => child.dispose())
        node.mounted = false
        node.disposed = true
      },
    }

    disposers.push(
      this.options.form.effect(() => {
        for (const path of node.schema.to) {
          void this.options.form.getFieldValue(path)
        }

        this.options.scheduler.enqueueDependency(node)
      })
    )

    return node
  }

  /**
   * 生成 runtime node 稳定 key。
   *
   * 优先使用 schema.key，其次使用 field name，dependency/group 暂时使用
   * 结构信息 + index fallback。Stage B 会继续收紧 ownerPath 与 identity 策略。
   *
   * @param schema - 当前 schema
   * @param ownerPath - 当前 owner 路径
   * @param index - sibling index，仅作 fallback
   * @returns runtime node key
   */
  private getNodeKey(schema: RuntimeSchema<T>, ownerPath: string, index: number): string {
    const schemaKey = (schema as { key?: string }).key

    if (schemaKey) return `${ownerPath}/${schemaKey}`

    if (isDependencySchema(schema)) {
      return `${ownerPath}/dependency:${schema.to.map((item) => String(item)).join("|")}:${index}`
    }

    if (isGroupSchema(schema)) {
      return `${ownerPath}/group:${schema.label}:${index}`
    }

    return `${ownerPath}/field:${String((schema as SchemxBaseField<T>).name)}`
  }
}
