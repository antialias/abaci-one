'use client'

import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { generateGameCards } from '../utils/cardGeneration'
import { css } from '../../../../../styled-system/css'

// Add bounce animation for the start button
const bounceAnimation = `
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('setup-animations')) {
  const style = document.createElement('style')
  style.id = 'setup-animations'
  style.textContent = bounceAnimation
  document.head.appendChild(style)
}

export function SetupPhase() {
  const {
    state,
    setGameType,
    setDifficulty,
    dispatch,
    activePlayers
  } = useMemoryPairs()

  const { activePlayerCount, gameMode: globalGameMode } = useGameMode()

  const handleStartGame = () => {
    const cards = generateGameCards(state.gameType, state.difficulty)
    dispatch({ type: 'START_GAME', cards, activePlayers })
  }

  const getButtonStyles = (isSelected: boolean, variant: 'primary' | 'secondary' | 'difficulty' = 'primary') => {
    const baseStyles = {
      border: 'none',
      borderRadius: '16px',
      padding: '16px 24px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      minWidth: '160px',
      textAlign: 'center' as const,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      textShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
      transform: 'translateZ(0)', // Enable GPU acceleration
    }

    if (variant === 'difficulty') {
      return css({
        ...baseStyles,
        background: isSelected
          ? 'linear-gradient(135deg, #ff6b6b, #ee5a24)'
          : 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
        color: isSelected ? 'white' : '#495057',
        boxShadow: isSelected
          ? '0 8px 25px rgba(255, 107, 107, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        _hover: {
          transform: 'translateY(-3px) scale(1.02)',
          boxShadow: isSelected
            ? '0 12px 35px rgba(255, 107, 107, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
            : '0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
        },
        _active: {
          transform: 'translateY(-1px) scale(1.01)',
        }
      })
    }

    if (variant === 'secondary') {
      return css({
        ...baseStyles,
        background: isSelected
          ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)'
          : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
        color: isSelected ? 'white' : '#475569',
        boxShadow: isSelected
          ? '0 8px 25px rgba(167, 139, 250, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        _hover: {
          transform: 'translateY(-3px) scale(1.02)',
          boxShadow: isSelected
            ? '0 12px 35px rgba(167, 139, 250, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
            : '0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
        },
        _active: {
          transform: 'translateY(-1px) scale(1.01)',
        }
      })
    }

    // Primary variant
    return css({
      ...baseStyles,
      background: isSelected
        ? 'linear-gradient(135deg, #667eea, #764ba2)'
        : 'linear-gradient(135deg, #ffffff, #f1f5f9)',
      color: isSelected ? 'white' : '#334155',
      boxShadow: isSelected
        ? '0 8px 25px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
        : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
      _hover: {
        transform: 'translateY(-3px) scale(1.02)',
        boxShadow: isSelected
          ? '0 12px 35px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
      },
      _active: {
        transform: 'translateY(-1px) scale(1.01)',
      }
    })
  }

  return (
    <div className={css({
      textAlign: 'center',
      padding: '40px 20px',
      maxWidth: '800px',
      margin: '0 auto'
    })}>
      <h2 className={css({
        fontSize: '36px',
        marginBottom: '16px',
        color: 'gray.800',
        fontWeight: 'bold'
      })}>
        Game Setup
      </h2>

      <p className={css({
        fontSize: '18px',
        color: 'gray.600',
        marginBottom: '40px',
        lineHeight: '1.6'
      })}>
        Configure your memory challenge. Choose your preferred mode, game type, and difficulty level.
      </p>

      <div className={css({
        display: 'grid',
        gap: '32px',
        margin: '0 auto'
      })}>

        {/* Current Player Setup */}
        <div className={css({
          background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
          rounded: '2xl',
          p: '6',
          border: '2px solid',
          borderColor: 'gray.300'
        })}>
          <h3 className={css({
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'gray.700',
            mb: '3',
            textAlign: 'center'
          })}>
            🎮 Current Setup
          </h3>
          <div className={css({
            fontSize: '16px',
            color: 'gray.700',
            textAlign: 'center'
          })}>
            <p>
              <strong>{activePlayerCount}</strong> player{activePlayerCount !== 1 ? 's' : ''} selected
            </p>
            <p className={css({ fontSize: '14px', color: 'gray.600', mt: '1' })}>
              {activePlayerCount === 1
                ? 'Solo challenge mode - focus & memory'
                : `${activePlayerCount}-player battle mode - compete for the most pairs`
              }
            </p>
          </div>
          {activePlayerCount === 0 && (
            <div className={css({
              mt: '3',
              p: '3',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid',
              borderColor: 'red.200',
              rounded: 'lg',
              textAlign: 'center'
            })}>
              <p className={css({ color: 'red.700', fontSize: '14px' })}>
                ⚠️ Go back to select players before starting the game
              </p>
            </div>
          )}
        </div>

        {/* Game Type Selection */}
        <div>
          <label className={css({
            display: 'block',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: 'gray.700'
          })}>
            Game Type
          </label>
          <div className={css({
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          })}>
            <button
              className={getButtonStyles(state.gameType === 'abacus-numeral', 'secondary')}
              onClick={() => setGameType('abacus-numeral')}
            >
              <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' })}>
                <div className={css({ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                  <span>🧮</span>
                  <span className={css({ fontSize: '20px' })}>↔️</span>
                  <span>🔢</span>
                </div>
                <div className={css({ fontWeight: 'bold' })}>Abacus-Numeral</div>
                <div className={css({ fontSize: '12px', opacity: 0.8, textAlign: 'center' })}>
                  Match visual patterns<br/>with numbers
                </div>
              </div>
            </button>
            <button
              className={getButtonStyles(state.gameType === 'complement-pairs', 'secondary')}
              onClick={() => setGameType('complement-pairs')}
            >
              <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' })}>
                <div className={css({ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '8px' })}>
                  <span>🤝</span>
                  <span className={css({ fontSize: '20px' })}>➕</span>
                  <span>🔟</span>
                </div>
                <div className={css({ fontWeight: 'bold' })}>Complement Pairs</div>
                <div className={css({ fontSize: '12px', opacity: 0.8, textAlign: 'center' })}>
                  Find number friends<br/>that add to 5 or 10
                </div>
              </div>
            </button>
          </div>
          <p className={css({
            fontSize: '14px',
            color: 'gray.500',
            marginTop: '8px'
          })}>
            {state.gameType === 'abacus-numeral'
              ? 'Match abacus representations with their numerical values'
              : 'Find pairs of numbers that add up to 5 or 10'
            }
          </p>
        </div>

        {/* Difficulty Selection */}
        <div>
          <label className={css({
            display: 'block',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: 'gray.700'
          })}>
            Difficulty ({state.difficulty} pairs)
          </label>
          <div className={css({
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          })}>
            {([6, 8, 12, 15] as const).map(difficulty => {
              const difficultyInfo = {
                6: { icon: '🌱', label: 'Beginner', description: 'Perfect to start!' },
                8: { icon: '⚡', label: 'Medium', description: 'Getting spicy!' },
                12: { icon: '🔥', label: 'Hard', description: 'Serious challenge!' },
                15: { icon: '💀', label: 'Expert', description: 'Memory master!' }
              }

              return (
                <button
                  key={difficulty}
                  className={getButtonStyles(state.difficulty === difficulty, 'difficulty')}
                  onClick={() => setDifficulty(difficulty)}
                >
                  <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' })}>
                    <div className={css({ fontSize: '32px' })}>
                      {difficultyInfo[difficulty].icon}
                    </div>
                    <div className={css({ fontSize: '18px', fontWeight: 'bold' })}>{difficulty} pairs</div>
                    <div className={css({ fontSize: '14px', fontWeight: 'bold' })}>
                      {difficultyInfo[difficulty].label}
                    </div>
                    <div className={css({ fontSize: '11px', opacity: 0.9, textAlign: 'center' })}>
                      {difficultyInfo[difficulty].description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <p className={css({
            fontSize: '14px',
            color: 'gray.500',
            marginTop: '8px'
          })}>
            {state.difficulty} pairs = {state.difficulty * 2} cards total
          </p>
        </div>

        {/* Multi-Player Timer Setting */}
        {activePlayerCount > 1 && (
          <div>
            <label className={css({
              display: 'block',
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: 'gray.700'
            })}>
              Turn Timer
            </label>
            <div className={css({
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            })}>
              {([15, 30, 45, 60] as const).map(timer => {
                const timerInfo: Record<15 | 30 | 45 | 60, { icon: string; label: string }> = {
                  15: { icon: '💨', label: 'Lightning' },
                  30: { icon: '⚡', label: 'Quick' },
                  45: { icon: '🏃', label: 'Standard' },
                  60: { icon: '🧘', label: 'Relaxed' }
                }

                return (
                  <button
                    key={timer}
                    className={getButtonStyles(state.turnTimer === timer, 'secondary')}
                    onClick={() => dispatch({ type: 'SET_TURN_TIMER', timer })}
                  >
                    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' })}>
                      <span className={css({ fontSize: '24px' })}>{timerInfo[timer].icon}</span>
                      <span className={css({ fontSize: '18px', fontWeight: 'bold' })}>{timer}s</span>
                      <span className={css({ fontSize: '12px', opacity: 0.8 })}>{timerInfo[timer].label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className={css({
              fontSize: '14px',
              color: 'gray.500',
              marginTop: '8px'
            })}>
              Time limit for each player's turn
            </p>
          </div>
        )}

        {/* Start Game Button */}
        <div className={css({ marginTop: '20px' })}>
          <button
            className={css({
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff9ff3 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '60px',
              padding: '20px 60px',
              fontSize: '28px',
              fontWeight: 'black',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 10px 30px rgba(255, 107, 107, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
              _before: {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transition: 'left 0.6s ease',
              },
              _hover: {
                transform: 'translateY(-5px) scale(1.05)',
                boxShadow: '0 15px 40px rgba(255, 107, 107, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
                background: 'linear-gradient(135deg, #ff5252 0%, #dd2c00 50%, #e91e63 100%)',
                _before: {
                  left: '100%'
                }
              },
              _active: {
                transform: 'translateY(-2px) scale(1.02)',
              }
            })}
            onClick={handleStartGame}
          >
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              justifyContent: 'center'
            })}>
              <span className={css({
                fontSize: '32px',
                animation: 'bounce 2s infinite'
              })}>🚀</span>
              <span>START GAME</span>
              <span className={css({
                fontSize: '32px',
                animation: 'bounce 2s infinite',
                animationDelay: '0.5s'
              })}>🎮</span>
            </div>
          </button>
        </div>

        {/* Game Preview */}
        <div className={css({
          background: 'gray.50',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '20px'
        })}>
          <h3 className={css({
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: 'gray.700'
          })}>
            Game Preview
          </h3>
          <div className={css({
            fontSize: '14px',
            color: 'gray.600',
            lineHeight: '1.5'
          })}>
            <p><strong>Mode:</strong> {activePlayerCount === 1 ? 'Single Player' : `${activePlayerCount} Players`}</p>
            <p><strong>Type:</strong> {state.gameType === 'abacus-numeral' ? 'Abacus-Numeral Matching' : 'Complement Pairs'}</p>
            <p><strong>Difficulty:</strong> {state.difficulty} pairs ({state.difficulty * 2} cards)</p>
            {activePlayerCount > 1 && (
              <p><strong>Turn Timer:</strong> {state.turnTimer} seconds</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}