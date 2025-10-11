interface RoomInfoProps {
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
  shouldEmphasize: boolean
}

/**
 * Displays current arcade room/session information
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  shouldEmphasize,
}: RoomInfoProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: shouldEmphasize ? '8px 16px' : '4px 12px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))',
        borderRadius: '12px',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        fontSize: shouldEmphasize ? '16px' : '14px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.95)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
      }}
      title="Active Arcade Session"
    >
      {/* Room icon */}
      <div
        style={{
          fontSize: shouldEmphasize ? '20px' : '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        🎮
      </div>

      {/* Room details */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div
          style={{
            fontSize: shouldEmphasize ? '14px' : '12px',
            opacity: 0.8,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {roomName ? 'Room' : 'Arcade Session'}
        </div>
        <div
          style={{
            fontSize: shouldEmphasize ? '16px' : '14px',
            fontWeight: 'bold',
          }}
        >
          {roomName || gameName}
        </div>
        {joinCode && (
          <div
            style={{
              fontSize: shouldEmphasize ? '12px' : '11px',
              opacity: 0.7,
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
            }}
          >
            Code: {joinCode}
          </div>
        )}
      </div>

      {/* Player count badge */}
      <div
        style={{
          marginLeft: '8px',
          padding: '4px 8px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          fontSize: shouldEmphasize ? '14px' : '12px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>👥</span>
        <span>{playerCount}</span>
      </div>
    </div>
  )
}
