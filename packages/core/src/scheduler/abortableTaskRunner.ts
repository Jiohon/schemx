import type { Scope } from "../node"
import type { Scheduler } from "./scheduler"

export interface AbortableTaskRunner<TValue = void> {
  run(): Promise<TValue | undefined>
  dispose(): void
}

export interface AbortableTaskRunnerOptions<TValue = void> {
  scope: Scope
  scheduler: Scheduler
  run(signal: AbortSignal): Promise<TValue> | TValue
  onStart?(controller: AbortController): void
  onSuccess?(value: TValue): void
  onError?(error: Error): void
  onSettled?(): void
  throwOnError?: boolean
}

export function createAbortableTaskRunner<TValue = void>(
  options: AbortableTaskRunnerOptions<TValue>
): AbortableTaskRunner<TValue> {
  const ownScope = options.scope.child()

  let version = 0
  let controller: AbortController | null = null

  const isStale = (
    currentVersion: number,
    currentController: AbortController
  ): boolean => {
    return (
      ownScope.disposed ||
      currentController.signal.aborted ||
      currentVersion !== version
    )
  }

  const runCurrentTask = async (
    currentVersion: number,
    currentController: AbortController
  ): Promise<TValue | undefined> => {
    try {
      const value = await options.run(currentController.signal)

      if (isStale(currentVersion, currentController)) {
        return value
      }

      options.onSuccess?.(value)
      options.onSettled?.()

      return value
    } catch (cause) {
      const error = normalizeError(cause)

      if (isStale(currentVersion, currentController)) {
        if (options.throwOnError) {
          throw error
        }

        return
      }

      options.onError?.(error)
      options.onSettled?.()

      if (options.throwOnError) {
        throw error
      }
    }
  }

  const run = async (): Promise<TValue | undefined> => {
    if (ownScope.disposed) {
      return
    }

    const currentVersion = ++version
    controller?.abort()
    controller = new AbortController()
    options.onStart?.(controller)

    return await options.scheduler.track(runCurrentTask(currentVersion, controller))
  }

  const dispose = (): void => {
    version += 1
    controller?.abort()
    ownScope.dispose()
  }

  options.scope.add(dispose)

  return {
    run,
    dispose,
  }
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
