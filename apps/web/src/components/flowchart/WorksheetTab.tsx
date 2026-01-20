'use client'

import { useState, useCallback, useMemo } from 'react'
import type { ExecutableFlowchart } from '@/lib/flowcharts/schema'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import { DifficultyDistributionSlider, type DifficultyDistribution } from './DifficultyDistributionSlider'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface WorksheetTabProps {
  /** The loaded flowchart */
  flowchart: ExecutableFlowchart
  /** Tier counts from generated examples */
  tierCounts: { easy: number; medium: number; hard: number }
  /** Generated examples for problem selection */
  examples?: GeneratedExample[]
}

/** Problem counts options for dropdown */
const PROBLEM_COUNT_OPTIONS = [10, 15, 20, 25, 30, 40, 50]

/** Default pages based on problem count */
function getDefaultPages(problemCount: number): number {
  if (problemCount <= 12) return 1
  if (problemCount <= 24) return 2
  return Math.ceil(problemCount / 15)
}

/**
 * Worksheet tab content - generate PDF worksheets with difficulty controls.
 */
export function WorksheetTab({ flowchart, tierCounts, examples = [] }: WorksheetTabProps) {
  // Distribution state
  const [distribution, setDistribution] = useState<DifficultyDistribution>(() => {
    // Smart default: distribute based on available examples
    const total = tierCounts.easy + tierCounts.medium + tierCounts.hard
    if (total === 0) return { easy: 34, medium: 33, hard: 33 }

    // Weight towards what's available
    const easy = Math.round((tierCounts.easy / total) * 100)
    const hard = Math.round((tierCounts.hard / total) * 100)
    const medium = 100 - easy - hard

    return { easy, medium, hard }
  })

  // Problem count
  const [problemCount, setProblemCount] = useState(20)

  // Page count (auto-calculated but can be overridden)
  const [pageCount, setPageCount] = useState(() => getDefaultPages(20))

  // Whether to include answer key
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate problems per page
  const problemsPerPage = useMemo(() => {
    return Math.ceil(problemCount / pageCount)
  }, [problemCount, pageCount])

  // Calculate how many problems would be selected from each tier
  const tierSelection = useMemo(() => {
    const easy = Math.round((distribution.easy / 100) * problemCount)
    const hard = Math.round((distribution.hard / 100) * problemCount)
    const medium = problemCount - easy - hard // Remainder to ensure exact total
    return { easy, medium, hard }
  }, [distribution, problemCount])

  // Check if distribution is valid (enough examples available)
  const validationWarnings = useMemo(() => {
    const warnings: string[] = []

    if (tierSelection.easy > tierCounts.easy) {
      warnings.push(
        `Only ${tierCounts.easy} easy problems available (need ${tierSelection.easy})`
      )
    }
    if (tierSelection.medium > tierCounts.medium) {
      warnings.push(
        `Only ${tierCounts.medium} medium problems available (need ${tierSelection.medium})`
      )
    }
    if (tierSelection.hard > tierCounts.hard) {
      warnings.push(
        `Only ${tierCounts.hard} hard problems available (need ${tierSelection.hard})`
      )
    }

    return warnings
  }, [tierSelection, tierCounts])

  // Available tiers
  const availableTiers = useMemo(
    () => ({
      easy: tierCounts.easy > 0,
      medium: tierCounts.medium > 0,
      hard: tierCounts.hard > 0,
    }),
    [tierCounts]
  )

  // Handle problem count change
  const handleProblemCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = parseInt(e.target.value, 10)
    setProblemCount(count)
    setPageCount(getDefaultPages(count))
  }, [])

  // Handle page count change
  const handlePageCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageCount(parseInt(e.target.value, 10))
  }, [])

  // Generate worksheet
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/flowcharts/${flowchart.definition.id}/worksheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distribution,
          problemCount,
          pageCount,
          includeAnswerKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate worksheet')
      }

      // Get the PDF blob and trigger download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${flowchart.definition.title.toLowerCase().replace(/\s+/g, '-')}-worksheet.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate worksheet:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate worksheet')
    } finally {
      setIsGenerating(false)
    }
  }, [flowchart, distribution, problemCount, pageCount, includeAnswerKey])

  // If no examples available at all
  const totalAvailable = tierCounts.easy + tierCounts.medium + tierCounts.hard
  if (totalAvailable === 0) {
    return (
      <div
        data-component="worksheet-tab"
        className={vstack({ gap: '4', alignItems: 'center', padding: '6' })}
      >
        <p
          className={css({
            fontSize: 'md',
            color: { base: 'gray.600', _dark: 'gray.400' },
            textAlign: 'center',
          })}
        >
          No examples available yet. Visit the Practice tab first to generate problems.
        </p>
      </div>
    )
  }

  return (
    <div
      data-component="worksheet-tab"
      className={vstack({ gap: '6', alignItems: 'stretch' })}
    >
      {/* Difficulty Distribution */}
      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'semibold',
            color: { base: 'gray.800', _dark: 'gray.200' },
          })}
        >
          Difficulty Mix
        </h3>
        <DifficultyDistributionSlider
          distribution={distribution}
          onChange={setDistribution}
          availableTiers={availableTiers}
          tierCounts={tierCounts}
        />
      </div>

      {/* Problem & Page Counts */}
      <div className={hstack({ gap: '4', justifyContent: 'center', flexWrap: 'wrap' })}>
        {/* Problem count */}
        <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Problems
          </label>
          <select
            value={problemCount}
            onChange={handleProblemCountChange}
            className={css({
              padding: '2 4',
              fontSize: 'md',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              cursor: 'pointer',
              minWidth: '80px',
              _focus: {
                outline: 'none',
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
              },
            })}
          >
            {PROBLEM_COUNT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>

        {/* Page count */}
        <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
          <label
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Pages
          </label>
          <select
            value={pageCount}
            onChange={handlePageCountChange}
            className={css({
              padding: '2 4',
              fontSize: 'md',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              cursor: 'pointer',
              minWidth: '80px',
              _focus: {
                outline: 'none',
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
              },
            })}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>

        {/* Per page info */}
        <div
          className={css({
            alignSelf: 'flex-end',
            padding: '2',
            fontSize: 'sm',
            color: { base: 'gray.500', _dark: 'gray.400' },
          })}
        >
          ({problemsPerPage} per page)
        </div>
      </div>

      {/* Answer key toggle */}
      <div className={hstack({ gap: '2', justifyContent: 'center' })}>
        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            cursor: 'pointer',
          })}
        >
          <input
            type="checkbox"
            checked={includeAnswerKey}
            onChange={(e) => setIncludeAnswerKey(e.target.checked)}
            className={css({
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            })}
          />
          <span
            className={css({
              fontSize: 'sm',
              color: { base: 'gray.700', _dark: 'gray.300' },
            })}
          >
            Include answer key
          </span>
        </label>
      </div>

      {/* Validation warnings */}
      {validationWarnings.length > 0 && (
        <div
          data-element="validation-warnings"
          className={css({
            padding: '3',
            borderRadius: 'lg',
            backgroundColor: { base: 'amber.50', _dark: 'amber.900/30' },
            border: '1px solid',
            borderColor: { base: 'amber.300', _dark: 'amber.600' },
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: { base: 'amber.800', _dark: 'amber.300' },
              marginBottom: '1',
            })}
          >
            ⚠️ Not enough examples for selected distribution:
          </p>
          <ul
            className={css({
              fontSize: 'sm',
              color: { base: 'amber.700', _dark: 'amber.400' },
              listStyleType: 'disc',
              paddingLeft: '5',
            })}
          >
            {validationWarnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
          <p
            className={css({
              fontSize: 'xs',
              color: { base: 'amber.600', _dark: 'amber.400' },
              marginTop: '2',
            })}
          >
            Worksheet will use all available problems and fill the rest from other tiers.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className={css({
            padding: '3',
            borderRadius: 'lg',
            backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
            border: '1px solid',
            borderColor: { base: 'red.300', _dark: 'red.600' },
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: { base: 'red.700', _dark: 'red.300' },
            })}
          >
            {error}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        data-action="generate-worksheet"
        onClick={handleGenerate}
        disabled={isGenerating}
        className={css({
          padding: '3 6',
          fontSize: 'md',
          fontWeight: 'semibold',
          borderRadius: 'xl',
          border: 'none',
          cursor: isGenerating ? 'wait' : 'pointer',
          transition: 'all 0.15s',
          backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
          color: 'white',
          opacity: isGenerating ? 0.7 : 1,
          _hover: {
            backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
            transform: 'translateY(-1px)',
          },
          _active: {
            transform: 'translateY(0)',
          },
          _disabled: {
            cursor: 'not-allowed',
          },
        })}
      >
        {isGenerating ? 'Generating...' : 'Generate Worksheet PDF'}
      </button>

      {/* Preview info */}
      <div
        className={css({
          padding: '3',
          borderRadius: 'lg',
          backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
          border: '1px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
        })}
      >
        <p
          className={css({
            fontSize: 'xs',
            color: { base: 'gray.500', _dark: 'gray.400' },
            textAlign: 'center',
          })}
        >
          Worksheet will include: {tierSelection.easy} easy, {tierSelection.medium} medium,{' '}
          {tierSelection.hard} hard problems
          {includeAnswerKey ? ' + answer key' : ''}
        </p>
      </div>
    </div>
  )
}
