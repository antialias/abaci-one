'use client'

import { memo } from 'react'
import type { Passenger, Station } from '../lib/gameTypes'

interface PassengerCardProps {
  passenger: Passenger
  originStation: Station | undefined
  destinationStation: Station | undefined
}

export const PassengerCard = memo(function PassengerCard({ passenger, originStation, destinationStation }: PassengerCardProps) {
  if (!destinationStation || !originStation) return null

  // Vintage train station colors
  const bgColor = passenger.isDelivered
    ? '#1a3a1a' // Dark green for delivered
    : !passenger.isBoarded
    ? '#2a2419' // Dark brown/sepia for waiting
    : passenger.isUrgent
    ? '#3a2419' // Dark red-brown for urgent
    : '#1a2a3a' // Dark blue for aboard

  const accentColor = passenger.isDelivered
    ? '#4ade80' // Green
    : !passenger.isBoarded
    ? '#d4af37' // Gold for waiting
    : passenger.isUrgent
    ? '#ff6b35' // Orange-red for urgent
    : '#60a5fa' // Blue for aboard

  const borderColor = passenger.isUrgent && passenger.isBoarded && !passenger.isDelivered
    ? '#ff6b35'
    : '#d4af37'

  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '4px',
        padding: '8px 10px',
        minWidth: '220px',
        maxWidth: '280px',
        boxShadow: passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded
          ? '0 0 16px rgba(255, 107, 53, 0.5)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        fontFamily: '"Courier New", Courier, monospace',
        animation: passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded
          ? 'urgentFlicker 1.5s ease-in-out infinite'
          : 'none',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Top row: Passenger info and status */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '6px',
        borderBottom: `1px solid ${accentColor}33`,
        paddingBottom: '4px',
        paddingRight: '42px' // Make room for points badge
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1
        }}>
          <div style={{ fontSize: '20px', lineHeight: '1' }}>
            {passenger.isDelivered ? '✅' : passenger.avatar}
          </div>
          <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: accentColor,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            {passenger.name}
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          fontSize: '9px',
          color: accentColor,
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          background: `${accentColor}22`,
          padding: '2px 6px',
          borderRadius: '2px',
          border: `1px solid ${accentColor}66`,
          whiteSpace: 'nowrap',
          marginTop: '0'
        }}>
          {passenger.isDelivered ? 'DLVRD' : passenger.isBoarded ? 'BOARD' : 'WAIT'}
        </div>
      </div>

      {/* Route information */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        fontSize: '10px',
        color: '#e8d4a0'
      }}>
        {/* From station */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            color: accentColor,
            fontSize: '8px',
            fontWeight: 'bold',
            width: '28px',
            letterSpacing: '0.3px'
          }}>
            FROM:
          </span>
          <span style={{ fontSize: '14px', lineHeight: '1' }}>
            {originStation.icon}
          </span>
          <span style={{
            fontWeight: '600',
            fontSize: '10px',
            letterSpacing: '0.3px'
          }}>
            {originStation.name}
          </span>
        </div>

        {/* To station */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            color: accentColor,
            fontSize: '8px',
            fontWeight: 'bold',
            width: '28px',
            letterSpacing: '0.3px'
          }}>
            TO:
          </span>
          <span style={{ fontSize: '14px', lineHeight: '1' }}>
            {destinationStation.icon}
          </span>
          <span style={{
            fontWeight: '600',
            fontSize: '10px',
            letterSpacing: '0.3px'
          }}>
            {destinationStation.name}
          </span>
        </div>
      </div>

      {/* Points badge */}
      {!passenger.isDelivered && (
        <div style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          background: `${accentColor}33`,
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 'bold',
          color: accentColor,
          letterSpacing: '0.5px'
        }}>
          {passenger.isUrgent ? '+20' : '+10'}
        </div>
      )}

      {/* Urgent indicator */}
      {passenger.isUrgent && !passenger.isDelivered && passenger.isBoarded && (
        <div style={{
          position: 'absolute',
          left: '8px',
          bottom: '6px',
          fontSize: '10px',
          animation: 'urgentBlink 0.8s ease-in-out infinite',
          filter: 'drop-shadow(0 0 4px rgba(255, 107, 53, 0.8))'
        }}>
          ⚠️
        </div>
      )}

      <style>{`
        @keyframes urgentFlicker {
          0%, 100% {
            box-shadow: 0 0 16px rgba(255, 107, 53, 0.5);
            border-color: #ff6b35;
          }
          50% {
            box-shadow: 0 0 24px rgba(255, 107, 53, 0.8);
            border-color: #ffaa35;
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
})
