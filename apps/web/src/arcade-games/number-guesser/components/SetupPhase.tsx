/**
 * Setup Phase - Game configuration
 */

'use client'

import { css } from '../../../../styled-system/css'
import { useNumberGuesser } from '../Provider'

export function SetupPhase() {
  const { state, startGame, setConfig } = useNumberGuesser()

  return (
    <div
      className={css({
        padding: '32px',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      <h2
        className={css({
          fontSize: '2xl',
          fontWeight: 'bold',
          marginBottom: '24px',
          textAlign: 'center',
        })}
      >
        🎯 Number Guesser Setup
      </h2>

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
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            marginBottom: '16px',
          })}
        >
          Game Rules
        </h3>
        <ul
          className={css({
            listStyle: 'disc',
            paddingLeft: '24px',
            lineHeight: '1.6',
            color: 'gray.700',
          })}
        >
          <li>One player chooses a secret number</li>
          <li>Other players take turns guessing</li>
          <li>Get feedback on how close your guess is</li>
          <li>First to guess correctly wins the round!</li>
          <li>First to {state.roundsToWin} rounds wins the game!</li>
        </ul>
      </div>

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
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            marginBottom: '16px',
          })}
        >
          Configuration
        </h3>

        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          })}
        >
          <div>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: '600',
                marginBottom: '4px',
              })}
            >
              Minimum Number
            </label>
            <input
              type="number"
              value={state.minNumber ?? 1}
              onChange={(e) => setConfig('minNumber', Number.parseInt(e.target.value, 10))}
              className={css({
                width: '100%',
                padding: '8px 12px',
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: '6px',
                fontSize: 'md',
              })}
            />
          </div>

          <div>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: '600',
                marginBottom: '4px',
              })}
            >
              Maximum Number
            </label>
            <input
              type="number"
              value={state.maxNumber ?? 100}
              onChange={(e) => setConfig('maxNumber', Number.parseInt(e.target.value, 10))}
              className={css({
                width: '100%',
                padding: '8px 12px',
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: '6px',
                fontSize: 'md',
              })}
            />
          </div>

          <div>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: '600',
                marginBottom: '4px',
              })}
            >
              Rounds to Win
            </label>
            <input
              type="number"
              value={state.roundsToWin ?? 3}
              onChange={(e) => setConfig('roundsToWin', Number.parseInt(e.target.value, 10))}
              className={css({
                width: '100%',
                padding: '8px 12px',
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: '6px',
                fontSize: 'md',
              })}
            />
          </div>
        </div>
      </div>

      <button
        onClick={startGame}
        className={css({
          width: '100%',
          padding: '16px',
          background: 'linear-gradient(135deg, #fb923c, #f97316)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: 'lg',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _hover: {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 16px rgba(249, 115, 22, 0.3)',
          },
        })}
      >
        Start Game
      </button>
    </div>
  )
}
