/**
 * Math Sprint - Playing Phase
 *
 * Main gameplay: show question, accept answers, show feedback.
 */

'use client'

import { useEffect, useState } from 'react'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { css } from '../../../../styled-system/css'
import { useMathSprint } from '../Provider'

export function PlayingPhase() {
  const { state, submitAnswer, nextQuestion, lastError, clearError } = useMathSprint()
  const { data: viewerId } = useViewerId()
  const [inputValue, setInputValue] = useState('')

  const currentQuestion = state.questions[state.currentQuestionIndex]
  const progress = `${state.currentQuestionIndex + 1} / ${state.questions.length}`

  // Find if current user answered
  const myPlayerId = Object.keys(state.playerMetadata).find(
    (pid) => state.playerMetadata[pid]?.userId === viewerId
  )
  const myAnswer = state.answers.find((a) => a.playerId === myPlayerId)

  // Auto-clear error after 3 seconds
  useEffect(() => {
    if (lastError) {
      const timeout = setTimeout(() => clearError(), 3000)
      return () => clearTimeout(timeout)
    }
  }, [lastError, clearError])

  // Clear input after question changes
  useEffect(() => {
    setInputValue('')
  }, [state.currentQuestionIndex])

  const handleSubmit = () => {
    const answer = Number.parseInt(inputValue, 10)
    if (Number.isNaN(answer)) return

    submitAnswer(answer)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '700px',
        margin: '0 auto',
        padding: '32px 20px',
      })}
    >
      {/* Progress Bar */}
      <div
        className={css({
          background: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: '12px',
          padding: '16px',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          })}
        >
          <span className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>
            Question {progress}
          </span>
          <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
            {state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}
          </span>
        </div>
        <div
          className={css({
            background: 'gray.200',
            height: '8px',
            borderRadius: '4px',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              background: 'linear-gradient(90deg, #a78bfa, #8b5cf6)',
              height: '100%',
              borderRadius: '4px',
              transition: 'width 0.3s',
            })}
            style={{
              width: `${((state.currentQuestionIndex + 1) / state.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Error Banner */}
      {lastError && (
        <div
          className={css({
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '2px solid',
            borderColor: 'red.300',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
            <span>⚠️</span>
            <span className={css({ fontSize: 'sm', color: 'red.700' })}>{lastError}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className={css({
              fontSize: 'xs',
              padding: '4px 8px',
              background: 'red.100',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              _hover: { background: 'red.200' },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Question Display */}
      <div
        className={css({
          background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
          border: '2px solid',
          borderColor: 'purple.300',
          borderRadius: '16px',
          padding: '48px',
          textAlign: 'center',
        })}
      >
        <div
          className={css({
            fontSize: '4xl',
            fontWeight: 'bold',
            color: 'purple.700',
            fontFamily: 'monospace',
          })}
        >
          {currentQuestion.displayText}
        </div>
      </div>

      {/* Answer Input */}
      {!state.questionAnswered && (
        <div
          className={css({
            background: 'white',
            border: '2px solid',
            borderColor: myAnswer ? 'gray.300' : 'purple.500',
            borderRadius: '12px',
            padding: '24px',
          })}
        >
          {myAnswer ? (
            <div className={css({ textAlign: 'center' })}>
              <div
                className={css({
                  fontSize: 'lg',
                  color: 'gray.600',
                  marginBottom: '8px',
                })}
              >
                Your answer: <strong>{myAnswer.answer}</strong>
              </div>
              <div className={css({ fontSize: 'sm', color: 'gray.500' })}>
                Waiting for others or correct answer...
              </div>
            </div>
          ) : (
            <div>
              <label
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  marginBottom: '8px',
                })}
              >
                Your Answer
              </label>
              <div className={css({ display: 'flex', gap: '12px' })}>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer..."
                  className={css({
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 'lg',
                    border: '2px solid',
                    borderColor: 'gray.300',
                    borderRadius: '8px',
                    _focus: {
                      outline: 'none',
                      borderColor: 'purple.500',
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!inputValue}
                  className={css({
                    padding: '12px 24px',
                    fontSize: 'md',
                    fontWeight: 'semibold',
                    color: 'white',
                    background: inputValue ? 'purple.600' : 'gray.400',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: inputValue ? 'pointer' : 'not-allowed',
                    _hover: {
                      background: inputValue ? 'purple.700' : 'gray.400',
                    },
                  })}
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Winner Display */}
      {state.questionAnswered && state.winnerId && (
        <div
          className={css({
            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
            border: '2px solid',
            borderColor: 'green.400',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
          })}
        >
          <div className={css({ fontSize: '3xl', marginBottom: '8px' })}>🎉</div>
          <div className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'green.700' })}>
            {state.playerMetadata[state.winnerId]?.name || 'Someone'} got it right!
          </div>
          <div className={css({ fontSize: 'md', color: 'green.600', marginTop: '4px' })}>
            Answer: {currentQuestion.correctAnswer}
          </div>

          <button
            type="button"
            onClick={nextQuestion}
            className={css({
              marginTop: '16px',
              padding: '12px 32px',
              fontSize: 'md',
              fontWeight: 'semibold',
              color: 'white',
              background: 'green.600',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              _hover: { background: 'green.700' },
            })}
          >
            Next Question →
          </button>
        </div>
      )}

      {/* Scoreboard */}
      <div
        className={css({
          background: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: '12px',
          padding: '16px',
        })}
      >
        <h3
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            marginBottom: '12px',
          })}
        >
          Scores
        </h3>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
          {Object.entries(state.scores)
            .sort(([, a], [, b]) => b - a)
            .map(([playerId, score]) => {
              const player = state.playerMetadata[playerId]
              return (
                <div
                  key={playerId}
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'gray.50',
                    borderRadius: '8px',
                  })}
                >
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <span className={css({ fontSize: 'xl' })}>{player?.emoji}</span>
                    <span className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                      {player?.name}
                    </span>
                  </div>
                  <span
                    className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'purple.600' })}
                  >
                    {score} pts
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
