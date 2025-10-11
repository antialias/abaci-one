import React from 'react'

interface Player {
  id: string
  name: string
  emoji: string
}

interface AddPlayerButtonProps {
  inactivePlayers: Player[]
  shouldEmphasize: boolean
  onAddPlayer: (playerId: string) => void
}

export function AddPlayerButton({
  inactivePlayers,
  shouldEmphasize,
  onAddPlayer,
}: AddPlayerButtonProps) {
  const [showPopover, setShowPopover] = React.useState(false)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false)
      }
    }

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

  const handleAddPlayerClick = (playerId: string) => {
    onAddPlayer(playerId)
    setShowPopover(false)
  }

  if (!shouldEmphasize || inactivePlayers.length === 0) {
    return null
  }

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        style={{
          fontSize: shouldEmphasize ? '36px' : '36px',
          width: shouldEmphasize ? '56px' : '56px',
          height: shouldEmphasize ? '56px' : '56px',
          borderRadius: '50%',
          border: '3px solid #10b981',
          background: showPopover
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1))',
          color: showPopover ? 'white' : '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          padding: 0,
          lineHeight: 1,
          fontWeight: 'bold',
          boxShadow: showPopover
            ? '0 6px 16px rgba(16, 185, 129, 0.5)'
            : '0 6px 12px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={(e) => {
          if (!showPopover) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #10b981, #059669)'
            e.currentTarget.style.color = 'white'
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)'
          }
        }}
        onMouseLeave={(e) => {
          if (!showPopover) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1))'
            e.currentTarget.style.color = '#10b981'
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)'
          }
        }}
        title="Add player"
      >
        +
      </button>

      {/* Add Player Popover */}
      {showPopover && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            border: '2px solid #e5e7eb',
            padding: '12px',
            minWidth: '200px',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#374151',
              marginBottom: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            Add Player
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {inactivePlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => handleAddPlayerClick(player.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: '24px', lineHeight: 1 }}>{player.emoji}</span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1f2937',
                  }}
                >
                  {player.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
