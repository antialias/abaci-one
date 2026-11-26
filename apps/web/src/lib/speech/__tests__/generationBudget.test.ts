/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { GenerationBudget, ON_DEMAND_SPEECH_LIMITS } from '../generationBudget'

const HOUR = 60 * 60 * 1000

function budget(limits = ON_DEMAND_SPEECH_LIMITS) {
  let t = 0
  const b = new GenerationBudget(limits, () => t)
  return {
    b,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('GenerationBudget', () => {
  const small = {
    windowMs: HOUR,
    perIdentity: { clips: 3, chars: 100 },
    pod: { clips: 5, chars: 1000 },
  }

  it('caps clips per identity per hour', () => {
    const { b } = budget(small)
    for (let i = 0; i < 3; i++) expect(b.tryConsume('kid', 10)).toEqual({ ok: true })
    expect(b.tryConsume('kid', 10)).toEqual({ ok: false, scope: 'identity' })
    expect(b.tryConsume('other-kid', 10)).toEqual({ ok: true })
  })

  it('caps characters per identity per hour', () => {
    const { b } = budget(small)
    expect(b.tryConsume('kid', 90)).toEqual({ ok: true })
    expect(b.tryConsume('kid', 11)).toEqual({ ok: false, scope: 'identity' })
    expect(b.tryConsume('kid', 10)).toEqual({ ok: true })
  })

  it('caps the whole pod across identities', () => {
    const { b } = budget(small)
    for (let i = 0; i < 5; i++) expect(b.tryConsume(`guest-${i}`, 10)).toEqual({ ok: true })
    expect(b.tryConsume('guest-new', 10)).toEqual({ ok: false, scope: 'pod' })
  })

  it('frees spend once it is an hour old', () => {
    const { b, advance } = budget(small)
    for (let i = 0; i < 3; i++) b.tryConsume('kid', 10)
    advance(HOUR - 1)
    expect(b.tryConsume('kid', 10)).toEqual({ ok: false, scope: 'identity' })
    advance(2)
    expect(b.tryConsume('kid', 10)).toEqual({ ok: true })
  })

  it('a refused request spends nothing', () => {
    const { b } = budget(small)
    expect(b.tryConsume('kid', 101)).toEqual({ ok: false, scope: 'identity' })
    expect(b.tryConsume('kid', 100)).toEqual({ ok: true })
  })
})

describe('ON_DEMAND_SPEECH_LIMITS against real use', () => {
  it('one child doing all of the typing game and all of Euclid on an empty voice fits', () => {
    // Prod, 2026-11-25: typing game 244 clips / ~1.6k chars; Euclid ~141 lines / ~11k chars.
    const { b } = budget()
    for (let i = 0; i < 244; i++) expect(b.tryConsume('kid', 7).ok).toBe(true)
    for (let i = 0; i < 141; i++) expect(b.tryConsume('kid', 78).ok).toBe(true)
  })

  it('the pod can fill in the whole catalogue for a fresh voice within an hour', () => {
    // Prod, 2026-11-25: 632 clips, ~41.7k characters sent, across many families.
    const { b } = budget()
    for (let i = 0; i < 632; i++) expect(b.tryConsume(`family-${i % 40}`, 66).ok).toBe(true)
  })
})
