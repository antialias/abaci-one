'use client'

import { useComplementRace } from '@/arcade-games/complement-race/Provider'

export function GameIntro() {
  const { dispatch } = useComplementRace()

  const handleStartClick = () => {
    dispatch({ type: 'SHOW_CONTROLS' })
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        maxWidth: '800px',
        margin: '20px auto 0',
      }}
    >
      <h1
        style={{
          fontSize: '48px',
          fontWeight: 'bold',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Speed Complement Race
      </h1>

      <p
        style={{
          fontSize: '18px',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.6',
        }}
      >
        Race against AI opponents while solving complement problems! Find the missing number to
        complete the equation.
      </p>

      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          textAlign: 'left',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#1f2937',
          }}
        >
          How to Play
        </h2>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <li style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <span style={{ fontSize: '24px' }}>🎯</span>
            <span style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Find the complement number to reach the target sum
            </span>
          </li>
          <li style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <span style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Type your answer quickly to move forward in the race
            </span>
          </li>
          <li style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
            <span style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Compete against Swift AI and Math Bot with unique personalities
            </span>
          </li>
          <li style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <span style={{ fontSize: '24px' }}>🏆</span>
            <span style={{ color: '#4b5563', lineHeight: '1.6' }}>
              Earn points for correct answers and build up your streak
            </span>
          </li>
        </ul>
      </div>

      <button
        onClick={handleStartClick}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '16px 48px',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}
      >
        Start Racing!
      </button>
    </div>
  )
}
