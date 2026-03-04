import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CompassPhase, StraightedgePhase, ExtendPhase, MacroPhase, ActiveTool } from '../types'
import type { MacroInput } from '../engine/macros'

export interface ToolPhaseManager {
  // Phase refs (direct access for hot path — RAF loop, useToolInteraction, downstream hooks)
  readonly compassPhaseRef: MutableRefObject<CompassPhase>
  readonly straightedgePhaseRef: MutableRefObject<StraightedgePhase>
  readonly extendPhaseRef: MutableRefObject<ExtendPhase>
  readonly macroPhaseRef: MutableRefObject<MacroPhase>
  readonly snappedPointIdRef: MutableRefObject<string | null>
  readonly activeToolRef: MutableRefObject<ActiveTool>
  readonly pointerCapturedRef: MutableRefObject<boolean>
  readonly needsDrawRef: MutableRefObject<boolean>

  // Lifecycle methods
  /** Reset ALL four phases to idle, clear pointerCaptured, set needsDraw, sync macroPhase.
   *  Silent — does NOT call notifyPhaseChange(). Caller adds that if needed. */
  resetAll(): void
  /** Enter macro selecting mode for a specific proposition. Calls notifyPhaseChange(). */
  enterMacroSelecting(propId: number, inputs: MacroInput[]): void
  /** Enter macro choosing mode (picker open). Syncs macroPhase React state. */
  enterMacroChoosing(): void
  /** Set active tool ref + sync React state. */
  selectTool(tool: ActiveTool): void
  /** Set macroPhaseRef + sync React state. For useToolInteraction to call. */
  setMacroPhase(phase: MacroPhase): void

  // Notifications
  /** Trigger voice + preview updates (replaces onToolStateChange). */
  notifyPhaseChange(): void
  /** Set needsDrawRef = true. */
  requestDraw(): void

  // Writable callback slots (set by EuclidCanvas at render time)
  onPhaseChange: (() => void) | null
  onMacroPhaseSync: ((phase: MacroPhase) => void) | null
  onActiveToolSync: ((tool: ActiveTool) => void) | null
}

/**
 * Creates and owns all 8 tool-phase refs. Provides lifecycle methods that
 * handle all side effects (needsDraw, React state sync, notifications) in one
 * place, fixing bugs where individual mutation sites missed extendPhase resets,
 * needsDraw, or eventBus notifications.
 *
 * The refs are exposed directly so the RAF draw loop and useToolInteraction can
 * read/write them at 60fps without method-call overhead.
 */
export function useToolPhaseManager(initialTool: ActiveTool): ToolPhaseManager {
  // Create all refs once
  const compassPhaseRef = useRef<CompassPhase>({ tag: 'idle' })
  const straightedgePhaseRef = useRef<StraightedgePhase>({ tag: 'idle' })
  const extendPhaseRef = useRef<ExtendPhase>({ tag: 'idle' })
  const macroPhaseRef = useRef<MacroPhase>({ tag: 'idle' })
  const snappedPointIdRef = useRef<string | null>(null)
  const activeToolRef = useRef<ActiveTool>(initialTool)
  const pointerCapturedRef = useRef(false)
  const needsDrawRef = useRef(true)

  // Stable manager object — created once via useRef init, never recreated
  const managerRef = useRef<ToolPhaseManager | null>(null)
  if (managerRef.current === null) {
    const manager: ToolPhaseManager = {
      // Refs
      compassPhaseRef,
      straightedgePhaseRef,
      extendPhaseRef,
      macroPhaseRef,
      snappedPointIdRef,
      activeToolRef,
      pointerCapturedRef,
      needsDrawRef,

      // Callback slots (written by EuclidCanvas at render time)
      onPhaseChange: null,
      onMacroPhaseSync: null,
      onActiveToolSync: null,

      resetAll() {
        compassPhaseRef.current = { tag: 'idle' }
        straightedgePhaseRef.current = { tag: 'idle' }
        extendPhaseRef.current = { tag: 'idle' }
        macroPhaseRef.current = { tag: 'idle' }
        pointerCapturedRef.current = false
        needsDrawRef.current = true
        manager.onMacroPhaseSync?.({ tag: 'idle' })
      },

      enterMacroSelecting(propId: number, inputs: MacroInput[]) {
        const phase: MacroPhase = {
          tag: 'selecting',
          propId,
          inputs,
          selectedPointIds: [],
        }
        macroPhaseRef.current = phase
        needsDrawRef.current = true
        manager.onMacroPhaseSync?.(phase)
        manager.onPhaseChange?.()
      },

      enterMacroChoosing() {
        const phase: MacroPhase = { tag: 'choosing' }
        macroPhaseRef.current = phase
        manager.onMacroPhaseSync?.(phase)
      },

      selectTool(tool: ActiveTool) {
        activeToolRef.current = tool
        manager.onActiveToolSync?.(tool)
      },

      setMacroPhase(phase: MacroPhase) {
        macroPhaseRef.current = phase
        manager.onMacroPhaseSync?.(phase)
      },

      notifyPhaseChange() {
        manager.onPhaseChange?.()
      },

      requestDraw() {
        needsDrawRef.current = true
      },
    }
    managerRef.current = manager
  }

  return managerRef.current
}
