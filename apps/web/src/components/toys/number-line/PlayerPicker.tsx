'use client'

import { useState } from 'react'
import { useGameMode, type Player } from '@/contexts/GameModeContext'

/**
 * Lightweight player picker for the number line nav bar.
 * Shows the active player's emoji + name, or a "Select player" prompt.
 * Tapping opens a small dropdown to switch players.
 */
export function PlayerPicker({ isDark }: { isDark: boolean }) {
  const { getAllPlayers, getActivePlayers, setActive, isLoading } = useGameMode()
  const [open, setOpen] = useState(false)

  const allPlayers = getAllPlayers()
  const activePlayers = getActivePlayers()
  const activePlayer = activePlayers.length === 1 ? activePlayers[0] : null

  if (isLoading || allPlayers.length === 0) return null

  const textColor = isDark ? '#d1d5db' : '#374151'
  const mutedColor = isDark ? '#9ca3af' : '#6b7280'
  const bgHover = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'
  const dropdownBg = isDark ? '#1f2937' : '#ffffff'
  const dropdownBorder = isDark ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.8)'

  const handleSelect = (player: Player) => {
    // Deactivate all, activate selected
    for (const p of allPlayers) {
      if (p.isActive && p.id !== player.id) setActive(p.id, false)
    }
    if (!player.isActive) setActive(player.id, true)
    setOpen(false)
  }

  return (
    <div data-component="player-picker" style={{ position: 'relative' }}>
      <button
        data-action="toggle-player-picker"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          border: 'none',
          background: 'transparent',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
          color: textColor,
          transition: 'background 0.15s',
        }}
        onPointerEnter={e => { e.currentTarget.style.background = bgHover }}
        onPointerLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {activePlayer ? (
          <>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{activePlayer.emoji}</span>
            <span>{activePlayer.name}</span>
          </>
        ) : (
          <span style={{ color: mutedColor }}>Select player</span>
        )}
        <span style={{ fontSize: 10, color: mutedColor, marginLeft: 2 }}>▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />
          {/* Dropdown */}
          <div
            data-element="player-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: dropdownBg,
              border: `1px solid ${dropdownBorder}`,
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            {allPlayers.map(p => (
              <button
                key={p.id}
                data-action="select-player"
                onClick={() => handleSelect(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: activePlayer?.id === p.id
                    ? (isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)')
                    : 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: activePlayer?.id === p.id ? 600 : 400,
                  color: textColor,
                  transition: 'background 0.1s',
                }}
                onPointerEnter={e => {
                  if (activePlayer?.id !== p.id) e.currentTarget.style.background = bgHover
                }}
                onPointerLeave={e => {
                  if (activePlayer?.id !== p.id) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
