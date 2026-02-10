import { describe, it, expect } from 'vitest'
import {
  createDefaultSkillConfiguration,
  createBasicAllowedConfiguration,
  skillConfigurationToSkillSets,
  skillSetsToConfiguration,
  type SkillConfiguration,
} from '../skillConfiguration'

// ============================================================================
// createDefaultSkillConfiguration
// ============================================================================
describe('createDefaultSkillConfiguration', () => {
  it('returns a configuration with all expected categories', () => {
    const config = createDefaultSkillConfiguration()
    expect(config).toHaveProperty('basic')
    expect(config).toHaveProperty('fiveComplements')
    expect(config).toHaveProperty('tenComplements')
  })

  it('sets directAddition to allowed by default', () => {
    const config = createDefaultSkillConfiguration()
    expect(config.basic.directAddition).toBe('allowed')
  })

  it('sets all other basic skills to off', () => {
    const config = createDefaultSkillConfiguration()
    expect(config.basic.heavenBead).toBe('off')
    expect(config.basic.simpleCombinations).toBe('off')
  })

  it('sets all five complement skills to off', () => {
    const config = createDefaultSkillConfiguration()
    expect(config.fiveComplements['4=5-1']).toBe('off')
    expect(config.fiveComplements['3=5-2']).toBe('off')
    expect(config.fiveComplements['2=5-3']).toBe('off')
    expect(config.fiveComplements['1=5-4']).toBe('off')
  })

  it('sets all ten complement skills to off', () => {
    const config = createDefaultSkillConfiguration()
    expect(config.tenComplements['9=10-1']).toBe('off')
    expect(config.tenComplements['5=10-5']).toBe('off')
    expect(config.tenComplements['1=10-9']).toBe('off')
  })

  it('returns a fresh object each time', () => {
    const config1 = createDefaultSkillConfiguration()
    const config2 = createDefaultSkillConfiguration()
    expect(config1).not.toBe(config2)
    expect(config1).toEqual(config2)
  })
})

// ============================================================================
// createBasicAllowedConfiguration
// ============================================================================
describe('createBasicAllowedConfiguration', () => {
  it('sets directAddition and heavenBead to allowed', () => {
    const config = createBasicAllowedConfiguration()
    expect(config.basic.directAddition).toBe('allowed')
    expect(config.basic.heavenBead).toBe('allowed')
  })

  it('keeps simpleCombinations off', () => {
    const config = createBasicAllowedConfiguration()
    expect(config.basic.simpleCombinations).toBe('off')
  })

  it('keeps all five complement skills off', () => {
    const config = createBasicAllowedConfiguration()
    expect(config.fiveComplements['4=5-1']).toBe('off')
  })

  it('keeps all ten complement skills off', () => {
    const config = createBasicAllowedConfiguration()
    expect(config.tenComplements['9=10-1']).toBe('off')
  })
})

// ============================================================================
// skillConfigurationToSkillSets
// ============================================================================
describe('skillConfigurationToSkillSets', () => {
  it('maps "allowed" skills to required=true', () => {
    const config = createDefaultSkillConfiguration()
    config.basic.directAddition = 'allowed'
    const { required } = skillConfigurationToSkillSets(config)
    expect(required.basic.directAddition).toBe(true)
  })

  it('maps "off" skills to required=false', () => {
    const config = createDefaultSkillConfiguration()
    config.basic.heavenBead = 'off'
    const { required } = skillConfigurationToSkillSets(config)
    expect(required.basic.heavenBead).toBe(false)
  })

  it('maps "target" skills to required=true AND target entry', () => {
    const config = createDefaultSkillConfiguration()
    config.fiveComplements['4=5-1'] = 'target'
    const { required, target } = skillConfigurationToSkillSets(config)
    expect(required.fiveComplements['4=5-1']).toBe(true)
    expect(target.fiveComplements!['4=5-1']).toBe(true)
  })

  it('maps "forbidden" skills to required=false AND forbidden entry', () => {
    const config = createDefaultSkillConfiguration()
    config.tenComplements['9=10-1'] = 'forbidden'
    const { required, forbidden } = skillConfigurationToSkillSets(config)
    expect(required.tenComplements['9=10-1']).toBe(false)
    expect(forbidden.tenComplements!['9=10-1']).toBe(true)
  })

  it('required output has all expected categories', () => {
    const config = createDefaultSkillConfiguration()
    const { required } = skillConfigurationToSkillSets(config)
    expect(required).toHaveProperty('basic')
    expect(required).toHaveProperty('fiveComplements')
    expect(required).toHaveProperty('tenComplements')
    expect(required).toHaveProperty('fiveComplementsSub')
    expect(required).toHaveProperty('tenComplementsSub')
    expect(required).toHaveProperty('advanced')
  })

  it('target and forbidden start empty when no modes set', () => {
    const config = createDefaultSkillConfiguration()
    // Only directAddition is 'allowed', rest 'off' -- neither target nor forbidden
    const { target, forbidden } = skillConfigurationToSkillSets(config)
    // target and forbidden should not have entries for these categories
    expect(target.fiveComplements).toBeUndefined()
    expect(forbidden.fiveComplements).toBeUndefined()
  })

  it('handles multiple modes in the same category', () => {
    const config = createDefaultSkillConfiguration()
    config.fiveComplements['4=5-1'] = 'target'
    config.fiveComplements['3=5-2'] = 'allowed'
    config.fiveComplements['2=5-3'] = 'forbidden'
    config.fiveComplements['1=5-4'] = 'off'

    const { required, target, forbidden } = skillConfigurationToSkillSets(config)

    expect(required.fiveComplements['4=5-1']).toBe(true) // target => required
    expect(required.fiveComplements['3=5-2']).toBe(true) // allowed => required
    expect(required.fiveComplements['2=5-3']).toBe(false) // forbidden => not required
    expect(required.fiveComplements['1=5-4']).toBe(false) // off => not required

    expect(target.fiveComplements!['4=5-1']).toBe(true)
    expect(forbidden.fiveComplements!['2=5-3']).toBe(true)
  })
})

// ============================================================================
// skillSetsToConfiguration
// ============================================================================
describe('skillSetsToConfiguration', () => {
  it('converts required-only back to allowed/off config', () => {
    const config = createDefaultSkillConfiguration()
    config.basic.directAddition = 'allowed'
    config.basic.heavenBead = 'allowed'
    config.fiveComplements['4=5-1'] = 'allowed'

    const { required } = skillConfigurationToSkillSets(config)
    const result = skillSetsToConfiguration(required)

    expect(result.basic.directAddition).toBe('allowed')
    expect(result.basic.heavenBead).toBe('allowed')
    expect(result.basic.simpleCombinations).toBe('off')
    expect(result.fiveComplements['4=5-1']).toBe('allowed')
    expect(result.fiveComplements['3=5-2']).toBe('off')
  })

  it('converts target skills back to target mode', () => {
    const config = createDefaultSkillConfiguration()
    config.fiveComplements['4=5-1'] = 'target'

    const { required, target } = skillConfigurationToSkillSets(config)
    const result = skillSetsToConfiguration(required, target)

    expect(result.fiveComplements['4=5-1']).toBe('target')
  })

  it('converts forbidden skills back to forbidden mode', () => {
    const config = createDefaultSkillConfiguration()
    config.tenComplements['9=10-1'] = 'forbidden'

    const { required, target, forbidden } = skillConfigurationToSkillSets(config)
    const result = skillSetsToConfiguration(required, target, forbidden)

    expect(result.tenComplements['9=10-1']).toBe('forbidden')
  })

  it('round-trips a complex configuration', () => {
    const original = createDefaultSkillConfiguration()
    original.basic.directAddition = 'allowed'
    original.basic.heavenBead = 'target'
    original.basic.simpleCombinations = 'forbidden'
    original.fiveComplements['4=5-1'] = 'target'
    original.fiveComplements['3=5-2'] = 'allowed'
    original.tenComplements['9=10-1'] = 'forbidden'
    original.tenComplements['8=10-2'] = 'allowed'

    const { required, target, forbidden } = skillConfigurationToSkillSets(original)
    const result = skillSetsToConfiguration(required, target, forbidden)

    expect(result.basic.directAddition).toBe('allowed')
    expect(result.basic.heavenBead).toBe('target')
    expect(result.basic.simpleCombinations).toBe('forbidden')
    expect(result.fiveComplements['4=5-1']).toBe('target')
    expect(result.fiveComplements['3=5-2']).toBe('allowed')
    expect(result.tenComplements['9=10-1']).toBe('forbidden')
    expect(result.tenComplements['8=10-2']).toBe('allowed')
  })

  it('handles undefined target and forbidden', () => {
    const config = createDefaultSkillConfiguration()
    config.basic.directAddition = 'allowed'

    const { required } = skillConfigurationToSkillSets(config)
    const result = skillSetsToConfiguration(required)

    expect(result.basic.directAddition).toBe('allowed')
    expect(result.basic.heavenBead).toBe('off')
  })

  it('forbidden takes priority over target', () => {
    const config = createDefaultSkillConfiguration()
    const { required } = skillConfigurationToSkillSets(config)

    // Both target and forbidden set for same skill -- forbidden wins
    const target = { basic: { directAddition: true } } as any
    const forbidden = { basic: { directAddition: true } } as any

    const result = skillSetsToConfiguration(required, target, forbidden)
    expect(result.basic.directAddition).toBe('forbidden')
  })
})
