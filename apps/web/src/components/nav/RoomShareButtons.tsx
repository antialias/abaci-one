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
    <>
      <CopyButton
        text={joinCode}
        variant="code"
        label={
          <>
            <span>📋</span>
            <span>{joinCode}</span>
          </>
        }
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
      />

      <QRCodeButton url={shareUrl} />
    </>
  )
}
