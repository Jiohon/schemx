import { describe, expect, test, vi } from "vitest"

import { createCachedRequest } from "./createCachedRequest"

describe("createCachedRequest", () => {
  test("shares concurrent requests and reuses the successful promise", async () => {
    const result = { value: "success" }
    let resolveRequest!: (value: typeof result) => void
    const request = vi.fn(
      () =>
        new Promise<typeof result>((resolve) => {
          resolveRequest = resolve
        })
    )
    const cachedRequest = createCachedRequest(request)

    const first = cachedRequest()
    const second = cachedRequest()

    expect(request).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)

    resolveRequest(result)
    await expect(first).resolves.toBe(result)

    const third = cachedRequest()

    expect(request).toHaveBeenCalledTimes(1)
    expect(third).toBe(first)
    await expect(third).resolves.toBe(result)
  })

  test("retries after a failed request", async () => {
    const error = new Error("request failed")
    const result = { value: "success" }
    const request = vi
      .fn<() => Promise<typeof result>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(result)
    const cachedRequest = createCachedRequest(request)

    await expect(cachedRequest()).rejects.toBe(error)
    await expect(cachedRequest()).resolves.toBe(result)

    expect(request).toHaveBeenCalledTimes(2)
  })
})
