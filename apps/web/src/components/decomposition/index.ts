// Decomposition Display Components
// Standalone decomposition visualization that works anywhere in the app

export {
  DecompositionDisplay,
  DecompositionSection,
} from './DecompositionDisplay'
export { ReasonTooltip } from './ReasonTooltip'
export type {
  PedagogicalRule,
  PedagogicalSegment,
  TermReason,
} from './ReasonTooltip'

// Re-export the context and hooks from contexts
export {
  DecompositionProvider,
  useDecomposition,
  useDecompositionOptional,
} from '@/contexts/DecompositionContext'
export type {
  DecompositionContextConfig,
  DecompositionContextType,
} from '@/contexts/DecompositionContext'
