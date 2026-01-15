import type { SkillSet } from '../types/tutorial'

export type SkillMode = 'off' | 'allowed' | 'target' | 'forbidden'

export interface SkillConfiguration {
  basic: {
    directAddition: SkillMode
    heavenBead: SkillMode
    simpleCombinations: SkillMode
  }
  fiveComplements: {
    '4=5-1': SkillMode
    '3=5-2': SkillMode
    '2=5-3': SkillMode
    '1=5-4': SkillMode
  }
  tenComplements: {
    '9=10-1': SkillMode
    '8=10-2': SkillMode
    '7=10-3': SkillMode
    '6=10-4': SkillMode
    '5=10-5': SkillMode
    '4=10-6': SkillMode
    '3=10-7': SkillMode
    '2=10-8': SkillMode
    '1=10-9': SkillMode
  }
}

// Helper functions for new skill configuration
export function createDefaultSkillConfiguration(): SkillConfiguration {
  return {
    basic: {
      directAddition: 'allowed',
      heavenBead: 'off',
      simpleCombinations: 'off',
    },
    fiveComplements: {
      '4=5-1': 'off',
      '3=5-2': 'off',
      '2=5-3': 'off',
      '1=5-4': 'off',
    },
    tenComplements: {
      '9=10-1': 'off',
      '8=10-2': 'off',
      '7=10-3': 'off',
      '6=10-4': 'off',
      '5=10-5': 'off',
      '4=10-6': 'off',
      '3=10-7': 'off',
      '2=10-8': 'off',
      '1=10-9': 'off',
    },
  }
}

export function createBasicAllowedConfiguration(): SkillConfiguration {
  return {
    basic: {
      directAddition: 'allowed',
      heavenBead: 'allowed',
      simpleCombinations: 'off',
    },
    fiveComplements: {
      '4=5-1': 'off',
      '3=5-2': 'off',
      '2=5-3': 'off',
      '1=5-4': 'off',
    },
    tenComplements: {
      '9=10-1': 'off',
      '8=10-2': 'off',
      '7=10-3': 'off',
      '6=10-4': 'off',
      '5=10-5': 'off',
      '4=10-6': 'off',
      '3=10-7': 'off',
      '2=10-8': 'off',
      '1=10-9': 'off',
    },
  }
}

// Convert between old and new formats
export function skillConfigurationToSkillSets(config: SkillConfiguration): {
  required: SkillSet
  target: Partial<SkillSet>
  forbidden: Partial<SkillSet>
} {
  const required: SkillSet = {
    basic: {
      directAddition: false,
      heavenBead: false,
      simpleCombinations: false,
    },
    fiveComplements: {
      '4=5-1': false,
      '3=5-2': false,
      '2=5-3': false,
      '1=5-4': false,
    },
    tenComplements: {
      '9=10-1': false,
      '8=10-2': false,
      '7=10-3': false,
      '6=10-4': false,
      '5=10-5': false,
      '4=10-6': false,
      '3=10-7': false,
      '2=10-8': false,
      '1=10-9': false,
    },
  }

  const target: Partial<SkillSet> = {}
  const forbidden: Partial<SkillSet> = {}

  // Basic skills
  Object.entries(config.basic).forEach(([skill, mode]) => {
    if (mode === 'allowed' || mode === 'target') {
      required.basic[skill as keyof typeof required.basic] = true
    }
    if (mode === 'target') {
      if (!target.basic) target.basic = {} as any
      target.basic![skill as keyof typeof required.basic] = true
    }
    if (mode === 'forbidden') {
      if (!forbidden.basic) forbidden.basic = {} as any
      forbidden.basic![skill as keyof typeof required.basic] = true
    }
  })

  // Five complements
  Object.entries(config.fiveComplements).forEach(([skill, mode]) => {
    if (mode === 'allowed' || mode === 'target') {
      required.fiveComplements[skill as keyof typeof required.fiveComplements] = true
    }
    if (mode === 'target') {
      if (!target.fiveComplements) target.fiveComplements = {} as any
      target.fiveComplements![skill as keyof typeof required.fiveComplements] = true
    }
    if (mode === 'forbidden') {
      if (!forbidden.fiveComplements) forbidden.fiveComplements = {} as any
      forbidden.fiveComplements![skill as keyof typeof required.fiveComplements] = true
    }
  })

  // Ten complements
  Object.entries(config.tenComplements).forEach(([skill, mode]) => {
    if (mode === 'allowed' || mode === 'target') {
      required.tenComplements[skill as keyof typeof required.tenComplements] = true
    }
    if (mode === 'target') {
      if (!target.tenComplements) target.tenComplements = {} as any
      target.tenComplements![skill as keyof typeof required.tenComplements] = true
    }
    if (mode === 'forbidden') {
      if (!forbidden.tenComplements) forbidden.tenComplements = {} as any
      forbidden.tenComplements![skill as keyof typeof required.tenComplements] = true
    }
  })

  return { required, target, forbidden }
}

// Convert from old format to new format
export function skillSetsToConfiguration(
  required: SkillSet,
  target?: Partial<SkillSet>,
  forbidden?: Partial<SkillSet>
): SkillConfiguration {
  const config = createDefaultSkillConfiguration()

  // Process each skill category
  Object.entries(required.basic).forEach(([skill, isRequired]) => {
    const skillKey = skill as keyof typeof config.basic
    if (forbidden?.basic?.[skillKey]) {
      config.basic[skillKey] = 'forbidden'
    } else if (target?.basic?.[skillKey]) {
      config.basic[skillKey] = 'target'
    } else if (isRequired) {
      config.basic[skillKey] = 'allowed'
    } else {
      config.basic[skillKey] = 'off'
    }
  })

  Object.entries(required.fiveComplements).forEach(([skill, isRequired]) => {
    const skillKey = skill as keyof typeof config.fiveComplements
    if (forbidden?.fiveComplements?.[skillKey]) {
      config.fiveComplements[skillKey] = 'forbidden'
    } else if (target?.fiveComplements?.[skillKey]) {
      config.fiveComplements[skillKey] = 'target'
    } else if (isRequired) {
      config.fiveComplements[skillKey] = 'allowed'
    } else {
      config.fiveComplements[skillKey] = 'off'
    }
  })

  Object.entries(required.tenComplements).forEach(([skill, isRequired]) => {
    const skillKey = skill as keyof typeof config.tenComplements
    if (forbidden?.tenComplements?.[skillKey]) {
      config.tenComplements[skillKey] = 'forbidden'
    } else if (target?.tenComplements?.[skillKey]) {
      config.tenComplements[skillKey] = 'target'
    } else if (isRequired) {
      config.tenComplements[skillKey] = 'allowed'
    } else {
      config.tenComplements[skillKey] = 'off'
    }
  })

  return config
}
