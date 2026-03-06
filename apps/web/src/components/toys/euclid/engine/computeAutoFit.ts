/**
 * computeAutoFit — Pure function that adjusts the viewport (center + pixelsPerUnit)
 * to frame the current construction within the visible canvas area.
 *
 * Extracted from the RAF render loop in EuclidCanvas.tsx.
 * Reads/writes viewport through RAFContext refs.
 */
import type { RAFContext } from './rafContext'
import {
  AUTO_FIT_PAD_PX,
  AUTO_FIT_PAD_PX_MOBILE,
  AUTO_FIT_LERP,
  AUTO_FIT_MIN_PPU,
  AUTO_FIT_SOFT_MARGIN,
  AUTO_FIT_SWEEP_LERP_MIN,
  AUTO_FIT_POST_SWEEP_MS,
  AUTO_FIT_MAX_CENTER_PX,
  AUTO_FIT_MAX_PPU_DELTA,
  AUTO_FIT_SWEEP_PPU_DELTA,
  AUTO_FIT_CEREMONY_PPU_DELTA,
  AUTO_FIT_TIP_PAD_FRACTION,
  AUTO_FIT_DOCK_GAP,
  getConstructionBounds,
  expandBoundsForArc,
  expandBounds,
  getAutoFitMaxPpu,
  clampPpu,
  clampPpuWithMin,
  getFitRect,
  getScreenBounds,
  boundsWithinRect,
  clampCenterToRect,
} from './viewportMath'
import { getPoint } from './constructionState'
import { MACRO_PREVIEW_REGISTRY } from './macroPreview'

export function computeAutoFit(
  ctx: RAFContext,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): void {
  const compassPhase = ctx.compassPhaseRef.current
  const allowAutoFit =
    ctx.panZoomDisabledRef.current &&
    (!ctx.pointerCapturedRef.current ||
      compassPhase.tag === 'radius-set' ||
      compassPhase.tag === 'sweeping')

  if (!allowAutoFit) return

  const pad = ctx.isMobileRef.current ? AUTO_FIT_PAD_PX_MOBILE : AUTO_FIT_PAD_PX
  const canvasRect = canvas.getBoundingClientRect()
  const dockRect = ctx.toolDockRef.current?.getBoundingClientRect() ?? null
  const reservedBottom = 0
  const fitRect = getFitRect(
    cssWidth,
    cssHeight,
    canvasRect,
    dockRect,
    pad,
    AUTO_FIT_DOCK_GAP,
    reservedBottom
  )

  const bounds = getConstructionBounds(ctx.constructionRef.current)
  if (!bounds) return

  // ── Expand bounds for compass sweep arc ──
  if (compassPhase.tag === 'sweeping') {
    const centerId = compassPhase.centerId as string
    const radius = compassPhase.radius as number
    const startAngle = compassPhase.startAngle as number
    const cumulativeSweep = compassPhase.cumulativeSweep as number
    const centerPoint = getPoint(ctx.constructionRef.current, centerId)
    if (centerPoint && radius > 0) {
      expandBoundsForArc(bounds, centerPoint.x, centerPoint.y, radius, startAngle, cumulativeSweep)
    }
  }

  // ── Expand bounds for ghost geometry (ceremony + G-toggle) ──
  const cer = ctx.macroRevealRef.current
  const inCeremony = cer != null
  const hoveredStep = ctx.hoveredMacroStepRef.current
  const includeGhostBounds = inCeremony || ctx.ghostBoundsEnabledRef.current
  if (includeGhostBounds) {
    const ceremonyLayerKeys = inCeremony
      ? new Set([...cer!.sequence.map((e) => e.layerKey), ...cer!.preRevealedLayers.keys()])
      : null
    for (const layer of ctx.ghostLayersRef.current) {
      const key = `${layer.atStep}:${layer.depth}`
      // During ceremony: only include ceremony layers
      // With G toggle + hover: include only the hovered step's layers
      // With G toggle (no hover): include all ghost layers
      if (ceremonyLayerKeys && !ceremonyLayerKeys.has(key)) continue
      if (!ceremonyLayerKeys && hoveredStep != null && layer.atStep !== hoveredStep) continue
      for (const el of layer.elements) {
        if (el.kind === 'circle') {
          expandBounds(bounds, el.cx, el.cy, el.r)
        } else if (el.kind === 'segment') {
          expandBounds(bounds, el.x1, el.y1, 0)
          expandBounds(bounds, el.x2, el.y2, 0)
        } else if (el.kind === 'point') {
          expandBounds(bounds, el.x, el.y, 0)
        }
      }
    }
  }

  // ── Expand bounds for macro preview geometry ──
  let includeMacroPreview = false
  if (ctx.macroPreviewAutoFitRef.current) {
    const stepIdx = ctx.currentStepRef.current
    const stepExpected =
      stepIdx < ctx.stepsRef.current.length ? ctx.stepsRef.current[stepIdx].expected : null
    if (stepExpected?.type === 'macro') {
      const previewFn = MACRO_PREVIEW_REGISTRY[stepExpected.propId]
      if (previewFn) {
        const positions: { x: number; y: number }[] = []
        for (const pid of stepExpected.inputPointIds) {
          const pt = getPoint(ctx.constructionRef.current, pid)
          if (pt) positions.push({ x: pt.x, y: pt.y })
        }
        if (positions.length === stepExpected.inputPointIds.length) {
          const result = previewFn(positions)
          if (result) {
            includeMacroPreview = true
            for (const el of [...result.ghostElements, ...result.resultElements]) {
              if (el.kind === 'circle') {
                expandBounds(bounds, el.cx, el.cy, el.r)
              } else if (el.kind === 'segment') {
                expandBounds(bounds, el.x1, el.y1, 0)
                expandBounds(bounds, el.x2, el.y2, 0)
              } else if (el.kind === 'point') {
                expandBounds(bounds, el.x, el.y, 0)
              }
            }
          }
        }
      }
    }
  }

  // ── Compute target zoom ──
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const availableW = Math.max(1, fitRect.width - pad * 2)
  const availableH = Math.max(1, fitRect.height - pad * 2)
  const minPpuNeeded = Math.min(availableW / width, availableH / height)
  const fitArea = availableW * availableH
  const boundsArea = width * height
  // Suppress zoom-in when ghost/macro-preview bounds are included
  const shouldZoomIn = !includeGhostBounds && !includeMacroPreview && boundsArea <= fitArea * 0.25
  const desiredPpu = Math.min(availableW / width, availableH / height)
  const maxPpu = getAutoFitMaxPpu(ctx.isTouchRef.current)
  const targetPpu = shouldZoomIn
    ? clampPpu(desiredPpu, maxPpu)
    : clampPpuWithMin(desiredPpu, minPpuNeeded, maxPpu)
  const targetCx = (bounds.minX + bounds.maxX) / 2
  const targetCy = (bounds.minY + bounds.maxY) / 2

  const v = ctx.viewportRef.current
  const prevCx = v.center.x
  const prevCy = v.center.y
  const prevPpu = v.pixelsPerUnit
  const screenBounds = getScreenBounds(bounds, v, cssWidth, cssHeight)
  const softOk = boundsWithinRect(
    screenBounds,
    {
      left: fitRect.left,
      right: fitRect.right,
      top: fitRect.top,
      bottom: fitRect.bottom,
    },
    AUTO_FIT_SOFT_MARGIN
  )

  // ── Sweep speed tracking ──
  const now = performance.now()
  let sweepSpeed = 0
  if (compassPhase.tag === 'sweeping') {
    const cumulativeSweep = compassPhase.cumulativeSweep as number
    const lastSweep = ctx.lastSweepRef.current
    const lastTime = ctx.lastSweepTimeRef.current || now
    const dt = Math.max(1, now - lastTime) / 1000
    sweepSpeed = Math.abs(cumulativeSweep - lastSweep) / dt
    ctx.lastSweepRef.current = cumulativeSweep
    ctx.lastSweepTimeRef.current = now
    ctx.lastSweepCenterRef.current = compassPhase.centerId as string
  } else {
    ctx.lastSweepRef.current = 0
  }
  const sinceSweepMs = now - (ctx.lastSweepTimeRef.current || now)
  const isPostSweep = sinceSweepMs < AUTO_FIT_POST_SWEEP_MS
  // Dampen lerp when macro preview drives bounds
  const baseLerp = includeMacroPreview ? AUTO_FIT_LERP * 0.5 : AUTO_FIT_LERP
  const sweepLerp =
    compassPhase.tag === 'sweeping' || isPostSweep
      ? Math.max(AUTO_FIT_SWEEP_LERP_MIN, baseLerp / (1 + sweepSpeed * 0.4))
      : baseLerp

  // ── Apply zoom (delta-capped) ──
  let effectivePpu = v.pixelsPerUnit
  const isSweeping = compassPhase.tag === 'sweeping'
  if (!softOk || targetPpu < v.pixelsPerUnit || shouldZoomIn) {
    const nextPpu = v.pixelsPerUnit + (targetPpu - v.pixelsPerUnit) * sweepLerp
    const ppuDeltaCap = inCeremony
      ? AUTO_FIT_CEREMONY_PPU_DELTA
      : isSweeping
        ? AUTO_FIT_SWEEP_PPU_DELTA
        : AUTO_FIT_MAX_PPU_DELTA
    const deltaPpu = Math.max(-ppuDeltaCap, Math.min(ppuDeltaCap, nextPpu - v.pixelsPerUnit))
    // During sweep: only zoom out (negative delta), never in
    if (!isSweeping || deltaPpu <= 0) {
      effectivePpu = v.pixelsPerUnit + deltaPpu
      v.pixelsPerUnit = effectivePpu
    }
  }

  // ── Apply pan (rate-limited) ──
  let targetCenterX = targetCx - (fitRect.centerX - cssWidth / 2) / effectivePpu
  let targetCenterY = targetCy + (fitRect.centerY - cssHeight / 2) / effectivePpu
  if (compassPhase.tag === 'sweeping' || isPostSweep) {
    const anchorCenterId =
      compassPhase.tag === 'sweeping'
        ? (compassPhase.centerId as string)
        : ctx.lastSweepCenterRef.current
    const centerPoint = anchorCenterId
      ? getPoint(ctx.constructionRef.current, anchorCenterId)
      : null
    if (centerPoint) {
      const anchorScreenX = (centerPoint.x - v.center.x) * v.pixelsPerUnit + cssWidth / 2
      const anchorScreenY = (v.center.y - centerPoint.y) * v.pixelsPerUnit + cssHeight / 2
      targetCenterX = centerPoint.x - (anchorScreenX - cssWidth / 2) / effectivePpu
      targetCenterY = centerPoint.y + (anchorScreenY - cssHeight / 2) / effectivePpu
    }
  }
  if (ctx.isCompleteRef.current) {
    const clamped = clampCenterToRect(
      targetCenterX,
      targetCenterY,
      effectivePpu,
      bounds,
      {
        left: fitRect.left,
        right: fitRect.right,
        top: fitRect.top,
        bottom: fitRect.bottom,
      },
      pad,
      cssWidth,
      cssHeight
    )
    targetCenterX = clamped.centerX
    targetCenterY = clamped.centerY
  }

  const maxPx = shouldZoomIn ? AUTO_FIT_MAX_CENTER_PX * 3 : AUTO_FIT_MAX_CENTER_PX
  const maxDx = maxPx / v.pixelsPerUnit
  const maxDy = maxPx / v.pixelsPerUnit
  const dx = (targetCenterX - v.center.x) * sweepLerp
  const dy = (targetCenterY - v.center.y) * sweepLerp
  v.center.x += Math.max(-maxDx, Math.min(maxDx, dx))
  v.center.y += Math.max(-maxDy, Math.min(maxDy, dy))

  // ── Hard constraint: compass scribing tip must always be visible ──
  if (compassPhase.tag === 'sweeping') {
    const radius = compassPhase.radius as number
    if (radius > 0) {
      const sweepCenter = getPoint(ctx.constructionRef.current, compassPhase.centerId as string)
      if (sweepCenter) {
        const startAngle = compassPhase.startAngle as number
        const cumulativeSweep = compassPhase.cumulativeSweep as number
        const tipAngle = startAngle + cumulativeSweep
        const tipWorldX = sweepCenter.x + Math.cos(tipAngle) * radius
        const tipWorldY = sweepCenter.y + Math.sin(tipAngle) * radius
        const tipDx = tipWorldX - v.center.x
        const tipDy = v.center.y - tipWorldY // screen Y inverted
        const tipPad = pad * AUTO_FIT_TIP_PAD_FRACTION
        let tipMaxPpu = v.pixelsPerUnit
        if (tipDx > 0.001) {
          const limit = (fitRect.right - tipPad - cssWidth / 2) / tipDx
          if (limit > 0) tipMaxPpu = Math.min(tipMaxPpu, limit)
        } else if (tipDx < -0.001) {
          const limit = (fitRect.left + tipPad - cssWidth / 2) / tipDx
          if (limit > 0) tipMaxPpu = Math.min(tipMaxPpu, limit)
        }
        if (tipDy > 0.001) {
          const limit = (fitRect.bottom - tipPad - cssHeight / 2) / tipDy
          if (limit > 0) tipMaxPpu = Math.min(tipMaxPpu, limit)
        } else if (tipDy < -0.001) {
          const limit = (fitRect.top + tipPad - cssHeight / 2) / tipDy
          if (limit > 0) tipMaxPpu = Math.min(tipMaxPpu, limit)
        }
        if (tipMaxPpu < v.pixelsPerUnit && tipMaxPpu >= AUTO_FIT_MIN_PPU) {
          v.pixelsPerUnit = tipMaxPpu
        }
      }
    }
  }

  // ── Flag redraw if viewport moved ──
  if (
    Math.abs(v.center.x - prevCx) > 0.001 ||
    Math.abs(v.center.y - prevCy) > 0.001 ||
    Math.abs(v.pixelsPerUnit - prevPpu) > 0.01
  ) {
    ctx.needsDrawRef.current = true
  }
}
