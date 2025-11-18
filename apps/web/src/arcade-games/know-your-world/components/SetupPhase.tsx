'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'

export function SetupPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, startGame, setMap, setMode, setDifficulty, setStudyDuration } = useKnowYourWorld()

  return (
    <div
      data-component="setup-phase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '6',
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: '20',
        paddingX: '6',
        paddingBottom: '6',
      })}
    >
      {/* Map Selection */}
      <div data-section="map-selection">
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '4',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Choose a Map 🗺️
        </h2>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '4',
          })}
        >
          <button
            data-action="select-world-map"
            onClick={() => setMap('world')}
            className={css({
              padding: '6',
              rounded: 'xl',
              border: '3px solid',
              borderColor: state.selectedMap === 'world' ? 'blue.500' : 'transparent',
              bg:
                state.selectedMap === 'world'
                  ? isDark
                    ? 'blue.900'
                    : 'blue.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
                transform: 'translateY(-2px)',
              },
            })}
          >
            <div className={css({ fontSize: '4xl', marginBottom: '2' })}>🌍</div>
            <div className={css({ fontSize: 'xl', fontWeight: 'bold' })}>World</div>
            <div className={css({ fontSize: 'sm', color: isDark ? 'gray.400' : 'gray.600' })}>
              256 countries
            </div>
          </button>

          <button
            data-action="select-usa-map"
            onClick={() => setMap('usa')}
            className={css({
              padding: '6',
              rounded: 'xl',
              border: '3px solid',
              borderColor: state.selectedMap === 'usa' ? 'blue.500' : 'transparent',
              bg:
                state.selectedMap === 'usa'
                  ? isDark
                    ? 'blue.900'
                    : 'blue.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
                transform: 'translateY(-2px)',
              },
            })}
          >
            <div className={css({ fontSize: '4xl', marginBottom: '2' })}>🇺🇸</div>
            <div className={css({ fontSize: 'xl', fontWeight: 'bold' })}>USA States</div>
            <div className={css({ fontSize: 'sm', color: isDark ? 'gray.400' : 'gray.600' })}>
              51 states
            </div>
          </button>
        </div>
      </div>

      {/* Mode Selection */}
      <div data-section="mode-selection">
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '4',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Game Mode 🎮
        </h2>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4',
          })}
        >
          <button
            data-action="select-cooperative-mode"
            onClick={() => setMode('cooperative')}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.gameMode === 'cooperative' ? 'green.500' : 'transparent',
              bg:
                state.gameMode === 'cooperative'
                  ? isDark
                    ? 'green.900'
                    : 'green.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'green.400',
              },
            })}
          >
            <div className={css({ fontSize: '3xl', marginBottom: '2' })}>🤝</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Cooperative</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Work together
            </div>
          </button>

          <button
            data-action="select-race-mode"
            onClick={() => setMode('race')}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.gameMode === 'race' ? 'orange.500' : 'transparent',
              bg:
                state.gameMode === 'race'
                  ? isDark
                    ? 'orange.900'
                    : 'orange.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'orange.400',
              },
            })}
          >
            <div className={css({ fontSize: '3xl', marginBottom: '2' })}>🏁</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Race</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              First to click wins
            </div>
          </button>

          <button
            data-action="select-turn-based-mode"
            onClick={() => setMode('turn-based')}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.gameMode === 'turn-based' ? 'purple.500' : 'transparent',
              bg:
                state.gameMode === 'turn-based'
                  ? isDark
                    ? 'purple.900'
                    : 'purple.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'purple.400',
              },
            })}
          >
            <div className={css({ fontSize: '3xl', marginBottom: '2' })}>↔️</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Turn-Based</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Take turns
            </div>
          </button>
        </div>
      </div>

      {/* Difficulty Selection */}
      <div data-section="difficulty-selection">
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '4',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Difficulty ⭐
        </h2>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '4',
          })}
        >
          <button
            data-action="select-easy-difficulty"
            onClick={() => setDifficulty('easy')}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.difficulty === 'easy' ? 'green.500' : 'transparent',
              bg:
                state.difficulty === 'easy'
                  ? isDark
                    ? 'green.900'
                    : 'green.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'green.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>😊</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Easy</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              All outlines visible
            </div>
          </button>

          <button
            data-action="select-hard-difficulty"
            onClick={() => setDifficulty('hard')}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.difficulty === 'hard' ? 'red.500' : 'transparent',
              bg:
                state.difficulty === 'hard'
                  ? isDark
                    ? 'red.900'
                    : 'red.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'red.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>🤔</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Hard</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Outlines on hover only
            </div>
          </button>
        </div>
      </div>

      {/* Study Mode Selection */}
      <div data-section="study-mode-selection">
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            marginBottom: '4',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Study Mode 📚
        </h2>
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4',
          })}
        >
          <button
            data-action="select-no-study"
            onClick={() => setStudyDuration(0)}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.studyDuration === 0 ? 'gray.500' : 'transparent',
              bg:
                state.studyDuration === 0
                  ? isDark
                    ? 'gray.700'
                    : 'gray.200'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'gray.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>⏭️</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Skip</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              No study time
            </div>
          </button>

          <button
            data-action="select-30s-study"
            onClick={() => setStudyDuration(30)}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.studyDuration === 30 ? 'blue.500' : 'transparent',
              bg:
                state.studyDuration === 30
                  ? isDark
                    ? 'blue.900'
                    : 'blue.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>⏱️</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>30s</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Quick review
            </div>
          </button>

          <button
            data-action="select-60s-study"
            onClick={() => setStudyDuration(60)}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.studyDuration === 60 ? 'blue.500' : 'transparent',
              bg:
                state.studyDuration === 60
                  ? isDark
                    ? 'blue.900'
                    : 'blue.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>⏲️</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>1m</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Study time
            </div>
          </button>

          <button
            data-action="select-120s-study"
            onClick={() => setStudyDuration(120)}
            className={css({
              padding: '4',
              rounded: 'lg',
              border: '2px solid',
              borderColor: state.studyDuration === 120 ? 'blue.500' : 'transparent',
              bg:
                state.studyDuration === 120
                  ? isDark
                    ? 'blue.900'
                    : 'blue.50'
                  : isDark
                    ? 'gray.800'
                    : 'gray.100',
              color: isDark ? 'gray.100' : 'gray.900',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
              },
            })}
          >
            <div className={css({ fontSize: '2xl', marginBottom: '2' })}>⏰</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>2m</div>
            <div className={css({ fontSize: 'xs', color: isDark ? 'gray.400' : 'gray.600' })}>
              Deep study
            </div>
          </button>
        </div>
      </div>

      {/* Start Button */}
      <button
        data-action="start-game"
        onClick={startGame}
        className={css({
          marginTop: '4',
          padding: '4',
          rounded: 'xl',
          bg: 'blue.600',
          color: 'white',
          fontSize: 'xl',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _hover: {
            bg: 'blue.700',
            transform: 'translateY(-2px)',
            shadow: 'lg',
          },
        })}
      >
        {state.studyDuration > 0 ? 'Start Study & Play! 📚🚀' : 'Start Game! 🚀'}
      </button>
    </div>
  )
}
