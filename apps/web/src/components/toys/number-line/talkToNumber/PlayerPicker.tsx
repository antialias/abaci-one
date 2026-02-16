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

  // Show all non-archived players (isActive is an arcade-specific flag, not relevant here)
  const visiblePlayers = players?.filter(p => !p.isArchived) ?? []

  // If no players exist, render nothing — anonymous-only, no picker needed
  if (visiblePlayers.length === 0) return null

  const selectedPlayer = selectedPlayerId
    ? visiblePlayers.find(p => p.id === selectedPlayerId)
    : null

  const label = selectedPlayer
    ? `${selectedPlayer.emoji || '👤'} ${selectedPlayer.name}`
    : '👤 Who\'s playing?'

  const themeClass = isDark ? 'player-picker-dark' : 'player-picker-light'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-component="player-picker"
          className={themeClass}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            fontSize: '14px',
            fontWeight: 500,
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
          className={themeClass}
          data-component="player-picker-menu"
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions
        >
          {visiblePlayers.map(player => (
            <DropdownMenu.Item
              key={player.id}
              data-action="select-player"
              data-player-id={player.id}
              data-selected={selectedPlayerId === player.id || undefined}
              textValue={player.name}
              onSelect={() => onSelect(player.id)}
            >
              <span>{player.emoji || '👤'}</span>
              <span>{player.name}</span>
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator />

          <DropdownMenu.Item
            data-action="select-anonymous"
            data-selected={selectedPlayerId === null || undefined}
            textValue="Just exploring"
            onSelect={() => onSelect(null)}
            style={{ fontStyle: 'italic' }}
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

            /* Trigger button */
            [data-component="player-picker"]:hover:not(:disabled) {
              filter: brightness(1.1);
            }

            /* Content panel */
            [data-component="player-picker-menu"] {
              min-width: 160px;
              max-height: var(--radix-dropdown-menu-content-available-height, 300px);
              overflow-y: auto;
              padding: 4px;
              border-radius: 10px;
              backdrop-filter: blur(12px);
              z-index: 9999;
              animation: playerPickerFadeIn 0.15s ease-out;
            }

            /* Light theme */
            .player-picker-light[data-component="player-picker"] {
              color: rgba(55, 65, 81, 1);
              background: rgba(229, 231, 235, 0.7);
              border: 1px solid rgba(209, 213, 219, 0.8);
            }
            .player-picker-light[data-component="player-picker"]:disabled {
              color: rgba(107, 114, 128, 0.5);
            }
            .player-picker-light[data-component="player-picker-menu"] {
              background: rgba(255, 255, 255, 0.97);
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(229, 231, 235, 0.8);
            }
            .player-picker-light [role="menuitem"] {
              color: rgba(55, 65, 81, 1);
            }
            .player-picker-light [role="menuitem"][data-highlighted] {
              background: rgba(229, 231, 235, 0.7);
            }
            .player-picker-light [role="menuitem"][data-selected] {
              font-weight: 600;
              background: rgba(229, 231, 235, 0.5);
            }
            .player-picker-light [role="menuitem"][data-action="select-anonymous"] {
              color: rgba(107, 114, 128, 1);
            }
            .player-picker-light [role="separator"] {
              height: 1px;
              margin: 4px 8px;
              background: rgba(229, 231, 235, 0.8);
            }

            /* Dark theme */
            .player-picker-dark[data-component="player-picker"] {
              color: rgba(209, 213, 219, 1);
              background: rgba(55, 65, 81, 0.5);
              border: 1px solid rgba(75, 85, 99, 0.5);
            }
            .player-picker-dark[data-component="player-picker"]:disabled {
              color: rgba(156, 163, 175, 0.5);
            }
            .player-picker-dark[data-component="player-picker-menu"] {
              background: rgba(17, 24, 39, 0.97);
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(75, 85, 99, 0.3);
            }
            .player-picker-dark [role="menuitem"] {
              color: rgba(209, 213, 219, 1);
            }
            .player-picker-dark [role="menuitem"][data-highlighted] {
              background: rgba(75, 85, 99, 0.5);
            }
            .player-picker-dark [role="menuitem"][data-selected] {
              font-weight: 600;
              background: rgba(55, 65, 81, 0.5);
            }
            .player-picker-dark [role="menuitem"][data-action="select-anonymous"] {
              color: rgba(156, 163, 175, 1);
            }
            .player-picker-dark [role="separator"] {
              height: 1px;
              margin: 4px 8px;
              background: rgba(75, 85, 99, 0.4);
            }

            /* Shared item styles */
            [data-component="player-picker-menu"] [role="menuitem"] {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              font-size: 14px;
              border-radius: 6px;
              cursor: pointer;
              outline: none;
              user-select: none;
            }
          `,
        }}
      />
    </DropdownMenu.Root>
  )
}
