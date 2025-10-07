'use client'

import type React from 'react'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { ReasonTooltip } from './ReasonTooltip'
import { useTutorialContext } from './TutorialContext'
import { useTutorialUI } from './TutorialUIContext'
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
  removeActiveTerm: () => {},
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

function TermSpan({ termIndex, text, segment, reason, isCurrentStep = false }: TermSpanProps) {
  const { activeSegmentId, addActiveTerm, removeActiveTerm } = useContext(DecompositionContext)
  const rule = reason?.rule ?? segment?.plan[0]?.rule

  // Only show styling for terms that have pedagogical reasoning
  if (!rule) {
    return <span className="term term--plain">{text}</span>
  }

  // Determine CSS classes based on current step only
  const cssClasses = [
    'term',
    isCurrentStep && 'term--current', // New class for current step highlighting
  ]
    .filter(Boolean)
    .join(' ')

  // Individual term hover handlers for two-level highlighting
  const handleTermHover = (isHovering: boolean) => {
    if (isHovering) {
      addActiveTerm(termIndex, segment?.id)
    } else {
      removeActiveTerm(termIndex, segment?.id)
    }
  }

  return (
    <span
      className={cssClasses}
      onMouseEnter={() => handleTermHover(true)}
      onMouseLeave={() => handleTermHover(false)}
      style={{ cursor: 'pointer' }}
    >
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
  const { addActiveTerm, removeActiveTerm } = useContext(DecompositionContext)

  // Get steps from tutorial context instead of props
  const { unifiedSteps: steps } = useTutorialContext()

  // Calculate the original term that was expanded
  // digit * 10^place gives us the original value (e.g., digit=5, place=1 -> 50)
  const originalValue = (segment.digit * 10 ** segment.place).toString()

  // Get provenance from the first step in this segment
  const firstStepIndex = segment.termIndices[0]
  const firstStep = steps[firstStepIndex]
  const provenance = firstStep?.provenance

  const handleHighlightChange = (active: boolean) => {
    // Only handle highlighting, let HoverCard manage its own open/close timing
    if (active) {
      segment.termIndices.forEach((termIndex) => addActiveTerm(termIndex, segment.id))
    } else {
      segment.termIndices.forEach((termIndex) => removeActiveTerm(termIndex, segment.id))
    }
  }

  return (
    <ReasonTooltip
      termIndex={segment.termIndices[0]} // Use first term for tooltip ID
      segment={segment}
      originalValue={originalValue}
      steps={steps}
      provenance={provenance} // NEW: Pass provenance data
    >
      <span
        className="segment-group"
        onMouseEnter={() => handleHighlightChange(true)}
        onMouseLeave={() => handleHighlightChange(false)}
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
  termReasons,
}: DecompositionWithReasonsProps) {
  // Get context state including term highlighting
  const {
    state,
    activeTermIndices,
    setActiveTermIndices,
    activeIndividualTermIndex,
    setActiveIndividualTermIndex,
    getGroupTermIndicesFromTermIndex,
    unifiedSteps,
  } = useTutorialContext()
  const currentStepIndex = state.currentMultiStep
  const ui = useTutorialUI()

  // Build segment boundaries and ranges
  const _segmentRanges = useMemo(() => {
    if (!segments) return []
    return segments
      .map((seg) => ({
        segment: seg,
        startIndex: Math.min(
          ...seg.termIndices.map((i) => termPositions[i]?.startIndex ?? Infinity)
        ),
        endIndex: Math.max(...seg.termIndices.map((i) => termPositions[i]?.endIndex ?? 0)),
      }))
      .sort((a, b) => a.startIndex - b.startIndex)
  }, [segments, termPositions])

  // Build a quick lookup: termIndex -> segment
  const termIndexToSegment = useMemo(() => {
    const map = new Map<number, PedagogicalSegment>()
    segments?.forEach((seg) => seg.termIndices.forEach((i) => map.set(i, seg)))
    return map
  }, [segments])

  // Update active segment in UI context based on current step
  useEffect(() => {
    const currentSegment = termIndexToSegment.get(currentStepIndex) || null
    ui.setActiveSegment(currentSegment)
  }, [currentStepIndex, termIndexToSegment, ui])

  // Determine which segment should be highlighted based on active terms
  const activeSegmentId = useMemo(() => {
    if (activeTermIndices.size === 0) return null

    // Find the segment that contains any of the active terms
    for (const termIndex of activeTermIndices) {
      const segment = termIndexToSegment.get(termIndex)
      if (segment) {
        return segment.id
      }
    }
    return null
  }, [activeTermIndices, termIndexToSegment])

  const addActiveTerm = (termIndex: number, _segmentId?: string) => {
    console.log('🎯 TERM HOVER START - termIndex:', termIndex)

    // Debug: Get the unified steps to see provenance data
    const hoveredStep = unifiedSteps[termIndex]

    console.log('📊 Hovered step data:', {
      termIndex,
      mathematicalTerm: hoveredStep?.mathematicalTerm,
      provenance: hoveredStep?.provenance,
      hasGroupId: !!hoveredStep?.provenance?.groupId,
      groupId: hoveredStep?.provenance?.groupId,
      rhsPlace: hoveredStep?.provenance?.rhsPlace,
      rhsValue: hoveredStep?.provenance?.rhsValue,
    })

    // Set individual term highlight (orange glow)
    setActiveIndividualTermIndex(termIndex)
    console.log('🟠 Set individual term highlight:', termIndex)

    // Set group term highlights (blue glow) - for complement groups, highlight only the target column
    const groupTermIndices = getGroupTermIndicesFromTermIndex(termIndex)
    console.log('🔵 Group term indices found:', groupTermIndices)

    if (groupTermIndices.length > 0) {
      // Debug: Log all terms in the group
      console.log('📝 All terms in group:')
      groupTermIndices.forEach((idx) => {
        const step = unifiedSteps[idx]
        console.log(
          `  - Term ${idx}: "${step?.mathematicalTerm}" (termPlace: ${step?.provenance?.termPlace}, rhsPlace: ${step?.provenance?.rhsPlace}, groupId: ${step?.provenance?.groupId})`
        )
      })

      // For complement groups, highlight only the target column (rhsPlace, not individual termPlaces)
      // Use any term from the group since they all share the same rhsPlace (target column)
      setActiveTermIndices(new Set([termIndex]))
      console.log(
        '🎯 Set group highlight for target column (rhsPlace) using term index:',
        termIndex
      )
    } else {
      // This is a standalone term, just highlight it
      setActiveTermIndices(new Set([termIndex]))
      console.log('🎯 Set standalone term highlight')
    }

    console.log('✅ TERM HOVER COMPLETE')
  }

  const removeActiveTerm = (termIndex: number, _segmentId?: string) => {
    console.log('🚫 TERM HOVER END - termIndex:', termIndex)

    // Clear individual term highlight
    setActiveIndividualTermIndex(null)
    console.log('🟠 Cleared individual term highlight')

    // Clear group term highlights
    setActiveTermIndices(new Set())
    console.log('🔵 Cleared group term highlights')
  }

  // Slice the decomposition string using termPositions
  const _pieces: React.ReactNode[] = []
  const _cursor = 0

  // Render elements with segment groupings
  const renderElements = () => {
    const elements: React.ReactNode[] = []
    let cursor = 0
    const _currentSegmentIndex = 0

    for (let termIndex = 0; termIndex < termPositions.length; termIndex++) {
      const { startIndex, endIndex } = termPositions[termIndex]
      const segment = termIndexToSegment.get(termIndex)
      const reason = termReasons?.find((r) => r.termIndex === termIndex)

      // Add connector text before this term
      if (cursor < startIndex) {
        elements.push(
          <span key={`connector-${cursor}`}>{fullDecomposition.slice(cursor, startIndex)}</span>
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
          const segReason = termReasons?.find((r) => r.termIndex === segTermIndex)

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
      elements.push(<span key="trailing">{fullDecomposition.slice(cursor)}</span>)
    }

    return elements
  }

  return (
    <DecompositionContext.Provider
      value={{ activeTerms: activeTermIndices, activeSegmentId, addActiveTerm, removeActiveTerm }}
    >
      <div className="decomposition">{renderElements()}</div>
    </DecompositionContext.Provider>
  )
}
