'use client'

import { useCallback } from 'react'
import { css } from '../../styled-system/css'
import { hstack, vstack } from '../../styled-system/patterns'
import { SkillSet } from '../../types/tutorial'

interface SkillSelectorProps {
  skills: SkillSet
  onChange: (skills: SkillSet) => void
  mode?: 'required' | 'target' | 'forbidden'
  title?: string
  className?: string
}

type SkillMode = 'required' | 'target' | 'forbidden'

export function SkillSelector({
  skills,
  onChange,
  mode = 'required',
  title = 'Skills',
  className
}: SkillSelectorProps) {

  const updateSkill = useCallback((category: keyof SkillSet, skill: string, enabled: boolean) => {
    const newSkills = { ...skills }

    if (category === 'basic') {
      newSkills.basic = { ...newSkills.basic, [skill]: enabled }
    } else if (category === 'fiveComplements') {
      newSkills.fiveComplements = { ...newSkills.fiveComplements, [skill]: enabled }
    } else if (category === 'tenComplements') {
      newSkills.tenComplements = { ...newSkills.tenComplements, [skill]: enabled }
    }

    onChange(newSkills)
  }, [skills, onChange])

  const getModeStyles = (skillEnabled: boolean): string => {
    if (!skillEnabled) {
      return css({
        bg: 'gray.100',
        color: 'gray.400',
        border: '1px solid',
        borderColor: 'gray.200'
      })
    }

    switch (mode) {
      case 'required':
        return css({
          bg: 'green.100',
          color: 'green.800',
          border: '1px solid',
          borderColor: 'green.300'
        })
      case 'target':
        return css({
          bg: 'blue.100',
          color: 'blue.800',
          border: '1px solid',
          borderColor: 'blue.300'
        })
      case 'forbidden':
        return css({
          bg: 'red.100',
          color: 'red.800',
          border: '1px solid',
          borderColor: 'red.300'
        })
      default:
        return css({
          bg: 'gray.100',
          color: 'gray.600',
          border: '1px solid',
          borderColor: 'gray.300'
        })
    }
  }

  const SkillButton = ({
    category,
    skill,
    label,
    enabled
  }: {
    category: keyof SkillSet
    skill: string
    label: string
    enabled: boolean
  }) => (
    <button
      onClick={() => updateSkill(category, skill, !enabled)}
      className={css({
        px: 3,
        py: 2,
        rounded: 'md',
        fontSize: 'sm',
        fontWeight: 'medium',
        cursor: 'pointer',
        transition: 'all 0.2s',
        _hover: { opacity: 0.8 }
      }, getModeStyles(enabled))}
    >
      {enabled && mode === 'required' && '✅ '}
      {enabled && mode === 'target' && '🎯 '}
      {enabled && mode === 'forbidden' && '❌ '}
      {label}
    </button>
  )

  return (
    <div className={css({
      p: 4,
      bg: 'white',
      border: '1px solid',
      borderColor: 'gray.200',
      rounded: 'lg'
    }, className)}>
      <h4 className={css({
        fontSize: 'lg',
        fontWeight: 'semibold',
        mb: 4,
        color: 'gray.800'
      })}>
        {title}
      </h4>

      <div className={vstack({ gap: 4, alignItems: 'stretch' })}>
        {/* Basic Operations */}
        <div>
          <h5 className={css({
            fontSize: 'md',
            fontWeight: 'medium',
            mb: 2,
            color: 'gray.700'
          })}>
            Basic Operations
          </h5>
          <div className={hstack({ gap: 2, flexWrap: 'wrap' })}>
            <SkillButton
              category="basic"
              skill="directAddition"
              label="Direct Addition (1-4)"
              enabled={skills.basic.directAddition}
            />
            <SkillButton
              category="basic"
              skill="heavenBead"
              label="Heaven Bead (5)"
              enabled={skills.basic.heavenBead}
            />
            <SkillButton
              category="basic"
              skill="simpleCombinations"
              label="Simple Combinations (6-9)"
              enabled={skills.basic.simpleCombinations}
            />
          </div>
        </div>

        {/* Five Complements */}
        <div>
          <h5 className={css({
            fontSize: 'md',
            fontWeight: 'medium',
            mb: 2,
            color: 'gray.700'
          })}>
            Five Complements
          </h5>
          <div className={hstack({ gap: 2, flexWrap: 'wrap' })}>
            <SkillButton
              category="fiveComplements"
              skill="4=5-1"
              label="4 = 5 - 1"
              enabled={skills.fiveComplements["4=5-1"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="3=5-2"
              label="3 = 5 - 2"
              enabled={skills.fiveComplements["3=5-2"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="2=5-3"
              label="2 = 5 - 3"
              enabled={skills.fiveComplements["2=5-3"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="1=5-4"
              label="1 = 5 - 4"
              enabled={skills.fiveComplements["1=5-4"]}
            />
          </div>
        </div>

        {/* Ten Complements */}
        <div>
          <h5 className={css({
            fontSize: 'md',
            fontWeight: 'medium',
            mb: 2,
            color: 'gray.700'
          })}>
            Ten Complements
          </h5>
          <div className={hstack({ gap: 2, flexWrap: 'wrap' })}>
            {Object.entries(skills.tenComplements).map(([complement, enabled]) => (
              <SkillButton
                key={complement}
                category="tenComplements"
                skill={complement}
                label={complement}
                enabled={enabled}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={css({
        mt: 4,
        pt: 3,
        borderTop: '1px solid',
        borderColor: 'gray.200',
        fontSize: 'xs',
        color: 'gray.600'
      })}>
        {mode === 'required' && '✅ Skills the user must know to solve problems'}
        {mode === 'target' && '🎯 Skills to specifically practice (generates problems requiring these)'}
        {mode === 'forbidden' && '❌ Skills the user hasn\'t learned yet (problems won\'t require these)'}
      </div>
    </div>
  )
}