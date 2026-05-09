/**
 * Schemx runtime engine prototype
 *
 * 演示从 schema flatten 模型演进到 runtime tree 模型：
 * 1. Raw Schema immutable
 * 2. Normalize / static validation / runtime build 分层
 * 3. dependency = runtime container
 * 4. dependency subtree incremental compile + identity reuse
 * 5. async dependency versioning
 * 6. microtask scheduler batching
 * 7. dynamic subtree dispose
 */

/* ---------------------------------- */
/* signal */
/* ---------------------------------- */

type Subscriber = () => void

class Signal<T> {
  private _value: T

  private subscribers = new Set<Subscriber>()

  constructor(value: T) {
    this._value = value
  }

  get value() {
    return this._value
  }

  set value(next: T) {
    if (Object.is(this._value, next)) return

    this._value = next

    this.subscribers.forEach((fn) => fn())
  }

  subscribe(fn: Subscriber) {
    this.subscribers.add(fn)

    return () => {
      this.subscribers.delete(fn)
    }
  }
}

/* ---------------------------------- */
/* schema types */
/* ---------------------------------- */

type Values = Record<string, any>

type NamePath = string

interface BaseField {
  componentType: "input" | "select"

  name: NamePath

  label: string

  key?: string
}

interface GroupField {
  componentType: "group"

  label: string

  children: Schema[]

  key?: string
}

interface DependencyField {
  componentType: "dependency"

  to: NamePath[]

  renderer: (values: Values, form: FormStore) => Promise<Schema[]> | Schema[]

  key?: string
}

type Schema = BaseField | GroupField | DependencyField

type NormalizedSchema = Schema

/* ---------------------------------- */
/* runtime node */
/* ---------------------------------- */

interface RuntimeNodeBase {
  id: number

  key: string

  parent: RuntimeNode | null

  mounted: boolean

  dirty: boolean

  disposed: boolean

  dispose: () => void
}

interface FieldRuntime {
  value: Signal<any>

  errors: Signal<string[]>

  touched: Signal<boolean>

  validating: Signal<boolean>
}

interface FieldNode extends RuntimeNodeBase {
  type: "field"

  schema: BaseField

  field: FieldRuntime
}

interface GroupNode extends RuntimeNodeBase {
  type: "group"

  schema: GroupField

  children: RuntimeNode[]
}

interface DependencyNode extends RuntimeNodeBase {
  type: "dependency"

  schema: DependencyField

  children: RuntimeNode[]

  subtree: Signal<RuntimeNode[]>

  loading: Signal<boolean>

  error: Signal<unknown | null>

  version: number

  run: () => Promise<void>
}

type RuntimeNode = FieldNode | GroupNode | DependencyNode

/* ---------------------------------- */
/* form store / field registry */
/* ---------------------------------- */

class FormStore {
  private fields = new Map<string, FieldRuntime>()

  getField(name: string): FieldRuntime {
    if (!this.fields.has(name)) {
      this.fields.set(name, {
        value: new Signal(undefined),
        errors: new Signal<string[]>([]),
        touched: new Signal(false),
        validating: new Signal(false),
      })
    }

    return this.fields.get(name)!
  }

  setValue(name: string, value: any) {
    this.getField(name).value.value = value
  }

  getValue(name: string) {
    return this.getField(name).value.value
  }

  getValues(): Values {
    const result: Values = {}

    for (const [key, field] of this.fields.entries()) {
      result[key] = field.value.value
    }

    return result
  }

  subscribe(name: string, fn: Subscriber) {
    return this.getField(name).value.subscribe(fn)
  }
}

/* ---------------------------------- */
/* scheduler */
/* ---------------------------------- */

class RuntimeScheduler {
  private dirtyDependencies = new Set<DependencyNode>()

  private pending = false

  enqueueDependency(node: DependencyNode) {
    if (node.disposed) return

    node.dirty = true
    this.dirtyDependencies.add(node)

    if (this.pending) return

    this.pending = true

    queueMicrotask(() => {
      this.flush()
    })
  }

  private flush() {
    this.pending = false

    const queue = Array.from(this.dirtyDependencies)

    this.dirtyDependencies.clear()

    for (const node of queue) {
      node.dirty = false
      node.run().catch((error) => {
        node.error.value = error
        node.loading.value = false
      })
    }
  }
}

/* ---------------------------------- */
/* compiler */
/* ---------------------------------- */

interface CompileContext {
  parent: RuntimeNode | null

  ownerPath: string

  index: number
}

class RuntimeCompiler {
  private nextId = 1

  constructor(
    private readonly form: FormStore,
    private readonly scheduler: RuntimeScheduler
  ) {}

  compileRoot(rawSchemas: Schema[]) {
    const normalized = this.normalize(rawSchemas)

    this.staticValidate(normalized)

    return this.compileChildren([], normalized, null, "root")
  }

  private normalize(schemas: Schema[]): NormalizedSchema[] {
    return schemas.map((schema) => {
      if (schema.componentType === "group") {
        return {
          ...schema,
          children: this.normalize(schema.children),
        }
      }

      return { ...schema }
    })
  }

  private staticValidate(schemas: NormalizedSchema[], seen = new Set<string>()) {
    for (const schema of schemas) {
      if (schema.componentType === "dependency") {
        if (!Array.isArray(schema.to) || typeof schema.renderer !== "function") {
          throw new Error("Invalid dependency schema")
        }

        continue
      }

      if (schema.componentType === "group") {
        this.staticValidate(schema.children, seen)
        continue
      }

      if (seen.has(schema.name)) {
        console.warn(`[schemx] duplicate field name: ${schema.name}`)
      }

      seen.add(schema.name)
    }
  }

  private compileChildren(
    previous: RuntimeNode[],
    schemas: NormalizedSchema[],
    parent: RuntimeNode | null,
    ownerPath: string
  ) {
    const previousByKey = new Map(previous.map((node) => [node.key, node]))

    const nextNodes = schemas.map((schema, index) => {
      const key = this.getNodeKey(schema, ownerPath, index)
      const existing = previousByKey.get(key)

      previousByKey.delete(key)

      return this.compileNode(schema, {
        parent,
        ownerPath,
        index,
      }, existing)
    })

    for (const stale of previousByKey.values()) {
      stale.dispose()
    }

    return nextNodes
  }

  private compileNode(
    schema: NormalizedSchema,
    context: CompileContext,
    existing?: RuntimeNode
  ): RuntimeNode {
    const key = this.getNodeKey(schema, context.ownerPath, context.index)

    if (existing && existing.type === "field" && schema.componentType !== "group" && schema.componentType !== "dependency") {
      existing.schema = schema
      existing.parent = context.parent
      existing.mounted = true
      return existing
    }

    if (existing && existing.type === "group" && schema.componentType === "group") {
      existing.schema = schema
      existing.parent = context.parent
      existing.children = this.compileChildren(
        existing.children,
        schema.children,
        existing,
        key
      )
      existing.mounted = true
      return existing
    }

    if (existing && existing.type === "dependency" && schema.componentType === "dependency") {
      existing.schema = schema
      existing.parent = context.parent
      existing.mounted = true
      this.scheduler.enqueueDependency(existing)
      return existing
    }

    existing?.dispose()

    switch (schema.componentType) {
      case "input":
      case "select":
        return this.createFieldNode(schema, key, context.parent)

      case "group":
        return this.createGroupNode(schema, key, context.parent)

      case "dependency":
        return this.createDependencyNode(schema, key, context.parent)
    }
  }

  private createFieldNode(schema: BaseField, key: string, parent: RuntimeNode | null): FieldNode {
    const node: FieldNode = {
      id: this.nextId++,
      key,
      type: "field",
      schema,
      parent,
      mounted: true,
      dirty: false,
      disposed: false,
      field: this.form.getField(schema.name),
      dispose() {
        node.mounted = false
        node.disposed = true
      },
    }

    return node
  }

  private createGroupNode(schema: GroupField, key: string, parent: RuntimeNode | null): GroupNode {
    const node: GroupNode = {
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

    node.children = this.compileChildren([], schema.children, node, key)

    return node
  }

  private createDependencyNode(
    schema: DependencyField,
    key: string,
    parent: RuntimeNode | null
  ): DependencyNode {
    const subtree = new Signal<RuntimeNode[]>([])
    const loading = new Signal(false)
    const error = new Signal<unknown | null>(null)
    const disposers: Array<() => void> = []

    const node: DependencyNode = {
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

        const currentVersion = ++node.version
        const depValues: Values = {}

        node.loading.value = true
        node.error.value = null

        for (const name of node.schema.to) {
          depValues[name] = this.form.getValue(name)
        }

        try {
          const result = await node.schema.renderer(depValues, this.form)

          if (node.disposed || currentVersion !== node.version) {
            return
          }

          node.children = this.compileChildren(
            node.children,
            result,
            node,
            `${node.key}/subtree`
          )

          node.subtree.value = node.children
        } catch (runtimeError) {
          if (node.disposed || currentVersion !== node.version) {
            return
          }

          node.error.value = runtimeError
        } finally {
          if (!node.disposed && currentVersion === node.version) {
            node.loading.value = false
          }
        }
      },
      dispose: () => {
        disposers.forEach((dispose) => dispose())
        node.children.forEach((child) => child.dispose())
        node.mounted = false
        node.disposed = true
      },
    }

    for (const name of schema.to) {
      disposers.push(this.form.subscribe(name, () => {
        this.scheduler.enqueueDependency(node)
      }))
    }

    this.scheduler.enqueueDependency(node)

    return node
  }

  private getNodeKey(schema: NormalizedSchema, ownerPath: string, index: number) {
    if (schema.key) return `${ownerPath}/${schema.key}`

    if (schema.componentType === "dependency") {
      return `${ownerPath}/dependency:${schema.to.join("|")}:${index}`
    }

    if (schema.componentType === "group") {
      return `${ownerPath}/group:${schema.label}:${index}`
    }

    return `${ownerPath}/field:${schema.name}`
  }
}

/* ---------------------------------- */
/* renderer */
/* ---------------------------------- */

function render(nodes: RuntimeNode[], depth = 0) {
  const pad = " ".repeat(depth * 2)

  for (const node of nodes) {
    switch (node.type) {
      case "field":
        console.log(`${pad}FIELD #${node.id} -> ${node.schema.label}`)
        break

      case "group":
        console.log(`${pad}GROUP #${node.id} -> ${node.schema.label}`)
        render(node.children, depth + 1)
        break

      case "dependency":
        console.log(
          `${pad}DEPENDENCY #${node.id} loading=${node.loading.value} version=${node.version}`
        )

        if (node.error.value) {
          console.log(`${pad}  ERROR -> ${String(node.error.value)}`)
        }

        render(node.subtree.value, depth + 1)
        break
    }
  }
}

/* ---------------------------------- */
/* mock schema */
/* ---------------------------------- */

const schemas: Schema[] = [
  {
    componentType: "select",
    name: "type",
    label: "Type",
  },
  {
    componentType: "dependency",
    to: ["type"],
    async renderer(values) {
      console.log("dependency renderer =>", values.type)

      await sleep(values.type === "user" ? 800 : 200)

      if (values.type === "user") {
        return [
          {
            componentType: "input",
            name: "username",
            label: "Username",
          },
          {
            componentType: "dependency",
            to: ["username"],
            renderer(usernameValues) {
              if (!usernameValues.username) return []

              return [
                {
                  componentType: "input",
                  name: "nickname",
                  label: `Nickname for ${usernameValues.username}`,
                },
              ]
            },
          },
        ]
      }

      if (values.type === "company") {
        return [
          {
            componentType: "input",
            name: "companyName",
            label: "Company Name",
          },
          {
            componentType: "input",
            name: "companyCode",
            label: "Company Code",
          },
        ]
      }

      return []
    },
  },
]

/* ---------------------------------- */
/* bootstrap */
/* ---------------------------------- */

const form = new FormStore()
const scheduler = new RuntimeScheduler()
const compiler = new RuntimeCompiler(form, scheduler)
const runtimeTree = compiler.compileRoot(schemas)

/* ---------------------------------- */
/* mock updates */
/* ---------------------------------- */

async function main() {
  console.log("====== initial ======")
  render(runtimeTree)

  console.log("\n====== set user, then company quickly ======")
  form.setValue("type", "user")
  form.setValue("type", "company")

  await sleep(1000)
  render(runtimeTree)

  console.log("\n====== set user ======")
  form.setValue("type", "user")

  await sleep(1000)
  render(runtimeTree)

  console.log("\n====== set username ======")
  form.setValue("username", "Ada")

  await sleep(50)
  render(runtimeTree)
}

main()

/* ---------------------------------- */
/* utils */
/* ---------------------------------- */

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
