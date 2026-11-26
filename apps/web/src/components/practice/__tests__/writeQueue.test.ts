import { describe, expect, it, vi } from 'vitest'
import { createWriteQueue } from '../writeQueue'

/** A write whose settling the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createWriteQueue', () => {
  it('runs writes one at a time, in submit order', async () => {
    const queue = createWriteQueue(() => {})
    const order: string[] = []
    const first = deferred<string>()
    const a = queue.enqueue(() => {
      order.push('a')
      return first.promise
    })
    const b = queue.enqueue(async () => {
      order.push('b')
      return 'b'
    })
    await Promise.resolve()
    expect(order).toEqual(['a']) // b waits for a
    first.resolve('a')
    expect(await a).toBe('a')
    expect(await b).toBe('b')
    expect(order).toEqual(['a', 'b'])
  })

  it('drops the writes queued behind a failure and signals a resync once', async () => {
    const onFailure = vi.fn()
    const queue = createWriteQueue(onFailure)
    const failing = deferred<string>()
    const later = vi.fn(async () => 'later')

    const a = queue.enqueue(() => failing.promise)
    const b = queue.enqueue(later)
    const c = queue.enqueue(later)
    failing.reject(new Error('409'))

    await expect(a).rejects.toThrow('409')
    expect(await b).toBeUndefined()
    expect(await c).toBeUndefined()
    expect(later).not.toHaveBeenCalled()
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('runs writes enqueued after the failure', async () => {
    const queue = createWriteQueue(() => {})
    await expect(queue.enqueue(async () => Promise.reject(new Error('boom')))).rejects.toThrow()
    expect(await queue.enqueue(async () => 'next')).toBe('next')
  })
})
