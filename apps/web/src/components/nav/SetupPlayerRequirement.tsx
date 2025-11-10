import React from 'react'
import { InvitePlayersTab } from './InvitePlayersTab'

interface Player {
  id: string
  name: string
  emoji: string
}

interface SetupPlayerRequirementProps {
  minPlayers: number
  currentPlayers: Player[]
  inactivePlayers: Player[]
  onAddPlayer: (playerId: string) => void
  onConfigurePlayer: (playerId: string) => void
  gameTitle: string
}

/**
 * Prominent player requirement component shown during setup when not enough players are active.
 * Forces the user to add more players before proceeding with setup.
 */
export function SetupPlayerRequirement({
  minPlayers,
  currentPlayers,
  inactivePlayers,
  onAddPlayer,
  onConfigurePlayer,
  gameTitle,
}: SetupPlayerRequirementProps) {
  const [activeTab, setActiveTab] = React.useState<'add' | 'invite'>('add')
  const needsPlayers = currentPlayers.length < minPlayers
  const playersNeeded = minPlayers - currentPlayers.length

  if (!needsPlayers) {
    return null
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto 32px auto',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(167, 139, 250, 0.15))',
        borderRadius: '16px',
        border: '3px solid rgba(96, 165, 250, 0.4)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '24px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {gameTitle} needs {playersNeeded} more {playersNeeded === 1 ? 'player' : 'players'}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: '#64748b',
            fontWeight: '500',
          }}
        >
          Add local players or invite friends to join
        </p>
      </div>

      {/* Tab selector */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '700',
            borderRadius: '8px',
            border: activeTab === 'add' ? '2px solid #60a5fa' : '2px solid transparent',
            background: activeTab === 'add' ? '#60a5fa' : 'rgba(255, 255, 255, 0.5)',
            color: activeTab === 'add' ? 'white' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Add Local Player
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invite')}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '700',
            borderRadius: '8px',
            border: activeTab === 'invite' ? '2px solid #a78bfa' : '2px solid transparent',
            background: activeTab === 'invite' ? '#a78bfa' : 'rgba(255, 255, 255, 0.5)',
            color: activeTab === 'invite' ? 'white' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Invite Players
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'add' ? (
        // Add local player tab
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '12px',
          }}
        >
          {inactivePlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p
                style={{
                  margin: '0 0 12px 0',
                  color: '#64748b',
                  fontSize: '14px',
                }}
              >
                No inactive players available
              </p>
              <button
                type="button"
                onClick={() => onConfigurePlayer('new')}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  border: '2px solid #60a5fa',
                  background: '#60a5fa',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Create New Player
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '16px',
                justifyItems: 'center',
              }}
            >
              {inactivePlayers.map((player) => (
                <div
                  key={player.id}
                  onClick={() => onAddPlayer(player.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'white',
                    border: '2px solid rgba(96, 165, 250, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.borderColor = '#60a5fa'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(96, 165, 250, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontSize: '48px', lineHeight: 1 }}>{player.emoji}</div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1e293b',
                      textAlign: 'center',
                      wordBreak: 'break-word',
                    }}
                  >
                    {player.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Invite players tab
        <div
          style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '12px',
          }}
        >
          <InvitePlayersTab />
        </div>
      )}
    </div>
  )
}
