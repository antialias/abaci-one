'use client'

// Abacus Studio — live parametric viewer (Gitea epic #5, Phase 0 #6).
//
// Vanilla three.js in a mount effect (the app's R3F dep is React-18-pinned and
// unused; this is the first real three consumer). It consumes useAbacusScad for
// client-side OpenSCAD-WASM renders and reproduces the bench's imperative
// pipeline: parse the binary STL → union-find its shells → recolor per the
// myabacus scheme quantized onto the AMS filament slots, plus the floating ArUco
// corner overlay and the second-pass inset-text plug preview. No server-side
// OpenSCAD — client WASM only.
//
// Full-bleed CP1a: this is now JUST the canvas + status HUD. All design/print
// controls live in the docked rails (DesignInspectorRail / FabricationRail); the
// shared state + derivations live in the studio store. The viewer keeps only the
// three.js/worker-bound pieces — the live-mirror refs, the mount-once scene, the
// redraw effects — and publishes its worker-bound STL exporter into the store so
// the fabrication rail's Export buttons can drive it.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useAbacusStudio } from './AbacusStudioContext'
import {
  analyzeShells,
  COLOR_PALETTES,
  frameW,
  MARKER_BITS,
  nearestSlot,
  outerD,
  type ShellInfo,
  shellHex,
  shellRoleKey,
  tokenCenters,
} from './abacus-model'
import { type StatusUpdate, useAbacusScad } from './useAbacusScad'

type DrawApi = {
  /** parse + shell-classify + recolor a fresh geometry STL; returns tri count */
  swapMesh: (stl: ArrayBuffer) => number
  swapPlug: (stl: ArrayBuffer) => void
  clearPlug: () => void
  /** cheap: recenter + rebuild markers + recolor existing mesh (no WASM) */
  applyParams: () => void
}

export function AbacusStudioViewer() {
  // Only the three.js/worker-bound slice of the shared studio store: the design +
  // the filament projection the mount-once closures mirror, plus the export/reveal
  // registrars. Every control that edits these lives in the docked rails.
  //
  // Reality-first: the model previews what will actually PRINT — the design's
  // colors quantized onto the loaded filaments (`filamentMap`). Hovering a tile's
  // true-color fleck in the reconcile strip momentarily flips the whole model to
  // the user's designed colors; the strip pokes `registerRevealIntrinsic` (below).
  const {
    params,
    design,
    filamentMap,
    registerExportStl,
    registerRevealIntrinsic,
    registerHighlightRole,
  } = useAbacusStudio()

  // live mirrors read by the mount-once three.js closures (which can't re-close
  // over changing state). Kept in lockstep with the store on every render.
  const paramsRef = useRef(params)
  paramsRef.current = params
  const designRef = useRef(design)
  designRef.current = design
  const filamentMapRef = useRef(filamentMap)
  filamentMapRef.current = filamentMap
  // transient hover lens: true → show the user's INTRINSIC colors instead of the
  // filament projection. Set imperatively (not React state) so a hover never
  // re-renders the studio tree; the reveal handle below flips it + repaints.
  const revealIntrinsicRef = useRef(false)
  // transient highlight lens: a role key whose part stays opaque while every other
  // addressable shell goes translucent (x-ray, Gitea #17). Set imperatively (like
  // reveal) so a mapping-row hover never re-renders the tree. The label + "did it
  // actually light a shell?" feed the hero caption; both are refs so the caption
  // paints imperatively too (no re-render, no redundant WASM render).
  const highlightRoleRef = useRef<string | null>(null)
  const highlightLabelRef = useRef<string | null>(null)
  const highlightMatchRef = useRef(false)
  // the hero caption DOM node — announces the print-preview default at rest and
  // names what a hover is emphasizing; updated imperatively via paintCaption below.
  const captionRef = useRef<HTMLDivElement | null>(null)

  const [status, setStatus] = useState<StatusUpdate>({ text: 'booting…' })
  const [meta, setMeta] = useState<{ ms?: number; tris?: number }>({})
  const mountRef = useRef<HTMLDivElement | null>(null)
  const drawRef = useRef<DrawApi | null>(null)

  // paint the hero caption from the current hover lenses (all refs) — no React
  // state, so it composes with the imperative reveal/highlight handles without a
  // re-render. Reveal (designed colors) wins over emphasis; emphasis shows only when
  // the role really lit a part (marker/text rows match no shell → resting announce).
  const paintCaption = useCallback(() => {
    const el = captionRef.current
    if (!el) return
    const revealing = revealIntrinsicRef.current
    const label = highlightLabelRef.current
    const emphasizing = !revealing && label != null && highlightMatchRef.current
    const active = revealing || emphasizing
    el.textContent = revealing
      ? 'Your designed colors'
      : emphasizing
        ? `Emphasizing ${label}`
        : 'Print preview · hover a swatch for your design'
    el.dataset.active = active ? 'true' : 'false'
    el.style.color = active ? '#e6faff' : 'rgba(148,163,184,0.92)'
    el.style.background = active ? 'rgba(8,22,30,0.85)' : 'rgba(17,24,39,0.7)'
    el.style.borderColor = active ? 'rgba(103,232,249,0.5)' : 'rgba(148,163,184,0.18)'
    el.style.boxShadow = active ? '0 2px 14px rgba(6,182,212,0.22)' : 'none'
  }, [])

  const scad = useAbacusScad({
    onMain: ({ stl, ms }) => {
      const tris = drawRef.current?.swapMesh(stl) ?? 0
      setMeta({ ms, tris })
    },
    onPlug: (stl) => {
      if (stl) drawRef.current?.swapPlug(stl)
      else drawRef.current?.clearPlug()
    },
    onStatus: (s) => setStatus(s),
  })
  // keep the latest scad reachable from the once-registered exporter without
  // re-registering each render (scad.exportStl itself reads a stable stateRef).
  const scadRef = useRef(scad)
  scadRef.current = scad

  // ---- three.js scene (mount once) ------------------------------------------
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w0 = mount.clientWidth || 800
    const h0 = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x15181c)

    const camera = new THREE.PerspectiveCamera(45, w0 / h0, 1, 5000)
    camera.position.set(40, 150, 220)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x333340, 1.1))
    // key = HEADLAMP: repositioned to the camera every frame so orbiting under
    // the model lights the underside (feet dovetails hide under a fixed key).
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(80, 200, 120)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xaac4ff, 0.5)
    fill.position.set(-120, 60, -80)
    scene.add(fill)

    // model group: rotate model-Z (up) to view-Y (up); centered group holds the
    // meshes and shifts them so the frame straddles the origin.
    const model = new THREE.Group()
    model.rotation.x = -Math.PI / 2
    scene.add(model)
    const centered = new THREE.Group()
    model.add(centered)
    scene.add(new THREE.GridHelper(400, 20, 0x223344, 0x1a2233).translateY(-0.1))

    const _c = new THREE.Color()
    const stlLoader = new STLLoader()

    // ---- parametric render mesh ---------------------------------------------
    const renderMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
    // x-ray companion (Gitea #17): while a mapping row is hovered, its part renders
    // opaque with renderMat and every OTHER shell renders with this — translucent
    // and depth-write-free, so the emphasized part reads THROUGH the rest instead of
    // the whole board darkening. Same vertex colors; opacity is the only change
    // (tunable). Paired per-triangle via geometry groups in recolor().
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
    let renderMesh: THREE.Mesh | null = null
    let triShell: Int32Array | null = null
    let shellInfo: ShellInfo[] = []
    // true while a row highlight is x-raying the model — read by plugRecolor so the
    // inset text ghosts along with its beads instead of floating solid over them.
    let xrayOn = false

    const recenter = () =>
      centered.position.set(-frameW(paramsRef.current) / 2, -outerD(paramsRef.current) / 2, 0)
    recenter()

    function recolor() {
      const p = paramsRef.current
      if (!renderMesh || !triShell) return
      const ts = triShell
      const geo = renderMesh.geometry
      const nVert = geo.attributes.position.count
      // Reality-first: default to what actually PRINTS — the design's colors
      // QUANTIZED onto the loaded filaments (shellHex over the filament map). While
      // a strip fleck is hovered, `fm` goes null and we fall back to the user's
      // INTRINSIC colors (their on-screen abacus). Columns are keyed by place value
      // (ones = index 0); shellInfo.i counts left→right, so place value = cols-1-i.
      const fm = revealIntrinsicRef.current ? null : filamentMapRef.current
      const rc = designRef.current.resolvedColors
      // row→hero highlight (Gitea #17): while a mapping row is hovered, its part
      // stays opaque and every OTHER addressable shell goes translucent (x-ray, via
      // the two-material split below) so the emphasized part reads through the rest.
      // Independent of the reveal lens, so hovering a row's tile can BOTH flip the
      // model to designed colors AND single out that part. A role that resolves to
      // no shell (marker/text — no addressable geometry) leaves the model untouched.
      // Colors themselves never change here — only which material a shell draws with.
      const active = highlightRoleRef.current
      const anyMatch = active != null && shellInfo.some((info) => shellRoleKey(info, p) === active)
      highlightMatchRef.current = anyMatch
      const shellRGB = shellInfo.map((info) => {
        let hex: string
        if (fm) {
          hex = shellHex(info, p, fm)
        } else if (info.isFrame) {
          hex = rc.frame
        } else {
          const col = rc.columns[p.cols - 1 - info.i]
          hex = (info.isHeaven ? col?.heaven : col?.earth) ?? rc.frame
        }
        _c.set(hex)
        return [_c.r, _c.g, _c.b] as const
      })
      const colors = new Float32Array(nVert * 3)
      for (let t = 0; t < ts.length; t++) {
        const rgb = shellRGB[ts[t]] ?? ([1, 0.6, 0.24] as const)
        for (let c = 0; c < 3; c++) {
          const o = (t * 3 + c) * 3
          colors[o] = rgb[0]
          colors[o + 1] = rgb[1]
          colors[o + 2] = rgb[2]
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      // x-ray split: coalesce consecutive same-status triangles into geometry groups
      // — matching shells → material 0 (opaque renderMat), the rest → material 1
      // (translucent ghostMat, depth-write-free so the emphasized part shows through).
      // No highlight → one opaque material, no groups (single-draw fast path).
      geo.clearGroups()
      if (anyMatch) {
        const matchOf = (tri: number): boolean => {
          const info = shellInfo[ts[tri]]
          return info ? shellRoleKey(info, p) === active : false
        }
        let start = 0
        let cur = matchOf(0)
        for (let t = 1; t < ts.length; t++) {
          const m = matchOf(t)
          if (m !== cur) {
            geo.addGroup(start * 3, (t - start) * 3, cur ? 0 : 1)
            start = t
            cur = m
          }
        }
        geo.addGroup(start * 3, (ts.length - start) * 3, cur ? 0 : 1)
        renderMesh.material = [renderMat, ghostMat]
      } else {
        renderMesh.material = renderMat
      }
      xrayOn = anyMatch
      plugRecolor()
    }

    function swapMesh(stl: ArrayBuffer): number {
      const geo = stlLoader.parse(stl)
      geo.computeVertexNormals()
      if (renderMesh) {
        renderMesh.geometry.dispose()
        renderMesh.geometry = geo
      } else {
        renderMesh = new THREE.Mesh(geo, renderMat)
        centered.add(renderMesh)
      }
      const a = analyzeShells(geo.attributes.position.array as ArrayLike<number>, paramsRef.current)
      triShell = a.triShell
      shellInfo = a.shellInfo
      recolor()
      return geo.attributes.position.count / 3
    }

    // ---- ArUco corner marker overlay ----------------------------------------
    // The STL carries only the marker pockets (flush 2-color plugs weld into the
    // frame shell — color() is inert on binstl). Preview the b/w pattern as
    // texture quads floated on the top face, from the same js-aruco2 bits the
    // scad models and the abaci.one detector reads.
    const markerGroup = new THREE.Group()
    centered.add(markerGroup)

    const markerTexture = (
      bits: string,
      k: number,
      trim: { u: number; R: number; T: number } | null,
      white: string,
      black: string
    ): THREE.CanvasTexture => {
      const px = 32
      const cv = document.createElement('canvas')
      cv.width = 9 * px
      cv.height = 9 * px
      const g = cv.getContext('2d')
      if (!g) return new THREE.CanvasTexture(cv)
      g.fillStyle = white
      g.fillRect(0, 0, 9 * px, 9 * px) // quiet ring
      g.fillStyle = black
      g.fillRect(px, px, 7 * px, 7 * px) // border ring
      g.fillStyle = white
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
          if (bits[y * 5 + x] === '1') g.fillRect((2 + x) * px, (2 + y) * px, px, px)
      if (trim) {
        const ppm = (9 * px) / trim.T
        const u = trim.u * ppm
        const R = trim.R * ppm
        const t = Math.sqrt(Math.max(0, R * R - u * u))
        const M = [
          [1, 0, 0, 1, 0, 0], // TL
          [-1, 0, 0, 1, 9 * px, 0], // TR
          [-1, 0, 0, -1, 9 * px, 9 * px], // BR
          [1, 0, 0, -1, 0, 9 * px], // BL
        ][k]
        g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5])
        g.globalCompositeOperation = 'destination-out'
        g.beginPath()
        g.moveTo(0, u - t)
        g.arc(u, u, R, Math.atan2(-t, -u), Math.atan2(-u, -t), false)
        g.lineTo(0, 0)
        g.closePath()
        g.fill()
        g.setTransform(1, 0, 0, 1, 0, 0)
        g.globalCompositeOperation = 'source-over'
      }
      const tx = new THREE.CanvasTexture(cv)
      tx.magFilter = THREE.NearestFilter
      tx.colorSpace = THREE.SRGBColorSpace
      return tx
    }

    function updateMarkers() {
      const p = paramsRef.current
      for (const child of markerGroup.children) {
        const m = child as THREE.Mesh
        m.geometry.dispose()
        const mat = m.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      }
      markerGroup.clear()
      markerGroup.visible = p.show_markers
      if (!p.show_markers) return
      const S = p.scale_factor
      const ch = Math.min(p.top_chamfer, p.frame_h * S * 0.4)
      const r = p.corner_r * S
      const q = p.marker_mm / 9
      const inset = Math.max(0, ch, r <= 0 ? 0 : r - (r - ch) / Math.SQRT2 - q)
      const c = inset + p.marker_mm / 2
      const W = frameW(p)
      const D = outerD(p)
      const z = p.frame_h * S + 0.05
      const pos: [number, number][] = [
        [c, D - c], // TL
        [W - c, D - c], // TR
        [W - c, c], // BR
        [c, c], // BL
      ]
      const u = r - inset
      const R = r - ch
      const trim = R > 0 && u > R / Math.SQRT2 ? { u, R, T: p.marker_mm } : null
      // markers are black/white CV fiducials: reality-first shows the actual
      // filaments they snap to (whose contrast the plan warns about when it drops
      // below the camera's floor); the intrinsic-reveal hover shows the ideal pair.
      const fm = revealIntrinsicRef.current ? null : filamentMapRef.current
      const white = fm ? fm.slots[fm.markerWhite] : '#ffffff'
      const black = fm ? fm.slots[fm.markerBlack] : '#000000'
      pos.forEach(([x, y], k) => {
        const quad = new THREE.Mesh(
          new THREE.PlaneGeometry(p.marker_mm, p.marker_mm),
          new THREE.MeshBasicMaterial({
            map: markerTexture(MARKER_BITS[k], k, trim, white, black),
            transparent: true,
          })
        )
        quad.position.set(x, y, z)
        markerGroup.add(quad)
      })
    }

    // ---- inset text-plug preview (second WASM pass) -------------------------
    const plugMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    })
    // ghost twin for the inlay text — same polygon offset so it still floats above
    // the frame, but translucent, so text x-rays with its beads during a row
    // highlight instead of leaving solid numbers hanging over ghosted beads.
    const plugGhostMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
    let plugMesh: THREE.Mesh | null = null
    let plugTriTok: Int32Array | null = null

    function plugRecolor() {
      if (!plugMesh || !plugTriTok) return
      const p = paramsRef.current
      // reality-first: the inlay ink snaps to the nearest loaded filament by
      // default; the intrinsic-reveal hover shows the intended ink (rainbow palette
      // or the single text color) unquantized.
      const fm = revealIntrinsicRef.current ? null : filamentMapRef.current
      const pal = COLOR_PALETTES[p.color_palette] ?? COLOR_PALETTES.default
      const geo = plugMesh.geometry
      const colors = new Float32Array(geo.attributes.position.count * 3)
      const cache = new Map<number, readonly [number, number, number]>()
      for (let t = 0; t < plugTriTok.length; t++) {
        const k = plugTriTok[t]
        let rgb = cache.get(k)
        if (!rgb) {
          const intended = p.text_fill === 'rainbow' ? pal[k % 5] : p.text_color
          _c.set(fm ? fm.slots[nearestSlot(fm.slots, intended)] : intended)
          rgb = [_c.r, _c.g, _c.b] as const
          cache.set(k, rgb)
        }
        for (let c = 0; c < 3; c++) {
          const o = (t * 3 + c) * 3
          colors[o] = rgb[0]
          colors[o + 1] = rgb[1]
          colors[o + 2] = rgb[2]
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      plugMesh.material = xrayOn ? plugGhostMat : plugMat
    }

    function swapPlug(stl: ArrayBuffer) {
      const geo = stlLoader.parse(stl)
      geo.computeVertexNormals()
      const centers = tokenCenters(paramsRef.current)
      const pos = geo.attributes.position.array as ArrayLike<number>
      const nTri = (pos.length / 9) | 0
      plugTriTok = new Int32Array(nTri)
      for (let t = 0; t < nTri; t++) {
        let cx = 0
        let cy = 0
        let cz = 0
        for (let c = 0; c < 3; c++) {
          const o = (t * 3 + c) * 3
          cx += pos[o]
          cy += pos[o + 1]
          cz += pos[o + 2]
        }
        cx /= 3
        cy /= 3
        cz /= 3
        let bk = 0
        let bd = Number.POSITIVE_INFINITY
        for (const tc of centers) {
          const dd = (cx - tc.x) ** 2 + (cy - tc.y) ** 2 + (cz - tc.z) ** 2
          if (dd < bd) {
            bd = dd
            bk = tc.k
          }
        }
        plugTriTok[t] = bk
      }
      if (plugMesh) {
        plugMesh.geometry.dispose()
        plugMesh.geometry = geo
      } else {
        plugMesh = new THREE.Mesh(geo, plugMat)
        centered.add(plugMesh)
      }
      plugRecolor()
    }

    function clearPlug() {
      if (!plugMesh) return
      centered.remove(plugMesh)
      plugMesh.geometry.dispose()
      plugMesh = null
      plugTriTok = null
    }

    // publish the imperative API to the hook callbacks + the params effect
    drawRef.current = {
      swapMesh,
      swapPlug,
      clearPlug,
      applyParams: () => {
        recenter()
        updateMarkers()
        recolor()
      },
    }
    updateMarkers()

    // ---- resize + animation loop --------------------------------------------
    const onResize = () => {
      const w = mount.clientWidth || w0
      const h = mount.clientHeight || h0
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      controls.update()
      key.position.copy(camera.position) // headlamp
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderMesh?.geometry.dispose()
      renderMat.dispose()
      ghostMat.dispose()
      plugMesh?.geometry.dispose()
      plugMat.dispose()
      plugGhostMat.dispose()
      for (const child of markerGroup.children) {
        const m = child as THREE.Mesh
        m.geometry.dispose()
        const mat = m.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      }
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      drawRef.current = null
    }
  }, [])

  // ---- react to param edits: cheap redraw + (deduped) WASM re-render --------
  useEffect(() => {
    drawRef.current?.applyParams()
    scad.render(params)
  }, [params, scad])

  // editing the filament mapping (a pin, or new spools) is geometry-free: the
  // default filament projection changed, so recolor without a WASM re-render.
  // filamentMap also changes on every param edit, so the param effect above
  // harmlessly dedupes the overlap.
  useEffect(() => {
    drawRef.current?.applyParams()
  }, [filamentMap])

  // publish the worker-bound STL exporter into the store so the fabrication rail's
  // Export buttons + the print panel can trigger a one-shot high-quality render.
  // Registered once (scad.exportStl reads a stable ref); torn down on unmount so
  // the store's exporterReady flips back to false on the paper lane.
  useEffect(() => {
    registerExportStl(
      () =>
        new Promise<ArrayBuffer>((resolve) => scadRef.current.exportStl(paramsRef.current, resolve))
    )
    return () => registerExportStl(null)
  }, [registerExportStl])

  // publish the hover-reveal handle: the reconcile strip flips the model to the
  // user's designed colors while a true-color fleck is hovered. Imperative (flip a
  // ref + repaint) so a hover never re-renders the studio tree.
  useEffect(() => {
    registerRevealIntrinsic((v: boolean) => {
      revealIntrinsicRef.current = v
      drawRef.current?.applyParams()
      paintCaption()
    })
    return () => registerRevealIntrinsic(null)
  }, [registerRevealIntrinsic, paintCaption])

  // publish the row→hero highlight handle: a mapping row hover singles out its part
  // on the model and x-rays the rest, and captions what's emphasized on the hero.
  // Imperative (set refs + repaint) so the hover never re-renders the studio tree,
  // same as the reveal handle above. applyParams runs recolor first, which sets
  // highlightMatchRef (did the role light a shell?) — so paintCaption right after
  // never claims to emphasize a marker/text role that has no geometry.
  useEffect(() => {
    registerHighlightRole((k: string | null, label?: string | null) => {
      highlightRoleRef.current = k
      highlightLabelRef.current = label ?? null
      drawRef.current?.applyParams()
      paintCaption()
    })
    return () => registerHighlightRole(null)
  }, [registerHighlightRole, paintCaption])

  return (
    <div
      data-component="abacus-studio-viewer"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div
        ref={mountRef}
        data-element="abacus-studio-canvas"
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />

      {/* emphasis caption: announces the print-preview default and names what a hover
          is emphasizing (Gitea #17). Painted imperatively by paintCaption so a hover
          never re-renders the tree — initial text/styles match paintCaption's resting
          branch. */}
      <div
        ref={captionRef}
        data-element="abacus-studio-emphasis-caption"
        data-active="false"
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'calc(100% - 24px)',
          padding: '5px 12px',
          borderRadius: 999,
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'rgba(17,24,39,0.7)',
          color: 'rgba(148,163,184,0.92)',
          font: '12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          letterSpacing: 0.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          transition: 'color 120ms, background 120ms, border-color 120ms, box-shadow 120ms',
          zIndex: 2,
        }}
      >
        Print preview · hover a swatch for your design
      </div>

      {/* status HUD */}
      <div
        data-element="abacus-studio-hud"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(17,24,39,0.82)',
          color: status.error ? '#ff7b72' : 'rgba(209,213,219,0.95)',
          font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre-wrap',
          maxWidth: 'calc(100% - 24px)',
          pointerEvents: 'none',
        }}
      >
        {status.text}
        {meta.tris != null && !status.error
          ? `  ·  ${meta.tris.toLocaleString()} tris  ·  clearance ${params.clearance}mm`
          : ''}
      </div>
    </div>
  )
}
