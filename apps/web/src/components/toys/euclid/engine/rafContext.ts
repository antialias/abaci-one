/**
 * RAFContext — A typed plain object (NOT React context) that bundles all
 * mutable refs the RAF render loop reads/writes, plus the few state setters
 * it needs. Created once per mount in EuclidCanvasInner and passed to the
 * extracted RAF helper functions.
 *
 * This avoids passing 40+ individual refs to each helper while keeping
 * the contract explicit and type-checked.
 */
import type { MutableRefObject } from 'react'
import type {
  ConstructionState,
  ActiveTool,
  MacroPhase,
  TutorialHint,
  TutorialSubStep,
  GhostLayer,
  IntersectionCandidate,
  EuclidViewportState,
  ConstructionElement,
  PropositionDef,
  PropositionStep,
  MacroCeremonyState,
  SuperpositionPhase,
} from '../types'
import type { MacroAnimation } from './macroExecution'
import type { FactStore } from './factStore'
import type { ProofFact } from './facts'
import type { StraightedgeDrawAnim } from '../render/renderToolOverlay'
import type { SuperpositionFlash } from '../render/renderSuperpositionFlash'
import type { CitationFlash } from '../render/renderCitationFlash'
import type { PostCompletionAction } from './replayConstruction'
import type { ConstructionEventBus } from '../agent/ConstructionEventBus'
import type { GeometricEntityRef } from '../chat/parseGeometricEntities'

export interface RelocatePointAnim {
  actionIndex: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  startTime: number
  durationMs: number
  untrackedElements: ConstructionElement[]
}

export interface CorrectionAnim {
  active: boolean
  startTime: number
  duration: number
  fromAngle: number
  toAngle: number
  center: { x: number; y: number }
}

export interface CeremonyDebug {
  paused: boolean
  speedMultiplier: number
}

export interface RAFContext {
  // ── Canvas ──
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  needsDrawRef: MutableRefObject<boolean>

  // ── Viewport ──
  viewportRef: MutableRefObject<EuclidViewportState>

  // ── Construction state ──
  constructionRef: MutableRefObject<ConstructionState>
  candidatesRef: MutableRefObject<IntersectionCandidate[]>
  factStoreRef: MutableRefObject<FactStore>
  proofFactsRef: MutableRefObject<ProofFact[]>
  ghostLayersRef: MutableRefObject<GhostLayer[]>

  // ── Step tracking ──
  currentStepRef: MutableRefObject<number>
  stepsRef: MutableRefObject<PropositionStep[]>
  stepDataRef: MutableRefObject<Map<number, Record<string, unknown>>>

  // ── Tutorial advancement ──
  tutorialSubStepRef: MutableRefObject<number>
  tutorialSubStepsRef: MutableRefObject<TutorialSubStep[][]>
  resolvedTutorialRef: MutableRefObject<Map<number, TutorialSubStep[]>>
  prevCompassTagRef: MutableRefObject<string>
  prevStraightedgeTagRef: MutableRefObject<string>
  prevExtendTagRef: MutableRefObject<string>

  // ── Tool phases (from useToolPhaseManager) ──
  compassPhaseRef: MutableRefObject<{ tag: string; [key: string]: unknown }>
  straightedgePhaseRef: MutableRefObject<{ tag: string; [key: string]: unknown }>
  extendPhaseRef: MutableRefObject<{ tag: string; [key: string]: unknown }>
  macroPhaseRef: MutableRefObject<MacroPhase>
  activeToolRef: MutableRefObject<ActiveTool>

  // ── Interaction state ──
  pointerWorldRef: MutableRefObject<{ x: number; y: number } | null>
  pointerCapturedRef: MutableRefObject<boolean>
  snappedPointIdRef: MutableRefObject<string | null>
  panZoomDisabledRef: MutableRefObject<boolean>

  // ── Animation refs ──
  macroAnimationRef: MutableRefObject<MacroAnimation | null>
  macroRevealRef: MutableRefObject<MacroCeremonyState | null>
  ceremonyDebugRef: MutableRefObject<CeremonyDebug>
  relocatePointAnimRef: MutableRefObject<RelocatePointAnim | null>
  correctionRef: MutableRefObject<CorrectionAnim | null>
  correctionActiveRef: MutableRefObject<boolean>
  straightedgeDrawAnimRef: MutableRefObject<StraightedgeDrawAnim | null>
  superpositionFlashRef: MutableRefObject<SuperpositionFlash | null>
  citationFlashesRef: MutableRefObject<CitationFlash[]>
  completionTimeRef: MutableRefObject<number>
  chatHighlightRef: MutableRefObject<GeometricEntityRef | null>
  extendPreviewRef: MutableRefObject<{ x: number; y: number } | null>
  wiggleCancelRef: MutableRefObject<(() => void) | null>

  // ── Superposition interaction ──
  superpositionPhaseRef: MutableRefObject<SuperpositionPhase>
  onSuperpositionSettledRef: MutableRefObject<(() => void) | null>

  // ── Auto-fit viewport refs ──
  lastSweepRef: MutableRefObject<number>
  lastSweepTimeRef: MutableRefObject<number | null>
  lastSweepCenterRef: MutableRefObject<string | null>
  macroPreviewAutoFitRef: MutableRefObject<boolean>
  ghostBoundsEnabledRef: MutableRefObject<boolean>
  hoveredMacroStepRef: MutableRefObject<number | null>
  toolDockRef: MutableRefObject<HTMLDivElement | null>
  ghostOpacitiesRef: MutableRefObject<Map<string, number>>

  // ── Hint ──
  currentHintRef: MutableRefObject<TutorialHint>

  // ── Proposition ──
  propositionRef: MutableRefObject<PropositionDef>
  isCompleteRef: MutableRefObject<boolean>
  postCompletionActionsRef: MutableRefObject<PostCompletionAction[]>

  // ── Sync refs (values from React state/props, updated every render) ──
  isMobileRef: MutableRefObject<boolean>
  isTouchRef: MutableRefObject<boolean>
  playgroundModeRef: MutableRefObject<boolean | undefined>
  effectiveResultSegmentsRef: MutableRefObject<Array<{ fromId: string; toId: string }> | undefined>

  // ── Voice/chat refs ──
  sayMacroRevealRef: MutableRefObject<(opts: { say: { en: string }; tone: string }) => void>
  eventBusRef: MutableRefObject<ConstructionEventBus>
  euclidVoiceHighlightRef: MutableRefObject<GeometricEntityRef | null>

  // ── RAF ──
  rafRef: MutableRefObject<number>

  // ── State setters (called from RAF helpers) ──
  setTutorialSubStep: (v: number) => void
  setIsCorrectionActive: (v: boolean) => void
  setActiveTool: (v: ActiveTool) => void
  setProofFacts: (v: ProofFact[]) => void
}
