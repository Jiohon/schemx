/**
 * DependencyEffectSlot - dependency renderer 执行态容器。
 *
 * Slot 只记录异步执行状态。renderer 返回的结构由 reconciler 写入
 * DependencyFiber.subChildren。
 *
 * @module core/field/dependencySlot
 */

import { compileToDescriptors } from "../descriptor"
import { createSignal, createSignalEffect } from "../reactivity"

import type { SchemxFormContext } from "../createForm"
import type { DependencyDescriptor } from "../descriptor"
import type { DependencyFiber, Scope } from "../graph"
import type { Signal } from "../reactivity"
import type { NamePath, SchemxFormApi, Values } from "../types"

/**
 * 检查 DependencyFiber 是否有 DependencySlot。
 *
 * @param fiber - dependency runtime 节点。
 * @returns 已挂载 slot 时返回 true。
 */
export function hasDependencySlot(fiber: DependencyFiber): boolean {
  return fiber.dependencySlot != null
}

/**
 * 从 DependencyFiber 获取 DependencySlot。
 *
 * @param fiber - dependency runtime 节点。
 * @returns 当前 slot；尚未挂载时返回 undefined。
 */
export function getDependencySlot(
  fiber: DependencyFiber
): DependencyEffectSlot | undefined {
  return fiber.dependencySlot ?? undefined
}

/**
 * Dependency renderer 的执行状态与控制句柄。
 */
export interface DependencyEffectSlot {
  readonly loading: Signal<boolean>
  readonly error: Signal<Error | null>
  readonly version: Signal<number>
  readonly abortController: Signal<AbortController | null>

  /**
   * 执行 dependency renderer。
   *
   * @returns renderer 执行完成后 resolve 的 Promise。
   */
  run(): Promise<void>

  /**
   * 释放当前 dependency effect 持有的异步资源。
   */
  dispose(): void
}

/**
 * 创建 DependencyEffectSlot（无副作用）。
 *
 * @param _fiber - 预留的 dependency runtime 节点参数，保持工厂签名与挂载流程一致。
 * @returns 初始状态的 DependencyEffectSlot。
 */
export function createDependencyEffect<TValues extends Values = Values>(
  _fiber: DependencyFiber<TValues>
): DependencyEffectSlot {
  const loading = createSignal(false)
  const error = createSignal<Error | null>(null)
  const version = createSignal(0)
  const abortController = createSignal<AbortController | null>(null)

  const slot: DependencyEffectSlot = {
    loading,
    error,
    version,
    abortController,
    run: async () => undefined,
    dispose: () => undefined,
  }

  return slot
}

/**
 * 挂载 DependencyEffectSlot 到 Fiber。
 *
 * 会替换 slot 的 run/dispose 逻辑，并把 renderer 结果经由统一 commit 边界写入
 * dependency 子树。
 *
 * @param fiber - dependency runtime 节点。
 * @param descriptor - 当前 dependency descriptor。
 * @param context - form 内部运行时上下文。
 * @param slot - 可复用的 slot，默认使用 fiber 上已有 slot 或创建新 slot。
 * @param scope - 可选资源作用域，默认创建 fiber 的子 scope。
 */
export function mountDependencyEffect<TValues extends Values = Values>(
  fiber: DependencyFiber<TValues>,
  descriptor: DependencyDescriptor<TValues>,
  context: SchemxFormContext<TValues>,
  slot = fiber.dependencySlot ?? createDependencyEffect(fiber),
  scope?: Scope
): void {
  slot.dispose()
  const resourceScope = scope ?? fiber.scope.child()

  fiber.dependencyResourceScope = resourceScope

  slot.run = async (): Promise<void> => {
    if (resourceScope.disposed) return

    const currentDescriptor = fiber.descriptor

    const currentVersion = slot.version.value + 1
    slot.version.value = currentVersion

    slot.abortController.value?.abort()
    const controller = new AbortController()
    slot.abortController.value = controller

    slot.loading.value = true
    slot.error.value = null

    try {
      const childSchemas = await context.scheduler.track(
        Promise.resolve(
          currentDescriptor.renderer(context.getFormApi(), controller.signal)
        )
      )

      if (
        resourceScope.disposed ||
        controller.signal.aborted ||
        currentVersion !== slot.version.value
      ) {
        return
      }

      const descriptors = compileToDescriptors<TValues>(
        childSchemas,
        context.defaultProps
      )

      context.commitChildren(fiber, descriptors)
    } catch (cause) {
      if (
        resourceScope.disposed ||
        controller.signal.aborted ||
        currentVersion !== slot.version.value
      ) {
        return
      }

      slot.error.value = normalizeError(cause)
    } finally {
      if (
        !resourceScope.disposed &&
        !controller.signal.aborted &&
        currentVersion === slot.version.value
      ) {
        slot.loading.value = false
      }
    }
  }

  slot.dispose = (): void => {
    slot.version.value += 1
    slot.abortController.value?.abort()
    resourceScope.dispose()
  }

  resourceScope.add(() => {
    slot.abortController.value?.abort()
    slot.abortController.value = null

    if (fiber.dependencySlot === slot) {
      fiber.dependencySlot = null
    }

    if (fiber.dependencyResourceScope === resourceScope) {
      fiber.dependencyResourceScope = null
    }
  })

  if (descriptor.trigger.length > 0) {
    setupTriggerSubscription(
      descriptor.trigger,
      context.getFormApi(),
      () => slot.run(),
      resourceScope
    )
  }

  fiber.dependencySlot = slot

  void slot.run().catch((runError) => {
    console.error("DependencyEffectSlot initial run error:", runError)
  })
}

/**
 * 设置 trigger 字段监听。
 */
function setupTriggerSubscription<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  triggers: TName[],
  formApi: SchemxFormApi<TValues>,
  run: () => Promise<void>,
  scope: { disposed: boolean; add: (cleanup: () => void) => void }
): void {
  let isFirstRun = true
  let pendingRun = false

  const disposeEffect = createSignalEffect(() => {
    void formApi.getValues(triggers)

    if (!isFirstRun && !pendingRun) {
      pendingRun = true

      queueMicrotask(() => {
        pendingRun = false

        if (scope.disposed) return

        run().catch((runError) => {
          console.error("DependencyEffectSlot trigger run error:", runError)
        })
      })
    }

    isFirstRun = false
  })

  scope.add(disposeEffect)
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
