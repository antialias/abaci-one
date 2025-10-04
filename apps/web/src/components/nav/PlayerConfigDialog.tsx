import React, { useState } from 'react'
import { useGameMode } from '../../contexts/GameModeContext'
import { EmojiPicker } from '../../app/games/matching/components/EmojiPicker'

interface PlayerConfigDialogProps {
  playerId: string
  onClose: () => void
}

export function PlayerConfigDialog({ playerId, onClose }: PlayerConfigDialogProps) {
  const { getPlayer, updatePlayer } = useGameMode()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const player = getPlayer(playerId)

  if (!player) {
    return null
  }

  const [tempName, setTempName] = useState(player.name)

  const handleSave = () => {
    updatePlayer(playerId, { name: tempName })
    onClose()
  }

  const handleEmojiSelect = (emoji: string) => {
    updatePlayer(playerId, { emoji })
    setShowEmojiPicker(false)
  }

  // Get player number for UI theming (first 4 players get special colors)
  const allPlayers = Array.from(useGameMode().players.values()).sort((a, b) => a.createdAt - b.createdAt)
  const playerIndex = allPlayers.findIndex(p => p.id === playerId)
  const displayNumber = playerIndex + 1

  // Color based on player's actual color
  const gradientColor = player.color

  if (showEmojiPicker) {
    return (
      <EmojiPicker
        currentEmoji={player.emoji}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setShowEmojiPicker(false)}
        playerNumber={displayNumber}
      />
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            background: `linear-gradient(135deg, ${gradientColor}, ${gradientColor}dd)`,
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0
          }}>
            Configure Player
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              lineHeight: 1
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            ✕
          </button>
        </div>

        {/* Emoji Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Character
          </label>
          <button
            onClick={() => setShowEmojiPicker(true)}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = gradientColor
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              fontSize: '48px',
              lineHeight: 1
            }}>
              {player.emoji}
            </div>
            <div style={{
              flex: 1,
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '4px'
              }}>
                Click to change character
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                Choose from hundreds of emojis
              </div>
            </div>
            <div style={{
              fontSize: '20px',
              color: '#9ca3af'
            }}>
              →
            </div>
          </button>
        </div>

        {/* Name Input */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Name
          </label>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Player Name"
            maxLength={20}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              outline: 'none',
              transition: 'all 0.2s ease',
              fontWeight: '500'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = gradientColor
              e.currentTarget.style.boxShadow = `0 0 0 3px ${gradientColor}20`
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px',
            textAlign: 'right'
          }}>
            {tempName.length}/20 characters
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px',
              background: `linear-gradient(135deg, ${gradientColor}, ${gradientColor}dd)`,
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
