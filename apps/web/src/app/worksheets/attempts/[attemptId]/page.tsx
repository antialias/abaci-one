'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../styled-system/css'

interface AttemptResult {
  attemptId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage: string | null
  totalProblems: number | null
  correctCount: number | null
  accuracy: number | null
  problems: Array<{
    index: number
    problem: string
    correctAnswer: number
    studentAnswer: number | null
    isCorrect: boolean
    errorType: string | null
  }>
  errorPatterns: string[]
  aiSummary: string | null
  suggestedStepId: string | null
}

/**
 * Worksheet attempt results page
 *
 * Shows AI grading results with:
 * - Overall score and accuracy
 * - AI feedback and error patterns
 * - Problem-by-problem breakdown
 * - Recommended next step for practice
 */
export default function AttemptResultsPage({ params }: { params: { attemptId: string } }) {
  const { attemptId } = params
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/worksheets/attempts/${attemptId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch results')
        }
        const data = await response.json()
        setResult(data)
      } catch (err) {
        console.error('Fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }

    fetchResult()

    // Poll for updates if still processing
    const interval = setInterval(() => {
      if (result?.status === 'pending' || result?.status === 'processing') {
        fetchResult()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [attemptId, result?.status])

  if (loading) {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
        })}
      >
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              fontSize: '4xl',
              mb: 4,
            })}
          >
            ⏳
          </div>
          <p className={css({ fontSize: 'lg', color: 'gray.600' })}>Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          p: 4,
        })}
      >
        <div
          className={css({
            p: 6,
            bg: 'red.50',
            border: '1px solid',
            borderColor: 'red.200',
            borderRadius: 'lg',
            maxW: 'md',
            textAlign: 'center',
          })}
        >
          <div className={css({ fontSize: '3xl', mb: 3 })}>❌</div>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'red.700', mb: 2 })}>
            Error Loading Results
          </h2>
          <p className={css({ color: 'red.600', mb: 4 })}>{error}</p>
          <Link
            href="/"
            className={css({
              display: 'inline-block',
              px: 4,
              py: 2,
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              textDecoration: 'none',
              _hover: { bg: 'blue.600' },
            })}
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  // Still processing
  if (result.status === 'pending' || result.status === 'processing') {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          p: 4,
        })}
      >
        <div className={css({ textAlign: 'center', maxW: 'md' })}>
          <div className={css({ fontSize: '4xl', mb: 4 })}>🤖</div>
          <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
            AI is grading your worksheet...
          </h2>
          <p className={css({ color: 'gray.600', mb: 4 })}>
            This usually takes 30-60 seconds. We're analyzing handwriting, grading problems, and
            identifying patterns.
          </p>
          <div
            className={css({
              w: '100%',
              h: 2,
              bg: 'gray.200',
              borderRadius: 'full',
              overflow: 'hidden',
            })}
          >
            <div
              className={css({
                h: '100%',
                bg: 'blue.500',
                animation: 'progress 2s ease-in-out infinite',
              })}
              style={{
                width: result.status === 'processing' ? '60%' : '30%',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Failed
  if (result.status === 'failed') {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          p: 4,
        })}
      >
        <div
          className={css({
            p: 6,
            bg: 'yellow.50',
            border: '1px solid',
            borderColor: 'yellow.200',
            borderRadius: 'lg',
            maxW: 'md',
            textAlign: 'center',
          })}
        >
          <div className={css({ fontSize: '3xl', mb: 3 })}>⚠️</div>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'yellow.700', mb: 2 })}>
            Grading Failed
          </h2>
          <p className={css({ color: 'yellow.600', mb: 4 })}>
            {result.errorMessage ||
              'The image might be too blurry, not a math worksheet, or missing problems. Please try uploading a different image.'}
          </p>
          <Link
            href="/"
            className={css({
              display: 'inline-block',
              px: 4,
              py: 2,
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              textDecoration: 'none',
              _hover: { bg: 'blue.600' },
            })}
          >
            Upload Another
          </Link>
        </div>
      </div>
    )
  }

  // Completed - show results
  const accuracyPercent = ((result.accuracy || 0) * 100).toFixed(1)
  const scoreColor =
    (result.accuracy || 0) >= 0.9 ? 'green' : (result.accuracy || 0) >= 0.7 ? 'yellow' : 'red'

  return (
    <div
      data-component="attempt-results-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.50',
        p: 4,
        pb: 8,
      })}
    >
      <div className={css({ maxW: '4xl', mx: 'auto' })}>
        {/* Header */}
        <div className={css({ mb: 6 })}>
          <Link
            href="/"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              color: 'blue.600',
              fontSize: 'sm',
              textDecoration: 'none',
              mb: 4,
              _hover: { color: 'blue.700' },
            })}
          >
            ← Back to Worksheets
          </Link>
          <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', color: 'gray.800' })}>
            📊 Worksheet Results
          </h1>
          <p className={css({ fontSize: 'sm', color: 'gray.600', mt: 1 })}>
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Score card */}
        <div
          data-section="score-card"
          className={css({
            p: 8,
            bg: 'white',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'gray.200',
            textAlign: 'center',
            mb: 6,
          })}
        >
          <div className={css({ fontSize: '5xl', fontWeight: 'bold', color: `${scoreColor}.600` })}>
            {result.correctCount}/{result.totalProblems}
          </div>
          <div className={css({ fontSize: '3xl', color: `${scoreColor}.500`, mb: 2 })}>
            {accuracyPercent}%
          </div>
          <div
            className={css({
              w: '100%',
              h: 4,
              bg: 'gray.200',
              borderRadius: 'full',
              overflow: 'hidden',
              mb: 4,
            })}
          >
            <div
              className={css({
                h: '100%',
                bg: `${scoreColor}.500`,
                borderRadius: 'full',
                transition: 'width 0.5s',
              })}
              style={{ width: `${accuracyPercent}%` }}
            />
          </div>
          <p className={css({ fontSize: 'lg', color: 'gray.700', fontWeight: 'medium' })}>
            {(result.accuracy || 0) >= 0.9
              ? 'Excellent work! 🎉'
              : (result.accuracy || 0) >= 0.7
                ? 'Good job! Keep practicing! 👍'
                : 'Keep trying! Practice makes perfect! 💪'}
          </p>
        </div>

        {/* AI Analysis */}
        {result.aiSummary && (
          <div
            data-section="ai-analysis"
            className={css({
              p: 6,
              bg: 'white',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: 'gray.200',
              mb: 6,
            })}
          >
            <h2
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'gray.800',
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              })}
            >
              🤖 AI Analysis
            </h2>
            <p className={css({ color: 'gray.700', mb: 4, lineHeight: 1.6 })}>{result.aiSummary}</p>

            {result.errorPatterns.length > 0 && (
              <>
                <h3
                  className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'gray.700', mb: 2 })}
                >
                  Error Patterns:
                </h3>
                <div className={css({ display: 'flex', flexWrap: 'wrap', gap: 2 })}>
                  {result.errorPatterns.map((pattern, i) => (
                    <span
                      key={i}
                      className={css({
                        px: 3,
                        py: 1,
                        bg: 'red.100',
                        color: 'red.700',
                        borderRadius: 'full',
                        fontSize: 'sm',
                      })}
                    >
                      🏷️ {pattern}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Problem breakdown */}
        <div
          data-section="problem-breakdown"
          className={css({
            p: 6,
            bg: 'white',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'gray.200',
            mb: 6,
          })}
        >
          <h2
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'gray.800',
              mb: 4,
            })}
          >
            Problem Breakdown
          </h2>
          <div className={css({ display: 'grid', gap: 2 })}>
            {result.problems.slice(0, 10).map((problem) => (
              <div
                key={problem.index}
                className={css({
                  p: 3,
                  bg: problem.isCorrect ? 'green.50' : 'red.50',
                  border: '1px solid',
                  borderColor: problem.isCorrect ? 'green.200' : 'red.200',
                  borderRadius: 'md',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                })}
              >
                <span className={css({ fontFamily: 'mono', color: 'gray.700' })}>
                  #{problem.index + 1}: {problem.problem} = {problem.correctAnswer}
                </span>
                <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                  <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                    (student: {problem.studentAnswer ?? 'blank'})
                  </span>
                  <span className={css({ fontSize: 'lg' })}>{problem.isCorrect ? '✓' : '✗'}</span>
                </div>
              </div>
            ))}
          </div>
          {result.problems.length > 10 && (
            <p className={css({ mt: 3, textAlign: 'center', color: 'gray.500', fontSize: 'sm' })}>
              Showing 10 of {result.problems.length} problems
            </p>
          )}
        </div>

        {/* Next steps */}
        {result.suggestedStepId && (
          <div
            data-section="next-steps"
            className={css({
              p: 6,
              bg: 'blue.50',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: 'blue.200',
            })}
          >
            <h2
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'blue.800',
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              })}
            >
              📈 Recommended Next Step
            </h2>
            <p className={css({ color: 'blue.700', mb: 4 })}>
              Based on the analysis, we recommend practicing:{' '}
              <strong>{result.suggestedStepId}</strong>
            </p>
            <Link
              href={`/create/worksheets/addition?step=${result.suggestedStepId}`}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                px: 6,
                py: 3,
                bg: 'blue.500',
                color: 'white',
                borderRadius: 'md',
                fontWeight: 'medium',
                textDecoration: 'none',
                _hover: { bg: 'blue.600' },
              })}
            >
              🎯 Generate Practice Worksheet
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
