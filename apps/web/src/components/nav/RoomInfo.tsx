import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useState } from 'react'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface RoomInfoProps {
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
  shouldEmphasize: boolean
  gameMode: GameMode
  modeColor: string
  modeEmoji: string
  modeLabel: string
  navTitle: string
  navEmoji?: string
  onSetup?: () => void
  onNewGame?: () => void
  onQuit?: () => void
}

/**
 * Displays current arcade room/session with unified dropdown for join code + game menu
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  shouldEmphasize,
  gameMode,
  modeColor,
  modeEmoji,
  modeLabel,
  navTitle,
  navEmoji,
  onSetup,
  onNewGame,
  onQuit,
}: RoomInfoProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const handleCodeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!joinCode) return
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  const displayName = roomName || gameName

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '3px',
                padding: '5px 12px',
                background: `linear-gradient(135deg, ${modeColor}15, ${modeColor}10)`,
                borderRadius: '8px',
                border: `2px solid ${modeColor}40`,
                transition: 'all 0.2s ease',
                lineHeight: 1,
              }}
            >
              {/* Top: Game name with dropdown indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: 'rgba(255, 255, 255, 0.95)',
                  lineHeight: 1,
                }}
              >
                <span style={{ lineHeight: 1 }}>
                  {navEmoji && `${navEmoji} `}
                  {navTitle}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: 1,
                  }}
                >
                  ▼
                </span>
              </div>

              {/* Middle: Mode indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: modeColor,
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: '11px', lineHeight: 1 }}>{modeEmoji}</span>
                <span style={{ lineHeight: 1 }}>{modeLabel}</span>
              </div>

              {/* Bottom: Room name */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.75)',
                  lineHeight: 1,
                }}
              >
                {displayName}
              </div>
            </div>
          </button>
        </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={8}
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',
            minWidth: '200px',
            zIndex: 9999,
            animation: 'dropdownFadeIn 0.2s ease-out',
          }}
        >
          {/* Join code section */}
          {joinCode && (
            <>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'rgba(196, 181, 253, 0.7)',
                  marginBottom: '6px',
                  marginLeft: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Room Join Code
              </div>
              <button
                type="button"
                onClick={handleCodeClick}
                style={{
                  width: '100%',
                  background: copied
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.3))'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.3))',
                  border: copied
                    ? '2px solid rgba(34, 197, 94, 0.5)'
                    : '2px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: copied ? 'rgba(134, 239, 172, 1)' : 'rgba(196, 181, 253, 1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  letterSpacing: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.4))'
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.3))'
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
                  }
                }}
              >
                {copied ? (
                  <>
                    <span style={{ fontSize: '14px' }}>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <span>{joinCode}</span>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>📋</span>
                  </>
                )}
              </button>

              <DropdownMenu.Separator
                style={{
                  height: '1px',
                  background: 'rgba(75, 85, 99, 0.5)',
                  margin: '6px 0',
                }}
              />
            </>
          )}

          {/* Game menu items */}
          {onSetup && (
            <DropdownMenu.Item
              onSelect={onSetup}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>⚙️</span>
              <span>Setup</span>
            </DropdownMenu.Item>
          )}

          {onNewGame && (
            <DropdownMenu.Item
              onSelect={onNewGame}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(147, 197, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>🎮</span>
              <span>New Game</span>
            </DropdownMenu.Item>
          )}

          {onQuit && (
            <>
              {(onSetup || onNewGame) && (
                <DropdownMenu.Separator
                  style={{
                    height: '1px',
                    background: 'rgba(75, 85, 99, 0.5)',
                    margin: '4px 0',
                  }}
                />
              )}
              <DropdownMenu.Item
                onSelect={onQuit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(209, 213, 219, 1)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(251, 146, 60, 0.2)'
                  e.currentTarget.style.color = 'rgba(253, 186, 116, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
                }}
              >
                <span style={{ fontSize: '16px' }}>🏟️</span>
                <span>Quit to Arcade</span>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dropdownFadeIn {
              from {
                opacity: 0;
                transform: translateY(-4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </DropdownMenu.Root>
  )
}
