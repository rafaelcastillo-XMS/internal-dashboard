/** Bound report reads so one unavailable provider cannot hold the skeleton forever. */
export async function reportRequest<T>(request: PromiseLike<T>, timeoutMs = 45000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Report request timed out. Please retry.')), timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}
