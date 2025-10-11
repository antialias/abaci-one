import * as Tooltip from '@radix-ui/react-tooltip'

interface RoomInfoProps {
  roomName?: string
  gameName: string
  playerCount: number
  joinCode?: string
  shouldEmphasize: boolean
}

/**
 * Displays current arcade room/session information in a minimal format
 * Shows join code in a tooltip on hover
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  shouldEmphasize,
}: RoomInfoProps) {
  const displayName = roomName || gameName

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: shouldEmphasize ? '14px' : '13px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              cursor: joinCode ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: shouldEmphasize ? '16px' : '14px' }}>🎮</span>
            <span>{displayName}</span>
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: shouldEmphasize ? '13px' : '12px',
              }}
            >
              ({playerCount})
            </span>
          </div>
        </Tooltip.Trigger>
        {joinCode && (
          <Tooltip.Portal>
            <Tooltip.Content
              side="bottom"
              sideOffset={8}
              style={{
                background:
                  'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                zIndex: 9999,
                animation: 'tooltipFadeIn 0.2s ease-out',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'rgba(209, 213, 219, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '6px',
                }}
              >
                Join Code
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  padding: '8px 12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {joinCode}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(209, 213, 219, 0.6)',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                Share this code to invite others
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
