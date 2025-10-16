/**
 * Guessing Phase - Players take turns guessing the secret number
 */

'use client'

import { useEffect, useState } from 'react'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { css } from '../../../../styled-system/css'
import { useNumberGuesser } from '../Provider'

export function GuessingPhase() {
  const { state, makeGuess, nextRound, lastError, clearError } = useNumberGuesser()
  const { data: viewerId } = useViewerId()
  const [inputValue, setInputValue] = useState('')

  const currentGuesserMetadata = state.playerMetadata[state.currentGuesser]
  const isCurrentGuesser = currentGuesserMetadata?.userId === viewerId

  // Check if someone just won the round
  const lastGuess = state.guesses[state.guesses.length - 1]
  const roundJustEnded = lastGuess?.distance === 0

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (lastError) {
      const timeout = setTimeout(() => clearError(), 5000)
      return () => clearTimeout(timeout)
    }
  }, [lastError, clearError])

  const handleSubmit = () => {
    const guess = Number.parseInt(inputValue, 10)
    if (Number.isNaN(guess)) return

    makeGuess(guess)
    setInputValue('')
  }

  const getHotColdMessage = (distance: number) => {
    if (distance === 0) return '🎯 Correct!'
    if (distance <= 5) return '🔥 Very Hot!'
    if (distance <= 10) return '🌡️ Hot'
    if (distance <= 20) return '😊 Warm'
    if (distance <= 30) return '😐 Cool'
    if (distance <= 50) return '❄️ Cold'
    return '🧊 Very Cold'
  }

  return (
    <div
      className={css({
        padding: '32px',
        maxWidth: '800px',
        margin: '0 auto',
      })}
    >
      {/* Header */}
      <div
        className={css({
          textAlign: 'center',
          marginBottom: '32px',
        })}
      >
        <div
          className={css({
            fontSize: '64px',
            marginBottom: '16px',
          })}
        >
          {roundJustEnded ? '🎉' : currentGuesserMetadata?.emoji || '🤔'}
        </div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '8px',
          })}
        >
          {roundJustEnded
            ? `${lastGuess.playerName} guessed it!`
            : isCurrentGuesser
              ? 'Your turn to guess!'
              : `${currentGuesserMetadata?.name || 'Someone'} is guessing...`}
        </h2>
        <p
          className={css({
            color: 'gray.600',
          })}
        >
          Round {state.roundNumber} • Range: {state.minNumber} - {state.maxNumber}
        </p>
      </div>

      {/* Error Banner */}
      {lastError && (
        <div
          className={css({
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '2px solid',
            borderColor: 'red.300',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'slideIn 0.3s ease',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            })}
          >
            <div
              className={css({
                fontSize: '24px',
              })}
            >
              ⚠️
            </div>
            <div>
              <div
                className={css({
                  fontSize: 'md',
                  fontWeight: 'bold',
                  color: 'red.700',
                  marginBottom: '4px',
                })}
              >
                Move Rejected
              </div>
              <div
                className={css({
                  fontSize: 'sm',
                  color: 'red.600',
                })}
              >
                {lastError}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearError}
            className={css({
              padding: '8px 12px',
              background: 'white',
              border: '1px solid',
              borderColor: 'red.300',
              borderRadius: '6px',
              fontSize: 'sm',
              fontWeight: '600',
              color: 'red.700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                background: 'red.50',
              },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Round ended - show next round button */}
      {roundJustEnded && (
        <div
          className={css({
            background: 'white',
            border: '2px solid',
            borderColor: 'green.200',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: '48px',
              marginBottom: '16px',
            })}
          >
            🎯
          </div>
          <p
            className={css({
              fontSize: 'lg',
              marginBottom: '16px',
            })}
          >
            The secret number was <strong>{state.secretNumber}</strong>!
          </p>
          <button
            type="button"
            onClick={nextRound}
            className={css({
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #fb923c, #f97316)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: 'md',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                transform: 'translateY(-2px)',
              },
            })}
          >
            Next Round
          </button>
        </div>
      )}

      {/* Guessing input (only if round not ended) */}
      {!roundJustEnded && (
        <div
          className={css({
            background: 'white',
            border: '2px solid',
            borderColor: 'orange.200',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          })}
        >
          {isCurrentGuesser ? (
            <>
              <label
                className={css({
                  display: 'block',
                  fontSize: 'md',
                  fontWeight: '600',
                  marginBottom: '12px',
                  textAlign: 'center',
                })}
              >
                Make your guess ({state.minNumber} - {state.maxNumber})
              </label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue) {
                    handleSubmit()
                  }
                }}
                min={state.minNumber}
                max={state.maxNumber}
                placeholder={`${state.minNumber} - ${state.maxNumber}`}
                className={css({
                  width: '100%',
                  padding: '16px',
                  border: '2px solid',
                  borderColor: 'gray.300',
                  borderRadius: '8px',
                  fontSize: 'xl',
                  textAlign: 'center',
                  marginBottom: '16px',
                })}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!inputValue}
                className={css({
                  width: '100%',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #fb923c, #f97316)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                  _hover: {
                    transform: 'translateY(-2px)',
                  },
                })}
              >
                Submit Guess
              </button>
            </>
          ) : (
            <div
              className={css({
                textAlign: 'center',
                padding: '16px',
              })}
            >
              <div
                className={css({
                  fontSize: '48px',
                  marginBottom: '16px',
                })}
              >
                ⏳
              </div>
              <p
                className={css({
                  fontSize: 'lg',
                  color: 'gray.600',
                })}
              >
                Waiting for {currentGuesserMetadata?.name || 'player'} to guess...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Guess history */}
      {state.guesses.length > 0 && (
        <div
          className={css({
            background: 'white',
            border: '1px solid',
            borderColor: 'gray.200',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          })}
        >
          <h3
            className={css({
              fontSize: 'md',
              fontWeight: 'bold',
              marginBottom: '12px',
            })}
          >
            Guess History
          </h3>
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            })}
          >
            {state.guesses.map((guess, index) => {
              const player = state.playerMetadata[guess.playerId]
              return (
                <div
                  key={index}
                  className={css({
                    padding: '12px',
                    background: guess.distance === 0 ? 'green.50' : 'gray.50',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    })}
                  >
                    <span>{player?.emoji || '🎮'}</span>
                    <span className={css({ fontWeight: '600' })}>{guess.playerName}</span>
                    <span className={css({ color: 'gray.600' })}>guessed</span>
                    <span className={css({ fontWeight: 'bold', fontSize: 'lg' })}>
                      {guess.guess}
                    </span>
                  </div>
                  <div
                    className={css({
                      fontWeight: 'bold',
                      color: guess.distance === 0 ? 'green.700' : 'orange.700',
                    })}
                  >
                    {getHotColdMessage(guess.distance)}
                  </div>
                </div>
              )
            })}
          </div>
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
            fontSize: 'md',
            fontWeight: 'bold',
            marginBottom: '12px',
            textAlign: 'center',
          })}
        >
          Scores (First to {state.roundsToWin} wins!)
        </h3>
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
          })}
        >
          {state.activePlayers.map((playerId) => {
            const player = state.playerMetadata[playerId]
            const score = state.scores[playerId] || 0
            return (
              <div
                key={playerId}
                className={css({
                  padding: '8px 16px',
                  background: 'gray.100',
                  borderRadius: '8px',
                  fontSize: 'sm',
                })}
              >
                {player?.emoji} {player?.name}: {score}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
