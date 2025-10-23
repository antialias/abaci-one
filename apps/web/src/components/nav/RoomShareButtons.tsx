import { CopyButton } from '@/components/common/CopyButton'
import { QRCodeButton } from '@/components/common/QRCodeButton'

export interface RoomShareButtonsProps {
  /**
   * The room join code (e.g., "ABC123")
   */
  joinCode: string

  /**
   * The full shareable URL for the room
   */
  shareUrl: string
}

/**
 * Reusable component for sharing room join code and link
 * Used in both RoomInfo dropdown and AddPlayerButton's Invite tab
 */
export function RoomShareButtons({ joinCode, shareUrl }: RoomShareButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
      {/* Left side: stacked buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <CopyButton
          text={joinCode}
          variant="code"
          label={
            <>
              <span>📋</span>
              <span>{joinCode}</span>
            </>
          }
          style={{ marginBottom: 0 }}
        />

        <CopyButton
          text={shareUrl}
          variant="link"
          label={
            <>
              <span>🔗</span>
              <span>Share Link</span>
            </>
          }
          copiedLabel="Link Copied!"
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* Right side: QR code button */}
      <QRCodeButton url={shareUrl} />
    </div>
  )
}
