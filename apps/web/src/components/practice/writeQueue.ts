/**
 * Serializes a session's server writes (answers, do-overs) in submit order.
 *
 * The screen advances optimistically, so writes queued behind one that fails
 * were built on a plan the server never reached. When a write fails, every
 * write already queued behind it is dropped (resolves to `undefined` without
 * running) and `onFailure` fires once, so the caller can resync to the
 * server. Writes queued after the failure run normally. The queue itself never
 * retries: a try write's one immediate resend (same tryId, on a network error or
 * 5xx) happens inside the write (`sendTryWrite` in `useSessionPlan.ts`), so the
 * queue sees one write that either landed or failed after its resend.
 */
export interface WriteQueue {
  enqueue<T>(write: () => Promise<T>): Promise<T | undefined>
}

export function createWriteQueue(onFailure: (error: unknown) => void): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve()
  let generation = 0

  return {
    enqueue<T>(write: () => Promise<T>): Promise<T | undefined> {
      const enqueuedIn = generation
      const run = tail.then(async () => {
        if (enqueuedIn !== generation) return undefined
        try {
          return await write()
        } catch (error) {
          generation += 1
          onFailure(error)
          throw error
        }
      })
      tail = run.catch(() => undefined)
      return run
    },
  }
}
