import * as Popover from '@radix-ui/react-popover'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useClipboard } from '@/hooks/useClipboard'
import { Z_INDEX } from '@/constants/zIndex'

export interface QRCodeButtonProps {
  /**
   * The URL to encode in the QR code and display
   */
  url: string

  /**
   * Optional custom styles for the trigger button
   */
  style?: CSSProperties
}

/**
 * Button that opens a popover with a QR code for the share link
 * Includes the URL text with a copy button
 */
export function QRCodeButton({ url, style }: QRCodeButtonProps) {
  const [open, setOpen] = useState(false)
  const { copied, copy } = useClipboard()

  const buttonStyles: CSSProperties = {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(251, 146, 60, 0.4)',
    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 146, 60, 0.3))',
    borderRadius: '8px',
    padding: '4px',
    fontSize: '16px',
    color: 'rgba(253, 186, 116, 1)',
    height: '100%',
    aspectRatio: '1',
    flexShrink: 0,
    ...style,
  }

  const hoverStyles: CSSProperties = {
    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.3), rgba(251, 146, 60, 0.4))',
    borderColor: 'rgba(251, 146, 60, 0.6)',
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          style={buttonStyles}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, hoverStyles)
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, buttonStyles)
          }}
        >
          <QRCodeSVG value={url} size={72} level="L" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="center"
          side="bottom"
          sideOffset={8}
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '2px solid rgba(251, 146, 60, 0.4)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: Z_INDEX.GAME_NAV.HAMBURGER_NESTED_DROPDOWN,
            maxWidth: '320px',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'rgba(253, 186, 116, 1)',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            Scan to Join
          </div>

          {/* QR Code */}
          <div
            style={{
              background: 'white',
              padding: '16px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <QRCodeSVG value={url} size={200} level="H" />
          </div>

          {/* URL with copy button */}
          <div
            style={{
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(209, 213, 219, 0.7)',
                marginBottom: '6px',
                textAlign: 'center',
              }}
            >
              Or copy link:
            </div>
            <button
              type="button"
              onClick={() => copy(url)}
              style={{
                width: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: copied
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.3))'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.3))',
                border: copied
                  ? '2px solid rgba(34, 197, 94, 0.5)'
                  : '2px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: '600',
                color: copied ? 'rgba(134, 239, 172, 1)' : 'rgba(147, 197, 253, 1)',
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.4))'
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.3))'
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                }
              }}
            >
              {copied ? (
                <>
                  <span style={{ fontSize: '12px' }}>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '12px' }}>🔗</span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                    }}
                  >
                    {url}
                  </span>
                </>
              )}
            </button>
          </div>

          <Popover.Arrow
            style={{
              fill: 'rgba(251, 146, 60, 0.4)',
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
