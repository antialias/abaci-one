'use client'

import { useRouter } from 'next/navigation'
import { useComplementRace } from '../context/ComplementRaceContext'
import type { GameMode, GameStyle, TimeoutSetting } from '../lib/gameTypes'

export function GameControls() {
  const { state, dispatch } = useComplementRace()
  const router = useRouter()

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
    // Update URL to match selected game style when starting
    router.push(`/games/complement-race/${state.style}`)

    // Train mode (sprint) doesn't need countdown - start immediately
    if (state.style === 'sprint') {
      dispatch({ type: 'BEGIN_GAME' })
    } else {
      dispatch({ type: 'START_COUNTDOWN' })
    }
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '32px 20px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: 'bold',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Configure Your Race
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginBottom: '32px'
        }}>
          Choose your number mode, race type, and difficulty level
        </p>

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
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#1f2937'
            }}>
              Number Mode
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <button
                onClick={() => handleModeSelect('friends5')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '3px solid',
                  borderColor: state.mode === 'friends5' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'friends5'
                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                    : 'white',
                  color: state.mode === 'friends5' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: state.mode === 'friends5' ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
                }}
              >
                <span style={{ fontSize: '24px' }}>5️⃣</span>
                <span style={{ fontSize: '15px' }}>Friends of 5</span>
              </button>

              <button
                onClick={() => handleModeSelect('friends10')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '3px solid',
                  borderColor: state.mode === 'friends10' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'friends10'
                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                    : 'white',
                  color: state.mode === 'friends10' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: state.mode === 'friends10' ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
                }}
              >
                <span style={{ fontSize: '24px' }}>🔟</span>
                <span style={{ fontSize: '15px' }}>Friends of 10</span>
              </button>

              <button
                onClick={() => handleModeSelect('mixed')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '3px solid',
                  borderColor: state.mode === 'mixed' ? '#3b82f6' : '#e5e7eb',
                  background: state.mode === 'mixed'
                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                    : 'white',
                  color: state.mode === 'mixed' ? '#1e40af' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: state.mode === 'mixed' ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
                }}
              >
                <span style={{ fontSize: '24px' }}>🎲</span>
                <span style={{ fontSize: '15px' }}>Mixed</span>
              </button>
            </div>
          </div>

          {/* Game Style Selection */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#1f2937'
            }}>
              Race Type
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={() => handleStyleSelect('practice')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '3px solid',
                  borderColor: state.style === 'practice' ? '#10b981' : '#e5e7eb',
                  background: state.style === 'practice'
                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                    : 'white',
                  color: state.style === 'practice' ? '#047857' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  boxShadow: state.style === 'practice' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '28px' }}>🏁</span>
                  <span style={{ fontSize: '16px' }}>Practice Mode</span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: '1.4' }}>
                  Race AI opponents on a linear track. First to reach 20 correct answers wins! Perfect for building speed and accuracy.
                </div>
              </button>

              <button
                onClick={() => handleStyleSelect('sprint')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '3px solid',
                  borderColor: state.style === 'sprint' ? '#f59e0b' : '#e5e7eb',
                  background: state.style === 'sprint'
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : 'white',
                  color: state.style === 'sprint' ? '#d97706' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  boxShadow: state.style === 'sprint' ? '0 4px 12px rgba(245, 158, 11, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '28px' }}>🚂</span>
                  <span style={{ fontSize: '16px' }}>Steam Sprint</span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: '1.4' }}>
                  Keep your train moving for 60 seconds! Build momentum with correct answers. Pick up passengers and reach stations!
                </div>
              </button>

              <button
                onClick={() => handleStyleSelect('survival')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '3px solid',
                  borderColor: state.style === 'survival' ? '#8b5cf6' : '#e5e7eb',
                  background: state.style === 'survival'
                    ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                    : 'white',
                  color: state.style === 'survival' ? '#6b21a8' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  boxShadow: state.style === 'survival' ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '28px' }}>🔄</span>
                  <span style={{ fontSize: '16px' }}>Survival Mode</span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: '1.4' }}>
                  Endless circular race! Complete laps before AI opponents catch you. How long can you survive?
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Timeout Setting Selection - Full width below */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          textAlign: 'left'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#1f2937'
          }}>
            Difficulty Level
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '10px'
          }}>
            {(['preschool', 'kindergarten', 'relaxed', 'slow', 'normal', 'fast', 'expert'] as TimeoutSetting[]).map((timeout) => (
              <button
                key={timeout}
                onClick={() => handleTimeoutSelect(timeout)}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  border: '3px solid',
                  borderColor: state.timeoutSetting === timeout ? '#ec4899' : '#e5e7eb',
                  background: state.timeoutSetting === timeout
                    ? 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
                    : 'white',
                  color: state.timeoutSetting === timeout ? '#be185d' : '#6b7280',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '14px',
                  boxShadow: state.timeoutSetting === timeout ? '0 4px 12px rgba(236, 72, 153, 0.2)' : 'none'
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            padding: '18px 56px',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.2s ease',
            width: '100%',
            maxWidth: '400px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
          }}
        >
          <span style={{ fontSize: '24px' }}>🏁</span>
          <span>Start Your Race!</span>
        </button>
      </div>
    </div>
  )
}