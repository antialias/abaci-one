import * as Tooltip from '@radix-ui/react-tooltip'
import { useState } from 'react'

interface RoomInfoProps {
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
  shouldEmphasize: boolean
}

/**
 * Displays current arcade room/session information with tooltip for join code
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  shouldEmphasize,
}: RoomInfoProps) {
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleCodeClick = () => {
    if (!joinCode) return
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setIsOpen(false)
    }, 1500)
  }

  const displayName = roomName || gameName

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip.Trigger asChild>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              background: 'rgba(139, 92, 246, 0.15)',
              borderRadius: '6px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: '11px',
              fontWeight: '600',
              color: 'rgba(196, 181, 253, 1)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              cursor: joinCode ? 'pointer' : 'default',
            }}
            onMouseEnter={() => joinCode && setIsOpen(true)}
            onMouseLeave={() => !copied && setIsOpen(false)}
          >
            {/* Room name only */}
            <span>{displayName}</span>
          </div>
        </Tooltip.Trigger>

        {joinCode && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="bottom"
              sideOffset={8}
              style={{
                background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',
                maxWidth: '280px',
                zIndex: 9999,
                animation: 'tooltipFadeIn 0.2s ease-out',
              }}
            >
              {/* Join code label */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'rgba(196, 181, 253, 0.8)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Room Join Code
              </div>

              {/* Click-to-copy button */}
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
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: copied ? 'rgba(134, 239, 172, 1)' : 'rgba(196, 181, 253, 1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  letterSpacing: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
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
                    <span style={{ fontSize: '16px' }}>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <span>{joinCode}</span>
                    <span style={{ fontSize: '14px', opacity: 0.7 }}>📋</span>
                  </>
                )}
              </button>

              {/* Helper text */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(156, 163, 175, 0.8)',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                {copied ? 'Share this code with friends!' : 'Click to copy'}
              </div>

              <Tooltip.Arrow
                style={{
                  fill: 'rgba(17, 24, 39, 0.97)',
                }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tooltipFadeIn {
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
    </Tooltip.Provider>
  )
}
