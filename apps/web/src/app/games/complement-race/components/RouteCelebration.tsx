'use client'

import { getRouteTheme } from '../lib/routeThemes'

interface RouteCelebrationProps {
  completedRouteNumber: number
  nextRouteNumber: number
  onContinue: () => void
}

export function RouteCelebration({
  completedRouteNumber,
  nextRouteNumber,
  onContinue,
}: RouteCelebrationProps) {
  const completedTheme = getRouteTheme(completedRouteNumber)
  const nextTheme = getRouteTheme(nextRouteNumber)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'scaleIn 0.5s ease-out',
          color: 'white',
        }}
      >
        {/* Celebration header */}
        <div
          style={{
            fontSize: '64px',
            marginBottom: '20px',
            animation: 'bounce 1s ease-in-out infinite',
          }}
        >
          🎉
        </div>

        <h2
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '16px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          Route Complete!
        </h2>

        {/* Completed route info */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>{completedTheme.emoji}</div>
          <div style={{ fontSize: '20px', fontWeight: '600' }}>{completedTheme.name}</div>
          <div style={{ fontSize: '16px', opacity: 0.9, marginTop: '4px' }}>
            Route {completedRouteNumber}
          </div>
        </div>

        {/* Next route preview */}
        <div
          style={{
            fontSize: '14px',
            opacity: 0.9,
            marginBottom: '8px',
          }}
        >
          Next destination:
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '24px',
            border: '2px dashed rgba(255, 255, 255, 0.3)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '4px' }}>{nextTheme.emoji}</div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>{nextTheme.name}</div>
          <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
            Route {nextRouteNumber}
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          style={{
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}
        >
          Continue Journey 🚂
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  )
}
