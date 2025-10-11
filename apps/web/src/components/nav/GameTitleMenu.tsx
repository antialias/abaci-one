import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import React from 'react'

interface GameTitleMenuProps {
  navTitle: string
  navEmoji?: string
  onSetup?: () => void
  onNewGame?: () => void
  onQuit?: () => void
  showMenu: boolean
}

export function GameTitleMenu({
  navTitle,
  navEmoji,
  onSetup,
  onNewGame,
  onQuit,
  showMenu,
}: GameTitleMenuProps) {
  const [open, setOpen] = React.useState(false)

  // Don't show dropdown if no menu items
  if (!showMenu) {
    return (
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
          backgroundClip: 'text',
          color: 'transparent',
          margin: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {navEmoji && `${navEmoji} `}
        {navTitle}
      </h1>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            border: 'none',
            padding: '6px 10px',
            margin: '-6px -10px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '8px',
            background: open ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!open) {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)'
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {navEmoji && `${navEmoji} `}
            {navTitle}
          </span>
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(139, 92, 246, 0.5)',
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              lineHeight: 0,
            }}
          >
            ▼
          </span>
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
            padding: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',
            minWidth: '180px',
            zIndex: 9999,
            animation: 'dropdownFadeIn 0.2s ease-out',
          }}
        >
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
