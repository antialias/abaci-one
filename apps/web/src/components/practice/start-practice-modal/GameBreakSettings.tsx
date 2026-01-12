'use client'

import * as Select from '@radix-ui/react-select'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

export function GameBreakSettings() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    showGameBreakSettings,
    gameBreakEnabled,
    setGameBreakEnabled,
    gameBreakMinutes,
    setGameBreakMinutes,
    gameBreakSelectionMode,
    setGameBreakSelectionMode,
    gameBreakSelectedGame,
    setGameBreakSelectedGame,
    practiceApprovedGames,
    hasSingleGame,
    singleGame,
  } = useStartPracticeModal()

  if (!showGameBreakSettings) {
    return null
  }

  // Simplified UI for single-game scenario
  if (hasSingleGame && singleGame) {
    return (
      <div data-setting="game-break" data-mode="single-game">
        {/* Header with toggle */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              marginBottom: '0.25rem',
            },
          })}
        >
          <div
            data-element="game-break-label"
            className={css({
              fontSize: '0.6875rem',
              fontWeight: '600',
              color: isDark ? 'gray.500' : 'gray.400',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.625rem',
              },
            })}
          >
            Game Breaks
          </div>
          <button
            type="button"
            data-action="toggle-game-break"
            onClick={() => setGameBreakEnabled(!gameBreakEnabled)}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '@media (max-width: 480px), (max-height: 700px)': {
                padding: '0.125rem 0.375rem',
                fontSize: '0.5625rem',
              },
            })}
            style={{
              backgroundColor: gameBreakEnabled
                ? isDark
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)'
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)',
              color: gameBreakEnabled
                ? isDark
                  ? '#86efac'
                  : '#16a34a'
                : isDark
                  ? '#9ca3af'
                  : '#6b7280',
            }}
          >
            <span>{gameBreakEnabled ? '🎮' : '⏸️'}</span>
            <span>{gameBreakEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>

        {gameBreakEnabled && (
          <>
            {/* Game info + duration in one row */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                marginBottom: '0.375rem',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.375rem 0.5rem',
                  gap: '0.5rem',
                },
              })}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              }}
            >
              {/* Game icon and name */}
              <div
                data-element="single-game-info"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flex: 1,
                  minWidth: 0,
                })}
              >
                <span className={css({ fontSize: '1.25rem', flexShrink: 0 })}>
                  {singleGame.manifest.icon}
                </span>
                <span
                  className={css({
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: isDark ? 'gray.200' : 'gray.700',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '@media (max-width: 480px), (max-height: 700px)': {
                      fontSize: '0.75rem',
                    },
                  })}
                >
                  {singleGame.manifest.shortName || singleGame.manifest.displayName}
                </span>
              </div>

              {/* Duration selector - compact */}
              <div
                data-element="game-break-duration"
                className={css({
                  display: 'flex',
                  gap: '0.25rem',
                  flexShrink: 0,
                })}
              >
                {[2, 3, 5].map((mins) => {
                  const isSelected = gameBreakMinutes === mins
                  return (
                    <button
                      key={mins}
                      type="button"
                      data-option={`game-break-${mins}`}
                      data-selected={isSelected}
                      onClick={() => setGameBreakMinutes(mins)}
                      className={css({
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '@media (max-width: 480px), (max-height: 700px)': {
                          padding: '0.1875rem 0.375rem',
                          fontSize: '0.6875rem',
                        },
                      })}
                      style={{
                        backgroundColor: isSelected
                          ? isDark
                            ? '#22c55e'
                            : '#16a34a'
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.06)',
                        color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
                      }}
                    >
                      {mins}m
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Helper text + coming soon */}
            <div
              data-element="game-break-hint"
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'gray.500' : 'gray.400',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                '@media (max-width: 480px), (max-height: 700px)': {
                  fontSize: '0.5625rem',
                },
              })}
            >
              <span>Starts automatically between parts</span>
              <span
                className={css({
                  color: isDark ? 'blue.400' : 'blue.500',
                  fontWeight: '500',
                })}
              >
                More games coming soon!
              </span>
            </div>
          </>
        )}
      </div>
    )
  }

  // Full UI for multiple games
  return (
    <div data-setting="game-break" data-mode="multi-game">
      {/* Header with toggle */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            marginBottom: '0.25rem',
          },
        })}
      >
        <div
          data-element="game-break-label"
          className={css({
            fontSize: '0.6875rem',
            fontWeight: '600',
            color: isDark ? 'gray.500' : 'gray.400',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            '@media (max-width: 480px), (max-height: 700px)': {
              fontSize: '0.625rem',
            },
          })}
        >
          Game Breaks
        </div>
        <button
          type="button"
          data-action="toggle-game-break"
          onClick={() => setGameBreakEnabled(!gameBreakEnabled)}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.6875rem',
            fontWeight: '500',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '@media (max-width: 480px), (max-height: 700px)': {
              padding: '0.125rem 0.375rem',
              fontSize: '0.5625rem',
            },
          })}
          style={{
            backgroundColor: gameBreakEnabled
              ? isDark
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(34, 197, 94, 0.15)'
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            color: gameBreakEnabled
              ? isDark
                ? '#86efac'
                : '#16a34a'
              : isDark
                ? '#9ca3af'
                : '#6b7280',
          }}
        >
          <span>{gameBreakEnabled ? '🎮' : '⏸️'}</span>
          <span>{gameBreakEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Duration options */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-duration"
          className={css({
            display: 'flex',
            gap: '0.25rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              gap: '0.125rem',
            },
          })}
        >
          {[2, 3, 5, 10].map((mins) => {
            const isSelected = gameBreakMinutes === mins
            return (
              <button
                key={mins}
                type="button"
                data-option={`game-break-${mins}`}
                data-selected={isSelected}
                onClick={() => setGameBreakMinutes(mins)}
                className={css({
                  flex: 1,
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    padding: '0.3125rem 0.125rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                  },
                })}
                style={{
                  backgroundColor: isSelected
                    ? isDark
                      ? '#22c55e'
                      : '#16a34a'
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
                }}
              >
                {mins}m
              </button>
            )
          })}
        </div>
      )}

      {/* Selection Mode Toggle */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-mode"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            marginTop: '0.5rem',
          })}
        >
          <div
            className={css({
              fontSize: '0.625rem',
              fontWeight: '600',
              color: isDark ? 'gray.500' : 'gray.400',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.5625rem',
              },
            })}
          >
            How to start
          </div>
          <div
            className={css({
              display: 'flex',
              gap: '0.25rem',
            })}
          >
            {[
              { mode: 'auto-start' as const, emoji: '🚀', label: 'Auto-start' },
              { mode: 'kid-chooses' as const, emoji: '🎯', label: 'Kid picks' },
            ].map(({ mode, emoji, label }) => {
              const isSelected = gameBreakSelectionMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  data-option={`mode-${mode}`}
                  data-selected={isSelected}
                  onClick={() => setGameBreakSelectionMode(mode)}
                  className={css({
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.375rem 0.5rem',
                    fontSize: '0.6875rem',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '@media (max-width: 480px), (max-height: 700px)': {
                      padding: '0.25rem 0.375rem',
                      fontSize: '0.5625rem',
                      gap: '0.125rem',
                    },
                  })}
                  style={{
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(59, 130, 246, 0.25)'
                        : 'rgba(59, 130, 246, 0.15)'
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                    color: isSelected
                      ? isDark
                        ? '#93c5fd'
                        : '#2563eb'
                      : isDark
                        ? '#9ca3af'
                        : '#6b7280',
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Game Selection Dropdown */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-game"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            marginTop: '0.5rem',
          })}
        >
          <div
            className={css({
              fontSize: '0.625rem',
              fontWeight: '600',
              color: isDark ? 'gray.500' : 'gray.400',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.5625rem',
              },
            })}
          >
            {gameBreakSelectionMode === 'auto-start' ? 'Game' : 'Default'}
          </div>
          <Select.Root
            value={gameBreakSelectedGame ?? '__none__'}
            onValueChange={(value) =>
              setGameBreakSelectedGame(value === '__none__' ? null : (value as string | 'random'))
            }
          >
            <Select.Trigger
              data-element="game-select-trigger"
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                borderRadius: '8px',
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.6875rem',
                },
              })}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                color: isDark ? '#e5e7eb' : '#374151',
              }}
            >
              <Select.Value>
                {(() => {
                  if (gameBreakSelectedGame === 'random') return '🎲 Random'
                  if (gameBreakSelectedGame === null) return '✨ No default'
                  const game = practiceApprovedGames.find(
                    (g) => g.manifest.name === gameBreakSelectedGame
                  )
                  return game
                    ? `${game.manifest.icon} ${game.manifest.shortName || game.manifest.displayName}`
                    : 'Select game'
                })()}
              </Select.Value>
              <Select.Icon>
                <span
                  className={css({
                    fontSize: '0.625rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                  })}
                >
                  ▼
                </span>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                data-element="game-select-content"
                position="popper"
                sideOffset={4}
                className={css({
                  backgroundColor: isDark ? '#1f2937' : 'white',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  zIndex: 10001,
                  minWidth: '180px',
                })}
              >
                <Select.Viewport className={css({ padding: '0.25rem' })}>
                  {/* Random option */}
                  <Select.Item
                    value="random"
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      outline: 'none',
                      color: isDark ? '#e5e7eb' : '#374151',
                      _hover: {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      },
                      '&[data-highlighted]': {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      },
                    })}
                  >
                    <Select.ItemText>🎲 Random</Select.ItemText>
                  </Select.Item>
                  {/* Practice-approved games */}
                  {practiceApprovedGames.map((game) => (
                    <Select.Item
                      key={game.manifest.name}
                      value={game.manifest.name}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        outline: 'none',
                        color: isDark ? '#e5e7eb' : '#374151',
                        _hover: {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        },
                        '&[data-highlighted]': {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        },
                      })}
                    >
                      <Select.ItemText>
                        {game.manifest.icon} {game.manifest.shortName || game.manifest.displayName}
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                  {/* "No default" option for kid-chooses mode only */}
                  {gameBreakSelectionMode === 'kid-chooses' && (
                    <Select.Item
                      value="__none__"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        outline: 'none',
                        color: isDark ? '#9ca3af' : '#6b7280',
                        _hover: {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        },
                        '&[data-highlighted]': {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        },
                      })}
                    >
                      <Select.ItemText>✨ No default</Select.ItemText>
                    </Select.Item>
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      )}

      {/* Helper text */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-hint"
          className={css({
            fontSize: '0.625rem',
            color: isDark ? 'gray.500' : 'gray.400',
            marginTop: '0.375rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              fontSize: '0.5625rem',
              marginTop: '0.25rem',
            },
          })}
        >
          {gameBreakSelectionMode === 'auto-start'
            ? gameBreakSelectedGame === 'random'
              ? 'A random game will start automatically'
              : 'This game will start automatically (kid can skip)'
            : gameBreakSelectedGame === null
              ? 'Kid chooses from full list'
              : 'This game will be highlighted as suggested'}
        </div>
      )}
    </div>
  )
}
