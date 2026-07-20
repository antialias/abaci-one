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
import { useThhFilamentCatalog } from '@/hooks/useThhFilamentCatalog'
import { catalogFromParams } from './abacus-catalog'
import { toAbacusDesign } from './abacus-design'
import {
  analyzeShells,
  COLOR_PALETTES,
  frameW,
  MARKER_BITS,
  nearestSlot,
  outerD,
  type Params,
  PRESET_OPTS,
  paramsFromDisplayConfig,
  type ShellInfo,
  shellHex,
  tokenCenters,
} from './abacus-model'
import { materialize, planToFilamentMap, type RoleAssignment } from './abacus-plan'
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

// filament-mapping panel — a calm summary at rest, one inline picker at a time.
// Section eyebrow above each role group (beads first, structure below).
const GROUP_LABEL: CSSProperties = {
  fontSize: 9.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  color: 'rgba(148,163,184,0.9)',
  padding: '6px 6px 2px',
}
const RESET_BTN: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 5,
  border: '1px solid rgba(148,163,184,0.5)',
  background: 'transparent',
  color: 'rgba(226,232,240,1)',
  fontSize: 11,
  cursor: 'pointer',
}
// Hover/focus + the one-at-a-time reveal, plus the reduced-motion opt-out — none
// of which inline styles can express. Namespaced (abx-) so it can't collide.
const MAPPING_CSS = `
.abx-map-row { background: transparent; transition: background 120ms ease; }
.abx-map-row:hover { background: rgba(255,255,255,0.05); }
.abx-map-row:focus-visible { outline: 2px solid rgba(103,232,249,0.9); outline-offset: -2px; }
.abx-swatch:focus-visible { outline: 2px solid rgba(103,232,249,0.9); outline-offset: 2px; }
.abx-chevron { transition: transform 120ms ease; }
.abx-reveal { animation: abxReveal 140ms ease; }
@keyframes abxReveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .abx-map-row, .abx-chevron, .abx-reveal { transition: none; animation: none; }
}
`

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
  // preview lens: 'design' shows the user's INTRINSIC colors (what they built),
  // 'print' shows the same design QUANTIZED onto the loaded filaments (what will
  // actually print). A pure view concern — never touches params, so flipping it
  // doesn't detach `synced`.
  const [viewMode, setViewMode] = useState<'design' | 'print'>('design')
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  // manual filament mapping: roleKey → spoolId. Auto-snap picks each role's spool
  // by nearest color; this is the user's override (and the seam where, once THH
  // supplies material families, incompatible picks get flagged — P4/P5). Pure view
  // state like viewMode: it only reshapes the PRINT projection, so a pin never
  // detaches `synced` or touches the design. A pin onto an unloaded spool is
  // ignored by materialize, so its row falls back to Auto.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  // the print plan = the design projected onto the loaded filaments, honoring the
  // user's pins. The catalog is the live THH AMS snapshot when the gateway is
  // reachable (real colors, names, and material families), falling back to the
  // params-derived color-only catalog when it isn't — the studio never blocks on
  // THH. Either way it's the single source of truth for BOTH the reduction
  // warnings and the per-shell recolor below.
  const thhFilaments = useThhFilamentCatalog()
  const catalog = useMemo(
    () => thhFilaments.catalog ?? catalogFromParams(params),
    [thhFilaments.catalog, params]
  )
  const plan = useMemo(
    () => materialize(design, catalog, { overrides }),
    [design, catalog, overrides]
  )
  // roleKey → the spool auto-snap PREFERS, ignoring the user's pins: the closest
  // color today, and (once the THH catalog carries material families in P4) the
  // closest color that also welds compatibly. The picker badges this so someone
  // who has pinned a worse-matching filament still sees the recommendation.
  // Depends only on design + catalog, so a pin doesn't recompute it.
  const preferredByRole = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of materialize(design, catalog).assignments) m.set(a.role.key, a.spoolIndex)
    return m
  }, [design, catalog])
  // the legacy FilamentMap the recolor passes color through, derived FROM the plan
  // so overrides flow into the live preview for free. Mirrored to a ref for the
  // mount-once three.js closures (like designRef).
  const filamentMap = useMemo(
    () =>
      planToFilamentMap(
        plan,
        catalog.spools.map((s) => s.hex)
      ),
    [plan, catalog]
  )
  const filamentMapRef = useRef(filamentMap)
  filamentMapRef.current = filamentMap
  // the lossy-reduction heads-up shown in print mode: contrast the camera can't
  // read + a palette that outruns the loaded spools. The per-role collision detail
  // lives in the filament-mapping panel below.
  const reductionWarnings = plan.warnings.filter(
    (w) => w.code === 'marker-contrast' || w.code === 'budget-exceeded'
  )
  // override rows, grouped frame → ArUco pair → beads. `activeOverrides` counts
  // pins that actually took (an ignored, unloaded-spool pin has overridden=false).
  const orderedAssignments = useMemo(() => {
    const order = { frame: 0, markerBlack: 1, markerWhite: 2, bead: 3, text: 4 } as const
    return [...plan.assignments].sort((a, b) => order[a.role.kind] - order[b.role.kind])
  }, [plan])
  const activeOverrides = plan.assignments.filter((a) => a.overridden).length
  // grouped for the panel: beads first (what users actually tweak), then the
  // welded structure (frame + ArUco markers), which is rarely retargeted.
  const beadRows = orderedAssignments.filter((a) => a.role.kind === 'bead')
  const structureRows = orderedAssignments.filter((a) => a.role.kind !== 'bead')
  // show each spool's material only when it's informative (a mixed-material THH
  // catalog); the all-PLA params catalog would just print "PLA" on every row.
  const showMaterial = useMemo(
    () => new Set(catalog.spools.map((s) => s.material)).size > 1,
    [catalog]
  )
  const [mappingOpen, setMappingOpen] = useState(false)
  // which role's picker is expanded (at most one — opening a row collapses the
  // rest). Kept out here rather than per-row so the accordion is single-open by
  // construction, and an inline expand dodges the click-outside/positioning traps
  // of a floating popover over the WebGL canvas.
  const [openRole, setOpenRole] = useState<string | null>(null)
  const setRoleSpool = (roleKey: string, spoolId: string) =>
    setOverrides((prev) => {
      const next = { ...prev }
      if (spoolId) next[roleKey] = spoolId
      else delete next[roleKey]
      return next
    })

  // One role row: a calm summary line (intended color → the filament it prints on)
  // that expands in place to a filament picker. Shared by both groups so the two
  // never drift. A pinned row earns the panel's only accent (cyan rail + ring).
  const renderMappingRow = (a: RoleAssignment) => {
    const interactive = catalog.spools.length > 1
    const assigned = catalog.spools[a.spoolIndex]
    const preferred = preferredByRole.get(a.role.key)
    const isOpen = interactive && openRole === a.role.key
    const rowStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      width: '100%',
      padding: '5px 6px',
      textAlign: 'left',
      border: 'none',
      borderLeft: `2px solid ${a.overridden ? 'rgba(103,232,249,0.95)' : 'transparent'}`,
      borderRadius: 6,
      background: isOpen ? 'rgba(255,255,255,0.05)' : undefined,
      color: 'rgba(203,213,225,0.9)',
      fontSize: 11,
      cursor: interactive ? 'pointer' : 'default',
    }
    const header = (
      <>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.role.label}
        </span>
        <span
          title={assigned.hex}
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            flex: '0 0 auto',
            background: assigned.hex,
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: a.overridden
              ? '0 0 0 1px #111827, 0 0 0 2px rgba(103,232,249,0.95)'
              : 'none',
          }}
        />
        <span
          title={showMaterial ? `${assigned.name} · ${assigned.material}` : assigned.name}
          style={{
            flex: '0 1 auto',
            minWidth: 0,
            maxWidth: 74,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 10.5,
            color: 'rgba(148,163,184,0.95)',
          }}
        >
          {assigned.name}
        </span>
        {interactive && (
          <span
            aria-hidden="true"
            className="abx-chevron"
            style={{
              flex: '0 0 auto',
              fontSize: 10,
              color: 'rgba(148,163,184,0.7)',
              transform: isOpen ? 'rotate(90deg)' : 'none',
            }}
          >
            ▸
          </span>
        )}
      </>
    )
    return (
      <div
        key={a.role.key}
        data-element="abacus-studio-mapping-row"
        data-role={a.role.key}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      >
        {interactive ? (
          <button
            type="button"
            className="abx-map-row"
            data-action="toggle-mapping-row"
            aria-expanded={isOpen}
            onClick={() => setOpenRole((prev) => (prev === a.role.key ? null : a.role.key))}
            style={rowStyle}
          >
            {header}
          </button>
        ) : (
          <div style={rowStyle}>{header}</div>
        )}

        {isOpen && (
          <div
            className="abx-reveal"
            data-element="abacus-studio-role-picker"
            style={{
              // float over the rows below instead of pushing them down — opening a
              // picker must not reflow the panel. Anchored to this (relative) row.
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 2,
              marginTop: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(17,24,39,0.98)',
              border: '1px solid rgba(148,163,184,0.25)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
            }}
          >
            {/* the designed (intrinsic) color lives here, on-demand, instead of
                doubling every resting row — this is what the ✓ is matching to. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden="true"
                title={`designed ${a.role.intrinsicHex}`}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  flex: '0 0 auto',
                  background: a.role.intrinsicHex,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
              <span
                style={{
                  fontSize: 9.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'rgba(148,163,184,0.75)',
                }}
              >
                Match {a.role.label}
              </span>
            </span>
            <div
              role="group"
              aria-label={`filament for ${a.role.label}`}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
            >
              {catalog.spools.map((s, idx) => {
                const isAssigned = idx === a.spoolIndex
                const isPreferred = idx === preferred
                const ring = a.overridden ? 'rgba(103,232,249,0.95)' : 'rgba(226,232,240,0.9)'
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="abx-swatch"
                    data-action="override-role-spool"
                    aria-label={`${a.role.label} uses ${s.name}${showMaterial ? ` ${s.material}` : ''} ${s.hex}${isPreferred ? ' (best match)' : ''}`}
                    aria-pressed={isAssigned}
                    title={`${showMaterial ? `${s.name} · ${s.material} · ${s.hex}` : `${s.name} · ${s.hex}`}${isPreferred ? ' · best match' : ''}`}
                    onClick={() => setRoleSpool(a.role.key, s.id)}
                    style={{
                      position: 'relative',
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      flex: '0 0 auto',
                      padding: 0,
                      background: s.hex,
                      border: '1px solid rgba(255,255,255,0.25)',
                      cursor: 'pointer',
                      boxShadow: isAssigned ? `0 0 0 2px #111827, 0 0 0 4px ${ring}` : 'none',
                    }}
                  >
                    {isPreferred && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -5,
                          width: 13,
                          height: 13,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(17,24,39,0.95)',
                          border: '1px solid rgba(226,232,240,0.8)',
                          color: 'rgba(226,232,240,0.95)',
                          fontSize: 8,
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 9.5,
                color: 'rgba(148,163,184,0.7)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  background: 'rgba(17,24,39,0.95)',
                  border: '1px solid rgba(226,232,240,0.8)',
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 8,
                }}
              >
                ✓
              </span>
              best match — closest color{showMaterial ? ' & compatible material' : ''}
            </span>
            {a.overridden && (
              <button
                type="button"
                data-action="clear-role-override"
                onClick={() => setRoleSpool(a.role.key, '')}
                style={{
                  alignSelf: 'flex-start',
                  padding: '2px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'transparent',
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                ↺ Back to auto
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
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
      // Two lenses on the same design:
      //  • 'design' → the user's INTRINSIC colors (matches their on-screen abacus
      //    exactly). Columns are keyed by place value (ones = index 0); shellInfo.i
      //    counts left→right, so place value = cols-1-i.
      //  • 'print'  → those same colors QUANTIZED onto the loaded filaments
      //    (shellHex over the filament map), i.e. what actually prints.
      const printMode = viewModeRef.current === 'print'
      const fm = printMode ? filamentMapRef.current : null
      const rc = designRef.current.resolvedColors
      const shellRGB = shellInfo.map((info) => {
        let hex: string
        if (printMode && fm) {
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
      // markers are black/white CV fiducials: 'design' shows their ideal pure
      // pair, 'print' shows the actual filaments they snap to (whose contrast the
      // plan warns about when it drops below the camera's floor).
      const printMode = viewModeRef.current === 'print'
      const fm = printMode ? filamentMapRef.current : null
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
    let plugMesh: THREE.Mesh | null = null
    let plugTriTok: Int32Array | null = null

    function plugRecolor() {
      if (!plugMesh || !plugTriTok) return
      const p = paramsRef.current
      // 'design' shows the intended inlay ink (rainbow palette or the single text
      // color); 'print' snaps it to the nearest loaded filament.
      const printMode = viewModeRef.current === 'print'
      const fm = printMode ? filamentMapRef.current : null
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

  // flipping the preview lens OR editing the filament mapping is geometry-free:
  // recolor + rebuild the markers from the new plan, no WASM re-render (the closures
  // read viewModeRef + filamentMapRef). filamentMap changes on every param edit too,
  // so the param effect's redraw is harmlessly deduped by this one.
  useEffect(() => {
    drawRef.current?.applyParams()
  }, [viewMode, filamentMap])

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
      <div
        ref={mountRef}
        data-element="abacus-studio-canvas"
        style={{ width: '100%', height: '100%' }}
      />

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

        {/* preview lens: the identity the user built vs. what the loaded filaments
            will actually print. Flipping it recolors the model in place. */}
        <div
          data-element="abacus-studio-view-mode"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div
            role="group"
            aria-label="preview colors"
            style={{
              display: 'flex',
              borderRadius: 7,
              overflow: 'hidden',
              border: '1px solid rgba(148,163,184,0.35)',
            }}
          >
            {(
              [
                ['design', 'My colors'],
                ['print', 'Print preview'],
              ] as const
            ).map(([mode, label]) => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  data-action="set-view-mode"
                  data-mode={mode}
                  aria-pressed={active}
                  onClick={() => setViewMode(mode)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    border: 'none',
                    background: active ? CYAN_GRADIENT : 'transparent',
                    color: active ? '#fff' : 'rgba(203,213,225,0.9)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {viewMode === 'print' && (
            <div
              data-element="abacus-studio-print-preview"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'rgba(148,163,184,0.9)',
                  }}
                >
                  {catalog.spools.length} filament{catalog.spools.length === 1 ? '' : 's'} loaded
                </span>
                <div
                  data-element="abacus-studio-filament-legend"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
                >
                  {catalog.spools.map((s) => (
                    <span
                      key={s.id}
                      title={
                        showMaterial
                          ? `${s.name} · ${s.material} · ${s.hex}`
                          : `${s.name} · ${s.hex}`
                      }
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: s.hex,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {reductionWarnings.length > 0 && (
                <div
                  data-element="abacus-studio-plan-warnings"
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
                  {reductionWarnings.map((w) => (
                    <div key={w.code}>{w.message}</div>
                  ))}
                </div>
              )}

              {/* manual override — pin any role to a specific loaded filament.
                  Auto-snap picks by nearest color; this is the escape hatch. Once
                  THH supplies material families, incompatible picks get flagged
                  here (P4/P5); today every spool is PLA, so all picks are valid. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  data-action="toggle-filament-mapping"
                  aria-expanded={mappingOpen}
                  onClick={() => setMappingOpen((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 2px',
                    border: 'none',
                    background: 'transparent',
                    color: 'rgba(203,213,225,0.9)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    Filament mapping
                    {activeOverrides > 0 && (
                      <span style={{ marginLeft: 6, color: 'rgba(103,232,249,0.95)' }}>
                        · {activeOverrides} pinned
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true">{mappingOpen ? '▾' : '▸'}</span>
                </button>

                {mappingOpen && (
                  <div
                    data-element="abacus-studio-filament-mapping"
                    style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <style>{MAPPING_CSS}</style>

                    {catalog.spools.length === 1 && (
                      <div
                        style={{
                          fontSize: 10.5,
                          lineHeight: 1.4,
                          color: 'rgba(148,163,184,0.85)',
                          padding: '0 6px 4px',
                        }}
                      >
                        One filament loaded — load more to remap roles.
                      </div>
                    )}

                    {beadRows.length > 0 && (
                      <>
                        <div
                          data-element="abacus-studio-mapping-group"
                          data-group="beads"
                          style={GROUP_LABEL}
                        >
                          Beads
                        </div>
                        {beadRows.map(renderMappingRow)}
                      </>
                    )}

                    {structureRows.length > 0 && (
                      <>
                        <div
                          data-element="abacus-studio-mapping-group"
                          data-group="structure"
                          style={{ ...GROUP_LABEL, color: 'rgba(148,163,184,0.7)' }}
                        >
                          Structure{' '}
                          <span style={{ fontWeight: 400, color: 'rgba(148,163,184,0.5)' }}>
                            · rarely changed
                          </span>
                        </div>
                        {structureRows.map(renderMappingRow)}
                      </>
                    )}

                    {activeOverrides > 0 && (
                      <button
                        type="button"
                        data-action="clear-all-overrides"
                        onClick={() => setOverrides({})}
                        style={{ ...RESET_BTN, alignSelf: 'flex-start', marginTop: 4 }}
                      >
                        ↺ Reset all to auto
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
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
