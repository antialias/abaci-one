'use client'

import { memo } from 'react'
import type { ComplementQuestion } from '../../lib/gameTypes'
import type { Passenger, Station } from '@/arcade-games/complement-race/types'
import { AbacusTarget } from '../AbacusTarget'
import { PassengerCard } from '../PassengerCard'
import { PressureGauge } from '../PressureGauge'

interface RouteTheme {
  emoji: string
  name: string
}

interface GameHUDProps {
  routeTheme: RouteTheme
  currentRoute: number
  periodName: string
  timeRemaining: number
  pressure: number
  nonDeliveredPassengers: Passenger[]
  stations: Station[]
  currentQuestion: ComplementQuestion | null
  currentInput: string
}

export const GameHUD = memo(
  ({
    routeTheme,
    currentRoute,
    periodName,
    timeRemaining,
    pressure,
    nonDeliveredPassengers,
    stations,
    currentQuestion,
    currentInput,
  }: GameHUDProps) => {
    return (
      <>
        {/* Route and time of day indicator */}
        <div
          data-component="route-info"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10,
          }}
        >
          {/* Current Route */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '20px' }}>{routeTheme.emoji}</span>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Route {currentRoute}</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>{routeTheme.name}</div>
            </div>
          </div>

          {/* Time of Day */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              backdropFilter: 'blur(4px)',
            }}
          >
            {periodName}
          </div>
        </div>

        {/* Time remaining */}
        <div
          data-component="time-remaining"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            backdropFilter: 'blur(4px)',
            zIndex: 10,
          }}
        >
          ⏱️ {timeRemaining}s
        </div>

        {/* Pressure gauge */}
        <div
          data-component="pressure-gauge-container"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            width: '120px',
          }}
        >
          <PressureGauge pressure={pressure} />
        </div>

        {/* Passenger cards - show all non-delivered passengers */}
        {nonDeliveredPassengers.length > 0 && (
          <div
            data-component="passenger-list"
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '8px',
              zIndex: 1000,
              maxHeight: 'calc(100vh - 40px)',
              overflowY: 'auto',
            }}
          >
            {nonDeliveredPassengers.map((passenger) => (
              <PassengerCard
                key={passenger.id}
                passenger={passenger}
                originStation={stations.find((s) => s.id === passenger.originStationId)}
                destinationStation={stations.find((s) => s.id === passenger.destinationStationId)}
              />
            ))}
          </div>
        )}

        {/* Question Display - centered at bottom, equation-focused */}
        {currentQuestion && (
          <div
            data-component="sprint-question-display"
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.98)',
              borderRadius: '24px',
              padding: '28px 50px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 5px rgba(59, 130, 246, 0.4)',
              backdropFilter: 'blur(12px)',
              border: '4px solid rgba(255, 255, 255, 0.95)',
              zIndex: 1000,
            }}
          >
            {/* Complement equation as main focus */}
            <div
              data-element="sprint-question-equation"
              style={{
                fontSize: '96px',
                fontWeight: 'bold',
                color: '#1f2937',
                lineHeight: '1.1',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '16px',
                  minWidth: '140px',
                  display: 'inline-block',
                  textShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
                }}
              >
                {currentInput || '?'}
              </span>
              <span style={{ color: '#6b7280' }}>+</span>
              {currentQuestion.showAsAbacus ? (
                <div
                  style={{
                    transform: 'scale(2.4) translateY(8%)',
                    transformOrigin: 'center center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AbacusTarget number={currentQuestion.number} />
                </div>
              ) : (
                <span>{currentQuestion.number}</span>
              )}
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#10b981' }}>{currentQuestion.targetSum}</span>
            </div>
          </div>
        )}
      </>
    )
  }
)

GameHUD.displayName = 'GameHUD'
