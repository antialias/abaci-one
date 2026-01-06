'use client'

import { useState } from 'react'
import { css } from '../../../../../../../styled-system/css'
import { ModelTester } from '../../ModelTester'
import { useTrainingDiagnostics, type DiagnosticReason } from '../../TrainingDiagnosticsContext'
import type { TrainingResult } from '../types'

interface ResultsCardProps {
  result: TrainingResult | null
  error: string | null
  configuredEpochs: number
  onTrainAgain: () => void
}

export function ResultsCard({ result, error, configuredEpochs, onTrainAgain }: ResultsCardProps) {
  const [activeTab, setActiveTab] = useState<'results' | 'test'>('results')
  const diagnostics = useTrainingDiagnostics()

  if (error) {
    return (
      <div className={css({ textAlign: 'center', py: 4 })}>
        <div className={css({ fontSize: '3xl', mb: 3 })}>❌</div>
        <div className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'red.400', mb: 2 })}>
          Training Failed
        </div>
        <div
          className={css({
            color: 'gray.300',
            fontSize: 'sm',
            mb: 4,
            p: 3,
            bg: 'red.900/30',
            border: '1px solid',
            borderColor: 'red.800',
            borderRadius: 'lg',
            textAlign: 'left',
            fontFamily: 'mono',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '150px',
            overflow: 'auto',
          })}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={onTrainAgain}
          className={css({
            px: 6,
            py: 3,
            bg: 'blue.600',
            color: 'white',
            borderRadius: 'lg',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 'md',
            _hover: { bg: 'blue.500' },
          })}
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <div className={css({ fontSize: '2xl', mb: 3, animation: 'spin 1s linear infinite' })}>
          ⏳
        </div>
        <div className={css({ color: 'gray.400' })}>Waiting for results...</div>
      </div>
    )
  }

  const accuracy = result.final_accuracy ?? 0

  return (
    <div>
      {/* Tabs */}
      <div
        className={css({
          display: 'flex',
          gap: 1,
          mb: 4,
          borderBottom: '1px solid',
          borderColor: 'gray.700',
        })}
      >
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={css({
            px: 4,
            py: 2,
            bg: 'transparent',
            color: activeTab === 'results' ? 'green.400' : 'gray.500',
            border: 'none',
            borderBottom: '2px solid',
            borderColor: activeTab === 'results' ? 'green.400' : 'transparent',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
            _hover: { color: 'gray.300' },
          })}
        >
          Results
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={css({
            px: 4,
            py: 2,
            bg: 'transparent',
            color: activeTab === 'test' ? 'purple.400' : 'gray.500',
            border: 'none',
            borderBottom: '2px solid',
            borderColor: activeTab === 'test' ? 'purple.400' : 'transparent',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
            _hover: { color: 'gray.300' },
          })}
        >
          🔬 Test Model
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'results' ? (
        <div className={css({ textAlign: 'center' })}>
          {/* Success icon */}
          <div className={css({ fontSize: '3xl', mb: 2 })}>🎉</div>

          {/* Title */}
          <div className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'green.400', mb: 3 })}>
            Training Complete!
          </div>

          {/* Main accuracy */}
          <div
            className={css({
              fontSize: '4xl',
              fontWeight: 'bold',
              color: 'green.400',
              mb: 0.5,
            })}
          >
            {(accuracy * 100).toFixed(1)}%
          </div>
          <div className={css({ fontSize: 'sm', color: 'gray.500', mb: 4 })}>Final Accuracy</div>

          {/* Stats grid */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              p: 3,
              bg: 'gray.900',
              borderRadius: 'lg',
              fontSize: 'sm',
              mb: 4,
            })}
          >
            <div>
              <div className={css({ color: 'gray.600', fontSize: 'xs' })}>Epochs</div>
              <div className={css({ fontFamily: 'mono', color: 'gray.300', fontWeight: 'medium' })}>
                {result.epochs_trained ?? '—'}
                {result.epochs_trained && result.epochs_trained < configuredEpochs && (
                  <span className={css({ color: 'gray.500' })}>/{configuredEpochs}</span>
                )}
              </div>
              {result.epochs_trained && result.epochs_trained < configuredEpochs && (
                <div className={css({ color: 'green.500', fontSize: 'xs', fontWeight: 'medium' })}>
                  converged
                </div>
              )}
            </div>
            <div>
              <div className={css({ color: 'gray.600', fontSize: 'xs' })}>Final Loss</div>
              <div className={css({ fontFamily: 'mono', color: 'gray.300', fontWeight: 'medium' })}>
                {result.final_loss?.toFixed(4) ?? '—'}
              </div>
            </div>
            <div>
              <div className={css({ color: 'gray.600', fontSize: 'xs' })}>Model</div>
              <div className={css({ color: 'green.400', fontWeight: 'medium' })}>
                {result.tfjs_exported ? '✓ Saved' : '—'}
              </div>
            </div>
          </div>

          {/* Model path */}
          {result.tfjs_exported && (
            <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 4 })}>
              Model exported and ready to use
            </div>
          )}

          {/* Remediation advice for poor results */}
          {diagnostics.shouldShowRemediation && (
            <RemediationSection reasons={diagnostics.reasons} />
          )}

          {/* Train again button */}
          <button
            type="button"
            onClick={onTrainAgain}
            className={css({
              px: 6,
              py: 3,
              bg: 'blue.600',
              color: 'white',
              borderRadius: 'lg',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 'md',
              _hover: { bg: 'blue.500' },
            })}
          >
            Train Again
          </button>
        </div>
      ) : (
        <ModelTester columnCount={4} />
      )}
    </div>
  )
}

/** Shows diagnostic reasons and remediation advice for poor training results */
function RemediationSection({ reasons }: { reasons: DiagnosticReason[] }) {
  if (reasons.length === 0) return null

  return (
    <div
      data-element="remediation-section"
      className={css({
        mt: 4,
        mb: 4,
        p: 3,
        bg: 'yellow.900/30',
        border: '1px solid',
        borderColor: 'yellow.700',
        borderRadius: 'lg',
        textAlign: 'left',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
          fontWeight: 'semibold',
          color: 'yellow.400',
          fontSize: 'sm',
        })}
      >
        <span>⚠️</span>
        <span>Why is accuracy low?</span>
      </div>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
        {reasons.map((reason, i) => (
          <div key={i} className={css({ fontSize: 'xs' })}>
            <div className={css({ color: 'gray.200', fontWeight: 'medium' })}>• {reason.title}</div>
            <div className={css({ color: 'gray.400', ml: 3 })}>{reason.action}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
