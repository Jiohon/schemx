/**
 * T037 [US1] - Runtime Graph - 装配入口
 *
 * 实现完整的 Runtime Graph 装配和协调。
 *
 * @module core/runtimeGraph/createRuntimeGraph
 */

import type {
  CreateRuntimeGraphOptions,
  RuntimeGraph,
  RuntimeDiagnostics,
} from "./types"
import type { Values } from "../types/form"
import type { SchemxField } from "../types/schema"
import type { SchemxSchemasInput } from "../createSchemas"
import type {
  IdentifiedSchemaNode,
  IdentifiedFieldNode,
  SchemaNodeRecord,
} from "../schemaGraph/types"
import { createSchemaGraphStore, SchemaGraphStoreImpl } from "../schemaGraph/schemaGraphStore"
import { createValueGraph } from "../valueGraph/valueGraph"
import { createDynamicPropsEngine } from "../dynamicProps/dynamicPropsEngine"
import { createDynamicSlotEngine } from "../dynamicSlot/dynamicSlotEngine"
import { createEffectiveSchemaLayer } from "../effectiveSchema/effectiveSchemaLayer"
import { createValidationEngine } from "../validation/validationEngine"
import { createRuntimeScopeManager } from "../runtimeScope/runtimeScopeManager"
import { createViewGraph, ViewGraphImpl } from "../view/viewGraphNew"
import { createRuntimeDiagnostics } from "./diagnostics"
import { compileSchema } from "../schemaGraph/compiler"
import { assignIdentities } from "../schemaGraph/identity"
import { diffSchemas } from "../schemaGraph/patches"
import { isSchemxSchemas } from "../createSchemas"

/**
 * Runtime Graph 实现。
 */
class RuntimeGraphImpl<TValues extends Values = Values>
  implements RuntimeGraph<TValues>
{
  readonly schemaGraph: SchemaGraphStoreImpl<TValues>
  readonly valueGraph: ReturnType<typeof createValueGraph<TValues>>
  readonly dynamicProps: ReturnType<typeof createDynamicPropsEngine<TValues>>
  readonly dynamicSlot: ReturnType<typeof createDynamicSlotEngine<TValues>>
  readonly effectiveSchema: ReturnType<typeof createEffectiveSchemaLayer<TValues>>
  readonly validation: ReturnType<typeof createValidationEngine<TValues>>
  readonly scopeManager: ReturnType<typeof createRuntimeScopeManager>
  readonly viewGraph: ViewGraphImpl<TValues>
  readonly diagnostics: RuntimeDiagnostics<TValues>

  private _destroyed = false
  private _currentIdentifiedNodes: IdentifiedSchemaNode<TValues>[] = []

  constructor(options: CreateRuntimeGraphOptions<TValues> = {}) {
    this.schemaGraph = createSchemaGraphStore<TValues>() as SchemaGraphStoreImpl<TValues>
    this.valueGraph = createValueGraph<TValues>()
    this.dynamicProps = createDynamicPropsEngine<TValues>()
    this.dynamicSlot = createDynamicSlotEngine<TValues>()
    this.effectiveSchema = createEffectiveSchemaLayer<TValues>()
    this.validation = createValidationEngine<TValues>()
    this.scopeManager = createRuntimeScopeManager()
    this.viewGraph = createViewGraph<TValues>() as ViewGraphImpl<TValues>
    this.diagnostics =
      createRuntimeDiagnostics<TValues>() as RuntimeDiagnostics<TValues>

    // 连接 viewGraph 到其他层
    this.viewGraph.connect(
      this.schemaGraph,
      this.valueGraph,
      this.effectiveSchema
    )

    // 设置初始值
    if (options.initialValues) {
      this.valueGraph.setInitialValues(options.initialValues)
    }

    // 应用初始 schema
    if (options.jsonSchemas) {
      this.setSchemas(options.jsonSchemas)
    }
  }

  setSchemas(nextSchemas: SchemxSchemasInput<TValues>): void {
    if (this._destroyed) {
      return
    }

    // 解析 schemas 输入
    const schemasArray: readonly SchemxField<TValues>[] =
      isSchemxSchemas(nextSchemas) ? nextSchemas.value : nextSchemas

    // 1. 编译 schema
    const compileResult = compileSchema(schemasArray)
    if (compileResult.errors.length > 0) {
      console.warn("[schemx] Schema compile errors:", compileResult.errors)
      return
    }

    // 2. 分配 identities
    const identityResult = assignIdentities(compileResult.normalizedNodes)
    if (identityResult.errors.length > 0) {
      console.warn("[schemx] Schema identity errors:", identityResult.errors)
      return
    }

    // 3. 计算差异
    const diffResult = diffSchemas(
      this._currentIdentifiedNodes,
      identityResult.identifiedNodes
    )

    if (diffResult.patches.length > 0) {
      // 4. 应用补丁
      this.schemaGraph.apply(diffResult.patches)
    } else if (this._currentIdentifiedNodes.length === 0) {
      // 首次加载
      this.schemaGraph.setInitialNodes(identityResult.identifiedNodes)
    }

    // 5. 更新当前节点缓存
    this._currentIdentifiedNodes = identityResult.identifiedNodes

    // 6. Mount 字段到 valueGraph
    mountFieldsFromNodes(
      identityResult.identifiedNodes,
      this.schemaGraph,
      this.valueGraph
    )

    // 7. 注册到 effectiveSchema
    registerEffectiveSchema(
      identityResult.identifiedNodes,
      this.schemaGraph,
      this.effectiveSchema
    )

    // 8. 触发 viewGraph 重新计算
    this.viewGraph.recompute()
  }

  setFieldValue<TName extends keyof TValues>(
    name: TName,
    value: TValues[TName] | undefined
  ): void {
    if (this._destroyed) {
      return
    }
    this.valueGraph.setValue(name, value)
    this.viewGraph.recompute()
  }

  getFieldValue<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined {
    return this.valueGraph.getValue(name)
  }

  async validate(): Promise<boolean> {
    if (this._destroyed) {
      return false
    }
    const result = await this.validation.validateForm()
    return result.valid
  }

  destroy(): void {
    if (this._destroyed) {
      return
    }
    this._destroyed = true
    this.scopeManager.disposeForm()
  }
}

/**
 * 判断 SchemaNodeRecord 是否为字段节点。
 */
function isFieldRecord<TValues extends Values>(
  record: SchemaNodeRecord<TValues>
): record is IdentifiedFieldNode<TValues> & { readonly revision: number } {
  return record.kind === "field"
}

/**
 * 从 identified 节点中提取字段信息并 mount 到 valueGraph。
 */
function mountFieldsFromNodes<TValues extends Values>(
  nodes: readonly IdentifiedSchemaNode<TValues>[],
  schemaGraph: SchemaGraphStoreImpl<TValues>,
  valueGraph: ReturnType<typeof createValueGraph<TValues>>
): void {
  const fieldRecords: (IdentifiedFieldNode<TValues> & { readonly revision: number })[] = []

  function collect(n: readonly IdentifiedSchemaNode<TValues>[]) {
    for (const node of n) {
      if (node.kind === "field") {
        const record = schemaGraph.getNode(node.nodeId)
        if (record && isFieldRecord(record)) {
          fieldRecords.push(record)
        }
      }
      if (node.kind === "group") {
        collect(node.children)
      }
    }
  }

  collect(nodes)

  for (const fieldRecord of fieldRecords) {
    const initialValue = fieldRecord.staticSchema.initialValue
    valueGraph.mountField(
      fieldRecord.nodeId,
      fieldRecord.name as keyof TValues,
      initialValue as TValues[keyof TValues] | undefined
    )
  }
}

/**
 * 从 identified 节点中提取信息并注册到 effectiveSchema。
 */
function registerEffectiveSchema<TValues extends Values>(
  nodes: readonly IdentifiedSchemaNode<TValues>[],
  schemaGraph: SchemaGraphStoreImpl<TValues>,
  effectiveSchema: ReturnType<typeof createEffectiveSchemaLayer<TValues>>
): void {
  function process(n: readonly IdentifiedSchemaNode<TValues>[]) {
    for (const node of n) {
      if (node.kind === "field") {
        const record = schemaGraph.getNode(node.nodeId)
        if (record && isFieldRecord(record)) {
          effectiveSchema.ensureField(
            node.nodeId,
            record.staticSchema
          )
        }
      }
      if (node.kind === "group") {
        process(node.children)
      }
    }
  }

  process(nodes)
}

/**
 * 创建 Runtime Graph 实例。
 */
export function createRuntimeGraph<TValues extends Values = Values>(
  options: CreateRuntimeGraphOptions<TValues> = {}
): RuntimeGraph<TValues> {
  return new RuntimeGraphImpl<TValues>(options)
}

/**
 * 创建空的运行时诊断对象（已过时，保留兼容）。
 */
export function createEmptyDiagnostics<
  TValues extends Values = Values
>(): RuntimeDiagnostics<TValues> {
  return createRuntimeDiagnostics<TValues>() as RuntimeDiagnostics<TValues>
}
