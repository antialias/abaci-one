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

import { useAbacusConfig } from '@soroban/abacus-react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { DebugCheckbox, DebugSlider } from '@/components/toys/ToyDebugPanel'
import {
  analyzeShells,
  COLOR_PALETTES,
  computeFilamentMap,
  frameW,
  MARKER_BITS,
  nearestSlot,
  outerD,
  type Params,
  paramsFromDisplayConfig,
  PRESET_OPTS,
  type ShellInfo,
  tokenCenters,
} from './abacus-model'
import { toAbacusDesign } from './abacus-design'
import { DEFAULT_PROFILE_ID, PRINTER_PROFILES, profileById, solve } from './abacus-solver'
import { type StatusUpdate, useAbacusScad } from './useAbacusScad'

const SCHEMES = ['monochrome', 'place-value', 'heaven-earth', 'alternating']
const PALETTES = ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature']
const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'

// shared style for the one-click solver-fix buttons (sit inside the red error box)
const FIX_BTN: CSSProperties = {
  padding: '5px 9px',
  borderRadius: 6,
  border: '1px solid rgba(248,113,113,0.6)',
  background: 'rgba(254,226,226,0.12)',
  color: 'rgba(254,226,226,0.98)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
}

type DrawApi = {
  /** parse + shell-classify + recolor a fresh geometry STL; returns tri count */
  swapMesh: (stl: ArrayBuffer) => number
  swapPlug: (stl: ArrayBuffer) => void
  clearPlug: () => void
  /** cheap: recenter + rebuild markers + recolor existing mesh (no WASM) */
  applyParams: () => void
}

export function AbacusStudioViewer() {
  // the toy opens showing the viewer's OWN abacus (columns + color identity from
  // their live AbacusDisplayConfig), then follows it until they touch a control.
  const displayConfig = useAbacusConfig()
  const [params, setParams] = useState<Params>(() => paramsFromDisplayConfig(displayConfig))
  // `synced` = params still mirror the display config. Any manual edit detaches
  // (so a customization is never stomped by a config change), and the
  // "reset to my abacus" button re-attaches.
  const [synced, setSynced] = useState(true)
  // sliders/selects live behind a "Customize" disclosure so the print tool leads
  // with its Download action instead of a wall of dev controls.
  const [customizeOpen, setCustomizeOpen] = useState(false)
  // printer profile: a print setting (Common / Wide / Fine), NOT part of the
  // abacus identity — changing it must not detach `synced`.
  const [profileId, setProfileId] = useState<string>(DEFAULT_PROFILE_ID)
  const paramsRef = useRef(params)
  paramsRef.current = params
  // the serializable design projection — the studio's Phase-2 handoff and the
  // single source of truth for the preview's bead/frame colors. Baking it here
  // (instead of re-deriving hexes in recolor) keeps the on-screen preview and
  // the exported design in lockstep. Intrinsic colors, not AMS-snapped.
  const design = useMemo(() => toAbacusDesign(params, profileId), [params, profileId])
  const designRef = useRef(design)
  designRef.current = design
  const [status, setStatus] = useState<StatusUpdate>({ text: 'booting…' })
  const [meta, setMeta] = useState<{ ms?: number; tris?: number }>({})
  const mountRef = useRef<HTMLDivElement | null>(null)
  const drawRef = useRef<DrawApi | null>(null)

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
    let renderMesh: THREE.Mesh | null = null
    let triShell: Int32Array | null = null
    let shellInfo: ShellInfo[] = []

    const recenter = () =>
      centered.position.set(-frameW(paramsRef.current) / 2, -outerD(paramsRef.current) / 2, 0)
    recenter()

    function recolor() {
      const p = paramsRef.current
      if (!renderMesh || !triShell) return
      const geo = renderMesh.geometry
      const nVert = geo.attributes.position.count
      // Paint from the design's INTRINSIC colors so the preview matches the
      // user's on-screen abacus exactly — the old filament snap quantized the
      // alternating/colorblind/mnemonic/grayscale/nature palettes to spool
      // approximations. Columns are keyed by place value (ones = index 0);
      // shellInfo.i counts left→right, so place value = cols-1-i. The AMS snap
      // still governs the ArUco markers + text plug via plugRecolor (the #10 seam).
      const rc = designRef.current.resolvedColors
      const shellRGB = shellInfo.map((info) => {
        let hex: string
        if (info.isFrame) {
          hex = rc.frame
        } else {
          const col = rc.columns[p.cols - 1 - info.i]
          hex = (info.isHeaven ? col?.heaven : col?.earth) ?? rc.frame
        }
        _c.set(hex)
        return [_c.r, _c.g, _c.b] as const
      })
      const colors = new Float32Array(nVert * 3)
      for (let t = 0; t < triShell.length; t++) {
        const rgb = shellRGB[triShell[t]] ?? ([1, 0.6, 0.24] as const)
        for (let c = 0; c < 3; c++) {
          const o = (t * 3 + c) * 3
          colors[o] = rgb[0]
          colors[o + 1] = rgb[1]
          colors[o + 2] = rgb[2]
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
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
      const fm = computeFilamentMap(p)
      pos.forEach(([x, y], k) => {
        const quad = new THREE.Mesh(
          new THREE.PlaneGeometry(p.marker_mm, p.marker_mm),
          new THREE.MeshBasicMaterial({
            map: markerTexture(
              MARKER_BITS[k],
              k,
              trim,
              fm.slots[fm.markerWhite],
              fm.slots[fm.markerBlack]
            ),
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
    let plugMesh: THREE.Mesh | null = null
    let plugTriTok: Int32Array | null = null

    function plugRecolor() {
      if (!plugMesh || !plugTriTok) return
      const p = paramsRef.current
      const fm = computeFilamentMap(p)
      const pal = COLOR_PALETTES[p.color_palette] ?? COLOR_PALETTES.default
      const geo = plugMesh.geometry
      const colors = new Float32Array(geo.attributes.position.count * 3)
      const cache = new Map<number, readonly [number, number, number]>()
      for (let t = 0; t < plugTriTok.length; t++) {
        const k = plugTriTok[t]
        let rgb = cache.get(k)
        if (!rgb) {
          const intended = p.text_fill === 'rainbow' ? pal[k % 5] : p.text_color
          _c.set(fm.slots[nearestSlot(fm.slots, intended)])
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
      plugMesh?.geometry.dispose()
      plugMat.dispose()
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

  // ---- follow the live abacus config while synced ---------------------------
  // Re-seeds when the provider hydrates its stored config after mount, and when
  // the user changes their abacus elsewhere. A no-op once they've customized.
  useEffect(() => {
    if (!synced) return
    setParams(paramsFromDisplayConfig(displayConfig))
  }, [displayConfig, synced])

  // ---- react to param edits: cheap redraw + (deduped) WASM re-render --------
  useEffect(() => {
    drawRef.current?.applyParams()
    scad.render(params)
  }, [params, scad])

  // any manual edit detaches from the live config (see `synced`).
  const set = <K extends keyof Params>(k: K, v: Params[K]) => {
    setSynced(false)
    setParams((prev) => ({ ...prev, [k]: v }))
  }

  // ---- printability gate ----------------------------------------------------
  // Run the pure solver against the selected profile; errors block Export, the
  // inlay warning does not. See abacus-solver.ts.
  const profile = profileById(profileId)
  const solveResult = useMemo(() => solve(params, profile), [params, profile])
  const errors = solveResult.reasons.filter((r) => r.severity === 'error')
  const warnings = solveResult.reasons.filter((r) => r.severity === 'warning')
  const exportBlocked = errors.length > 0
  // the two mechanical one-click fixes derivable from the errors: scale up to
  // clear all proportional floors at once, and/or raise the absolute fit gap.
  const proportionalScales = errors
    .map((r) => r.suggestedScale)
    .filter((s): s is number => typeof s === 'number')
  const scaleFix = proportionalScales.length ? Math.max(...proportionalScales) : null
  const clearanceFix = errors.find((r) => r.dim === 'clearance')?.floorMm ?? null

  const onExport = () =>
    scad.exportStl(paramsRef.current, (stl) => {
      const blob = new Blob([stl], { type: 'model/stl' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `abacus-${params.cols}col-x${params.scale_factor}.stl`
      a.click()
      URL.revokeObjectURL(a.href)
    })

  return (
    <div
      data-component="abacus-studio-viewer"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div ref={mountRef} data-element="abacus-studio-canvas" style={{ width: '100%', height: '100%' }} />

      {/* control panel */}
      <div
        data-element="abacus-studio-controls"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          width: 250,
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'rgba(17,24,39,0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: 10,
          padding: '14px 16px',
          color: 'rgba(243,244,246,1)',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>Your 3D abacus</div>

        <div
          data-element="abacus-studio-sync-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: synced ? 'rgba(134,239,172,0.95)' : 'rgba(252,211,77,0.95)',
          }}
        >
          <span>{synced ? '● showing your abacus' : '● customized'}</span>
          {!synced && (
            <button
              type="button"
              data-action="reset-to-my-abacus"
              onClick={() => setSynced(true)}
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(148,163,184,0.5)',
                background: 'transparent',
                color: 'rgba(226,232,240,1)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              reset to my abacus
            </button>
          )}
        </div>

        {/* printer profile — a first-class print setting (drives the gate below) */}
        <Select
          label="printer profile"
          value={profileId}
          options={PRINTER_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
          onChange={setProfileId}
          dataElement="abacus-studio-profile"
          dataAction="select-profile"
        />

        {/* printability verdict: red errors block Export (with one-click fixes),
            amber warnings inform but don't block */}
        {solveResult.reasons.length > 0 && (
          <div
            data-element="abacus-studio-solver-reasons"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {errors.length > 0 && (
              <div
                data-element="abacus-studio-solver-errors"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(127,29,29,0.35)',
                  border: '1px solid rgba(248,113,113,0.5)',
                  color: 'rgba(254,226,226,0.96)',
                  fontSize: 11,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true">⛔</span> Won&apos;t print on {profile.label}
                </div>
                {errors.map((r) => (
                  <div key={r.dim}>{r.message}</div>
                ))}
                {(scaleFix != null || clearanceFix != null) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {scaleFix != null && (
                      <button
                        type="button"
                        data-action="apply-solver-fix"
                        onClick={() => set('scale_factor', scaleFix)}
                        style={FIX_BTN}
                      >
                        ⤢ Scale up to {scaleFix}×
                      </button>
                    )}
                    {clearanceFix != null && (
                      <button
                        type="button"
                        data-action="apply-solver-fix"
                        onClick={() => set('clearance', clearanceFix)}
                        style={FIX_BTN}
                      >
                        ↕ Raise fit gap to {clearanceFix.toFixed(2)} mm
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {warnings.length > 0 && (
              <div
                data-element="abacus-studio-solver-warnings"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(120,53,15,0.30)',
                  border: '1px solid rgba(251,191,36,0.45)',
                  color: 'rgba(254,243,199,0.96)',
                  fontSize: 11,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true">⚠️</span> Heads up
                </div>
                {warnings.map((r) => (
                  <div key={r.dim}>{r.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* primary action — the whole point of the print path */}
        <button
          type="button"
          data-action="export-stl"
          onClick={onExport}
          disabled={exportBlocked}
          title={
            exportBlocked
              ? `Fix the errors above to print on ${profile.label}`
              : 'Download a print-ready STL'
          }
          style={{
            padding: '11px 12px',
            borderRadius: 8,
            border: 'none',
            background: exportBlocked ? 'rgba(75,85,99,0.55)' : CYAN_GRADIENT,
            color: exportBlocked ? 'rgba(209,213,219,0.7)' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: exportBlocked ? 'not-allowed' : 'pointer',
            boxShadow: exportBlocked ? 'none' : '0 4px 14px rgba(6,182,212,0.35)',
          }}
        >
          ⬇ Download STL to print
        </button>

        {/* customize disclosure — sliders/selects tucked out of the way */}
        <button
          type="button"
          data-action="toggle-customize"
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 2px',
            border: 'none',
            background: 'transparent',
            color: 'rgba(203,213,225,0.9)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span>Customize</span>
          <span aria-hidden="true">{customizeOpen ? '▾' : '▸'}</span>
        </button>

        {customizeOpen && (
          <div
            data-element="abacus-studio-customize"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <DebugSlider
              label="size ×"
              value={params.scale_factor}
              min={0.5}
              max={2}
              step={0.05}
              onChange={(v) => set('scale_factor', v)}
              formatValue={(v) => v.toFixed(2)}
            />
            <DebugSlider
              label="columns"
              value={params.cols}
              min={3}
              max={21}
              step={1}
              onChange={(v) => set('cols', v)}
            />
            <DebugSlider
              label="fit gap (mm)"
              value={params.clearance}
              min={0.1}
              max={0.8}
              step={0.01}
              onChange={(v) => set('clearance', v)}
              formatValue={(v) => v.toFixed(2)}
            />
            <DebugSlider
              label="$fn (quality)"
              value={params.fn}
              min={8}
              max={64}
              step={1}
              onChange={(v) => set('fn', v)}
            />

            <Select
              label="color scheme"
              value={params.color_scheme}
              options={SCHEMES}
              onChange={(v) => set('color_scheme', v)}
            />
            <Select
              label="palette"
              value={params.color_palette}
              options={PALETTES}
              onChange={(v) => set('color_palette', v)}
            />
            <Select
              label="top rail"
              value={params.top_preset}
              options={PRESET_OPTS}
              onChange={(v) => set('top_preset', v)}
            />
            <Select
              label="bottom rail"
              value={params.bottom_preset}
              options={PRESET_OPTS}
              onChange={(v) => set('bottom_preset', v)}
            />

            <DebugCheckbox
              label="ArUco corner markers"
              checked={params.show_markers}
              onChange={(v) => set('show_markers', v)}
            />
          </div>
        )}
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

// tiny labeled <select> (the app's debug panel has no select primitive). Options
// are plain strings (value === label) or {value,label} pairs for id→label menus.
function Select({
  label,
  value,
  options,
  onChange,
  dataElement = 'abacus-studio-select',
  dataAction,
}: {
  label: string
  value: string
  options: Array<string | { value: string; label: string }>
  onChange: (v: string) => void
  dataElement?: string
  dataAction?: string
}) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <label
      data-element={dataElement}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 500 }}
    >
      {label}
      <select
        value={value}
        data-action={dataAction}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          padding: '4px 6px',
          fontSize: 12,
        }}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value} style={{ color: '#111' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
