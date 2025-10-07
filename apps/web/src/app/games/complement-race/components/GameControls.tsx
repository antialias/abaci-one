'use client'

import { useComplementRace } from '../context/ComplementRaceContext'
import type { ComplementDisplay, GameMode, GameStyle, TimeoutSetting } from '../lib/gameTypes'
import { AbacusTarget } from './AbacusTarget'

export function GameControls() {
  const { state, dispatch } = useComplementRace()

  const handleModeSelect = (mode: GameMode) => {
    dispatch({ type: 'SET_MODE', mode })
  }

  const handleStyleSelect = (style: GameStyle) => {
    dispatch({ type: 'SET_STYLE', style })
    // Start the game immediately - no navigation needed
    if (style === 'sprint') {
      dispatch({ type: 'BEGIN_GAME' })
    } else {
      dispatch({ type: 'START_COUNTDOWN' })
    }
  }

  const handleTimeoutSelect = (timeout: TimeoutSetting) => {
    dispatch({ type: 'SET_TIMEOUT', timeout })
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 50%, #334155 100%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Animated background pattern */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          Complement Race
        </h1>
      </div>

      {/* Settings Bar */}
      <div
        style={{
          padding: '0 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Number Mode & Display */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '20px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Number Mode Pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flex: 1,
                minWidth: '200px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontWeight: '600',
                  marginRight: '4px',
                }}
              >
                Mode:
              </span>
              {[
                { mode: 'friends5' as GameMode, label: '5' },
                { mode: 'friends10' as GameMode, label: '10' },
                { mode: 'mixed' as GameMode, label: 'Mix' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background:
                      state.mode === mode
                        ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                        : 'rgba(148, 163, 184, 0.2)',
                    color: state.mode === mode ? 'white' : '#94a3b8',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '13px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Complement Display Pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flex: 1,
                minWidth: '200px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontWeight: '600',
                  marginRight: '4px',
                }}
              >
                Show:
              </span>
              {(['number', 'abacus', 'random'] as ComplementDisplay[]).map((displayMode) => (
                <button
                  key={displayMode}
                  onClick={() => dispatch({ type: 'SET_COMPLEMENT_DISPLAY', display: displayMode })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background:
                      state.complementDisplay === displayMode
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(148, 163, 184, 0.2)',
                    color: state.complementDisplay === displayMode ? 'white' : '#94a3b8',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '13px',
                  }}
                >
                  {displayMode === 'number' ? '123' : displayMode === 'abacus' ? '🧮' : '🎲'}
                </button>
              ))}
            </div>

            {/* Speed Pills */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                flex: 1,
                minWidth: '200px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontWeight: '600',
                  marginRight: '4px',
                }}
              >
                Speed:
              </span>
              {(
                [
                  'preschool',
                  'kindergarten',
                  'relaxed',
                  'slow',
                  'normal',
                  'fast',
                  'expert',
                ] as TimeoutSetting[]
              ).map((timeout) => (
                <button
                  key={timeout}
                  onClick={() => handleTimeoutSelect(timeout)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: 'none',
                    background:
                      state.timeoutSetting === timeout
                        ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
                        : 'rgba(148, 163, 184, 0.2)',
                    color: state.timeoutSetting === timeout ? 'white' : '#94a3b8',
                    fontWeight: state.timeoutSetting === timeout ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '11px',
                  }}
                >
                  {timeout === 'preschool'
                    ? 'Pre'
                    : timeout === 'kindergarten'
                      ? 'K'
                      : timeout.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Preview - compact */}
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Preview:</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  padding: '2px 10px',
                  borderRadius: '6px',
                }}
              >
                ?
              </div>
              <span style={{ fontSize: '16px', color: '#64748b' }}>+</span>
              {state.complementDisplay === 'number' ? (
                <span>3</span>
              ) : state.complementDisplay === 'abacus' ? (
                <div style={{ transform: 'scale(0.8)' }}>
                  <AbacusTarget number={3} />
                </div>
              ) : (
                <span style={{ fontSize: '14px' }}>🎲</span>
              )}
              <span style={{ fontSize: '16px', color: '#64748b' }}>=</span>
              <span style={{ color: '#10b981' }}>
                {state.mode === 'friends5' ? '5' : state.mode === 'friends10' ? '10' : '?'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO SECTION - Race Cards */}
      <div
        data-component="race-cards-container"
        style={{
          flex: 1,
          padding: '0 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          zIndex: 1,
          overflow: 'auto',
        }}
      >
        {[
          {
            style: 'practice' as GameStyle,
            emoji: '🏁',
            title: 'Practice Race',
            desc: 'Race against AI to 20 correct answers',
            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            shadowColor: 'rgba(16, 185, 129, 0.5)',
            accentColor: '#34d399',
          },
          {
            style: 'sprint' as GameStyle,
            emoji: '🚂',
            title: 'Steam Sprint',
            desc: 'High-speed 60-second train journey',
            gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            shadowColor: 'rgba(245, 158, 11, 0.5)',
            accentColor: '#fbbf24',
          },
          {
            style: 'survival' as GameStyle,
            emoji: '🔄',
            title: 'Survival Circuit',
            desc: 'Endless laps - beat your best time',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            shadowColor: 'rgba(139, 92, 246, 0.5)',
            accentColor: '#a78bfa',
          },
        ].map(({ style, emoji, title, desc, gradient, shadowColor, accentColor }) => (
          <button
            key={style}
            onClick={() => handleStyleSelect(style)}
            style={{
              position: 'relative',
              padding: '0',
              border: 'none',
              borderRadius: '24px',
              background: gradient,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 10px 40px ${shadowColor}, 0 0 0 1px rgba(255, 255, 255, 0.1)`,
              transform: 'translateY(0)',
              flex: 1,
              minHeight: '140px',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = `0 20px 60px ${shadowColor}, 0 0 0 2px ${accentColor}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = `0 10px 40px ${shadowColor}, 0 0 0 1px rgba(255, 255, 255, 0.1)`
            }}
          >
            {/* Shine effect overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: '64px',
                    lineHeight: 1,
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                  }}
                >
                  {emoji}
                </div>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 'bold',
                      color: 'white',
                      marginBottom: '6px',
                      textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      textShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {desc}
                  </div>
                </div>
              </div>

              {/* PLAY NOW button */}
              <div
                style={{
                  background: 'white',
                  color: gradient.includes('10b981')
                    ? '#047857'
                    : gradient.includes('f59e0b')
                      ? '#d97706'
                      : '#6b21a8',
                  padding: '16px 32px',
                  borderRadius: '16px',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>PLAY</span>
                <span style={{ fontSize: '24px' }}>▶</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
