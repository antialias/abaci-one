/**
 * Aggregated narration configs for all constant demos.
 *
 * Module-level object for ref stability — must not be recreated per render.
 * Mutable: the LCM hopper injects its config at runtime via NARRATION_CONFIGS['lcm_hopper'].
 */

import type { DemoNarrationConfig } from './useConstantDemoNarration'
import { E_DEMO_SEGMENTS, E_DEMO_TONE } from './eDemoNarration'
import { PI_DEMO_SEGMENTS, PI_DEMO_TONE } from './piDemoNarration'
import { TAU_DEMO_SEGMENTS, TAU_DEMO_TONE } from './tauDemoNarration'
import { PHI_DEMO_SEGMENTS, PHI_DEMO_TONE } from './phiDemoNarration'
import { GAMMA_DEMO_SEGMENTS, GAMMA_DEMO_TONE } from './gammaDemoNarration'
import { SQRT2_DEMO_SEGMENTS, SQRT2_DEMO_TONE } from './sqrt2DemoNarration'
import { SQRT3_DEMO_SEGMENTS, SQRT3_DEMO_TONE } from './sqrt3DemoNarration'
import { LN2_DEMO_SEGMENTS, LN2_DEMO_TONE } from './ln2DemoNarration'
import { RAMANUJAN_DEMO_SEGMENTS, RAMANUJAN_DEMO_TONE } from './ramanujanDemoNarration'
import { FEIGENBAUM_DEMO_SEGMENTS, FEIGENBAUM_DEMO_TONE } from './feigenbaumDemoNarration'

export const NARRATION_CONFIGS: Record<string, DemoNarrationConfig> = {
  e: { segments: E_DEMO_SEGMENTS, tone: E_DEMO_TONE },
  pi: { segments: PI_DEMO_SEGMENTS, tone: PI_DEMO_TONE },
  tau: { segments: TAU_DEMO_SEGMENTS, tone: TAU_DEMO_TONE },
  phi: { segments: PHI_DEMO_SEGMENTS, tone: PHI_DEMO_TONE },
  gamma: { segments: GAMMA_DEMO_SEGMENTS, tone: GAMMA_DEMO_TONE },
  sqrt2: { segments: SQRT2_DEMO_SEGMENTS, tone: SQRT2_DEMO_TONE },
  sqrt3: { segments: SQRT3_DEMO_SEGMENTS, tone: SQRT3_DEMO_TONE },
  ln2: { segments: LN2_DEMO_SEGMENTS, tone: LN2_DEMO_TONE },
  ramanujan: { segments: RAMANUJAN_DEMO_SEGMENTS, tone: RAMANUJAN_DEMO_TONE },
  feigenbaum: { segments: FEIGENBAUM_DEMO_SEGMENTS, tone: FEIGENBAUM_DEMO_TONE },
}
