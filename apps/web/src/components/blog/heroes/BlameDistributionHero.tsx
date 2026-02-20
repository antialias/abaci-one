'use client'

import { useState, useEffect, useRef } from 'react'
import { css } from '../../../../styled-system/css'
import { VerticalProblem } from '@/components/practice/VerticalProblem'
import { updateOnIncorrect } from '@/lib/curriculum/bkt/conjunctive-bkt'
import { getDefaultParams } from '@/lib/curriculum/bkt/skill-priors'
import { formatSkillLabel } from '@/components/practice/weakSkillUtils'
import type { SkillBktRecord, BlameDistribution } from '@/lib/curriculum/bkt/types'

// Animation phases in order
type Phase =
  | 'initial'
  | 'typing1'
  | 'typing2'
  | 'incorrect'
  | 'blameReveal'
  | 'masteryUpdate'
  | 'hold'
  | 'fadeOut'

const PHASE_ORDER: Record<Phase, number> = {
  initial: 0,
  typing1: 1,
  typing2: 2,
  incorrect: 3,
  blameReveal: 4,
  masteryUpdate: 5,
  hold: 6,
  fadeOut: 7,
}

function phaseAtLeast(current: Phase, target: Phase): boolean {
  return PHASE_ORDER[current] >= PHASE_ORDER[target]
}

// --- Problem scenarios ---
// Each problem exercises 3-4 skills with varied mastery levels.
// Wrong answers are plausible errors (typically off by 10 from a carry mistake).

interface ProblemScenario {
  terms: number[]
  correctAnswer: number
  wrongAnswer: string
  skills: { skillId: string; pKnown: number }[]
}

const PROBLEMS: ProblemScenario[] = [
  {
    // 47 + 38 = 85, student writes 75
    terms: [47, 38],
    correctAnswer: 85,
    wrongAnswer: '75',
    skills: [
      { skillId: 'basic.directAddition', pKnown: 0.85 },
      { skillId: 'tenComplements.8=10-2', pKnown: 0.35 },
      { skillId: 'fiveComplements.4=5-1', pKnown: 0.62 },
    ],
  },
  {
    // 23 + 45 + 17 = 85, student writes 75
    terms: [23, 45, 17],
    correctAnswer: 85,
    wrongAnswer: '75',
    skills: [
      { skillId: 'basic.directAddition', pKnown: 0.82 },
      { skillId: 'fiveComplements.4=5-1', pKnown: 0.55 },
      { skillId: 'tenComplements.7=10-3', pKnown: 0.3 },
    ],
  },
  {
    // 34 + 28 + 19 = 81, student writes 71
    terms: [34, 28, 19],
    correctAnswer: 81,
    wrongAnswer: '71',
    skills: [
      { skillId: 'basic.directAddition', pKnown: 0.88 },
      { skillId: 'tenComplements.8=10-2', pKnown: 0.35 },
      { skillId: 'tenComplements.9=10-1', pKnown: 0.28 },
      { skillId: 'fiveComplements.3=5-2', pKnown: 0.6 },
    ],
  },
  {
    // 16 + 27 + 14 + 8 = 65, student writes 55
    terms: [16, 27, 14, 8],
    correctAnswer: 65,
    wrongAnswer: '55',
    skills: [
      { skillId: 'fiveComplements.2=5-3', pKnown: 0.5 },
      { skillId: 'tenComplements.7=10-3', pKnown: 0.32 },
      { skillId: 'basic.directAddition', pKnown: 0.85 },
      { skillId: 'fiveComplements.4=5-1', pKnown: 0.48 },
    ],
  },
  {
    // 42 + 33 + 18 = 93, student writes 83
    terms: [42, 33, 18],
    correctAnswer: 93,
    wrongAnswer: '83',
    skills: [
      { skillId: 'basic.directAddition', pKnown: 0.9 },
      { skillId: 'tenComplements.8=10-2', pKnown: 0.38 },
      { skillId: 'fiveComplements.3=5-2', pKnown: 0.58 },
    ],
  },
  {
    // 15 + 26 + 37 = 78, student writes 68
    terms: [15, 26, 37],
    correctAnswer: 78,
    wrongAnswer: '68',
    skills: [
      { skillId: 'fiveComplements.1=5-4', pKnown: 0.45 },
      { skillId: 'tenComplements.6=10-4', pKnown: 0.3 },
      { skillId: 'tenComplements.7=10-3', pKnown: 0.33 },
      { skillId: 'basic.directAddition', pKnown: 0.87 },
    ],
  },
]

// Precompute BKT records and blame results for each problem (all pure/deterministic)
interface ComputedProblem extends ProblemScenario {
  records: SkillBktRecord[]
  blameResults: BlameDistribution[]
}

const PROBLEM_DATA: ComputedProblem[] = PROBLEMS.map((p) => {
  const records: SkillBktRecord[] = p.skills.map((s) => ({
    ...s,
    params: getDefaultParams(s.skillId),
  }))
  return { ...p, records, blameResults: updateOnIncorrect(records) }
})

// Classification colors (from SkillProgressChart)
function getMasteryColor(pKnown: number): string {
  if (pKnown >= 0.8) return '#22c55e' // strong - green
  if (pKnown >= 0.5) return '#3b82f6' // developing - blue
  return '#f87171' // weak - red
}

const BLAME_COLOR = '#f97316'

export default function BlameDistributionHero() {
  const [phase, setPhase] = useState<Phase>('initial')
  const [opacity, setOpacity] = useState(1)
  const [problemIndex, setProblemIndex] = useState(0)
  const cycleRef = useRef(0)

  // Animation loop: cycles through phases, advances problem each iteration
  useEffect(() => {
    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function startCycle() {
      if (cancelled) return
      timeouts.length = 0

      const idx = cycleRef.current % PROBLEM_DATA.length
      cycleRef.current += 1

      setProblemIndex(idx)
      setPhase('initial')
      setOpacity(1)

      const schedule = (fn: () => void, delay: number) => {
        timeouts.push(
          setTimeout(() => {
            if (!cancelled) fn()
          }, delay)
        )
      }

      schedule(() => setPhase('typing1'), 800)
      schedule(() => setPhase('typing2'), 1150)
      schedule(() => setPhase('incorrect'), 1500)
      schedule(() => setPhase('blameReveal'), 2200)
      schedule(() => setPhase('masteryUpdate'), 4200)
      schedule(() => setPhase('hold'), 5700)
      schedule(() => {
        setPhase('fadeOut')
        setOpacity(0)
      }, 7200)
      schedule(startCycle, 7700)
    }

    startCycle()

    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [])

  const problem = PROBLEM_DATA[problemIndex]

  // Derived animation state
  const userAnswer = !phaseAtLeast(phase, 'typing1')
    ? ''
    : !phaseAtLeast(phase, 'typing2')
      ? problem.wrongAnswer[0]
      : problem.wrongAnswer
  const isCompleted = phaseAtLeast(phase, 'incorrect')
  const showBlame = phaseAtLeast(phase, 'blameReveal')
  const showMasteryUpdate = phaseAtLeast(phase, 'masteryUpdate')

  return (
    <div
      data-component="blame-distribution-hero"
      style={{ opacity, transition: 'opacity 500ms ease' }}
      className={css({
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { base: '1rem', md: '2rem' },
        padding: { base: '0.75rem', md: '1.5rem' },
      })}
    >
      {/* Left: Vertical Problem */}
      <div
        data-element="problem-panel"
        className={css({
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <div
          className={css({
            padding: { base: '0.75rem', md: '1.25rem' },
            backgroundColor: 'gray.50',
            borderRadius: '12px',
            borderWidth: '2px',
            borderStyle: 'solid',
          })}
          style={{
            borderColor: isCompleted ? '#f87171' : '#e5e7eb',
            transition: 'border-color 400ms ease',
          }}
        >
          <VerticalProblem
            terms={problem.terms}
            userAnswer={userAnswer}
            isFocused={!isCompleted}
            isCompleted={isCompleted}
            correctAnswer={problem.correctAnswer}
          />
        </div>
      </div>

      {/* Right: Skill Blame Table */}
      <div
        data-element="blame-table"
        className={css({
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: { base: '0.5rem', md: '0.75rem' },
        })}
      >
        {/* Header */}
        <div
          data-element="table-header"
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '70px 1fr 1fr', md: '110px 1fr 1fr' },
            gap: { base: '0.5rem', md: '0.75rem' },
            fontSize: { base: '0.6rem', md: '0.7rem' },
            color: 'gray.500',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            paddingBottom: '0.25rem',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderBottomColor: 'gray.200',
          })}
        >
          <div>Skill</div>
          <div>Mastery</div>
          <div>Blame</div>
        </div>

        {/* Skill Rows */}
        {problem.records.map((skill, i) => {
          const blame = problem.blameResults[i]
          const currentPKnown = showMasteryUpdate ? blame.updatedPKnown : skill.pKnown
          const masteryPercent = Math.round(currentPKnown * 100)
          const masteryColor = getMasteryColor(currentPKnown)
          const blamePercent = showBlame ? Math.round(blame.blameWeight * 100) : 0

          return (
            <div
              key={skill.skillId}
              data-element="skill-row"
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: '70px 1fr 1fr', md: '110px 1fr 1fr' },
                gap: { base: '0.5rem', md: '0.75rem' },
                alignItems: 'center',
              })}
            >
              {/* Skill Label */}
              <div
                data-element="skill-label"
                className={css({
                  fontSize: { base: '0.65rem', md: '0.8rem' },
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'gray.700',
                })}
              >
                {formatSkillLabel(skill.skillId)}
              </div>

              {/* Mastery Bar + Percent */}
              <div
                data-element="mastery-cell"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                })}
              >
                <div
                  className={css({
                    flex: 1,
                    height: { base: '14px', md: '18px' },
                    backgroundColor: 'gray.100',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  })}
                >
                  <div
                    style={{
                      width: `${currentPKnown * 100}%`,
                      backgroundColor: masteryColor,
                      height: '100%',
                      borderRadius: '4px',
                      transition: showMasteryUpdate
                        ? 'width 800ms ease-out, background-color 400ms ease'
                        : 'none',
                    }}
                  />
                </div>
                <span
                  className={css({
                    fontSize: { base: '0.6rem', md: '0.75rem' },
                    fontWeight: '600',
                    minWidth: { base: '2rem', md: '2.5rem' },
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'gray.600',
                  })}
                >
                  {masteryPercent}%
                </span>
              </div>

              {/* Blame Bar + Percent */}
              <div
                data-element="blame-cell"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                })}
              >
                <div
                  className={css({
                    flex: 1,
                    height: { base: '14px', md: '18px' },
                    backgroundColor: 'gray.100',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  })}
                >
                  <div
                    style={{
                      width: `${showBlame ? blame.blameWeight * 100 : 0}%`,
                      backgroundColor: BLAME_COLOR,
                      height: '100%',
                      borderRadius: '4px',
                      transition: showBlame ? `width 600ms ease-out ${i * 200}ms` : 'none',
                    }}
                  />
                </div>
                <span
                  className={css({
                    fontSize: { base: '0.6rem', md: '0.75rem' },
                    fontWeight: '600',
                    minWidth: { base: '2rem', md: '2.5rem' },
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'gray.600',
                  })}
                >
                  {blamePercent}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
