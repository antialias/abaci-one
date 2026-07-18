'use client'

// Abacus Studio — OpenSCAD-WASM render orchestration hook.
//
// Owns the two same-origin ES-module workers (main geometry + inset-text plug
// preview) and their latest-wins pumps, plus the one-time load of the .scad
// source and the two TTFs written into the worker's MEMFS /fonts (no font ships
// with the engine, so text() renders nothing without them). Results are handed
// back through imperative callbacks — the transferable STL ArrayBuffers never
// sit in React state, and all three.js mesh work stays in the viewer.
//
// Dedup keys off the DEFINES (not the whole params object): the myabacus color /
// filament knobs are JS-only (not sent to the scad), so a pure color tweak leaves
// the key unchanged and render() no-ops — the viewer recolors the existing mesh
// instead of paying a WASM solve.
//
// The worker + engine + fonts are the bench's verbatim, graduated into
// apps/web/public — "renders in the bench" == "renders here". No server-side
// OpenSCAD (that was the dead feature's fatal flaw); this is client WASM only.

import { useEffect, useRef } from 'react'
import { anyTokens, definesFrom, type Params } from './abacus-model'

const WORKER_URL = '/openscad/scad-worker.js'
const SCAD_URL = '/scad/abacus.scad'
const FONT_URLS = ['/fonts/DejaVuSans-Bold.ttf', '/fonts/NotoEmoji-Regular.ttf'] as const

const mainKeyOf = (p: Params): string => `${definesFrom(p).join('')}${p.fn}`

export type MainResult = { stl: ArrayBuffer; ms: number; id: number }
export type StatusUpdate = { text: string; error?: boolean }

export type UseAbacusScadArgs = {
  onMain: (res: MainResult) => void
  onPlug: (stl: ArrayBuffer | null) => void
  onStatus?: (s: StatusUpdate) => void
}

export type UseAbacusScad = {
  /** Request a render of `params`; latest-wins, and a no-op if the scad inputs
   *  are unchanged (color-only edits don't re-render). */
  render: (params: Params) => void
  /** Fire a one-shot high-quality ($fn=64) render for STL export. */
  exportStl: (params: Params, cb: (stl: ArrayBuffer) => void) => void
}

type Pump = {
  latest: Params | null
  latestKey: string
  drawnKey: string
  rendering: boolean
  reqId: number
  pending: { id: number; key: string } | null
}
const newPump = (): Pump => ({
  latest: null,
  latestKey: '',
  drawnKey: '',
  rendering: false,
  reqId: 0,
  pending: null,
})

export function useAbacusScad(args: UseAbacusScadArgs): UseAbacusScad {
  // keep the callbacks current without re-creating the workers
  const cbRef = useRef(args)
  cbRef.current = args

  const stateRef = useRef<{
    scad: string
    fonts: Record<string, Uint8Array>
    loaded: boolean
    worker: Worker | null
    plugWorker: Worker | null
    main: Pump
    plug: Pump
    pumpMain?: () => void
    pumpPlug?: () => void
  }>({
    scad: '',
    fonts: {},
    loaded: false,
    worker: null,
    plugWorker: null,
    main: newPump(),
    plug: newPump(),
  })

  useEffect(() => {
    const st = stateRef.current
    let disposed = false
    const renderFiles = () => ({ '/abacus.scad': st.scad, ...st.fonts })

    // ---- main geometry pump --------------------------------------------------
    function pumpMain() {
      const m = st.main
      if (m.rendering || !st.loaded || !m.latest || m.latestKey === m.drawnKey) return
      m.rendering = true
      const id = ++m.reqId
      m.pending = { id, key: m.latestKey }
      cbRef.current.onStatus?.({ text: `rendering #${id}…` })
      st.worker?.postMessage({
        id,
        entry: '/abacus.scad',
        files: renderFiles(),
        defines: definesFrom(m.latest),
        fn: m.latest.fn,
      })
    }

    // ---- inset text-plug pump (second worker; never blocks the main pump) ----
    function pumpPlug() {
      const pl = st.plug
      if (pl.rendering || !st.loaded || !pl.latest || pl.latestKey === pl.drawnKey) return
      pl.rendering = true
      const id = ++pl.reqId
      pl.pending = { id, key: pl.latestKey }
      st.plugWorker?.postMessage({
        id,
        entry: '/abacus.scad',
        files: renderFiles(),
        defines: [...definesFrom(pl.latest), '-Donly="text_plugs"'],
        fn: pl.latest.fn,
      })
    }

    const worker = new Worker(WORKER_URL, { type: 'module' })
    const plugWorker = new Worker(WORKER_URL, { type: 'module' })
    st.worker = worker
    st.plugWorker = plugWorker

    worker.onmessage = (e: MessageEvent) => {
      const { id, ok, stl, ms, error } = e.data
      const m = st.main
      m.rendering = false
      if (m.pending && id === m.pending.id) {
        if (ok) {
          cbRef.current.onMain({ stl: stl as ArrayBuffer, ms, id })
          m.drawnKey = m.pending.key
          cbRef.current.onStatus?.({ text: `#${id}  ${ms}ms` })
        } else {
          cbRef.current.onStatus?.({ text: `#${id} FAILED\n${error}`, error: true })
          // count failures as drawn so a scad assert doesn't re-post forever
          m.drawnKey = m.pending.key
        }
      }
      pumpMain()
    }
    plugWorker.onmessage = (e: MessageEvent) => {
      const { id, ok, stl } = e.data
      const pl = st.plug
      pl.rendering = false
      if (pl.pending && id === pl.pending.id) {
        if (ok) cbRef.current.onPlug(stl as ArrayBuffer)
        // count failures as drawn too — the main pump already surfaces the error
        pl.drawnKey = pl.pending.key
      }
      pumpPlug()
    }

    // ---- one-time load of the scad source + fonts ----------------------------
    ;(async () => {
      cbRef.current.onStatus?.({ text: 'loading abacus.scad + fonts…' })
      try {
        const [scad, ...fontBufs] = await Promise.all([
          fetch(SCAD_URL).then((r) => r.text()),
          ...FONT_URLS.map((u) => fetch(u).then((r) => r.arrayBuffer())),
        ])
        if (disposed) return
        st.scad = scad
        // the public URLs (/fonts/…) double as the absolute MEMFS paths
        FONT_URLS.forEach((u, i) => {
          st.fonts[u] = new Uint8Array(fontBufs[i])
        })
        st.loaded = true
        pumpMain()
        pumpPlug()
      } catch (err) {
        if (!disposed)
          cbRef.current.onStatus?.({
            text: `failed to load harness assets: ${String((err as Error)?.message ?? err)}`,
            error: true,
          })
      }
    })()

    st.pumpMain = pumpMain
    st.pumpPlug = pumpPlug

    return () => {
      disposed = true
      worker.terminate()
      plugWorker.terminate()
      st.worker = null
      st.plugWorker = null
      st.pumpMain = undefined
      st.pumpPlug = undefined
    }
    // workers are created once for the component's lifetime (deps intentionally
    // empty; biome's useExhaustiveDependencies is off for this repo)
  }, [])

  const render = (params: Params): void => {
    const st = stateRef.current
    const key = mainKeyOf(params)
    st.main.latest = params
    st.main.latestKey = key
    st.pumpMain?.()
    if (params.text_mode === 'inset' && anyTokens(params)) {
      st.plug.latest = params
      st.plug.latestKey = key
      st.pumpPlug?.()
    } else {
      st.plug.latest = null
      st.plug.latestKey = ''
      st.plug.drawnKey = ''
      cbRef.current.onPlug(null)
    }
  }

  const exportStl = (params: Params, cb: (stl: ArrayBuffer) => void): void => {
    const st = stateRef.current
    if (!st.worker || !st.loaded) return
    const id = -1 - Math.floor(performance.now()) // negative id: outside the pump's stream
    const onceHandler = (e: MessageEvent) => {
      if (e.data.id !== id) return
      st.worker?.removeEventListener('message', onceHandler)
      if (e.data.ok) cb(e.data.stl as ArrayBuffer)
    }
    st.worker.addEventListener('message', onceHandler)
    st.worker.postMessage({
      id,
      entry: '/abacus.scad',
      files: { '/abacus.scad': st.scad, ...st.fonts },
      defines: definesFrom(params),
      fn: 64,
    })
  }

  return { render, exportStl }
}
