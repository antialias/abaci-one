/**
 * useAbacusScad — the plug pump's modular gate (Gitea #30, CP8 aftercare +
 * the side-text follow-up).
 *
 * The gate is anyTokens, which is modular-aware: side-rail/end-wall tokens
 * survive on snap-together columns (the scad renders them at ASSEMBLED
 * positions), while crossing-slot tokens are gated out. So a modular flip on
 * a crossing-only design must not just skip NEW plug renders — it must also
 * orphan the one in flight. The first manual studio pass caught the miss on
 * screen: flip to modular while the mono plug pass is still solving and the
 * stale result lands AFTER the clear, painting mono-pitch frame text across
 * the modular assembly. These tests drive the hook through fake workers to
 * pin that ordering (and that the gate doesn't overcorrect: mono delivery
 * still works, flipping back to mono re-renders the plug it just cleared,
 * and side tokens keep the pump posting in modular mode).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultParams, type Params } from '../abacus-model'
import { useAbacusScad } from '../useAbacusScad'

// The hook holds each worker behind a ref and only talks postMessage/onmessage,
// so a capturing stand-in is the whole contract. Construction order is pinned
// by the hook: instances[0] = main geometry, instances[1] = text-plug preview.
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((e: MessageEvent) => void) | null = null
  posted: Array<{ id: number; defines: string[] }> = []
  private listeners: Array<(e: MessageEvent) => void> = []

  constructor(_url: string | URL, _opts?: WorkerOptions) {
    FakeWorker.instances.push(this)
  }
  postMessage(msg: { id: number; defines: string[] }) {
    this.posted.push(msg)
  }
  addEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn)
  }
  removeEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn)
  }
  terminate() {}
  /** Complete a render from the worker's side. */
  emit(data: { id: number; ok: boolean; stl?: ArrayBuffer; ms?: number; error?: string }) {
    const e = { data } as MessageEvent
    this.onmessage?.(e)
    for (const fn of [...this.listeners]) fn(e)
  }
}

// edge_front is a seam-CROSSING slot: its tokens make anyTokens true in mono
// and false in modular, which is exactly what the orphan tests need. The aids
// must be OFF for that to hold — left on, they'd relocate to the side rails in
// modular and legitimately keep the pass alive. edge_left is the
// counter-fixture: an end-wall slot that survives the modular gate.
const blank: Params = { ...defaultParams, aid_10: 'off', aid_5: 'off', text_mode: 'inset' }
const mono: Params = { ...blank, edge_front: 'HI' }
const modular: Params = { ...mono, seam_mode: 'modular' }
const sideMono: Params = { ...blank, edge_left: 'HI' }
const sideModular: Params = { ...sideMono, seam_mode: 'modular' }

const plugWorker = () => FakeWorker.instances[1]

async function mount() {
  const onMain = vi.fn()
  const onPlug = vi.fn()
  const onReady = vi.fn()
  const view = renderHook(() => useAbacusScad({ onMain, onPlug, onReady }))
  await waitFor(() => expect(onReady).toHaveBeenCalled())
  return { ...view, onMain, onPlug }
}

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  // one text() for the scad, one arrayBuffer() per font — content is irrelevant,
  // the fake workers never parse it
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      text: async () => '// scad source',
      arrayBuffer: async () => new ArrayBuffer(8),
    }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAbacusScad plug pump', () => {
  it('delivers a completed mono plug render (the gate must not overcorrect)', async () => {
    const { result, onPlug } = await mount()
    result.current.render(mono)
    expect(plugWorker().posted).toHaveLength(1)
    expect(plugWorker().posted[0].defines).toContain('-Donly="text_plugs"')

    const stl = new ArrayBuffer(84)
    plugWorker().emit({ id: plugWorker().posted[0].id, ok: true, stl })
    expect(onPlug).toHaveBeenCalledWith(stl)
  })

  it('orphans an in-flight mono plug render when the design flips to modular', async () => {
    const { result, onPlug } = await mount()
    result.current.render(mono) // plug pass now in flight
    result.current.render(modular)
    expect(onPlug).toHaveBeenLastCalledWith(null)

    // the mono pass completes AFTER the flip — it must be dropped, not drawn
    plugWorker().emit({ id: plugWorker().posted[0].id, ok: true, stl: new ArrayBuffer(84) })
    expect(onPlug).toHaveBeenLastCalledWith(null)
    expect(onPlug.mock.calls.every(([v]) => v === null)).toBe(true)
  })

  it('re-renders the plug when flipping back to mono, same params or not', async () => {
    const { result, onPlug } = await mount()
    result.current.render(mono)
    plugWorker().emit({ id: plugWorker().posted[0].id, ok: true, stl: new ArrayBuffer(84) })

    result.current.render(modular)
    expect(onPlug).toHaveBeenLastCalledWith(null)

    // identical mono params as before: the clear wiped drawnKey, so the pump
    // must re-post instead of treating the cleared mesh as already drawn
    result.current.render(mono)
    expect(plugWorker().posted).toHaveLength(2)
  })

  it('side tokens keep the pump posting in modular mode — end modules print that text', async () => {
    const { result, onPlug } = await mount()
    result.current.render(sideModular)
    expect(plugWorker().posted).toHaveLength(1)
    expect(plugWorker().posted[0].defines).toContain('-Donly="text_plugs"')
    expect(plugWorker().posted[0].defines).toContain('-Dseam_mode="modular"')

    const stl = new ArrayBuffer(84)
    plugWorker().emit({ id: plugWorker().posted[0].id, ok: true, stl })
    expect(onPlug).toHaveBeenCalledWith(stl)
  })

  it('the mono→modular flip re-posts under the new key when the tokens survive', async () => {
    // seam_mode is a real geometry define, so the same words at the same slots
    // still need a fresh render (the plugs move to their assembled positions)
    const { result, onPlug } = await mount()
    result.current.render(sideMono)
    plugWorker().emit({ id: plugWorker().posted[0].id, ok: true, stl: new ArrayBuffer(84) })

    result.current.render(sideModular)
    expect(plugWorker().posted).toHaveLength(2)
    // no clear in between — the pass is still on, only repositioned
    expect(onPlug).not.toHaveBeenCalledWith(null)
    const stl = new ArrayBuffer(84)
    plugWorker().emit({ id: plugWorker().posted[1].id, ok: true, stl })
    expect(onPlug).toHaveBeenLastCalledWith(stl)
  })
})
