import type { RAFContext } from '../engine/rafContext'

/**
 * Observe tool phase transitions (compass, straightedge, extend, macro)
 * and advance tutorial sub-steps accordingly. Called once per RAF frame.
 *
 * Returns the effective sub-steps for the current step (used later in the frame).
 */
export function tickTutorialAdvancement(ctx: RAFContext) {
  const subSteps = ctx.tutorialSubStepsRef.current
  const step = ctx.currentStepRef.current
  const subStep = ctx.tutorialSubStepRef.current
  // Prefer resolved tutorial overrides for adaptive steps
  const effectiveSubStepsForStep = ctx.resolvedTutorialRef.current.get(step) ?? subSteps[step]

  // ── Compass phase transitions ──
  const compassTag = ctx.compassPhaseRef.current.tag
  if (compassTag !== ctx.prevCompassTagRef.current) {
    const prev = ctx.prevCompassTagRef.current
    ctx.prevCompassTagRef.current = compassTag

    if (compassTag === 'idle' && prev !== 'idle') {
      // Gesture cancelled or completed — reset sub-step
      ctx.tutorialSubStepRef.current = 0
      ctx.setTutorialSubStep(0)
    } else {
      const subStepDef = effectiveSubStepsForStep?.[subStep]
      const adv = subStepDef?.advanceOn
      if (adv?.kind === 'compass-phase' && adv.phase === compassTag) {
        const next = subStep + 1
        ctx.tutorialSubStepRef.current = next
        ctx.setTutorialSubStep(next)
      }
    }
  }

  // ── Straightedge phase transitions ──
  const straightedgeTag = ctx.straightedgePhaseRef.current.tag
  if (straightedgeTag !== ctx.prevStraightedgeTagRef.current) {
    const prev = ctx.prevStraightedgeTagRef.current
    ctx.prevStraightedgeTagRef.current = straightedgeTag

    if (straightedgeTag === 'idle' && prev !== 'idle') {
      ctx.tutorialSubStepRef.current = 0
      ctx.setTutorialSubStep(0)
    }
  }

  // ── Extend phase transitions ──
  const extendTag = ctx.extendPhaseRef.current.tag
  if (extendTag !== ctx.prevExtendTagRef.current) {
    const prev = ctx.prevExtendTagRef.current
    ctx.prevExtendTagRef.current = extendTag

    if (extendTag === 'idle' && prev !== 'idle') {
      // Extend gesture completed or cancelled — reset sub-step
      ctx.tutorialSubStepRef.current = 0
      ctx.setTutorialSubStep(0)
    } else {
      const subStepDef = effectiveSubStepsForStep?.[subStep]
      const adv = subStepDef?.advanceOn
      if (adv?.kind === 'extend-phase' && adv.phase === extendTag) {
        const next = subStep + 1
        ctx.tutorialSubStepRef.current = next
        ctx.setTutorialSubStep(next)
      }
    }
  }

  // ── Macro phase transitions ──
  const macroPhase = ctx.macroPhaseRef.current
  if (macroPhase.tag === 'selecting' && macroPhase.selectedPointIds.length > 0) {
    const subStepDef = effectiveSubStepsForStep?.[subStep]
    const adv = subStepDef?.advanceOn
    if (adv?.kind === 'macro-select' && adv.index === macroPhase.selectedPointIds.length - 1) {
      const next = subStep + 1
      ctx.tutorialSubStepRef.current = next
      ctx.setTutorialSubStep(next)
    }
  }

  return effectiveSubStepsForStep
}
