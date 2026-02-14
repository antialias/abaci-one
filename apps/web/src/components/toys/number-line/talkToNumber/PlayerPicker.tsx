'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useUserPlayers } from '@/hooks/useUserPlayers'

interface PlayerPickerProps {
  selectedPlayerId: string | null // null = anonymous
  onSelect: (playerId: string | null) => void
  disabled?: boolean // true during active calls
  isDark?: boolean
}

export function PlayerPicker({ selectedPlayerId, onSelect, disabled, isDark }: PlayerPickerProps) {
  const { data: players } = useUserPlayers()

  // Only show active players
  const activePlayers = players?.filter(p => p.isActive && !p.isArchived) ?? []

  // If no players exist, render nothing — anonymous-only, no picker needed
  if (activePlayers.length === 0) return null

  const selectedPlayer = selectedPlayerId
    ? activePlayers.find(p => p.id === selectedPlayerId)
    : null

  const label = selectedPlayer
    ? `${selectedPlayer.emoji || '👤'} ${selectedPlayer.name}`
    : '👤 Who\'s playing?'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-component="player-picker"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            fontSize: '14px',
            fontWeight: 500,
            color: disabled
              ? (isDark ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)')
              : (isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)'),
            background: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.7)',
            border: isDark ? '1px solid rgba(75, 85, 99, 0.5)' : '1px solid rgba(209, 213, 219, 0.8)',
            borderRadius: '16px',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          {!disabled && (
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          style={{
            background: isDark
              ? 'rgba(17, 24, 39, 0.97)'
              : 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(12px)',
            borderRadius: '10px',
            padding: '4px',
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(75, 85, 99, 0.3)'
              : '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(229, 231, 235, 0.8)',
            minWidth: '160px',
            zIndex: 9999,
            animation: 'playerPickerFadeIn 0.15s ease-out',
          }}
        >
          {activePlayers.map(player => (
            <DropdownMenu.Item
              key={player.id}
              data-action="select-player"
              data-player-id={player.id}
              onSelect={() => onSelect(player.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '14px',
                color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
                borderRadius: '6px',
                cursor: 'pointer',
                outline: 'none',
                fontWeight: selectedPlayerId === player.id ? 600 : 400,
                background: selectedPlayerId === player.id
                  ? (isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)')
                  : 'transparent',
              }}
            >
              <span>{player.emoji || '👤'}</span>
              <span>{player.name}</span>
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator
            style={{
              height: '1px',
              margin: '4px 8px',
              background: isDark ? 'rgba(75, 85, 99, 0.4)' : 'rgba(229, 231, 235, 0.8)',
            }}
          />

          <DropdownMenu.Item
            data-action="select-anonymous"
            onSelect={() => onSelect(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              color: isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(107, 114, 128, 1)',
              borderRadius: '6px',
              cursor: 'pointer',
              outline: 'none',
              fontStyle: 'italic',
              fontWeight: selectedPlayerId === null ? 600 : 400,
              background: selectedPlayerId === null
                ? (isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)')
                : 'transparent',
            }}
          >
            <span>🔍</span>
            <span>Just exploring</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes playerPickerFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            [data-component="player-picker"]:hover:not(:disabled) {
              filter: brightness(1.1);
            }
          `,
        }}
      />
    </DropdownMenu.Root>
  )
}
