/**
 * Problem Generator Audit Story
 *
 * This story allows you to:
 * 1. Select skills (same structure as the practice app)
 * 2. Generate problems using the EXACT same code path as the practice app
 * 3. View debug traces for copy/paste debugging
 * 4. Regenerate problems to see different outputs
 */
import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { createEmptySkillSet, type SkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type GenerationTrace,
  generateSingleProblem,
  type ProblemConstraints,
} from '@/utils/problemGenerator'
import { css } from '../../../styled-system/css'

const meta: Meta = {
  title: 'Practice/Problem Generator Audit',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

/** Constraints as displayed in the debug trace (different from generator's ProblemConstraints) */
interface DisplayConstraints {
  requiredSkills: SkillSet
  digitRange: { min: number; max: number }
  termCount: { min: number; max: number }
}

interface DebugTrace {
  timestamp: string
  input: {
    constraints: DisplayConstraints
    skillSetSnapshot: SkillSet
  }
  output: {
    terms: number[]
    answer: number
    skillsRequired: string[]
  }
  analysis: {
    actualSkillsFromAnalyzer: string[]
    skillsMatch: boolean
    mismatchedSkills: string[]
  }
  stepByStepTrace: GenerationTrace
  /** True if the generator failed to produce a problem */
  generationFailed?: boolean
}

// Skill checkbox group component
function SkillGroup({
  title,
  skills,
  category,
  skillSet,
  onToggle,
}: {
  title: string
  skills: { key: string; label: string }[]
  category: keyof SkillSet
  skillSet: SkillSet
  onToggle: (category: keyof SkillSet, key: string) => void
}) {
  const categorySkills = skillSet[category] as Record<string, boolean>

  return (
    <div
      className={css({
        p: '1rem',
        bg: 'gray.50',
        borderRadius: '8px',
        mb: '1rem',
      })}
    >
      <h3
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          mb: '0.5rem',
          color: 'gray.700',
        })}
      >
        {title}
      </h3>
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
        })}
      >
        {skills.map(({ key, label }) => (
          <label
            key={key}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              bg: categorySkills[key] ? 'blue.100' : 'white',
              px: '0.5rem',
              py: '0.25rem',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: categorySkills[key] ? 'blue.300' : 'gray.300',
              transition: 'all 0.1s',
              _hover: { borderColor: 'blue.400' },
            })}
          >
            <input
              type="checkbox"
              checked={categorySkills[key] || false}
              onChange={() => onToggle(category, key)}
              className={css({ cursor: 'pointer' })}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

// Main audit component
function ProblemGeneratorAuditUI() {
  // Skill set state - starts with basic addition enabled
  const [skillSet, setSkillSet] = useState<SkillSet>(() => {
    const base = createEmptySkillSet()
    base.basic.directAddition = true
    base.basic.heavenBead = true
    return base
  })

  // Constraints state
  const [maxDigits, setMaxDigits] = useState(1)
  const [maxTerms, setMaxTerms] = useState(5)

  // Results state
  const [debugTraces, setDebugTraces] = useState<DebugTrace[]>([])
  const [generationCount, setGenerationCount] = useState(0)

  // Toggle a skill
  const toggleSkill = useCallback((category: keyof SkillSet, key: string) => {
    setSkillSet((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !(prev[category] as Record<string, boolean>)[key],
      },
    }))
  }, [])

  // Generate a problem using the EXACT same code path as the practice app
  const generateProblem = useCallback(() => {
    const maxValue = 10 ** maxDigits - 1
    const constraints: ProblemConstraints = {
      numberRange: { min: 1, max: maxValue },
      maxTerms,
      problemCount: 1,
    }

    // Call generateSingleProblem directly to get the generation trace (provenance)
    const result = generateSingleProblem(constraints, skillSet)

    if (!result) {
      // Generation failed - create a trace showing the failure
      const failureTrace: DebugTrace = {
        timestamp: new Date().toISOString(),
        input: {
          constraints: {
            requiredSkills: skillSet,
            digitRange: { min: 1, max: maxDigits },
            termCount: { min: 3, max: maxTerms },
          },
          skillSetSnapshot: JSON.parse(JSON.stringify(skillSet)),
        },
        output: {
          terms: [],
          answer: 0,
          skillsRequired: [],
        },
        analysis: {
          actualSkillsFromAnalyzer: [],
          skillsMatch: true,
          mismatchedSkills: [],
        },
        stepByStepTrace: { terms: [], answer: 0, steps: [], allSkills: [] },
        generationFailed: true,
      }
      setDebugTraces((prev) => [failureTrace, ...prev])
      setGenerationCount((prev) => prev + 1)
      return
    }

    // Get the provenance trace directly from the generator
    const stepByStepTrace = result.generationTrace!

    // Run the analyzer independently to verify (this is the comparison)
    const actualSkillsFromAnalyzer = analyzeRequiredSkills(result.terms, result.answer)

    // Check for mismatches between generator's provenance and independent analyzer
    const resultSkillsSet = new Set(result.requiredSkills)
    const analyzerSkillsSet = new Set(actualSkillsFromAnalyzer)
    const mismatchedSkills = [
      ...result.requiredSkills.filter((s) => !analyzerSkillsSet.has(s)),
      ...actualSkillsFromAnalyzer.filter((s) => !resultSkillsSet.has(s)),
    ]

    const trace: DebugTrace = {
      timestamp: new Date().toISOString(),
      input: {
        constraints: {
          requiredSkills: skillSet,
          digitRange: { min: 1, max: maxDigits },
          termCount: { min: 3, max: maxTerms },
        },
        skillSetSnapshot: JSON.parse(JSON.stringify(skillSet)),
      },
      output: {
        terms: result.terms,
        answer: result.answer,
        skillsRequired: result.requiredSkills,
      },
      analysis: {
        actualSkillsFromAnalyzer,
        skillsMatch:
          result.requiredSkills.length === actualSkillsFromAnalyzer.length &&
          result.requiredSkills.every((s) => analyzerSkillsSet.has(s)),
        mismatchedSkills,
      },
      stepByStepTrace,
    }

    setDebugTraces((prev) => [trace, ...prev])
    setGenerationCount((prev) => prev + 1)
  }, [skillSet, maxDigits, maxTerms])

  // Clear traces
  const clearTraces = useCallback(() => {
    setDebugTraces([])
  }, [])

  // Format step-by-step trace for display
  const formatStepByStepTrace = useCallback((trace: GenerationTrace): string => {
    let output = '### Step-by-Step Skill Analysis\n\n'
    output += '| Step | Operation | Skills Used | Explanation |\n'
    output += '|------|-----------|-------------|-------------|\n'
    for (const step of trace.steps) {
      const skills = step.skillsUsed.length > 0 ? step.skillsUsed.join(', ') : '(none)'
      output += `| ${step.stepNumber} | ${step.operation} | ${skills} | ${step.explanation} |\n`
    }
    return output
  }, [])

  // Copy trace to clipboard
  const copyTrace = useCallback(
    (trace: DebugTrace) => {
      const text = `## Problem Generator Debug Trace

**Timestamp:** ${trace.timestamp}

### Input Constraints
\`\`\`json
${JSON.stringify(trace.input.constraints, null, 2)}
\`\`\`

### Skill Set Snapshot
\`\`\`json
${JSON.stringify(trace.input.skillSetSnapshot, null, 2)}
\`\`\`

### Output
- **Terms:** ${trace.output.terms.join(' + ')} = ${trace.output.answer}
- **Skills Required:** ${trace.output.skillsRequired.join(', ')}

${formatStepByStepTrace(trace.stepByStepTrace)}

### Analysis
- **Analyzer Skills:** ${trace.analysis.actualSkillsFromAnalyzer.join(', ')}
- **Skills Match:** ${trace.analysis.skillsMatch ? '✅ Yes' : '❌ No'}
${trace.analysis.mismatchedSkills.length > 0 ? `- **Mismatched Skills:** ${trace.analysis.mismatchedSkills.join(', ')}` : ''}
`
      navigator.clipboard.writeText(text)
    },
    [formatStepByStepTrace]
  )

  // Skill definitions for the UI
  const basicSkills = [
    { key: 'directAddition', label: 'Direct Add (1-4)' },
    { key: 'heavenBead', label: 'Heaven Bead (5)' },
    { key: 'simpleCombinations', label: 'Simple Combos (6-9)' },
    { key: 'directSubtraction', label: 'Direct Sub' },
    { key: 'heavenBeadSubtraction', label: 'Heaven Bead Sub' },
    { key: 'simpleCombinationsSub', label: 'Simple Combos Sub' },
  ]

  const fiveComplementsAdd = [
    { key: '4=5-1', label: '+4 = +5-1' },
    { key: '3=5-2', label: '+3 = +5-2' },
    { key: '2=5-3', label: '+2 = +5-3' },
    { key: '1=5-4', label: '+1 = +5-4' },
  ]

  const tenComplementsAdd = [
    { key: '9=10-1', label: '+9 = +10-1' },
    { key: '8=10-2', label: '+8 = +10-2' },
    { key: '7=10-3', label: '+7 = +10-3' },
    { key: '6=10-4', label: '+6 = +10-4' },
    { key: '5=10-5', label: '+5 = +10-5' },
    { key: '4=10-6', label: '+4 = +10-6' },
    { key: '3=10-7', label: '+3 = +10-7' },
    { key: '2=10-8', label: '+2 = +10-8' },
    { key: '1=10-9', label: '+1 = +10-9' },
  ]

  const fiveComplementsSub = [
    { key: '-4=-5+1', label: '-4 = -5+1' },
    { key: '-3=-5+2', label: '-3 = -5+2' },
    { key: '-2=-5+3', label: '-2 = -5+3' },
    { key: '-1=-5+4', label: '-1 = -5+4' },
  ]

  const tenComplementsSub = [
    { key: '-9=+1-10', label: '-9 = +1-10' },
    { key: '-8=+2-10', label: '-8 = +2-10' },
    { key: '-7=+3-10', label: '-7 = +3-10' },
    { key: '-6=+4-10', label: '-6 = +4-10' },
    { key: '-5=+5-10', label: '-5 = +5-10' },
    { key: '-4=+6-10', label: '-4 = +6-10' },
    { key: '-3=+7-10', label: '-3 = +7-10' },
    { key: '-2=+8-10', label: '-2 = +8-10' },
    { key: '-1=+9-10', label: '-1 = +9-10' },
  ]

  return (
    <div
      data-component="problem-generator-audit"
      className={css({
        display: 'flex',
        h: '100vh',
        bg: 'gray.100',
      })}
    >
      {/* Left Panel: Controls */}
      <div
        className={css({
          w: '400px',
          bg: 'white',
          borderRight: '1px solid',
          borderColor: 'gray.200',
          overflow: 'auto',
          p: '1rem',
        })}
      >
        <h1
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            mb: '1rem',
          })}
        >
          Problem Generator Audit
        </h1>

        {/* Constraints */}
        <div
          className={css({
            mb: '1rem',
            p: '1rem',
            bg: 'blue.50',
            borderRadius: '8px',
          })}
        >
          <h2
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              mb: '0.75rem',
            })}
          >
            Constraints
          </h2>
          <div className={css({ display: 'flex', gap: '1rem' })}>
            <label className={css({ flex: 1 })}>
              <span className={css({ fontSize: '0.75rem', color: 'gray.600' })}>Max Digits</span>
              <select
                value={maxDigits}
                onChange={(e) => setMaxDigits(Number(e.target.value))}
                className={css({
                  w: '100%',
                  p: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: 'gray.300',
                })}
              >
                <option value={1}>1 (1-9)</option>
                <option value={2}>2 (1-99)</option>
                <option value={3}>3 (1-999)</option>
              </select>
            </label>
            <label className={css({ flex: 1 })}>
              <span className={css({ fontSize: '0.75rem', color: 'gray.600' })}>Max Terms</span>
              <select
                value={maxTerms}
                onChange={(e) => setMaxTerms(Number(e.target.value))}
                className={css({
                  w: '100%',
                  p: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: 'gray.300',
                })}
              >
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} terms
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Skills */}
        <SkillGroup
          title="Basic Skills"
          skills={basicSkills}
          category="basic"
          skillSet={skillSet}
          onToggle={toggleSkill}
        />

        <SkillGroup
          title="Five Complements (Addition)"
          skills={fiveComplementsAdd}
          category="fiveComplements"
          skillSet={skillSet}
          onToggle={toggleSkill}
        />

        <SkillGroup
          title="Ten Complements (Addition)"
          skills={tenComplementsAdd}
          category="tenComplements"
          skillSet={skillSet}
          onToggle={toggleSkill}
        />

        <SkillGroup
          title="Five Complements (Subtraction)"
          skills={fiveComplementsSub}
          category="fiveComplementsSub"
          skillSet={skillSet}
          onToggle={toggleSkill}
        />

        <SkillGroup
          title="Ten Complements (Subtraction)"
          skills={tenComplementsSub}
          category="tenComplementsSub"
          skillSet={skillSet}
          onToggle={toggleSkill}
        />

        {/* Actions */}
        <div
          className={css({
            position: 'sticky',
            bottom: 0,
            bg: 'white',
            py: '1rem',
            borderTop: '1px solid',
            borderColor: 'gray.200',
            display: 'flex',
            gap: '0.5rem',
          })}
        >
          <button
            onClick={generateProblem}
            className={css({
              flex: 1,
              bg: 'blue.600',
              color: 'white',
              py: '0.75rem',
              px: '1rem',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              _hover: { bg: 'blue.700' },
            })}
          >
            Generate Problem
          </button>
          <button
            onClick={clearTraces}
            className={css({
              bg: 'gray.200',
              color: 'gray.700',
              py: '0.75rem',
              px: '1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              _hover: { bg: 'gray.300' },
            })}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div
        className={css({
          flex: 1,
          overflow: 'auto',
          p: '1rem',
        })}
      >
        <div
          className={css({
            mb: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <h2
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
            })}
          >
            Debug Traces ({debugTraces.length})
          </h2>
          <span className={css({ fontSize: '0.875rem', color: 'gray.500' })}>
            Total generations: {generationCount}
          </span>
        </div>

        {debugTraces.length === 0 ? (
          <div
            className={css({
              textAlign: 'center',
              py: '4rem',
              color: 'gray.500',
            })}
          >
            <p>Click "Generate Problem" to see debug traces</p>
            <p className={css({ fontSize: '0.875rem', mt: '0.5rem' })}>
              Each trace can be copied and pasted for debugging
            </p>
          </div>
        ) : (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
            {debugTraces.map((trace, index) => (
              <div
                key={trace.timestamp}
                className={css({
                  bg: 'white',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: trace.analysis.skillsMatch ? 'gray.200' : 'red.300',
                  overflow: 'hidden',
                })}
              >
                {/* Header */}
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: '0.75rem 1rem',
                    bg: trace.analysis.skillsMatch ? 'gray.50' : 'red.50',
                    borderBottom: '1px solid',
                    borderColor: trace.analysis.skillsMatch ? 'gray.200' : 'red.200',
                  })}
                >
                  <span className={css({ fontSize: '0.75rem', color: 'gray.500' })}>
                    #{debugTraces.length - index} • {new Date(trace.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => copyTrace(trace)}
                    className={css({
                      fontSize: '0.75rem',
                      bg: 'blue.100',
                      color: 'blue.700',
                      px: '0.5rem',
                      py: '0.25rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      _hover: { bg: 'blue.200' },
                    })}
                  >
                    Copy Debug Trace
                  </button>
                </div>

                {/* Problem Display */}
                <div className={css({ p: '1rem' })}>
                  <div
                    className={css({
                      display: 'flex',
                      gap: '2rem',
                      alignItems: 'flex-start',
                    })}
                  >
                    {/* Vertical Problem with Skills per Term */}
                    <div
                      className={css({
                        fontFamily: 'monospace',
                        fontSize: '1rem',
                        bg: 'gray.100',
                        p: '1rem',
                        borderRadius: '8px',
                      })}
                    >
                      {trace.output.terms.map((term, i) => {
                        // Find the corresponding step in the trace (step numbers are 1-indexed, first term is step 1)
                        const step = trace.stepByStepTrace.steps.find((s) => s.stepNumber === i + 1)
                        return (
                          <div
                            key={i}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1rem',
                              py: '0.25rem',
                            })}
                          >
                            {/* Term value - right aligned with sign */}
                            <span
                              className={css({
                                minW: '60px',
                                textAlign: 'right',
                                color: term < 0 ? 'red.600' : 'inherit',
                              })}
                            >
                              {i === 0 ? term : term >= 0 ? `+${term}` : term}
                            </span>
                            {/* Running total and skills (not shown for first term) */}
                            {i === 0 ? (
                              <span
                                className={css({
                                  fontSize: '0.75rem',
                                  color: 'gray.500',
                                })}
                              >
                                (start)
                              </span>
                            ) : step ? (
                              <div
                                className={css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                })}
                              >
                                {/* Running total */}
                                <span
                                  className={css({
                                    fontSize: '0.75rem',
                                    color: 'gray.600',
                                    fontWeight: 'bold',
                                  })}
                                >
                                  = {step.accumulatedAfter}
                                </span>
                                {/* Skills used */}
                                {step.skillsUsed.length > 0 && (
                                  <div
                                    className={css({
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '0.25rem',
                                    })}
                                  >
                                    {step.skillsUsed.map((skill) => (
                                      <span
                                        key={skill}
                                        className={css({
                                          fontSize: '0.625rem',
                                          bg: 'purple.100',
                                          color: 'purple.800',
                                          px: '0.375rem',
                                          py: '0.125rem',
                                          borderRadius: '4px',
                                        })}
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {step.skillsUsed.length === 0 && (
                                  <span
                                    className={css({
                                      fontSize: '0.625rem',
                                      color: 'gray.400',
                                    })}
                                  >
                                    (basic)
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          borderTop: '2px solid',
                          borderColor: 'gray.400',
                          pt: '0.25rem',
                          mt: '0.25rem',
                        })}
                      >
                        <span
                          className={css({
                            minW: '60px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                          })}
                        >
                          {trace.output.answer}
                        </span>
                        <span
                          className={css({
                            fontSize: '0.75rem',
                            color: 'gray.600',
                          })}
                        >
                          (final)
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className={css({ flex: 1 })}>
                      {/* Skills Required */}
                      <div className={css({ mb: '0.75rem' })}>
                        <span className={css({ fontSize: '0.75rem', color: 'gray.500' })}>
                          Skills from generator:
                        </span>
                        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' })}>
                          {trace.output.skillsRequired.map((skill) => (
                            <span
                              key={skill}
                              className={css({
                                fontSize: '0.75rem',
                                bg: 'blue.100',
                                color: 'blue.800',
                                px: '0.5rem',
                                py: '0.125rem',
                                borderRadius: '4px',
                              })}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Skills from Analyzer */}
                      <div className={css({ mb: '0.75rem' })}>
                        <span className={css({ fontSize: '0.75rem', color: 'gray.500' })}>
                          Skills from analyzer:
                        </span>
                        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' })}>
                          {trace.analysis.actualSkillsFromAnalyzer.map((skill) => (
                            <span
                              key={skill}
                              className={css({
                                fontSize: '0.75rem',
                                bg: 'green.100',
                                color: 'green.800',
                                px: '0.5rem',
                                py: '0.125rem',
                                borderRadius: '4px',
                              })}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Mismatch Warning */}
                      {!trace.analysis.skillsMatch && (
                        <div
                          className={css({
                            bg: 'red.100',
                            color: 'red.800',
                            p: '0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          })}
                        >
                          ⚠️ Skills mismatch! Mismatched:{' '}
                          {trace.analysis.mismatchedSkills.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Full Debug Trace - always visible */}
                  <div
                    className={css({
                      mt: '1rem',
                      p: '0.75rem',
                      bg: 'gray.900',
                      borderRadius: '8px',
                      color: 'gray.100',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: '0.5rem',
                      })}
                    >
                      <span
                        className={css({
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          color: 'gray.400',
                        })}
                      >
                        Debug Trace (copy for debugging)
                      </span>
                      <button
                        onClick={() => copyTrace(trace)}
                        className={css({
                          fontSize: '0.625rem',
                          bg: 'gray.700',
                          color: 'gray.200',
                          px: '0.5rem',
                          py: '0.25rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          _hover: { bg: 'gray.600' },
                        })}
                      >
                        Copy as Markdown
                      </button>
                    </div>
                    <pre
                      className={css({
                        fontSize: '0.625rem',
                        fontFamily: 'monospace',
                        overflow: 'auto',
                        maxH: '500px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      })}
                    >
                      {`## Problem Generator Debug Trace

**Timestamp:** ${trace.timestamp}

### Input Constraints
\`\`\`json
${JSON.stringify(trace.input.constraints, null, 2)}
\`\`\`

### Enabled Skills at Generation Time
\`\`\`json
${JSON.stringify(
  Object.fromEntries(
    Object.entries(trace.input.skillSetSnapshot).map(([cat, skills]) => [
      cat,
      Object.fromEntries(
        Object.entries(skills as Record<string, boolean>).filter(([, enabled]) => enabled)
      ),
    ])
  ),
  null,
  2
)}
\`\`\`

### Output
- **Terms:** ${trace.output.terms.join(' + ')} = ${trace.output.answer}
- **Skills Required:** ${trace.output.skillsRequired.join(', ')}

${formatStepByStepTrace(trace.stepByStepTrace)}

### Analysis
- **Analyzer Skills:** ${trace.analysis.actualSkillsFromAnalyzer.join(', ')}
- **Skills Match:** ${trace.analysis.skillsMatch ? '✅ Yes' : '❌ No'}${trace.analysis.mismatchedSkills.length > 0 ? `\n- **Mismatched Skills:** ${trace.analysis.mismatchedSkills.join(', ')}` : ''}`}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const Audit: StoryObj = {
  render: () => <ProblemGeneratorAuditUI />,
}
