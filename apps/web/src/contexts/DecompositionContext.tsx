"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  generateUnifiedInstructionSequence,
  type PedagogicalSegment,
  type UnifiedInstructionSequence,
  type UnifiedStepData,
} from "@/utils/unifiedStepGenerator";

// ============================================================================
// Types
// ============================================================================

export interface DecompositionContextConfig {
  /** Starting abacus value */
  startValue: number;
  /** Target abacus value to reach */
  targetValue: number;
  /** Current step index for highlighting (optional) */
  currentStepIndex?: number;
  /** Callback when active segment changes (optional) */
  onSegmentChange?: (segment: PedagogicalSegment | null) => void;
  /** Callback when a term is hovered (optional) */
  onTermHover?: (termIndex: number | null, columnIndex: number | null) => void;
  /** Number of abacus columns for column mapping (default: 5) */
  abacusColumns?: number;
}

export interface DecompositionContextType {
  // Generated data
  sequence: UnifiedInstructionSequence;
  fullDecomposition: string;
  isMeaningfulDecomposition: boolean;
  termPositions: Array<{ startIndex: number; endIndex: number }>;
  segments: PedagogicalSegment[];
  steps: UnifiedStepData[];

  // Configuration
  startValue: number;
  targetValue: number;
  currentStepIndex: number;
  abacusColumns: number;

  // Highlighting state
  activeTermIndices: Set<number>;
  setActiveTermIndices: (indices: Set<number>) => void;
  activeIndividualTermIndex: number | null;
  setActiveIndividualTermIndex: (index: number | null) => void;

  // Derived functions
  getColumnFromTermIndex: (
    termIndex: number,
    useGroupColumn?: boolean,
  ) => number | null;
  getTermIndicesFromColumn: (columnIndex: number) => number[];
  getGroupTermIndicesFromTermIndex: (termIndex: number) => number[];

  // Event handlers
  handleTermHover: (termIndex: number, isHovering: boolean) => void;
  handleColumnHover: (columnIndex: number, isHovering: boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

const DecompositionContext = createContext<DecompositionContextType | null>(
  null,
);

/**
 * Hook to access decomposition context. Throws if not inside DecompositionProvider.
 */
export function useDecomposition(): DecompositionContextType {
  const context = useContext(DecompositionContext);
  if (!context) {
    throw new Error(
      "useDecomposition must be used within a DecompositionProvider",
    );
  }
  return context;
}

/**
 * Optional hook that returns null if not in provider (for conditional usage).
 */
export function useDecompositionOptional(): DecompositionContextType | null {
  return useContext(DecompositionContext);
}

// ============================================================================
// Provider
// ============================================================================

interface DecompositionProviderProps extends DecompositionContextConfig {
  children: ReactNode;
}

/**
 * Provider for decomposition display.
 *
 * Wraps any area where you want to show an interactive decomposition display.
 * Only requires startValue and targetValue - all other data is derived.
 *
 * @example
 * ```tsx
 * <DecompositionProvider startValue={0} targetValue={45}>
 *   <DecompositionDisplay />
 * </DecompositionProvider>
 * ```
 */
export function DecompositionProvider({
  startValue,
  targetValue,
  currentStepIndex = 0,
  onSegmentChange,
  onTermHover,
  abacusColumns = 5,
  children,
}: DecompositionProviderProps) {
  // -------------------------------------------------------------------------
  // Generate sequence (memoized on value changes)
  // -------------------------------------------------------------------------
  const sequence = useMemo(
    () => generateUnifiedInstructionSequence(startValue, targetValue),
    [startValue, targetValue],
  );

  // -------------------------------------------------------------------------
  // Highlighting state
  // -------------------------------------------------------------------------
  const [activeTermIndices, setActiveTermIndices] = useState<Set<number>>(
    new Set(),
  );
  const [activeIndividualTermIndex, setActiveIndividualTermIndex] = useState<
    number | null
  >(null);

  // -------------------------------------------------------------------------
  // Derived: term positions from steps
  // -------------------------------------------------------------------------
  const termPositions = useMemo(
    () => sequence.steps.map((step) => step.termPosition),
    [sequence.steps],
  );

  // -------------------------------------------------------------------------
  // Derived function: Get column index from term index
  // -------------------------------------------------------------------------
  const getColumnFromTermIndex = useCallback(
    (termIndex: number, useGroupColumn = false): number | null => {
      const step = sequence.steps[termIndex];
      if (!step?.provenance) return null;

      // For group highlighting: use rhsPlace (target column of the operation)
      // For individual term: use termPlace (specific column this term affects)
      const placeValue = useGroupColumn
        ? step.provenance.rhsPlace
        : (step.provenance.termPlace ?? step.provenance.rhsPlace);

      // Convert place value to column index (rightmost column is highest index)
      return abacusColumns - 1 - placeValue;
    },
    [sequence.steps, abacusColumns],
  );

  // -------------------------------------------------------------------------
  // Derived function: Get term indices that affect a given column
  // -------------------------------------------------------------------------
  const getTermIndicesFromColumn = useCallback(
    (columnIndex: number): number[] => {
      const placeValue = abacusColumns - 1 - columnIndex;
      return sequence.steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => {
          if (!step.provenance) return false;
          return (
            step.provenance.rhsPlace === placeValue ||
            step.provenance.termPlace === placeValue
          );
        })
        .map(({ index }) => index);
    },
    [sequence.steps, abacusColumns],
  );

  // -------------------------------------------------------------------------
  // Derived function: Get all term indices in the same complement group
  // -------------------------------------------------------------------------
  const getGroupTermIndicesFromTermIndex = useCallback(
    (termIndex: number): number[] => {
      const step = sequence.steps[termIndex];
      if (!step?.provenance) return [termIndex];

      const groupId = step.provenance.groupId;
      if (!groupId) return [termIndex];

      // Find all steps with the same groupId
      return sequence.steps
        .map((s, i) => ({ step: s, index: i }))
        .filter(({ step: s }) => s.provenance?.groupId === groupId)
        .map(({ index }) => index);
    },
    [sequence.steps],
  );

  // -------------------------------------------------------------------------
  // Event handler: Term hover
  // -------------------------------------------------------------------------
  const handleTermHover = useCallback(
    (termIndex: number, isHovering: boolean) => {
      if (isHovering) {
        // Set individual term highlight
        setActiveIndividualTermIndex(termIndex);

        // Set group highlights
        const groupIndices = getGroupTermIndicesFromTermIndex(termIndex);
        setActiveTermIndices(new Set(groupIndices));

        // Notify external listener
        if (onTermHover) {
          const columnIndex = getColumnFromTermIndex(termIndex, true);
          onTermHover(termIndex, columnIndex);
        }
      } else {
        setActiveIndividualTermIndex(null);
        setActiveTermIndices(new Set());
        onTermHover?.(null, null);
      }
    },
    [getGroupTermIndicesFromTermIndex, getColumnFromTermIndex, onTermHover],
  );

  // -------------------------------------------------------------------------
  // Event handler: Column hover (for bidirectional abacus ↔ decomposition)
  // -------------------------------------------------------------------------
  const handleColumnHover = useCallback(
    (columnIndex: number, isHovering: boolean) => {
      if (isHovering) {
        const termIndices = getTermIndicesFromColumn(columnIndex);
        setActiveTermIndices(new Set(termIndices));
      } else {
        setActiveTermIndices(new Set());
      }
    },
    [getTermIndicesFromColumn],
  );

  // -------------------------------------------------------------------------
  // Effect: Notify when active segment changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!onSegmentChange) return;

    const segment = sequence.segments.find((seg) =>
      seg.stepIndices?.includes(currentStepIndex),
    );
    onSegmentChange(segment || null);
  }, [currentStepIndex, sequence.segments, onSegmentChange]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value: DecompositionContextType = useMemo(
    () => ({
      // Generated data
      sequence,
      fullDecomposition: sequence.fullDecomposition,
      isMeaningfulDecomposition: sequence.isMeaningfulDecomposition,
      termPositions,
      segments: sequence.segments,
      steps: sequence.steps,

      // Configuration
      startValue,
      targetValue,
      currentStepIndex,
      abacusColumns,

      // Highlighting state
      activeTermIndices,
      setActiveTermIndices,
      activeIndividualTermIndex,
      setActiveIndividualTermIndex,

      // Derived functions
      getColumnFromTermIndex,
      getTermIndicesFromColumn,
      getGroupTermIndicesFromTermIndex,

      // Event handlers
      handleTermHover,
      handleColumnHover,
    }),
    [
      sequence,
      termPositions,
      startValue,
      targetValue,
      currentStepIndex,
      abacusColumns,
      activeTermIndices,
      activeIndividualTermIndex,
      getColumnFromTermIndex,
      getTermIndicesFromColumn,
      getGroupTermIndicesFromTermIndex,
      handleTermHover,
      handleColumnHover,
    ],
  );

  return (
    <DecompositionContext.Provider value={value}>
      {children}
    </DecompositionContext.Provider>
  );
}
