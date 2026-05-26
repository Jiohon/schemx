import { vi } from "vitest"

import { compileToDescriptors, type FormDescriptor } from "../../descriptor"
import { createFieldRegistry, type FieldRegistry } from "../../field"
import { createLifecycleBus, type LifecycleListener } from "../../lifecycle"
import { createSignal } from "../../reactivity"
import { createScheduler, type Scheduler } from "../../scheduler"
import { createViewRevision, type ViewRevision } from "../../view"
import { createFiberManager, type FiberManager } from "../fiberManager"
import { createReconciler, type Reconciler } from "../reconciler"

import type { SchemxFormContext } from "../../createForm"
import type { FieldDescriptor } from "../../descriptor"
import type { SchemxField, SchemxFormApi, Values } from "../../types"
import type { ContainerFiber, Fiber, RootFiber } from "../fiber"

export interface RuntimeGraphTestHarness<TValues extends Values = Values> {
  readonly context: SchemxFormContext<TValues>
  readonly fieldRegistry: FieldRegistry<TValues>
  readonly fiberManager: FiberManager<TValues>
  readonly reconciler: Reconciler<TValues>
  readonly root: RootFiber
  readonly scheduler: Scheduler
  readonly viewRevision: ViewRevision
  readonly commitChildren: (
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ) => void
  readonly commitSchemas: (
    parent: ContainerFiber<TValues>,
    schemas: SchemxField<TValues>[]
  ) => void
  readonly formApi: SchemxFormApi<TValues>
}

export function createFieldDescriptor<TValues extends Values = Values>(
  key: string,
  name: string | string[] = key
): FieldDescriptor<TValues> {
  return compileToDescriptors<TValues>([
    {
      key,
      name: name as any,
      label: "label",
      componentType: "text",
    },
  ])[0] as FieldDescriptor<TValues>
}

export function createRawFieldSchema<TValues extends Values = Values>(
  key: string,
  name: string | string[] = key
): SchemxField<TValues> {
  return {
    key,
    name: name as any,
    componentType: "text",
  } as SchemxField<TValues>
}

export function createRuntimeGraphHarness<TValues extends Values = Values>(
  listener: LifecycleListener<Fiber<TValues>, FormDescriptor<TValues>> = {},
  initialValues: Record<string, unknown> = {}
): RuntimeGraphTestHarness<TValues> {
  const signals = new Map<string, ReturnType<typeof createSignal<unknown>>>()
  const values = { ...initialValues }
  const fieldRegistry = createFieldRegistry<TValues>()
  const lifecycleBus = createLifecycleBus<Fiber<TValues>, FormDescriptor<TValues>>(
    listener
  )
  const scheduler = createScheduler()
  const viewRevision = createViewRevision()

  const readValue = (name: unknown): unknown => {
    const key = normalizeName(name)
    let signal = signals.get(key)

    if (!signal) {
      signal = createSignal(values[key])
      signals.set(key, signal)
    }

    return signal.value
  }

  const writeValue = (name: unknown, value: unknown): void => {
    const key = normalizeName(name)
    values[key] = value

    let signal = signals.get(key)
    if (!signal) {
      signal = createSignal(value)
      signals.set(key, signal)
    } else {
      signal.value = value
    }
  }

  const formApi = {
    setValue: writeValue,
    setValues: vi.fn(),
    getValue: readValue,
    getValues: (names?: unknown) => {
      if (Array.isArray(names)) {
        for (const name of names) {
          readValue(name)
        }
      }

      return values as TValues
    },
    getSnapshots: () => values as TValues,
    setPending: vi.fn(),
    isPending: vi.fn(() => false),
    setTouched: vi.fn(),
    isTouched: vi.fn(() => false),
    getError: vi.fn(() => []),
    setError: vi.fn(),
    resetFields: vi.fn(),
    reset: vi.fn(),
    validateField: vi.fn().mockResolvedValue({ ok: true, values }),
    validate: vi.fn().mockResolvedValue({ ok: true, values }),
  } as unknown as SchemxFormApi<TValues>

  const context = {
    scheduler,
    lifecycleBus,
    fieldRegistry,
    store: {
      getFieldsSnapshot: vi.fn(() => values),
      getFieldsValue: vi.fn(() => values),
    },
    validator: {
      getFieldError: vi.fn(() => []),
      setFieldError: vi.fn(),
      registerRules: vi.fn(),
      unregisterRules: vi.fn(),
      validateField: vi.fn().mockResolvedValue({ ok: true, values }),
      validate: vi.fn().mockResolvedValue({ ok: true, values }),
    },
    rulesRegistry: {
      resolve: vi.fn(() => []),
    },
    defaultProps: {},
    getFormApi: () => formApi,
  } as unknown as SchemxFormContext<TValues>

  const fiberManager = createFiberManager<TValues>(context)
  const reconciler = createReconciler(fiberManager)
  const root = fiberManager.createRoot()
  const commitChildren = (
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void => {
    const changed = reconciler.reconcileChildren(parent, descriptors)

    if (changed) {
      viewRevision.bump()
    }
  }

  const commitSchemas = (
    parent: ContainerFiber<TValues>,
    schemas: SchemxField<TValues>[]
  ): void => commitChildren(parent, compileToDescriptors<TValues>(schemas))

  Object.assign(context, { reconciler, commitChildren })

  return {
    context,
    fieldRegistry,
    fiberManager,
    reconciler,
    root,
    scheduler,
    viewRevision,
    commitChildren,
    commitSchemas,
    formApi,
  }
}

export async function flushRuntimeGraph(scheduler: Scheduler): Promise<void> {
  await Promise.resolve()
  await scheduler.whenIdle()
  await Promise.resolve()
}

function normalizeName(name: unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
