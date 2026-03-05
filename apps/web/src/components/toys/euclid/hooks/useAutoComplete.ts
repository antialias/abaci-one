import { useState, useEffect } from 'react'
import type { ConstructionState, IntersectionCandidate, PropositionStep } from '../types'
import { resolveSelector } from '../engine/selectors'
import { isCandidateBeyondPoint } from '../engine/intersections'
import { getPoint } from '../engine/constructionState'

interface UseAutoCompleteOptions {
  steps: PropositionStep[]
  currentStepRef: React.MutableRefObject<number>
  resolvedStepOverridesRef: React.MutableRefObject<Map<number, Partial<PropositionStep>>>
  constructionRef: React.MutableRefObject<ConstructionState>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  handleCommitCircle: (centerId: string, radiusPointId: string) => void
  handleCommitSegment: (fromId: string, toId: string) => void
  handleCommitExtend: (baseId: string, throughId: string, projX: number, projY: number) => void
  handleMarkIntersection: (candidate: IntersectionCandidate) => void
  handleCommitMacro: (propId: number, inputPointIds: string[]) => void
}

export function useAutoComplete({
  steps,
  currentStepRef,
  resolvedStepOverridesRef,
  constructionRef,
  candidatesRef,
  handleCommitCircle,
  handleCommitSegment,
  handleCommitExtend,
  handleMarkIntersection,
  handleCommitMacro,
}: UseAutoCompleteOptions) {
  const [autoCompleting, setAutoCompleting] = useState(false)

  useEffect(() => {
    if (!autoCompleting) return

    const interval = setInterval(() => {
      const step = currentStepRef.current
      if (step >= steps.length) {
        setAutoCompleting(false)
        return
      }

      // Use resolved override if available (for adaptive steps like Prop 5)
      const overrides = resolvedStepOverridesRef.current.get(step)
      const expected = overrides?.expected ?? steps[step].expected

      if (expected.type === 'compass') {
        handleCommitCircle(expected.centerId, expected.radiusPointId)
      } else if (expected.type === 'straightedge') {
        handleCommitSegment(expected.fromId, expected.toId)
      } else if (expected.type === 'intersection') {
        const state = constructionRef.current
        const candidates = candidatesRef.current
        const resolvedA = expected.ofA != null ? resolveSelector(expected.ofA, state) : null
        const resolvedB = expected.ofB != null ? resolveSelector(expected.ofB, state) : null

        if (resolvedA && resolvedB) {
          const match = candidates.find((c) => {
            const matches =
              (c.ofA === resolvedA && c.ofB === resolvedB) ||
              (c.ofA === resolvedB && c.ofB === resolvedA)
            if (!matches) return false
            if (expected.beyondId) {
              return isCandidateBeyondPoint(c, expected.beyondId, c.ofA, c.ofB, state)
            }
            const hasHigher = candidates.some(
              (other) =>
                other !== c &&
                ((other.ofA === resolvedA && other.ofB === resolvedB) ||
                  (other.ofA === resolvedB && other.ofB === resolvedA)) &&
                other.y > c.y
            )
            return !hasHigher
          })
          if (match) {
            handleMarkIntersection(match)
          }
        }
      } else if (expected.type === 'extend') {
        if (expected.distance != null) {
          // Fixed distance — projX/projY are ignored
          handleCommitExtend(expected.baseId, expected.throughId, 0, 0)
        } else {
          // Free extend: compute a default position (extend by segment length)
          const basePt = getPoint(constructionRef.current, expected.baseId)
          const throughPt = getPoint(constructionRef.current, expected.throughId)
          if (basePt && throughPt) {
            const edx = throughPt.x - basePt.x
            const edy = throughPt.y - basePt.y
            const elen = Math.sqrt(edx * edx + edy * edy)
            if (elen > 0.001) {
              const dirX = edx / elen
              const dirY = edy / elen
              handleCommitExtend(
                expected.baseId,
                expected.throughId,
                throughPt.x + dirX * elen,
                throughPt.y + dirY * elen
              )
            }
          }
        }
      } else if (expected.type === 'macro') {
        handleCommitMacro(expected.propId, expected.inputPointIds)
      }
    }, 250)

    return () => clearInterval(interval)
  }, [
    autoCompleting,
    steps,
    handleCommitCircle,
    handleCommitSegment,
    handleCommitExtend,
    handleMarkIntersection,
    handleCommitMacro,
  ])

  return { autoCompleting, setAutoCompleting }
}
