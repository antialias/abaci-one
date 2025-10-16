/**
 * Choosing Phase - Chooser picks a secret number
 */

'use client'

import { useState } from 'react'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { css } from '../../../../styled-system/css'
import { useNumberGuesser } from '../Provider'

export function ChoosingPhase() {
  const { state, chooseNumber } = useNumberGuesser()
  const { data: viewerId } = useViewerId()
  const [inputValue, setInputValue] = useState('')

  const chooserMetadata = state.playerMetadata[state.chooser]
  const isChooser = chooserMetadata?.userId === viewerId

  const handleSubmit = () => {
    const number = Number.parseInt(inputValue, 10)
    if (Number.isNaN(number)) return

    chooseNumber(number)
  }

  return (
    <div
      className={css({
        padding: '32px',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
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
          {chooserMetadata?.emoji || '🤔'}
        </div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '8px',
          })}
        >
          {isChooser ? "You're choosing!" : `${chooserMetadata?.name || 'Someone'} is choosing...`}
        </h2>
        <p
          className={css({
            color: 'gray.600',
          })}
        >
          Round {state.roundNumber}
        </p>
      </div>

      {isChooser ? (
        <div
          className={css({
            background: 'white',
            border: '2px solid',
            borderColor: 'orange.200',
            borderRadius: '12px',
            padding: '24px',
          })}
        >
          <label
            className={css({
              display: 'block',
              fontSize: 'md',
              fontWeight: '600',
              marginBottom: '12px',
              textAlign: 'center',
            })}
          >
            Choose a secret number ({state.minNumber} - {state.maxNumber})
          </label>
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
            Confirm Choice
          </button>
        </div>
      ) : (
        <div
          className={css({
            background: 'white',
            border: '2px solid',
            borderColor: 'orange.200',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
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
            Waiting for {chooserMetadata?.name || 'player'} to choose a number...
          </p>
        </div>
      )}

      {/* Scoreboard */}
      <div
        className={css({
          marginTop: '32px',
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
          Scores
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
                {player?.emoji} {player?.name}: {state.scores[playerId] || 0}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
