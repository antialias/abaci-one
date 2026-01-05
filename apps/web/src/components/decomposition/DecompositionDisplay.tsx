"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDecomposition } from "@/contexts/DecompositionContext";
import type {
  PedagogicalSegment,
  UnifiedStepData,
} from "@/utils/unifiedStepGenerator";
import { ReasonTooltip } from "./ReasonTooltip";
import "./decomposition.css";

// ============================================================================
// Internal Context for term hover coordination
// ============================================================================

interface InternalDecompositionContextType {
  activeTerms: Set<number>;
  activeSegmentId: string | null;
  addActiveTerm: (termIndex: number, segmentId?: string) => void;
  removeActiveTerm: (termIndex: number, segmentId?: string) => void;
}

const InternalDecompositionContext =
  createContext<InternalDecompositionContextType>({
    activeTerms: new Set(),
    activeSegmentId: null,
    addActiveTerm: () => {},
    removeActiveTerm: () => {},
  });

// ============================================================================
// TermSpan Component
// ============================================================================

interface TermSpanProps {
  termIndex: number;
  text: string;
  segment?: PedagogicalSegment;
  isCurrentStep?: boolean;
}

function TermSpan({
  termIndex,
  text,
  segment,
  isCurrentStep = false,
}: TermSpanProps) {
  const { addActiveTerm, removeActiveTerm } = useContext(
    InternalDecompositionContext,
  );
  const rule = segment?.plan[0]?.rule;

  // Only show styling for terms that have pedagogical reasoning
  if (!rule) {
    return <span className="term term--plain">{text}</span>;
  }

  // Determine CSS classes based on current step only
  const cssClasses = ["term", isCurrentStep && "term--current"]
    .filter(Boolean)
    .join(" ");

  // Individual term hover handlers for two-level highlighting
  const handleTermHover = (isHovering: boolean) => {
    if (isHovering) {
      addActiveTerm(termIndex, segment?.id);
    } else {
      removeActiveTerm(termIndex, segment?.id);
    }
  };

  return (
    <span
      data-element="decomposition-term"
      data-term-index={termIndex}
      className={cssClasses}
      onMouseEnter={() => handleTermHover(true)}
      onMouseLeave={() => handleTermHover(false)}
      style={{ cursor: "pointer" }}
    >
      {text}
    </span>
  );
}

// ============================================================================
// SegmentGroup Component
// ============================================================================

interface SegmentGroupProps {
  segment: PedagogicalSegment;
  steps: UnifiedStepData[];
  children: React.ReactNode;
}

function SegmentGroup({ segment, steps, children }: SegmentGroupProps) {
  const { addActiveTerm, removeActiveTerm } = useContext(
    InternalDecompositionContext,
  );

  // Calculate the original term that was expanded
  // digit * 10^place gives us the original value (e.g., digit=5, place=1 -> 50)
  const originalValue = (segment.digit * 10 ** segment.place).toString();

  // Get provenance from the first step in this segment
  const firstStepIndex = segment.termIndices[0];
  const firstStep = steps[firstStepIndex];
  const provenance = firstStep?.provenance;

  const handleHighlightChange = (active: boolean) => {
    // Only handle highlighting, let HoverCard manage its own open/close timing
    if (active) {
      segment.termIndices.forEach((termIndex) =>
        addActiveTerm(termIndex, segment.id),
      );
    } else {
      segment.termIndices.forEach((termIndex) =>
        removeActiveTerm(termIndex, segment.id),
      );
    }
  };

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
  );
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
    isMeaningfulDecomposition,
  } = useDecomposition();

  // Don't render if decomposition is not meaningful (e.g., "5 = 5")
  if (!isMeaningfulDecomposition) {
    return null;
  }

  // Refs for overflow detection
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [needsMultiLine, setNeedsMultiLine] = useState(false);

  // Build a quick lookup: termIndex -> segment
  const termIndexToSegment = useMemo(() => {
    const map = new Map<number, PedagogicalSegment>();
    segments?.forEach((seg) => seg.termIndices.forEach((i) => map.set(i, seg)));
    return map;
  }, [segments]);

  // Determine which segment should be highlighted based on active terms
  const activeSegmentId = useMemo(() => {
    if (activeTermIndices.size === 0) return null;

    // Find the segment that contains any of the active terms
    for (const termIndex of activeTermIndices) {
      const segment = termIndexToSegment.get(termIndex);
      if (segment) {
        return segment.id;
      }
    }
    return null;
  }, [activeTermIndices, termIndexToSegment]);

  // Detect overflow and enable multi-line mode if needed
  // Uses a hidden measurement element that always renders in single-line mode
  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const checkOverflow = () => {
      // measureRef always contains the single-line version, so we can
      // reliably compare its width to the container width
      const singleLineWidth = measure.scrollWidth;
      const containerWidth = container.clientWidth;

      // Add a small buffer (2px) to avoid edge cases
      setNeedsMultiLine(singleLineWidth > containerWidth + 2);
    };

    // Check on mount and content changes
    checkOverflow();

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [fullDecomposition]);

  // Term hover handlers
  const addActiveTerm = (termIndex: number, _segmentId?: string) => {
    // Set individual term highlight (orange glow)
    setActiveIndividualTermIndex(termIndex);

    // Set group term highlights (blue glow) - for complement groups, highlight only the target column
    const groupTermIndices = getGroupTermIndicesFromTermIndex(termIndex);

    if (groupTermIndices.length > 0) {
      // For complement groups, highlight only the target column (rhsPlace, not individual termPlaces)
      // Use any term from the group since they all share the same rhsPlace (target column)
      setActiveTermIndices(new Set([termIndex]));
    } else {
      // This is a standalone term, just highlight it
      setActiveTermIndices(new Set([termIndex]));
    }
  };

  const removeActiveTerm = (_termIndex: number, _segmentId?: string) => {
    // Clear individual term highlight
    setActiveIndividualTermIndex(null);

    // Clear group term highlights
    setActiveTermIndices(new Set());
  };

  // Find positions of '=' signs in fullDecomposition for line breaking
  const equalSignPositions = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < fullDecomposition.length; i++) {
      if (fullDecomposition[i] === "=") {
        positions.push(i);
      }
    }
    return positions;
  }, [fullDecomposition]);

  // Render elements for a given range of the decomposition string
  const renderElementsForRange = (
    rangeStart: number,
    rangeEnd: number,
    keyPrefix: string,
  ) => {
    const elements: React.ReactNode[] = [];
    let cursor = rangeStart;

    for (let termIndex = 0; termIndex < termPositions.length; termIndex++) {
      const { startIndex, endIndex } = termPositions[termIndex];

      // Skip terms outside our range
      if (endIndex <= rangeStart || startIndex >= rangeEnd) continue;

      const segment = termIndexToSegment.get(termIndex);

      // Add connector text before this term (within range)
      const connectorStart = Math.max(cursor, rangeStart);
      const connectorEnd = Math.min(startIndex, rangeEnd);
      if (connectorStart < connectorEnd) {
        elements.push(
          <span key={`${keyPrefix}-connector-${connectorStart}`}>
            {fullDecomposition.slice(connectorStart, connectorEnd)}
          </span>,
        );
      }

      // Check if this term starts a new segment
      if (segment && segment.termIndices[0] === termIndex) {
        // This is the first term of a segment - wrap all segment terms
        const segmentElements: React.ReactNode[] = [];
        let segmentCursor = Math.max(startIndex, rangeStart);

        for (const segTermIndex of segment.termIndices) {
          const segPos = termPositions[segTermIndex];
          if (!segPos) continue;

          // Skip segment terms outside our range
          if (segPos.endIndex <= rangeStart || segPos.startIndex >= rangeEnd)
            continue;

          // Add connector within segment (within range)
          const segConnectorStart = Math.max(segmentCursor, rangeStart);
          const segConnectorEnd = Math.min(segPos.startIndex, rangeEnd);
          if (segConnectorStart < segConnectorEnd) {
            segmentElements.push(
              <span key={`${keyPrefix}-seg-connector-${segConnectorStart}`}>
                {fullDecomposition.slice(segConnectorStart, segConnectorEnd)}
              </span>,
            );
          }

          const termStart = Math.max(segPos.startIndex, rangeStart);
          const termEnd = Math.min(segPos.endIndex, rangeEnd);
          const segText = fullDecomposition.slice(termStart, termEnd);

          if (segText) {
            segmentElements.push(
              <TermSpan
                key={`${keyPrefix}-seg-term-${segTermIndex}`}
                termIndex={segTermIndex}
                text={segText}
                segment={segment}
                isCurrentStep={segTermIndex === currentStepIndex}
              />,
            );
          }

          segmentCursor = segPos.endIndex;
        }

        if (segmentElements.length > 0) {
          elements.push(
            <SegmentGroup
              key={`${keyPrefix}-segment-${segment.id}`}
              segment={segment}
              steps={steps}
            >
              {segmentElements}
            </SegmentGroup>,
          );
        }

        // Skip ahead past all terms in this segment
        const lastSegTermIndex =
          segment.termIndices[segment.termIndices.length - 1];
        const lastSegPos = termPositions[lastSegTermIndex];
        cursor = Math.min(lastSegPos?.endIndex ?? endIndex, rangeEnd);
        termIndex = lastSegTermIndex; // Will be incremented by for loop
      } else if (!segment) {
        // Regular term not in a segment
        const termStart = Math.max(startIndex, rangeStart);
        const termEnd = Math.min(endIndex, rangeEnd);
        const termText = fullDecomposition.slice(termStart, termEnd);

        if (termText) {
          elements.push(
            <TermSpan
              key={`${keyPrefix}-term-${termIndex}`}
              termIndex={termIndex}
              text={termText}
              segment={segment}
              isCurrentStep={termIndex === currentStepIndex}
            />,
          );
        }
        cursor = termEnd;
      }
      // If this term is part of a segment but not the first, it was already handled above
    }

    // Add trailing text within range
    if (cursor < rangeEnd) {
      elements.push(
        <span key={`${keyPrefix}-trailing`}>
          {fullDecomposition.slice(cursor, rangeEnd)}
        </span>,
      );
    }

    return elements;
  };

  // Render elements - either single line or multi-line split on '='
  const renderElements = () => {
    if (!needsMultiLine || equalSignPositions.length === 0) {
      // Single line mode
      return renderElementsForRange(0, fullDecomposition.length, "single");
    }

    // Multi-line mode: split on '=' signs
    // First line: everything before first '='
    // Subsequent lines: start with '=' and go to next '=' (or end)
    const lines: React.ReactNode[] = [];

    // First line: from start to first '='
    const firstEqualPos = equalSignPositions[0];
    if (firstEqualPos > 0) {
      lines.push(
        <div key="line-0" className="decomposition-line">
          {renderElementsForRange(0, firstEqualPos, "line-0")}
        </div>,
      );
    }

    // Subsequent lines: each starts with '=' and goes to next '=' or end
    for (let i = 0; i < equalSignPositions.length; i++) {
      const lineStart = equalSignPositions[i];
      const lineEnd = equalSignPositions[i + 1] ?? fullDecomposition.length;

      lines.push(
        <div key={`line-${i + 1}`} className="decomposition-line">
          {renderElementsForRange(lineStart, lineEnd, `line-${i + 1}`)}
        </div>,
      );
    }

    return lines;
  };

  return (
    <InternalDecompositionContext.Provider
      value={{
        activeTerms: activeTermIndices,
        activeSegmentId,
        addActiveTerm,
        removeActiveTerm,
      }}
    >
      <div
        ref={containerRef}
        data-element="decomposition-display"
        className={`decomposition ${needsMultiLine ? "decomposition--multiline" : ""}`}
      >
        {/* Hidden measurement element - always renders single-line to measure true width */}
        <div
          ref={measureRef}
          className="decomposition-measure"
          aria-hidden="true"
        >
          {renderElementsForRange(0, fullDecomposition.length, "measure")}
        </div>
        {/* Visible content - may be multi-line if overflow detected */}
        <div className="decomposition-content">{renderElements()}</div>
      </div>
    </InternalDecompositionContext.Provider>
  );
}

/**
 * DecompositionSection - A self-contained section with label that hides when decomposition is not meaningful
 *
 * Use this when you want the entire section (including "Step-by-Step" label) to disappear
 * when the decomposition is trivial (e.g., "5 = 5").
 *
 * Must be used inside a DecompositionProvider.
 */
export function DecompositionSection({
  label = "Step-by-Step",
  className,
  labelClassName,
  contentClassName,
}: {
  label?: string;
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
}) {
  const { isMeaningfulDecomposition } = useDecomposition();

  if (!isMeaningfulDecomposition) {
    return null;
  }

  return (
    <div data-element="decomposition-section" className={className}>
      <div data-element="decomposition-label" className={labelClassName}>
        {label}
      </div>
      <div data-element="decomposition-content" className={contentClassName}>
        <DecompositionDisplay />
      </div>
    </div>
  );
}
