'use client'

import type React from 'react'
import { createContext, useContext, useMemo } from 'react'
import { useDecomposition } from '@/contexts/DecompositionContext'
import type { PedagogicalSegment, UnifiedStepData } from '@/utils/unifiedStepGenerator'
import { ReasonTooltip } from './ReasonTooltip'
import './decomposition.css'

// ============================================================================
// Internal Context for term hover coordination
// ============================================================================

interface InternalDecompositionContextType {
  activeTerms: Set<number>
  activeSegmentId: string | null
  addActiveTerm: (termIndex: number, segmentId?: string) => void
  removeActiveTerm: (termIndex: number, segmentId?: string) => void
}

const InternalDecompositionContext = createContext<InternalDecompositionContextType>({
  activeTerms: new Set(),
  activeSegmentId: null,
  addActiveTerm: () => {},
  removeActiveTerm: () => {},
})

// ============================================================================
// TermSpan Component
// ============================================================================

interface TermSpanProps {
  termIndex: number
  text: string
  segment?: PedagogicalSegment
  isCurrentStep?: boolean
}

function TermSpan({ termIndex, text, segment, isCurrentStep = false }: TermSpanProps) {
  const { addActiveTerm, removeActiveTerm } = useContext(InternalDecompositionContext)
  const rule = segment?.plan[0]?.rule

  // Only show styling for terms that have pedagogical reasoning
  if (!rule) {
    return <span className="term term--plain">{text}</span>
  }

  // Determine CSS classes based on current step only
  const cssClasses = ['term', isCurrentStep && 'term--current'].filter(Boolean).join(' ')

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
      data-element="decomposition-term"
      data-term-index={termIndex}
      className={cssClasses}
      onMouseEnter={() => handleTermHover(true)}
      onMouseLeave={() => handleTermHover(false)}
      style={{ cursor: 'pointer' }}
    >
      {text}
    </span>
  )
}

// ============================================================================
// SegmentGroup Component
// ============================================================================

interface SegmentGroupProps {
  segment: PedagogicalSegment
  steps: UnifiedStepData[]
  children: React.ReactNode
}

function SegmentGroup({ segment, steps, children }: SegmentGroupProps) {
  const { addActiveTerm, removeActiveTerm } = useContext(InternalDecompositionContext)

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
      provenance={provenance}
    >
      <span
        data-element="segment-group"
        data-segment-id={segment.id}
        className="segment-group"
        onMouseEnter={() => handleHighlightChange(true)}
        onMouseLeave={() => handleHighlightChange(false)}
      >
        {children}
      </span>
    </ReasonTooltip>
  )
}

// ============================================================================
// DecompositionDisplay Component
// ============================================================================

/**
 * Renders the decomposition string with interactive terms and tooltips.
 *
 * Must be used inside a DecompositionProvider.
 *
 * @example
 * ```tsx
 * <DecompositionProvider startValue={0} targetValue={45}>
 *   <DecompositionDisplay />
 * </DecompositionProvider>
 * ```
 */
export function DecompositionDisplay() {
  const {
    fullDecomposition,
    termPositions,
    segments,
    steps,
    currentStepIndex,
    activeTermIndices,
    setActiveTermIndices,
    setActiveIndividualTermIndex,
    getGroupTermIndicesFromTermIndex,
  } = useDecomposition()

  // Build a quick lookup: termIndex -> segment
  const termIndexToSegment = useMemo(() => {
    const map = new Map<number, PedagogicalSegment>()
    segments?.forEach((seg) => seg.termIndices.forEach((i) => map.set(i, seg)))
    return map
  }, [segments])

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

  // Term hover handlers
  const addActiveTerm = (termIndex: number, _segmentId?: string) => {
    // Set individual term highlight (orange glow)
    setActiveIndividualTermIndex(termIndex)

    // Set group term highlights (blue glow) - for complement groups, highlight only the target column
    const groupTermIndices = getGroupTermIndicesFromTermIndex(termIndex)

    if (groupTermIndices.length > 0) {
      // For complement groups, highlight only the target column (rhsPlace, not individual termPlaces)
      // Use any term from the group since they all share the same rhsPlace (target column)
      setActiveTermIndices(new Set([termIndex]))
    } else {
      // This is a standalone term, just highlight it
      setActiveTermIndices(new Set([termIndex]))
    }
  }

  const removeActiveTerm = (_termIndex: number, _segmentId?: string) => {
    // Clear individual term highlight
    setActiveIndividualTermIndex(null)

    // Clear group term highlights
    setActiveTermIndices(new Set())
  }

  // Render elements with segment groupings
  const renderElements = () => {
    const elements: React.ReactNode[] = []
    let cursor = 0

    for (let termIndex = 0; termIndex < termPositions.length; termIndex++) {
      const { startIndex, endIndex } = termPositions[termIndex]
      const segment = termIndexToSegment.get(termIndex)

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

          segmentElements.push(
            <TermSpan
              key={`seg-term-${segTermIndex}`}
              termIndex={segTermIndex}
              text={segText}
              segment={segment}
              isCurrentStep={segTermIndex === currentStepIndex}
            />
          )

          segmentCursor = segPos.endIndex
        }

        elements.push(
          <SegmentGroup key={`segment-${segment.id}`} segment={segment} steps={steps}>
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
    <InternalDecompositionContext.Provider
      value={{
        activeTerms: activeTermIndices,
        activeSegmentId,
        addActiveTerm,
        removeActiveTerm,
      }}
    >
      <div data-element="decomposition-display" className="decomposition">
        {renderElements()}
      </div>
    </InternalDecompositionContext.Provider>
  )
}
