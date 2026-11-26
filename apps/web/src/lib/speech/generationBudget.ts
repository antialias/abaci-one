/**
 * Spend caps for on-demand speech (POST /api/audio/generate-clip), per pod,
 * in memory, over a sliding hour. Only real generations count: a clip that's
 * already on disk is served from cache and costs nothing.
 *
 * The numbers, against prod's collected clips (2026-11-25):
 * - Every clip any feature has ever registered is 632 clips / ~41.7k
 *   characters. Each clip is generated once per voice and then cached.
 * - The biggest bursts a child can cause are the typing game (244 one-word
 *   clips, ~1.6k chars) and Euclid (~141 lines, ~11k chars ever).
 * - Per identity: 500 clips and 20,000 characters an hour. One child working
 *   through all of the typing game and all of Euclid in one hour on a voice
 *   with nothing cached (385 clips, ~12.6k chars) still fits.
 * - Whole pod: 1,000 clips and 60,000 characters an hour, more than the
 *   whole catalogue, so a fresh voice can fill in at any pace real use
 *   produces. That bounds abuse (made-up identities) at ~60k credits, about
 *   $4.80, an hour.
 */

export interface BudgetLimits {
  windowMs: number
  perIdentity: { clips: number; chars: number }
  pod: { clips: number; chars: number }
}

export const ON_DEMAND_SPEECH_LIMITS: BudgetLimits = {
  windowMs: 60 * 60 * 1000,
  perIdentity: { clips: 500, chars: 20_000 },
  pod: { clips: 1_000, chars: 60_000 },
}

interface Spend {
  at: number
  chars: number
}

export type BudgetDecision = { ok: true } | { ok: false; scope: 'identity' | 'pod' }

export class GenerationBudget {
  private pod: Spend[] = []
  private byIdentity = new Map<string, Spend[]>()

  constructor(
    private readonly limits: BudgetLimits,
    private readonly now: () => number = Date.now
  ) {}

  /** Record one generation of `chars` characters for `identity`, if both caps allow it. */
  tryConsume(identity: string, chars: number): BudgetDecision {
    const cutoff = this.now() - this.limits.windowMs
    this.pod = this.pod.filter((s) => s.at > cutoff)
    // Identities only gain entries when the pod cap admits them, so this map
    // never holds more than pod.clips identities with live entries.
    for (const [id, spends] of this.byIdentity) {
      const live = spends.filter((s) => s.at > cutoff)
      if (live.length === 0) this.byIdentity.delete(id)
      else this.byIdentity.set(id, live)
    }

    const mine = this.byIdentity.get(identity) ?? []
    if (!fits(mine, chars, this.limits.perIdentity)) return { ok: false, scope: 'identity' }
    if (!fits(this.pod, chars, this.limits.pod)) return { ok: false, scope: 'pod' }

    const spend = { at: this.now(), chars }
    mine.push(spend)
    this.byIdentity.set(identity, mine)
    this.pod.push(spend)
    return { ok: true }
  }
}

function fits(spends: Spend[], chars: number, cap: { clips: number; chars: number }): boolean {
  const used = spends.reduce((sum, s) => sum + s.chars, 0)
  return spends.length + 1 <= cap.clips && used + chars <= cap.chars
}

/** The pod's budget for on-demand clips. */
export const onDemandSpeechBudget = new GenerationBudget(ON_DEMAND_SPEECH_LIMITS)
