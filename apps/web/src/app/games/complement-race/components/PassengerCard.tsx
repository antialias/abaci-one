'use client'

import type { Passenger, Station } from '../lib/gameTypes'

interface PassengerCardProps {
  passenger: Passenger
  destinationStation: Station | undefined
}

export function PassengerCard({ passenger, destinationStation }: PassengerCardProps) {
  if (!destinationStation) return null

  return (
    <div
      style={{
        background: passenger.isDelivered
          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
          : !passenger.isBoarded
          ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'  // Gray for waiting
          : passenger.isUrgent
          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded
          ? '0 0 20px rgba(245, 158, 11, 0.6)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        minWidth: '180px',
        position: 'relative',
        opacity: passenger.isDelivered ? 0.6 : !passenger.isBoarded ? 0.8 : 1,
        animation: passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded ? 'urgentPulse 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Passenger icon and name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px'
      }}>
        <div style={{ fontSize: '32px' }}>
          {passenger.isDelivered ? '✅' : passenger.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            {passenger.name}
          </div>
          {/* Status badge */}
          {!passenger.isDelivered && (
            <div style={{
              fontSize: '10px',
              marginTop: '2px',
              opacity: 0.9,
              fontWeight: '600'
            }}>
              {passenger.isBoarded ? '🚂 ABOARD' : '⏳ WAITING'}
            </div>
          )}
        </div>
        {passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded && (
          <div style={{
            fontSize: '16px',
            animation: 'urgentBlink 0.8s ease-in-out infinite'
          }}>
            ⚠️
          </div>
        )}
      </div>

      {/* Destination */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '14px',
        opacity: 0.95
      }}>
        <span>→</span>
        <span>{destinationStation.icon}</span>
        <span style={{ fontWeight: '600' }}>{destinationStation.name}</span>
      </div>

      {/* Points indicator */}
      {!passenger.isDelivered && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
          padding: '2px 8px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {passenger.isUrgent ? '+20' : '+10'}
        </div>
      )}

      <style>{`
        @keyframes urgentPulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.6);
          }
          50% {
            box-shadow: 0 0 30px rgba(245, 158, 11, 0.9);
          }
        }

        @keyframes urgentBlink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  )
}