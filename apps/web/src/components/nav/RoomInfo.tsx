import { useState } from 'react'

interface RoomInfoProps {
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
  shouldEmphasize: boolean
}

/**
 * Displays current arcade room/session information in a compact inline format
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  shouldEmphasize,
}: RoomInfoProps) {
  const [copied, setCopied] = useState(false)

  const handleCodeClick = () => {
    if (!joinCode) return
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: 'rgba(59, 130, 246, 0.15)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        fontSize: '13px',
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.9)',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
      title="Active Arcade Room"
    >
      {/* Room icon and name */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '14px' }}>🎮</span>
        <span style={{ fontWeight: '600' }}>{roomName || gameName}</span>
      </span>

      {/* Join code with click-to-copy */}
      {joinCode && (
        <>
          <span style={{ opacity: 0.5 }}>•</span>
          <button
            type="button"
            onClick={handleCodeClick}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.95)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: '600',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
            title={copied ? 'Copied!' : 'Click to copy join code'}
          >
            {copied ? '✓ Copied' : joinCode}
          </button>
        </>
      )}

      {/* Player count */}
      <span style={{ opacity: 0.5 }}>•</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span style={{ fontSize: '12px' }}>👥</span>
        <span>{playerCount}</span>
      </span>
    </div>
  )
}
