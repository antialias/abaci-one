import type { ConstructionState, EuclidViewportState } from '../types'
import { getAllSegments, getPoint } from '../engine/constructionState'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import type { FactStore } from '../engine/factStore'
import { queryEquality } from '../engine/factStore'
import { distancePair } from '../engine/facts'

const TICK_LENGTH = 6 // px each side of the line
const TICK_SPACING = 4 // px between parallel tick marks
const TICK_COLOR = '#5b8a8a'

function toScreen(wx: number, wy: number, viewport: EuclidViewportState, w: number, h: number) {
  return worldToScreen2D(
    wx,
    wy,
    viewport.center.x,
    viewport.center.y,
    viewport.pixelsPerUnit,
    viewport.pixelsPerUnit,
    w,
    h
  )
}

/** A line between two points to consider for equality marking. */
interface LinePair {
  fromId: string
  toId: string
}

/**
 * Draw equality tick marks on construction segments (and result segments)
 * whose distances are formally known-equal from the fact store.
 *
 * Result segments (e.g. AF in I.2) are included so the Q.E.D. line
 * and the given segment it equals (BC) both get matching tick marks.
 */
export function renderEqualityMarks(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  w: number,
  h: number,
  factStore: FactStore,
  hiddenElementIds?: Set<string>,
  resultSegments?: Array<{ fromId: string; toId: string }>
) {
  // Collect all lines to consider: construction segments + result segments
  const lines: LinePair[] = []
  const seen = new Set<string>()

  for (const seg of getAllSegments(state)) {
    if (hiddenElementIds?.has(seg.id)) continue
    const key = distancePair(seg.fromId, seg.toId)
    const k = `${key.a}|${key.b}`
    if (!seen.has(k)) {
      seen.add(k)
      lines.push({ fromId: seg.fromId, toId: seg.toId })
    }
  }

  if (resultSegments) {
    for (const rs of resultSegments) {
      const key = distancePair(rs.fromId, rs.toId)
      const k = `${key.a}|${key.b}`
      if (!seen.has(k)) {
        seen.add(k)
        lines.push(rs)
      }
    }
  }

  if (lines.length < 2) return

  // Group lines by equality class via the fact store
  const groups: number[][] = []
  const lineGroup: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const dp = distancePair(lines[i].fromId, lines[i].toId)
    let foundGroup = -1

    for (let g = 0; g < groups.length; g++) {
      const rep = lines[groups[g][0]]
      const repDp = distancePair(rep.fromId, rep.toId)
      if (queryEquality(factStore, dp, repDp)) {
        foundGroup = g
        break
      }
    }

    if (foundGroup >= 0) {
      groups[foundGroup].push(i)
      lineGroup.push(foundGroup)
    } else {
      groups.push([i])
      lineGroup.push(groups.length - 1)
    }
  }

  // Assign tick counts — only groups with 2+ lines get marks
  let tickGroupNum = 0
  const groupTickCount = new Map<number, number>()
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].length >= 2) {
      tickGroupNum++
      groupTickCount.set(g, tickGroupNum)
    }
  }

  if (tickGroupNum === 0) return

  ctx.save()

  for (let i = 0; i < lines.length; i++) {
    const tickCount = groupTickCount.get(lineGroup[i])
    if (!tickCount) continue

    const line = lines[i]
    const from = getPoint(state, line.fromId)
    const to = getPoint(state, line.toId)
    if (!from || !to) continue

    const sf = toScreen(from.x, from.y, viewport, w, h)
    const st = toScreen(to.x, to.y, viewport, w, h)

    const dx = st.x - sf.x
    const dy = st.y - sf.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) continue

    const dirX = dx / len
    const dirY = dy / len

    // Perpendicular — pick the direction pointing more "up" on screen (lower Y)
    const pAx = -dirY,
      pAy = dirX
    const pBx = dirY,
      pBy = -dirX
    const perpX = pAy < pBy ? pAx : pBx
    const perpY = pAy < pBy ? pAy : pBy

    // Midpoint
    const mx = (sf.x + st.x) / 2
    const my = (sf.y + st.y) / 2

    // Draw tick marks
    ctx.strokeStyle = TICK_COLOR
    ctx.lineWidth = 1.5

    const totalWidth = (tickCount - 1) * TICK_SPACING
    const startOffset = -totalWidth / 2

    for (let t = 0; t < tickCount; t++) {
      const offset = startOffset + t * TICK_SPACING
      const cx = mx + dirX * offset
      const cy = my + dirY * offset

      ctx.beginPath()
      ctx.moveTo(cx + perpX * TICK_LENGTH, cy + perpY * TICK_LENGTH)
      ctx.lineTo(cx - perpX * TICK_LENGTH, cy - perpY * TICK_LENGTH)
      ctx.stroke()
    }
  }

  ctx.restore()
}
