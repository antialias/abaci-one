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

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { STUDIO } from '@/components/studio/theme'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { useAbacusStudio } from './AbacusStudioContext'
import { type Motion, modulePose, planMotion, sampleMotion } from './abacus-assembly-motion'
import {
  analyzeShells,
  COLOR_PALETTES,
  EXPLODE_GAP,
  emphasisCaption,
  FEET_ROLE_KEY,
  feetEffective,
  feetPositions,
  frameW,
  isModular,
  MARKER_BITS,
  markersFollowFrameGhost,
  moduleAtX,
  moduleFeetStuds,
  moduleOriginX,
  moduleWidth,
  outerD,
  type Params,
  type ShellInfo,
  shellHex,
  shellRoleKey,
  sideTextGroups,
  textGroupCount,
  tokenCenters,
  tokGroup,
  triModule,
  type XrayGroup,
  xrayGroups,
} from './abacus-model'
import {
  type ModuleRange,
  partitionTriangles,
  permuteInt32,
  permuteTriangles,
} from './abacus-module-partition'
import { type StatusUpdate, useAbacusScad } from './useAbacusScad'

// x-ray opacity for the ghosted (non-emphasized) parts during a row highlight — the
// beads, the inset text, and the marker decals all fade to this while one role stays
// opaque (Gitea #17). One tuning knob so the three ghosts stay in lockstep.
const XRAY_OPACITY = 0.14

// The hero's glass chrome (pills, caption, HUD) — one palette, from theme.ts.
const CANVAS = STUDIO.color.canvas

// The canvas pill (mock-up `.pill` / `.pill.on`) — shared by the two assembly
// controls so "Take it apart" and "Replay" cannot drift apart. `dim` is the
// while-a-play-runs state: aria-disabled + faded, never the `disabled`
// attribute (a disabled control is invisible to hover and touch, and this one
// is unavailable for ~1 s, not broken).
const canvasPill = (on: boolean, dim: boolean): CSSProperties => ({
  padding: '5px 12px',
  borderRadius: STUDIO.radius.pill,
  border: `1px solid ${on ? CANVAS.chromeBorderOn : STUDIO.color.border}`,
  background: on ? CANVAS.chromeOn : CANVAS.chrome,
  color: on ? CANVAS.textOn : STUDIO.color.text2,
  font: '12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif',
  fontWeight: 600,
  letterSpacing: 0.2,
  cursor: dim ? 'default' : 'pointer',
  opacity: dim ? 0.55 : 1,
  backdropFilter: 'blur(6px)',
  boxShadow: on ? STUDIO.shadow.canvasOn : 'none',
  transition: 'color 120ms, background 120ms, border-color 120ms, box-shadow 120ms, opacity 120ms',
})

type DrawApi = {
  /** parse + shell-classify + recolor a fresh geometry STL; returns tri count */
  swapMesh: (stl: ArrayBuffer) => number
  swapPlug: (stl: ArrayBuffer) => void
  clearPlug: () => void
  /** cheap: recenter + rebuild markers + recolor existing mesh (no WASM) */
  applyParams: () => void
  /** Pose the modular chain INSTANTLY: 1 = seated, 0 = fully taken apart. A pure
   *  group transform — no re-render, no WASM, no React state per frame. Cancels
   *  any play in flight. */
  setAssembled: (v: number) => void
  /** Play the assembly timeline from the current pose to `to` (1 = seated,
   *  0 = apart) along each joint's real path. Jumps under reduced motion. */
  animateTo: (to: number) => void
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
    registerExporter,
    registerRevealIntrinsic,
    registerHighlightRole,
    pickModelRole,
  } = useAbacusStudio()

  // live mirrors read by the mount-once three.js closures (which can't re-close
  // over changing state). Kept in lockstep with the store on every render.
  const paramsRef = useRef(params)
  paramsRef.current = params
  const designRef = useRef(design)
  designRef.current = design
  const filamentMapRef = useRef(filamentMap)
  filamentMapRef.current = filamentMap
  // hero→row pick emitter (Gitea #18), mirrored so the mount-once scene effect can
  // call the latest without re-running. pickModelRole is a stable useCallback anyway.
  const pickRef = useRef(pickModelRole)
  pickRef.current = pickModelRole
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

  // The render readout is developer instrumentation, not product: it only paints
  // when visual debug is on (Ctrl+Shift+D / ?debug=1). With the flag off the HUD
  // keeps two things every user needs: that a render is in flight (`busy`, or the
  // grid sits empty for seconds with no account of why) and that one FAILED.
  const { isVisualDebugEnabled: showHud } = useVisualDebugSafe()

  const [status, setStatus] = useState<StatusUpdate>({ text: 'booting…', busy: 'loading' })
  const [meta, setMeta] = useState<{ ms?: number; tris?: number }>({})
  // "take it apart" toggle: pure VIEW state, never a Param — it stays out of
  // snapshots, content hashes and every export.
  const [exploded, setExploded] = useState(false)
  // …and the two bits of state the ASSEMBLY PLAY needs on the React side, both
  // written at most twice per play (never per frame): `moving` dims the pills
  // while the modules are in flight, `playedOnce` is what makes Replay appear
  // (an offer to watch it again, not a control that pre-dates the first play).
  const [moving, setMoving] = useState(false)
  const [playedOnce, setPlayedOnce] = useState(false)
  // ...and it no longer reaches the renderer AT ALL. The scad's explode knob is a
  // pure per-module translation (module i sits at x0(i) + i·explode and nothing
  // else changes), so the exploded soup IS the seated soup with each module
  // shifted — which means a modular design can be rendered exploded ONCE and
  // posed in JS. The viewer splits that soup per module and slides the groups, so
  // the toggle is a transform, not a re-render, and a modular design costs
  // exactly as many WASM renders as the seated view always did.
  const explodeRender = isModular(params) ? EXPLODE_GAP : 0
  // mirrored for the mount-once three.js closures (the pose, the shell
  // classifier, the feet studs), same pattern as paramsRef above.
  const explodeRef = useRef(0)
  explodeRef.current = explodeRender
  const mountRef = useRef<HTMLDivElement | null>(null)
  const drawRef = useRef<DrawApi | null>(null)

  // paint the hero caption from the current hover lenses (all refs) — no React
  // state, so it composes with the imperative reveal/highlight handles without a
  // re-render. Reveal (designed colors) wins over emphasis; emphasis shows only when
  // the role really lit a part (marker/text rows match no shell → resting announce).
  const paintCaption = useCallback(() => {
    const el = captionRef.current
    if (!el) return
    const { text, active } = emphasisCaption(
      revealIntrinsicRef.current,
      highlightLabelRef.current,
      highlightMatchRef.current
    )
    el.textContent = text
    el.dataset.active = active ? 'true' : 'false'
    el.style.color = active ? CANVAS.textOn : STUDIO.color.muted
    el.style.background = active ? CANVAS.chromeOn : CANVAS.chrome
    el.style.borderColor = active ? CANVAS.chromeBorderOn : STUDIO.color.border
    el.style.boxShadow = active ? STUDIO.shadow.canvasOn : 'none'
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
      opacity: XRAY_OPACITY,
      depthWrite: false,
    })
    // ONE shared set of geometry attributes for the whole abacus, with one
    // BufferGeometry + Mesh per MODULE over it, each carrying only its own draw
    // range and parented to its own group. (three's non-indexed raycast honours
    // drawRange and still reports an ABSOLUTE faceIndex — Mesh.js:297-310 — so
    // the global per-triangle tables below keep working unchanged.)
    let moduleMeshes: THREE.Mesh[] = []
    let moduleGeos: THREE.BufferGeometry[] = []
    let moduleRanges: ModuleRange[] = []
    // triShell/shellInfo stay GLOBAL over the (permuted) soup, so recolor and
    // picking remain one flat pass across every module exactly as they were when
    // the abacus was a single mesh.
    let triShell: Int32Array | null = null
    let shellInfo: ShellInfo[] = []
    // true while a row highlight is x-raying the model — read by plugRecolor so the
    // inset text ghosts along with its beads instead of floating solid over them.
    let xrayOn = false

    // ---- per-module groups + the assembly pose ------------------------------
    // The modular STL is always the EXPLODED chain, so a module group's LOCAL
    // frame is the exploded render's frame: seated pulls group i back by
    // i·EXPLODE_GAP, taken apart leaves it at 0. Everything that belongs to a
    // module — its slab, its beads, its feet studs, its share of the inset-text
    // overlay — lives in that group and rides along for free. Mono has exactly
    // one group and it never moves.
    // The pool only grows: dropping a column leaves an empty group parked.
    const moduleGroups: THREE.Group[] = []
    const groupFor = (i: number): THREE.Group => {
      while (moduleGroups.length <= i) {
        const g = new THREE.Group()
        centered.add(g)
        moduleGroups.push(g)
      }
      return moduleGroups[i]
    }
    // 1 = seated, 0 = fully taken apart. A plain object, not React state, so the
    // animation can drive it per frame without re-rendering the studio tree.
    const pose = { assembled: 1 }

    // Pose every module group and recentre on the chain's TRUE X extent.
    // Mid-play the modules are NOT evenly spread — they seat from the anchor
    // outward with a stagger — so the only honest centre is the one measured
    // from where the modules actually are this frame. Module 0 is the anchor at
    // x = 0, so the extent is [0, max right edge]: seated that is exactly
    // frameW (a modular design centres where a mono one does), fully apart it is
    // frameW + (cols-1)·gap, and everything between falls out of the same sum.
    // The joint path itself lives in abacus-assembly-motion (pure + tested);
    // this is only the three.js binding.
    // derived() is not memoized and the pose reads it once per module per frame,
    // so cache what the pose needs against the params OBJECT (the store hands out
    // a new one on every edit). `explodedRight[i]` is module i's right edge in the
    // render's own coordinates; add the module's current x offset and the largest
    // one is the chain's right edge this frame.
    let poseGeomFor: Params | null = null
    let poseGeom = { dims: { gap: 0, depth: 0 }, explodedRight: [] as number[], frameW: 0 }
    const poseGeometry = (p: Params) => {
      if (poseGeomFor === p) return poseGeom
      const gap = explodeRef.current
      const explodedRight: number[] = []
      for (let i = 0; i < p.cols; i++)
        explodedRight.push(moduleOriginX(p, i, gap) + moduleWidth(p, i))
      poseGeom = { dims: { gap, depth: outerD(p) }, explodedRight, frameW: frameW(p) }
      poseGeomFor = p
      return poseGeom
    }
    const applyPose = () => {
      const p = paramsRef.current
      const { dims, explodedRight, frameW: fw } = poseGeometry(p)
      if (dims.gap === 0) {
        // mono: one group, and it never moves
        for (const g of moduleGroups) g.position.set(0, 0, 0)
        centered.position.set(-fw / 2, -dims.depth / 2, 0)
        return
      }
      let right = 0
      for (let i = 0; i < moduleGroups.length; i++) {
        const q = modulePose(p.joint_type, i, p.cols, pose.assembled, dims)
        moduleGroups[i].position.set(q.x, q.y, q.z)
        if (i < p.cols) right = Math.max(right, explodedRight[i] + q.x)
      }
      centered.position.set(-right / 2, -dims.depth / 2, 0)
    }
    applyPose()

    // ---- the assembly timeline ----------------------------------------------
    // One play at a time, advanced by the rAF loop at the bottom of this effect.
    // `pose.assembled` is a plain number in this closure, so a play costs ZERO
    // React renders: only its start and its end flip the pill's own state.
    let motion: Motion | null = null
    const reducedMotion = () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const endMotion = () => {
      motion = null
      setMoving(false)
    }
    const animateTo = (to: number) => {
      if (!motion && to === pose.assembled) return
      const m = planMotion(pose.assembled, to, paramsRef.current.cols, {
        now: performance.now(),
        reducedMotion: reducedMotion(),
      })
      // reduced motion (and mono) → 0 ms: land the end pose now, never start a
      // play, never touch React state.
      if (m.durationMs <= 0) {
        if (motion) endMotion()
        pose.assembled = to
        applyPose()
        return
      }
      motion = m
      setMoving(true)
    }

    function recolor() {
      const p = paramsRef.current
      if (!triShell || moduleGeos.length === 0) return
      const ts = triShell
      const nVert = ts.length * 3
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
      // per-shell match for the emphasized role (null when no row is hovered). Reused
      // below to expand into the per-triangle mask the x-ray split coalesces, so the
      // role→shellRoleKey scan runs once per shell, not once per triangle.
      const active = highlightRoleRef.current
      const shellMatch =
        active != null ? shellInfo.map((info) => shellRoleKey(info, p) === active) : null
      const anyMatch = shellMatch?.some(Boolean) ?? false
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
      // one colour attribute, shared by every module geometry (they share the
      // position attribute too — the whole point of the permuted soup)
      const colorAttr = new THREE.BufferAttribute(colors, 3)
      for (const g of moduleGeos) g.setAttribute('color', colorAttr)

      // x-ray split: expand the per-shell match to a per-triangle mask, coalesce into
      // geometry groups — matching triangles → material 0 (opaque renderMat), the rest
      // → material 1 (translucent ghostMat, depth-write-free so the emphasized part
      // shows through). No highlight → one opaque material, no groups (single-draw).
      // The groups are ABSOLUTE indices into the shared buffer, so each module
      // takes only the slice that overlaps its own draw range — the renderer and
      // the raycaster would clip them anyway, but pruning here keeps the draw
      // call count proportional to the geometry instead of to cols·groups.
      let groups: XrayGroup[] | null = null
      if (anyMatch && shellMatch) {
        const mask = new Array<boolean>(ts.length)
        for (let t = 0; t < ts.length; t++) mask[t] = shellMatch[ts[t]] ?? false
        groups = xrayGroups(mask)
      }
      moduleGeos.forEach((g, i) => {
        g.clearGroups()
        if (!groups) return
        const lo = moduleRanges[i].start * 3
        const hi = lo + moduleRanges[i].count * 3
        for (const gr of groups) {
          const s0 = Math.max(gr.start, lo)
          const e0 = Math.min(gr.start + gr.count, hi)
          if (e0 > s0) g.addGroup(s0, e0 - s0, gr.materialIndex)
        }
      })
      for (const m of moduleMeshes) m.material = groups ? [renderMat, ghostMat] : renderMat
      xrayOn = anyMatch
      plugRecolor()
    }

    function disposeModuleMeshes() {
      for (const m of moduleMeshes) m.parent?.remove(m)
      // The module geometries SHARE their attributes, so they have to be disposed
      // together: three frees an attribute's GPU buffer with the first geometry
      // that references it (WebGLGeometries.onGeometryDispose), which would leave
      // any survivor drawing from a deleted buffer.
      for (const g of moduleGeos) g.dispose()
      moduleMeshes = []
      moduleGeos = []
    }

    function swapMesh(stl: ArrayBuffer): number {
      const p = paramsRef.current
      const src = stlLoader.parse(stl)
      const raw = src.attributes.position.array as ArrayLike<number>
      // In modular mode this soup is the EXPLODED chain, so every module is a
      // disjoint set of shells and the partition is exact rather than a guess.
      const a = analyzeShells(raw, p, explodeRef.current)
      const modules = isModular(p) ? p.cols : 1
      const { order, ranges } = partitionTriangles(triModule(a), modules)
      const positions = permuteTriangles(raw, order)
      triShell = permuteInt32(a.triShell, order)
      shellInfo = a.shellInfo
      moduleRanges = ranges
      src.dispose()

      disposeModuleMeshes()
      const posAttr = new THREE.BufferAttribute(positions, 3)
      // normals are computed ONCE over the whole soup (computeVertexNormals
      // ignores drawRange) and shared, like the positions
      let normAttr: THREE.BufferAttribute | null = null
      for (let i = 0; i < ranges.length; i++) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', posAttr)
        if (normAttr) geo.setAttribute('normal', normAttr)
        else {
          geo.computeVertexNormals()
          normAttr = geo.attributes.normal as THREE.BufferAttribute
        }
        geo.setDrawRange(ranges[i].start * 3, ranges[i].count * 3)
        // the bounding sphere covers the WHOLE shared buffer, not this module's
        // slice — conservative, so frustum culling and the raycast broad phase
        // stay correct; they just do a little more work than they could.
        const mesh = new THREE.Mesh(geo, renderMat)
        groupFor(i).add(mesh)
        moduleGeos.push(geo)
        moduleMeshes.push(mesh)
      }
      applyPose()
      recolor()
      return order.length
    }

    // ---- ArUco corner marker overlay ----------------------------------------
    // The MAIN STL carries only the marker pockets (flush 2-color plugs weld into
    // the frame shell — color() is inert on binstl). Preview the b/w pattern as
    // texture quads floated on the top face, from the same js-aruco2 bits the
    // scad models and the abaci.one detector reads. The EXPORT gets the real
    // plugs: separate `only="marker_*"` part renders merged into the 3MF as
    // their own filament bodies (abacus-3mf.ts, Gitea #12).
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
      // No marker decals in modular mode: phase 1 ships engraved pockets on the
      // end modules, not printed markers — decals would advertise fiducials the
      // kit doesn't deliver (and their corner math is the mono frame's anyway).
      const on = p.show_markers && !isModular(p)
      markerGroup.visible = on
      if (!on) return
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
      const white = fm ? fm.slots[fm.markerWhite] : '#ffffff' // theme-guard: allow — canvas-2D fillStyle for the marker CanvasTexture
      const black = fm ? fm.slots[fm.markerBlack] : '#000000' // theme-guard: allow — canvas-2D fillStyle for the marker CanvasTexture
      // markers are decals on the frame's top face — fade them with the frame during
      // an x-ray (Gitea #17) so they don't hang solid over a ghosted board. xrayOn is
      // fresh here: applyParams runs recolor (which sets it) before updateMarkers.
      const ghosted = markersFollowFrameGhost(xrayOn, highlightRoleRef.current)
      pos.forEach(([x, y], k) => {
        const quad = new THREE.Mesh(
          new THREE.PlaneGeometry(p.marker_mm, p.marker_mm),
          new THREE.MeshBasicMaterial({
            map: markerTexture(MARKER_BITS[k], k, trim, white, black),
            transparent: true,
            opacity: ghosted ? XRAY_OPACITY : 1,
            depthWrite: !ghosted,
          })
        )
        quad.position.set(x, y, z)
        markerGroup.add(quad)
      })
    }

    // ---- printed-feet stud preview (Gitea #23) -------------------------------
    // The MAIN STL never carries feet (the scad emits them only via the part
    // passes — `only="feet"` on a monolith, `only="module_*_feet"` per module —
    // so analyzeShells can't mis-classify studs as beads); preview them as
    // mouth-diameter studs at the positions the matching pass would emit.
    // The studs deliberately dip below the z=0 grid — the print stands on its
    // feet, and showing them buried would hide the whole point of the feature.
    // Studs are NOT one group any more: each one is parented to its own module's
    // group, so a modular kit's feet stay under their module through the whole
    // pose instead of hanging over an opened seam. Held in a flat list so
    // disposal stays exact-once wherever they ended up.
    const feetMeshes: THREE.Mesh[] = []
    // Studs share a solid per FOOT CLASS — one on a monolith, two on a modular
    // design (the mid modules' smaller class beside the mono corner foot) — so
    // the geometries are keyed by mouth and the material is shared by all of
    // them. Held here (not walked off the children) so disposal is exact-once
    // and the unmount teardown can reuse it.
    const feetGeos = new Map<number, THREE.BufferGeometry>()
    let feetMat: THREE.Material | null = null

    function disposeFeet() {
      for (const m of feetMeshes) m.parent?.remove(m)
      feetMeshes.length = 0
      for (const geo of feetGeos.values()) geo.dispose()
      feetGeos.clear()
      feetMat?.dispose()
      feetMat = null
    }

    function updateFeet() {
      const p = paramsRef.current
      disposeFeet()
      const on = p.feet_mode === 'printed' && p.show_frame
      if (!on) return
      const fx = feetEffective(p)
      // The stud spans z ∈ [−proud, depthEff] at the MOUTH section. The real foot
      // flares to `seat` at depth and carries the crossbar slot, but all of that
      // is buried inside the pocket — the only part anyone can see is the straight
      // mouth-section stand-off below the bottom face, which this matches exactly.
      // (It is also why a mid module's rotated crossbar needs nothing here: the
      // only thing that varies above the bottom face is the mouth.)
      const h = fx.proud + fx.depthEff
      const geoFor = (mouth: number): THREE.BufferGeometry => {
        const hit = feetGeos.get(mouth)
        if (hit) return hit
        const geo =
          p.feet_shape === 'square'
            ? new THREE.BoxGeometry(mouth, mouth, h)
            : new THREE.CylinderGeometry(mouth / 2, mouth / 2, h, 32).rotateX(Math.PI / 2)
        feetGeos.set(mouth, geo)
        return geo
      }
      // reality-first: the studs wear the feet role's mapped spool, falling back
      // to the frame slot exactly like planToFilamentMap's no-TPU fallback; the
      // intrinsic-reveal hover shows the plan's designed feet hex instead.
      const fm = revealIntrinsicRef.current ? null : filamentMapRef.current
      const hex = fm ? fm.slots[fm.feet ?? fm.frame] : '#1f2937' // three.js
      // feet are their own filament role, so they ghost with the rest of the
      // board unless the feet row itself is the emphasis. xrayOn is fresh here:
      // applyParams runs recolor before updateFeet (same contract as markers).
      const ghosted = xrayOn && highlightRoleRef.current !== FEET_ROLE_KEY
      feetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.55,
        metalness: 0.05,
        transparent: ghosted,
        opacity: ghosted ? XRAY_OPACITY : 1,
        depthWrite: !ghosted,
      })
      // A modular kit's feet are its modules' own (two per module, mid ones in
      // the smaller class beside the seam socket) — NOT the monolith's, whose
      // intermediate pairs don't exist once every seam lands a foot.
      // ...and they ride the take-it-apart gap with their own module, which is
      // why the explode is read here and not baked into a seated layout.
      const studs = isModular(p)
        ? moduleFeetStuds(p, explodeRef.current)
        : feetPositions(p).map(([x, y]) => ({ x, y, mouth: fx.mouth }))
      for (const { x, y, mouth } of studs) {
        const stud = new THREE.Mesh(geoFor(mouth), feetMat)
        stud.position.set(x, y, (fx.depthEff - fx.proud) / 2)
        // moduleFeetStuds already rides the gap, so these are EXPLODED
        // coordinates — which is exactly the local frame of the module group the
        // stud belongs in. Mono resolves to module 0, the group that never moves.
        groupFor(moduleAtX(p, x, explodeRef.current)).add(stud)
        feetMeshes.push(stud)
      }
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
      opacity: XRAY_OPACITY,
      depthWrite: false,
    })
    // Same shape as the main mesh: one shared attribute set, one draw-ranged
    // geometry per module, each mesh inside its module's group.
    let plugMeshes: THREE.Mesh[] = []
    let plugGeos: THREE.BufferGeometry[] = []
    let plugTriTok: Int32Array | null = null

    function plugRecolor() {
      if (!plugTriTok || plugGeos.length === 0) return
      const p = paramsRef.current
      // reality-first: the inlay ink snaps to the nearest loaded filament by
      // default; the intrinsic-reveal hover shows the intended ink (rainbow palette
      // or the single text color) unquantized.
      const fm = revealIntrinsicRef.current ? null : filamentMapRef.current
      const pal = COLOR_PALETTES[p.color_palette] ?? COLOR_PALETTES.default
      const colors = new Float32Array(plugTriTok.length * 9)
      const cache = new Map<number, readonly [number, number, number]>()
      for (let t = 0; t < plugTriTok.length; t++) {
        const k = plugTriTok[t]
        let rgb = cache.get(k)
        if (!rgb) {
          const g = tokGroup(p, k)
          const intended = p.text_fill === 'rainbow' ? pal[g] : p.text_color
          // The PLAN owns which spool this group's ink prints from (Gitea #26) —
          // it snaps inside the frame's material family and honors pins, neither
          // of which a local nearest-color match here would know about. Reading
          // its slot is what keeps the preview honest about the plate.
          const slot = fm?.textRoles?.[g]
          _c.set(fm && slot !== undefined ? fm.slots[slot] : intended)
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
      const colorAttr = new THREE.BufferAttribute(colors, 3)
      for (const g of plugGeos) g.setAttribute('color', colorAttr)
      for (const m of plugMeshes) m.material = xrayOn ? plugGhostMat : plugMat
    }

    function swapPlug(stl: ArrayBuffer) {
      const p = paramsRef.current
      const src = stlLoader.parse(stl)
      const centers = tokenCenters(p)
      const pos = src.attributes.position.array as ArrayLike<number>
      const nTri = (pos.length / 9) | 0
      // text_plugs always renders SEATED, so a token belongs to whichever
      // module's SEATED x range holds it. Membership is decided per TOKEN, not
      // per triangle, so a letter sitting over a seam stays whole with one module
      // instead of tearing in half the moment the chain opens.
      const tokModule = centers.map((tc) => moduleAtX(p, tc.x, 0))
      const tok = new Int32Array(nTri)
      const mod = new Int32Array(nTri)
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
        let bi = -1
        let bd = Number.POSITIVE_INFINITY
        centers.forEach((tc, i) => {
          const dd = (cx - tc.x) ** 2 + (cy - tc.y) ** 2 + (cz - tc.z) ** 2
          if (dd < bd) {
            bd = dd
            bi = i
          }
        })
        tok[t] = bi < 0 ? 0 : centers[bi].k
        mod[t] = bi < 0 ? 0 : tokModule[bi]
      }
      const modules = isModular(p) ? p.cols : 1
      const { order, ranges } = partitionTriangles(mod, modules)
      const positions = permuteTriangles(pos, order)
      const permutedTok = permuteInt32(tok, order)
      src.dispose()

      clearPlug()
      plugTriTok = permutedTok
      const posAttr = new THREE.BufferAttribute(positions, 3)
      let normAttr: THREE.BufferAttribute | null = null
      for (let i = 0; i < ranges.length; i++) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', posAttr)
        if (normAttr) geo.setAttribute('normal', normAttr)
        else {
          geo.computeVertexNormals()
          normAttr = geo.attributes.normal as THREE.BufferAttribute
        }
        geo.setDrawRange(ranges[i].start * 3, ranges[i].count * 3)
        const mesh = new THREE.Mesh(geo, plugMat)
        // the plug soup is in SEATED coordinates and the group frame is the
        // EXPLODED render's, so each piece carries the offset back the other way
        mesh.position.x = i * explodeRef.current
        groupFor(i).add(mesh)
        plugGeos.push(geo)
        plugMeshes.push(mesh)
      }
      plugRecolor()
    }

    function clearPlug() {
      for (const m of plugMeshes) m.parent?.remove(m)
      // shared attributes again: dispose the whole set or none of it
      for (const g of plugGeos) g.dispose()
      plugMeshes = []
      plugGeos = []
      plugTriTok = null
    }

    // publish the imperative API to the hook callbacks + the params effect
    drawRef.current = {
      swapMesh,
      swapPlug,
      clearPlug,
      setAssembled: (v: number) => {
        // the geometry on screen is ALREADY the taken-apart chain, so both poses
        // are the same triangles under a different group transform
        if (motion) endMotion()
        pose.assembled = v
        applyPose()
      },
      animateTo,
      applyParams: () => {
        applyPose()
        // recolor first: it sets xrayOn, which updateMarkers/updateFeet read to
        // fade with the board during an x-ray (Gitea #17). recolor never touches
        // the markers or the feet studs, so the swap is safe.
        recolor()
        updateMarkers()
        updateFeet()
      },
    }
    updateMarkers()
    updateFeet()

    // ---- hero→row picking (Gitea #18) ---------------------------------------
    // Click a bead/frame on the model → open its filament row. Raycast renderMesh
    // (beads + frame) on a press that ISN'T an orbit drag, map the hit triangle to
    // its shell → role key (the exact key the mapping rows carry, via shellRoleKey),
    // and emit it. Markers/inset text have no addressable shell here, so a miss is a
    // silent no-op. The intrinsic-reveal/x-ray lenses don't affect hit-testing —
    // the raycaster reads geometry, not material opacity.
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downX = 0
    let downY = 0
    let downT = 0
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
      downT = e.timeStamp
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return // primary button only (right/middle = orbit/pan)
      // reject orbit drags: only a short, near-stationary press reads as a pick
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
      if (e.timeStamp - downT > 500) return
      if (moduleMeshes.length === 0 || !triShell) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      // nearest hit across every module mesh (intersectObjects sorts by
      // distance). Each group carries its own transform, so the hit is already
      // in world space — no pose bookkeeping here.
      const hit = raycaster.intersectObjects(moduleMeshes, false)[0]
      if (hit?.faceIndex == null) return // clicked empty space / grid
      // faceIndex is ABSOLUTE over the shared position buffer: three clamps the
      // scan to the geometry's drawRange but still numbers triangles globally
      // (three/src/objects/Mesh.js — `faceIndex = Math.floor(i / 3)`), so it
      // indexes the permuted triShell directly.
      const shell = shellInfo[triShell[hit.faceIndex]]
      if (!shell) return
      pickRef.current?.(shellRoleKey(shell, paramsRef.current))
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

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
      if (motion) {
        // the global timeline advances linearly; every ease, the stagger and the
        // detent live in modulePose, so this stays one lerp and a group write.
        const { s, done } = sampleMotion(motion, performance.now())
        pose.assembled = s
        applyPose()
        if (done) endMotion()
      }
      controls.update()
      key.position.copy(camera.position) // headlamp
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      disposeModuleMeshes()
      renderMat.dispose()
      ghostMat.dispose()
      clearPlug()
      plugMat.dispose()
      plugGhostMat.dispose()
      for (const child of markerGroup.children) {
        const m = child as THREE.Mesh
        m.geometry.dispose()
        const mat = m.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      }
      disposeFeet()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      drawRef.current = null
    }
  }, [])

  // ---- react to param edits: cheap redraw + (deduped) WASM re-render --------
  // explodeRender is a function of PARAMS alone (modular → EXPLODE_GAP), never of
  // the toggle — so this effect fires exactly when it always did, and the "take
  // it apart" pill never reaches the renderer. mainKeyOf still keys on explode,
  // so a mono↔modular flip re-renders as before.
  useEffect(() => {
    drawRef.current?.applyParams()
    scad.render(params, explodeRender)
  }, [params, scad])

  // ...and the pose follows the pill — as a PLAY along each joint's real path
  // (rear slide + detent, or drop + snap), not a jump: the chain on screen is
  // already the taken-apart geometry, so the whole animation is per-frame group
  // transforms in the rAF loop. React state drives only the pill's label,
  // aria-pressed and dimming; `s` itself never round-trips through React.
  // On mount this runs with the pose already seated and animateTo no-ops.
  // Crossing the mobile breakpoint remounts the viewer: the scene rebuilds
  // seated and `exploded` resets to false at the same time, so the two can't
  // drift — the pose is simply lost, which is what a remount means.
  useEffect(() => {
    drawRef.current?.animateTo(exploded ? 0 : 1)
  }, [exploded])

  // editing the filament mapping (a pin, or new spools) is geometry-free: the
  // default filament projection changed, so recolor without a WASM re-render.
  // filamentMap also changes on every param edit, so the param effect above
  // harmlessly dedupes the overlap.
  useEffect(() => {
    drawRef.current?.applyParams()
  }, [filamentMap])

  // publish the worker-bound exporter into the store so the fabrication rail's
  // Export buttons + the print panel can trigger the one-shot high-quality
  // renders. `exportParts` snapshots params ONCE for all the renders (frame +
  // the two ArUco marker part passes + the feet pass + one inlay-text pass per
  // color group) — a knob drag mid-export can therefore never mix a frame from
  // one design with parts from another.
  // The part passes are gated on that same snapshot: the part must be on, and
  // the frame must be rendered (the scad's `only=` selectors emit parts
  // unconditionally — without a frame the plugs would be four floating plates,
  // the feet six floating studs, and the text a swarm of loose letters).
  // Registered once (scad.exportStl reads a stable ref); torn down on unmount so
  // the store's exporterReady flips back to false on the paper lane.
  useEffect(() => {
    registerExporter({
      // The plain colorless STL ships without plugs, so retention pockets
      // would only be dirt-trap recesses under every letter — force them off.
      // exportParts (the 3MF path, below) keeps the user's params untouched.
      exportStl: () => scadRef.current.exportStl({ ...paramsRef.current, text_retention: false }),
      exportParts: async () => {
        const p = paramsRef.current
        const withMarkers = p.show_markers && p.show_frame
        const withFeet = p.feet_mode === 'printed' && p.show_frame
        // one render per ink group, each filtered by -Dplug_group. Single-fill
        // text is one unfiltered-equivalent pass; rainbow costs up to five.
        const groups = p.text_mode === 'inset' && p.show_frame ? textGroupCount(p) : 0
        const [stl, markerBlack, markerWhite, feet, ...textStls] = await Promise.all([
          scadRef.current.exportStl(p),
          withMarkers ? scadRef.current.exportStl(p, { only: 'marker_black' }) : null,
          withMarkers ? scadRef.current.exportStl(p, { only: 'marker_white' }) : null,
          withFeet ? scadRef.current.exportStl(p, { only: 'feet' }) : null,
          ...Array.from({ length: groups }, (_, g) =>
            scadRef.current.exportStl(p, { only: 'text_plugs', group: g })
          ),
        ])
        const textPlugs = textStls.map((stl, g) => ({ group: g, stl: stl as ArrayBuffer }))
        return { stl, markerBlack, markerWhite, feet, textPlugs, params: p }
      },
      // The modular kit's bundle (Gitea #30): three module bodies + their feet
      // passes + per-side inset-text passes, under the same snapshot-once
      // contract as exportParts — a knob drag mid-export can never mix module
      // geometries from different designs.
      // Feet gate matches exportParts' feet pass (and the scad's module_*_feet
      // asserts fire per pass, so an unprintable-feet design fails loudly here,
      // not silently at the slicer).
      // Text passes fan out per SIDE: the end modules partition the plate's
      // ink groups (sideTextGroups), so each side renders only the groups its
      // own rail + wall carry — same -Dplug_group vocabulary as the mono pass.
      exportModuleParts: async () => {
        const p = paramsRef.current
        const withFeet = p.feet_mode === 'printed' && p.show_frame
        const withText = p.text_mode === 'inset' && p.show_frame
        const leftGroups = withText ? sideTextGroups(p, 'left') : []
        const rightGroups = withText ? sideTextGroups(p, 'right') : []
        const [left, mid, right, leftFeet, midFeet, rightFeet, ...textStls] = await Promise.all([
          scadRef.current.exportStl(p, { only: 'module_left' }),
          scadRef.current.exportStl(p, { only: 'module_mid' }),
          scadRef.current.exportStl(p, { only: 'module_right' }),
          withFeet ? scadRef.current.exportStl(p, { only: 'module_left_feet' }) : null,
          withFeet ? scadRef.current.exportStl(p, { only: 'module_mid_feet' }) : null,
          withFeet ? scadRef.current.exportStl(p, { only: 'module_right_feet' }) : null,
          ...leftGroups.map((g) =>
            scadRef.current.exportStl(p, { only: 'module_left_text', group: g })
          ),
          ...rightGroups.map((g) =>
            scadRef.current.exportStl(p, { only: 'module_right_text', group: g })
          ),
        ])
        const leftText = leftGroups.map((g, i) => ({
          group: g,
          stl: textStls[i] as ArrayBuffer,
        }))
        const rightText = rightGroups.map((g, i) => ({
          group: g,
          stl: textStls[leftGroups.length + i] as ArrayBuffer,
        }))
        return { left, mid, right, leftFeet, midFeet, rightFeet, leftText, rightText, params: p }
      },
      // Generic single-pass escape hatch (seam coupon download, bench parts).
      // Reads the live params at call time — single-render downloads only;
      // anything multi-render belongs in a snapshotting bundle above.
      exportPass: (pass) => scadRef.current.exportStl(paramsRef.current, pass),
    })
    return () => registerExporter(null)
  }, [registerExporter])

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
          borderRadius: STUDIO.radius.pill,
          border: `1px solid ${STUDIO.color.border}`,
          background: CANVAS.chrome,
          color: STUDIO.color.muted,
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

      {/* the assembly controls (modular mode only): the modules come apart along
          the path they'd really take — a sliding dovetail backs out the rear and
          slides home with a detent, a snap seam lifts and drops onto its clips —
          so the joint faces are inspectable, and HOW the thing goes together is
          shown rather than described. View-only: exports, snapshots and the kit
          always stay seated, and the model never re-renders (the play is a
          per-module group transform on geometry that is already on screen). */}
      {isModular(params) && (
        <div
          data-element="abacus-studio-canvas-pills"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            // stacked, not side by side: the hero caption is centred on the SAME
            // top edge, and a two-pill row runs into it as soon as the canvas is
            // narrow (rails open at 1280). Down has room at every width.
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            data-element="abacus-studio-explode-toggle"
            data-action="toggle-explode"
            aria-pressed={exploded}
            aria-disabled={moving}
            onClick={() => {
              if (moving) return
              setPlayedOnce(true)
              setExploded((v) => !v)
            }}
            style={canvasPill(exploded, moving)}
          >
            {exploded ? 'Put it together' : 'Take it apart'}
          </button>
          {/* an offer, not a control: only once the user has seen a play, and
              only from the seated end of it (from apart, the toggle IS replay). */}
          {playedOnce && !exploded && (
            <button
              type="button"
              data-element="abacus-studio-replay"
              data-action="replay-assembly"
              aria-disabled={moving}
              onClick={() => {
                if (moving) return
                drawRef.current?.setAssembled(0)
                drawRef.current?.animateTo(1)
              }}
              style={canvasPill(false, moving)}
            >
              Replay
            </button>
          )}
        </div>
      )}

      {/* status HUD — a DEV readout ("#7 1346ms · 48,598 tris · clearance
          0.25mm") that used to ship to every user in the product. It is gated on
          the app's visual-debug flag now. Two things are not developer trivia and
          stay, flag or no flag: a render in flight (as plain "Rendering…" /
          "Loading…", not the request counter) and a FAILED render, which is the
          only on-screen account of why the hero went stale. */}
      {(showHud || status.error === true || status.busy != null) && (
        <div
          data-element="abacus-studio-hud"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '6px 10px',
            borderRadius: STUDIO.radius.notice,
            background: CANVAS.chromeStrong,
            color: status.error ? CANVAS.error : STUDIO.color.text2,
            font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
            whiteSpace: 'pre-wrap',
            maxWidth: 'calc(100% - 24px)',
            pointerEvents: 'none',
          }}
        >
          {showHud || status.error
            ? status.text
            : status.busy === 'loading'
              ? 'Loading the 3D preview…'
              : 'Rendering…'}
          {showHud && meta.tris != null && !status.error
            ? `  ·  ${meta.tris.toLocaleString()} tris  ·  clearance ${params.clearance}mm`
            : ''}
        </div>
      )}
    </div>
  )
}
