'use client'

import React, { useMemo, useState, createContext, useContext } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ReasonTooltip } from './ReasonTooltip'
import type { UnifiedStepData } from '../../utils/unifiedStepGenerator'
import { useTutorialContext } from './TutorialContext'
import './decomposition-reasoning.css'

export type PedagogicalRule = 'Direct' | 'FiveComplement' | 'TenComplement' | 'Cascade'

export interface SegmentDecision {
  rule: PedagogicalRule
  conditions: string[]
  explanation: string[]
}

export interface PedagogicalSegment {
  id: string
  place: number
  digit: number
  a: number
  L: number
  U: 0 | 1
  goal: string
  plan: SegmentDecision[]
  expression: string
  termIndices: number[]
  termRange: { startIndex: number; endIndex: number }
}

export interface TermReason {
  termIndex: number
  segmentId: string
  rule: PedagogicalRule
  shortReason: string
  bullets?: string[]
}

// Context for tracking active terms to highlight related segments
interface DecompositionContextType {
  activeTerms: Set<number>
  activeSegmentId: string | null
  addActiveTerm: (termIndex: number, segmentId?: string) => void
  removeActiveTerm: (termIndex: number, segmentId?: string) => void
}

const DecompositionContext = createContext<DecompositionContextType>({
  activeTerms: new Set(),
  activeSegmentId: null,
  addActiveTerm: () => {},
  removeActiveTerm: () => {}
})

interface DecompositionWithReasonsProps {
  fullDecomposition: string
  termPositions: Array<{ startIndex: number; endIndex: number }>
  segments?: PedagogicalSegment[]
  termReasons?: TermReason[]
  // NOTE: steps now comes from tutorial context, not props
}

interface TermSpanProps {
  termIndex: number
  text: string
  segment?: PedagogicalSegment
  reason?: TermReason
  isCurrentStep?: boolean
}

function TermSpan({
  termIndex,
  text,
  segment,
  reason,
  isCurrentStep = false
}: TermSpanProps) {
  const { activeSegmentId } = useContext(DecompositionContext)
  const rule = reason?.rule ?? segment?.plan[0]?.rule

  // Only show styling for terms that have pedagogical reasoning
  if (!rule) {
    return <span className="term term--plain">{text}</span>
  }

  // Determine CSS classes based on current step only
  const cssClasses = [
    'term',
    isCurrentStep && 'term--current' // New class for current step highlighting
  ].filter(Boolean).join(' ')

  return (
    <span className={cssClasses}>
      {text}
    </span>
  )
}

// Component for rendering a segment group with unified hover target
interface SegmentGroupProps {
  segment: PedagogicalSegment
  fullDecomposition: string
  termPositions: Array<{ startIndex: number; endIndex: number }>
  termReasons?: TermReason[]
  children: React.ReactNode
}

function SegmentGroup({ segment, fullDecomposition, children }: SegmentGroupProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const { addActiveTerm, removeActiveTerm } = useContext(DecompositionContext)

  // Get steps from tutorial context instead of props
  const { unifiedSteps: steps } = useTutorialContext()

  // Calculate the original term that was expanded
  // digit * 10^place gives us the original value (e.g., digit=5, place=1 -> 50)
  const originalValue = (segment.digit * Math.pow(10, segment.place)).toString()

  // Get provenance from the first step in this segment
  const firstStepIndex = segment.termIndices[0]
  const firstStep = steps[firstStepIndex]
  const provenance = firstStep?.provenance



  const handleTooltipChange = (open: boolean) => {
    setTooltipOpen(open)
    // Activate/deactivate all terms in this segment
    if (open) {
      segment.termIndices.forEach(termIndex => addActiveTerm(termIndex, segment.id))
    } else {
      segment.termIndices.forEach(termIndex => removeActiveTerm(termIndex, segment.id))
    }
  }

  return (
    <ReasonTooltip
      termIndex={segment.termIndices[0]} // Use first term for tooltip ID
      segment={segment}
      originalValue={originalValue}
      steps={steps}
      open={tooltipOpen}
      onOpenChange={handleTooltipChange}
      provenance={provenance} // NEW: Pass provenance data
    >
      <span
        className="segment-group"
        onMouseEnter={() => handleTooltipChange(true)}
        onMouseLeave={() => handleTooltipChange(false)}
        onFocus={() => handleTooltipChange(true)}
        onBlur={() => handleTooltipChange(false)}
      >
        {children}
      </span>
    </ReasonTooltip>
  )
}

export function DecompositionWithReasons({
  fullDecomposition,
  termPositions,
  segments,
  termReasons
}: DecompositionWithReasonsProps) {
  const [activeTerms, setActiveTerms] = useState<Set<number>>(new Set())

  // Get current step index from tutorial context
  const { state } = useTutorialContext()
  const currentStepIndex = state.currentMultiStep

  // Build segment boundaries and ranges
  const segmentRanges = useMemo(() => {
    if (!segments) return []
    return segments.map(seg => ({
      segment: seg,
      startIndex: Math.min(...seg.termIndices.map(i => termPositions[i]?.startIndex ?? Infinity)),
      endIndex: Math.max(...seg.termIndices.map(i => termPositions[i]?.endIndex ?? 0))
    })).sort((a, b) => a.startIndex - b.startIndex)
  }, [segments, termPositions])

  // Build a quick lookup: termIndex -> segment
  const termIndexToSegment = useMemo(() => {
    const map = new Map<number, PedagogicalSegment>()
    segments?.forEach(seg => seg.termIndices.forEach(i => map.set(i, seg)))
    return map
  }, [segments])

  // Determine which segment should be highlighted based on active terms
  const activeSegmentId = useMemo(() => {
    if (activeTerms.size === 0) return null

    // Find the segment that contains any of the active terms
    for (const termIndex of activeTerms) {
      const segment = termIndexToSegment.get(termIndex)
      if (segment) {
        return segment.id
      }
    }
    return null
  }, [activeTerms, termIndexToSegment])

  const addActiveTerm = (termIndex: number, segmentId?: string) => {
    setActiveTerms(prev => new Set([...prev, termIndex]))
  }

  const removeActiveTerm = (termIndex: number, segmentId?: string) => {
    setActiveTerms(prev => {
      const next = new Set(prev)
      next.delete(termIndex)
      return next
    })
  }

  // Slice the decomposition string using termPositions
  const pieces: React.ReactNode[] = []
  let cursor = 0

  // Render elements with segment groupings
  const renderElements = () => {
    const elements: React.ReactNode[] = []
    let cursor = 0
    let currentSegmentIndex = 0

    for (let termIndex = 0; termIndex < termPositions.length; termIndex++) {
      const { startIndex, endIndex } = termPositions[termIndex]
      const segment = termIndexToSegment.get(termIndex)
      const reason = termReasons?.find(r => r.termIndex === termIndex)

      // Add connector text before this term
      if (cursor < startIndex) {
        elements.push(
          <span key={`connector-${cursor}`}>
            {fullDecomposition.slice(cursor, startIndex)}
          </span>
        )
      }

      // Check if this term starts a new segment
      if (segment && segment.termIndices[0] === termIndex) {
        // This is the first term of a segment - wrap all segment terms
        const segmentElements: React.ReactNode[] = []
        let segmentCursor = startIndex

        for (const segTermIndex of segment.termIndices) {
          const segPos = termPositions[segTermIndex]
          if (!segPos) continue

          // Add connector within segment
          if (segmentCursor < segPos.startIndex) {
            segmentElements.push(
              <span key={`seg-connector-${segmentCursor}`}>
                {fullDecomposition.slice(segmentCursor, segPos.startIndex)}
              </span>
            )
          }

          const segText = fullDecomposition.slice(segPos.startIndex, segPos.endIndex)
          const segReason = termReasons?.find(r => r.termIndex === segTermIndex)

          segmentElements.push(
            <TermSpan
              key={`seg-term-${segTermIndex}`}
              termIndex={segTermIndex}
              text={segText}
              segment={segment}
              reason={segReason}
              isCurrentStep={segTermIndex === currentStepIndex}
            />
          )

          segmentCursor = segPos.endIndex
        }

        elements.push(
          <SegmentGroup
            key={`segment-${segment.id}`}
            segment={segment}
            fullDecomposition={fullDecomposition}
            termPositions={termPositions}
            termReasons={termReasons}
          >
            {segmentElements}
          </SegmentGroup>
        )

        // Skip ahead past all terms in this segment
        const lastSegTermIndex = segment.termIndices[segment.termIndices.length - 1]
        const lastSegPos = termPositions[lastSegTermIndex]
        cursor = lastSegPos?.endIndex ?? endIndex
        termIndex = lastSegTermIndex // Will be incremented by for loop

      } else if (!segment) {
        // Regular term not in a segment
        const termText = fullDecomposition.slice(startIndex, endIndex)
        elements.push(
          <TermSpan
            key={`term-${termIndex}`}
            termIndex={termIndex}
            text={termText}
            segment={segment}
            reason={reason}
            isCurrentStep={termIndex === currentStepIndex}
          />
        )
        cursor = endIndex
      }
      // If this term is part of a segment but not the first, it was already handled above
    }

    // Add trailing text
    if (cursor < fullDecomposition.length) {
      elements.push(
        <span key="trailing">
          {fullDecomposition.slice(cursor)}
        </span>
      )
    }

    return elements
  }

  return (
    <DecompositionContext.Provider value={{ activeTerms, activeSegmentId, addActiveTerm, removeActiveTerm }}>
      <Tooltip.Provider delayDuration={200} skipDelayDuration={100}>
        <div className="decomposition">
          {renderElements()}
        </div>
      </Tooltip.Provider>
    </DecompositionContext.Provider>
  )
}