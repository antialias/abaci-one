/**
 * On-demand clip generations in flight on this pod, deduped by storage path,
 * with spend charged once per real upstream request.
 *
 * The door bills a request in full even when the caller aborts it, so the
 * on-demand route doesn't abort: it waits SPEECH_TIMEOUT_MS.onDemandWait for
 * the child (then answers 504 so the voice chain falls to subtitles), while
 * the upstream request runs on under its own longer limit and writes the
 * cache file when it lands. Plays of the same clip meanwhile join the
 * generation already running instead of paying for another.
 */
import { type GenerationBudget, onDemandSpeechBudget } from './generationBudget'

export type Admission =
  | { kind: 'started' | 'joined'; done: Promise<Buffer> }
  | { kind: 'refused'; scope: 'identity' | 'pod' }

export class OnDemandGenerations {
  private inflight = new Map<string, Promise<Buffer>>()

  constructor(private readonly budget: GenerationBudget) {}

  /**
   * Join the generation running for `key`, or charge the budget and start
   * `run` (which must write the cache file before resolving). Synchronous up
   * to `run`'s first await, so a caller that checked the disk just before
   * can't race another caller into a second upstream request.
   */
  admit(key: string, identity: string, chars: number, run: () => Promise<Buffer>): Admission {
    const running = this.inflight.get(key)
    if (running) return { kind: 'joined', done: running }

    const decision = this.budget.tryConsume(identity, chars)
    if (!decision.ok) return { kind: 'refused', scope: decision.scope }

    const done = run().finally(() => this.inflight.delete(key))
    // Nobody may be waiting when it settles (every caller timed out).
    done.catch((err) => console.error('[generate-clip] background generation failed:', err))
    this.inflight.set(key, done)
    return { kind: 'started', done }
  }

  get inFlight(): number {
    return this.inflight.size
  }
}

/** Resolve with the value if `p` settles within `ms`; `{ done: false }` otherwise. Rejections pass through. */
export async function waitAtMost<T>(
  p: Promise<T>,
  ms: number
): Promise<{ done: true; value: T } | { done: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ done: false }>((resolve) => {
    timer = setTimeout(() => resolve({ done: false }), ms)
  })
  try {
    return await Promise.race([p.then((value) => ({ done: true as const, value })), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** The pod's on-demand generations. */
export const onDemandGenerations = new OnDemandGenerations(onDemandSpeechBudget)
