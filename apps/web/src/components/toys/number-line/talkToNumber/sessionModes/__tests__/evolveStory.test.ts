import { describe, expect, it } from 'vitest'
import { generateNumberPersonality } from '../../generateNumberPersonality'
import type { GeneratedScenario } from '../../generateScenario'
import { getConferenceTools, getDefaultTools } from '../tools'
import type { ModeContext } from '../types'

const scenario = {
  situation: 'Seven has lost count of the days of the week.',
  hook: 'I keep getting to six and then... nothing!',
  involvedNumbers: [{ number: 6, role: 'neighbor' }],
} as unknown as GeneratedScenario

const ctx = (s: GeneratedScenario | null) =>
  ({ scenario: s, availablePlayers: [] }) as unknown as ModeContext

const names = (tools: Array<{ name: string }>) => tools.map((t) => t.name)

// A call with no scenario must not be told to reach for a tool that can only
// answer "No active scenario to evolve".
describe('evolve_story follows the scenario', () => {
  it('is offered only when there is a scenario', () => {
    expect(names(getDefaultTools(ctx(scenario)))).toContain('evolve_story')
    expect(names(getDefaultTools(ctx(null)))).not.toContain('evolve_story')
    expect(names(getConferenceTools(ctx(scenario)))).toContain('evolve_story')
    expect(names(getConferenceTools(ctx(null)))).not.toContain('evolve_story')
  })

  it('is pushed by the prompt only when there is a scenario', () => {
    expect(generateNumberPersonality(7, scenario)).toContain('evolve_story')

    const bare = generateNumberPersonality(7, null)
    expect(bare).not.toContain('evolve_story')
    expect(bare).toContain('KEEPING THE CONVERSATION ALIVE')
    expect(bare).toContain('start_game')
  })
})
