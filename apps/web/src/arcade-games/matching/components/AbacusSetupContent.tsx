'use client'

import { css } from '../../../../styled-system/css'
import type { SetupContentProps } from '@/lib/arcade/matching-pairs-framework'
import type { AbacusConfig } from '../types'

/**
 * Abacus-specific setup content: game type and difficulty selection.
 * The generic framework handles config warning dialog, no-players warning,
 * turn timer, and start/resume button.
 */
export function AbacusSetupContent({
  config,
  setConfig,
  isCompact,
}: SetupContentProps<AbacusConfig>) {
  const getButtonStyles = (
    isSelected: boolean,
    variant: 'primary' | 'secondary' | 'difficulty' = 'primary'
  ) => {
    const baseStyles = {
      border: 'none',
      borderRadius: isCompact ? '12px' : { base: '12px', md: '16px' },
      padding: isCompact ? '10px 14px' : { base: '12px 16px', sm: '14px 20px', md: '16px 24px' },
      fontSize: isCompact ? '14px' : { base: '14px', sm: '15px', md: '16px' },
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      minWidth: isCompact ? '100px' : { base: '120px', sm: '140px', md: '160px' },
      textAlign: 'center' as const,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      textShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
      transform: 'translateZ(0)',
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
        },
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
        },
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
      },
    })
  }

  return (
    <>
      {/* Game Type Selection */}
      <div data-section="game-type-selection">
        <label
          data-element="game-type-label"
          className={css({
            display: 'block',
            fontSize: isCompact ? '16px' : { base: '16px', sm: '18px', md: '20px' },
            fontWeight: 'bold',
            marginBottom: isCompact ? '8px' : { base: '12px', md: '16px' },
            color: 'gray.700',
          })}
        >
          Game Type
        </label>
        <div
          data-element="game-type-buttons"
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: isCompact ? '8px' : { base: '8px', sm: '10px', md: '12px' },
            justifyItems: 'stretch',
          })}
        >
          <button
            data-action="select-game-type"
            data-game-type="abacus-numeral"
            data-selected={config.gameType === 'abacus-numeral'}
            className={getButtonStyles(config.gameType === 'abacus-numeral', 'secondary')}
            onClick={() => setConfig('gameType', 'abacus-numeral')}
          >
            <div
              data-element="button-content"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isCompact ? '4px' : { base: '4px', md: '6px' },
              })}
            >
              <div
                data-element="button-icons"
                className={css({
                  fontSize: isCompact ? '22px' : { base: '20px', sm: '24px', md: '28px' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: isCompact ? '4px' : { base: '4px', md: '8px' },
                })}
              >
                <span>🧮</span>
                <span
                  className={css({
                    fontSize: isCompact ? '16px' : { base: '16px', md: '20px' },
                  })}
                >
                  ↔️
                </span>
                <span>🔢</span>
              </div>
              <div
                data-element="button-title"
                className={css({
                  fontWeight: 'bold',
                  fontSize: isCompact ? '13px' : { base: '12px', sm: '13px', md: '14px' },
                })}
              >
                Abacus-Numeral
              </div>
              {!isCompact && (
                <div
                  data-element="button-description"
                  className={css({
                    fontSize: { base: '10px', sm: '11px', md: '12px' },
                    opacity: 0.8,
                    textAlign: 'center',
                    display: { base: 'none', sm: 'block' },
                  })}
                >
                  Match visual patterns
                  <br />
                  with numbers
                </div>
              )}
            </div>
          </button>
          <button
            data-action="select-game-type"
            data-game-type="complement-pairs"
            data-selected={config.gameType === 'complement-pairs'}
            className={getButtonStyles(config.gameType === 'complement-pairs', 'secondary')}
            onClick={() => setConfig('gameType', 'complement-pairs')}
          >
            <div
              data-element="button-content"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isCompact ? '4px' : { base: '4px', md: '6px' },
              })}
            >
              <div
                data-element="button-icons"
                className={css({
                  fontSize: isCompact ? '22px' : { base: '20px', sm: '24px', md: '28px' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: isCompact ? '4px' : { base: '4px', md: '8px' },
                })}
              >
                <span>🤝</span>
                <span
                  className={css({
                    fontSize: isCompact ? '16px' : { base: '16px', md: '20px' },
                  })}
                >
                  ➕
                </span>
                <span>🔟</span>
              </div>
              <div
                data-element="button-title"
                className={css({
                  fontWeight: 'bold',
                  fontSize: isCompact ? '13px' : { base: '12px', sm: '13px', md: '14px' },
                })}
              >
                Complement Pairs
              </div>
              {!isCompact && (
                <div
                  data-element="button-description"
                  className={css({
                    fontSize: { base: '10px', sm: '11px', md: '12px' },
                    opacity: 0.8,
                    textAlign: 'center',
                    display: { base: 'none', sm: 'block' },
                  })}
                >
                  Find number friends
                  <br />
                  that add to 5 or 10
                </div>
              )}
            </div>
          </button>
        </div>
        {!isCompact && (
          <p
            data-element="game-type-hint"
            className={css({
              fontSize: { base: '12px', md: '14px' },
              color: 'gray.500',
              marginTop: { base: '6px', md: '8px' },
              textAlign: 'center',
              display: { base: 'none', sm: 'block' },
            })}
          >
            {config.gameType === 'abacus-numeral'
              ? 'Match abacus representations with their numerical values'
              : 'Find pairs of numbers that add up to 5 or 10'}
          </p>
        )}
      </div>

      {/* Difficulty Selection */}
      <div data-section="difficulty-selection">
        <label
          data-element="difficulty-label"
          className={css({
            display: 'block',
            fontSize: isCompact ? '16px' : { base: '16px', sm: '18px', md: '20px' },
            fontWeight: 'bold',
            marginBottom: isCompact ? '8px' : { base: '12px', md: '16px' },
            color: 'gray.700',
          })}
        >
          Difficulty ({config.difficulty} pairs)
        </label>
        <div
          data-element="difficulty-buttons"
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: isCompact ? '8px' : { base: '8px', sm: '10px', md: '12px' },
            justifyItems: 'stretch',
          })}
        >
          {([6, 8, 12, 15] as const).map((difficulty) => {
            const difficultyInfo = {
              6: {
                icon: '🌱',
                label: 'Beginner',
                description: 'Perfect to start!',
              },
              8: {
                icon: '⚡',
                label: 'Medium',
                description: 'Getting spicy!',
              },
              12: {
                icon: '🔥',
                label: 'Hard',
                description: 'Serious challenge!',
              },
              15: {
                icon: '💀',
                label: 'Expert',
                description: 'Memory master!',
              },
            }

            return (
              <button
                key={difficulty}
                data-action="select-difficulty"
                data-difficulty={difficulty}
                data-selected={config.difficulty === difficulty}
                className={getButtonStyles(config.difficulty === difficulty, 'difficulty')}
                onClick={() => setConfig('difficulty', difficulty)}
              >
                <div
                  data-element="button-content"
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: isCompact ? '2px' : '4px',
                  })}
                >
                  <div
                    data-element="button-icon"
                    className={css({ fontSize: isCompact ? '24px' : '32px' })}
                  >
                    {difficultyInfo[difficulty].icon}
                  </div>
                  <div
                    data-element="button-pairs"
                    className={css({
                      fontSize: isCompact ? '14px' : '18px',
                      fontWeight: 'bold',
                    })}
                  >
                    {difficulty}
                  </div>
                  {!isCompact && (
                    <>
                      <div
                        data-element="button-level"
                        className={css({
                          fontSize: '14px',
                          fontWeight: 'bold',
                        })}
                      >
                        {difficultyInfo[difficulty].label}
                      </div>
                      <div
                        data-element="button-description"
                        className={css({
                          fontSize: '11px',
                          opacity: 0.9,
                          textAlign: 'center',
                        })}
                      >
                        {difficultyInfo[difficulty].description}
                      </div>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {!isCompact && (
          <p
            data-element="difficulty-hint"
            className={css({
              fontSize: '14px',
              color: 'gray.500',
              marginTop: '8px',
            })}
          >
            {config.difficulty} pairs = {config.difficulty * 2} cards total
          </p>
        )}
      </div>
    </>
  )
}
