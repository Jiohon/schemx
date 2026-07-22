export function createCachedRequest<T>(request: () => Promise<T>): () => Promise<T> {
  let cachedRequest: Promise<T> | undefined

  return () => {
    if (cachedRequest) {
      return cachedRequest
    }

    cachedRequest = request().catch((error: unknown) => {
      cachedRequest = undefined
      throw error
    })

    return cachedRequest
  }
}
