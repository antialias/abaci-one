'use client'

import { useComplementRace } from '../context/ComplementRaceContext'
import type { GameMode, GameStyle, TimeoutSetting } from '../lib/gameTypes'

export function GameControls() {
  const { state, dispatch } = useComplementRace()

  const handleModeSelect = (mode: GameMode) => {
    dispatch({ type: 'SET_MODE', mode })
  }

  const handleStyleSelect = (style: GameStyle) => {
    dispatch({ type: 'SET_STYLE', style })
  }

  const handleTimeoutSelect = (timeout: TimeoutSetting) => {
    dispatch({ type: 'SET_TIMEOUT', timeout })
  }

  const handleStartRace = () => {
    dispatch({ type: 'START_COUNTDOWN' })
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '20px',
          color: '#1f2937'
        }}>
          Race Configuration
        </h2>

        {/* Grid container for all sections on wider screens */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {/* Number Mode Selection */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#1f2937'
            }}>
              Number Mode
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <button
                onClick={() => handleModeSelect('friends5')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.mode === 'friends5' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'friends5' ? '#eff6ff' : 'white',
                  color: state.mode === 'friends5' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '20px' }}>5️⃣</span>
                <span>Friends of 5</span>
              </button>

              <button
                onClick={() => handleModeSelect('friends10')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.mode === 'friends10' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'friends10' ? '#eff6ff' : 'white',
                  color: state.mode === 'friends10' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '20px' }}>🔟</span>
                <span>Friends of 10</span>
              </button>

              <button
                onClick={() => handleModeSelect('mixed')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.mode === 'mixed' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'mixed' ? '#eff6ff' : 'white',
                  color: state.mode === 'mixed' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '20px' }}>🎲</span>
                <span>Mixed</span>
              </button>
            </div>
          </div>

          {/* Game Style Selection */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#1f2937'
            }}>
              Race Type
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <button
                onClick={() => handleStyleSelect('practice')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.style === 'practice' ? '#10b981' : '#e5e7eb',
                  background: state.style === 'practice' ? '#d1fae5' : 'white',
                  color: state.style === 'practice' ? '#047857' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '20px' }}>🤖</span>
                  <span>Robot Showdown</span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Race AI on track</div>
              </button>

              <button
                onClick={() => handleStyleSelect('sprint')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.style === 'sprint' ? '#f59e0b' : '#e5e7eb',
                  background: state.style === 'sprint' ? '#fef3c7' : 'white',
                  color: state.style === 'sprint' ? '#d97706' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '20px' }}>🚂</span>
                  <span>Steam Sprint</span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>60-second journey</div>
              </button>

              <button
                onClick={() => handleStyleSelect('survival')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.style === 'survival' ? '#ef4444' : '#e5e7eb',
                  background: state.style === 'survival' ? '#fee2e2' : 'white',
                  color: state.style === 'survival' ? '#dc2626' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '20px' }}>🔄</span>
                  <span>Endless Circuit</span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>Infinite laps</div>
              </button>
            </div>
          </div>
        </div>

        {/* Timeout Setting Selection - Full width below */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          textAlign: 'left'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#1f2937'
          }}>
            Difficulty Level
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px'
          }}>
            {(['preschool', 'kindergarten', 'relaxed', 'slow', 'normal', 'fast', 'expert'] as TimeoutSetting[]).map((timeout) => (
              <button
                key={timeout}
                onClick={() => handleTimeoutSelect(timeout)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.timeoutSetting === timeout ? '#8b5cf6' : '#e5e7eb',
                  background: state.timeoutSetting === timeout ? '#f3e8ff' : 'white',
                  color: state.timeoutSetting === timeout ? '#6b21a8' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '13px'
                }}
              >
                {timeout.charAt(0).toUpperCase() + timeout.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStartRace}
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 48px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            width: '100%',
            maxWidth: '300px',
            margin: '0 auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
        >
          Begin Race!
        </button>
      </div>
    </div>
  )
}