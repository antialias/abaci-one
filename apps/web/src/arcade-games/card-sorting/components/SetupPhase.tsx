'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'

export function SetupPhase() {
  const { state, setConfig, startGame, resumeGame, canResumeGame } = useCardSorting()

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
      })}
    >
      <div className={css({ textAlign: 'center' })}>
        <h2
          className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Card Sorting Challenge
        </h2>
        <p
          className={css({
            fontSize: { base: 'md', md: 'lg' },
            color: 'gray.600',
          })}
        >
          Arrange abacus cards in order using only visual patterns
        </p>
      </div>

      {/* Card Count Selection */}
      <div className={css({ width: '100%', maxWidth: '400px' })}>
        <label
          className={css({
            display: 'block',
            fontSize: 'sm',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: 'gray.700',
          })}
        >
          Number of Cards
        </label>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '4',
            gap: '0.5rem',
          })}
        >
          {([5, 8, 12, 15] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setConfig('cardCount', count)}
              className={css({
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                borderColor: state.cardCount === count ? 'teal.500' : 'gray.300',
                background: state.cardCount === count ? 'teal.50' : 'white',
                color: state.cardCount === count ? 'teal.700' : 'gray.700',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  borderColor: 'teal.400',
                  background: 'teal.50',
                },
              })}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Show Numbers Toggle */}
      <div className={css({ width: '100%', maxWidth: '400px' })}>
        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            border: '1px solid',
            borderColor: 'gray.200',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            _hover: {
              background: 'gray.50',
            },
          })}
        >
          <input
            type="checkbox"
            checked={state.showNumbers}
            onChange={(e) => setConfig('showNumbers', e.target.checked)}
            className={css({
              width: '1.25rem',
              height: '1.25rem',
              cursor: 'pointer',
            })}
          />
          <div>
            <div
              className={css({
                fontWeight: '600',
                color: 'gray.700',
              })}
            >
              Allow "Reveal Numbers" button
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: 'gray.500',
              })}
            >
              Show numeric values during gameplay
            </div>
          </div>
        </label>
      </div>

      {/* Game Mode Selection */}
      <div className={css({ width: '100%', maxWidth: '400px' })}>
        <label
          className={css({
            display: 'block',
            fontSize: 'sm',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: 'gray.700',
          })}
        >
          Game Mode
        </label>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '2',
            gap: '0.5rem',
          })}
        >
          <button
            type="button"
            onClick={() => setConfig('gameMode', 'solo')}
            className={css({
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '2px solid',
              borderColor: state.gameMode === 'solo' ? 'teal.500' : 'gray.300',
              background: state.gameMode === 'solo' ? 'teal.50' : 'white',
              color: state.gameMode === 'solo' ? 'teal.700' : 'gray.700',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'teal.400',
                background: 'teal.50',
              },
            })}
          >
            👤 Solo
          </button>
          <button
            type="button"
            onClick={() => setConfig('gameMode', 'collaborative')}
            className={css({
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '2px solid',
              borderColor: state.gameMode === 'collaborative' ? 'teal.500' : 'gray.300',
              background: state.gameMode === 'collaborative' ? 'teal.50' : 'white',
              color: state.gameMode === 'collaborative' ? 'teal.700' : 'gray.700',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'teal.400',
                background: 'teal.50',
              },
            })}
          >
            👥 Collaborative
          </button>
        </div>
        <p
          className={css({
            fontSize: 'xs',
            color: 'gray.500',
            marginTop: '0.5rem',
          })}
        >
          {state.gameMode === 'solo'
            ? 'Play alone and beat your best score'
            : 'Work together with other players in real-time'}
        </p>
      </div>

      {/* Action Buttons */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '400px',
          marginTop: '1rem',
        })}
      >
        {canResumeGame && (
          <button
            type="button"
            onClick={resumeGame}
            className={css({
              padding: '1rem',
              borderRadius: '0.5rem',
              background: 'teal.600',
              color: 'white',
              fontWeight: '600',
              fontSize: 'lg',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              _hover: {
                background: 'teal.700',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              },
            })}
          >
            Resume Game
          </button>
        )}
        <button
          type="button"
          onClick={startGame}
          className={css({
            padding: '1rem',
            borderRadius: '0.5rem',
            background: canResumeGame ? 'gray.600' : 'teal.600',
            color: 'white',
            fontWeight: '600',
            fontSize: 'lg',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
            _hover: {
              background: canResumeGame ? 'gray.700' : 'teal.700',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          })}
        >
          {canResumeGame ? 'Start New Game' : 'Start Game'}
        </button>
      </div>
    </div>
  )
}
