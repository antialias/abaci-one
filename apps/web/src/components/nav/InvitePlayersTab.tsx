import { useCallback, useEffect, useRef, useState } from 'react'
import { useCreateRoom, useRoomData } from '@/hooks/useRoomData'
import { RoomShareButtons } from './RoomShareButtons'
import { HistoricalPlayersInvite } from './HistoricalPlayersInvite'

/**
 * Tab content for inviting players to a room
 *
 * Behavior:
 * - If user is already in a room: Shows share buttons immediately
 * - If user is NOT in a room: Lazily creates a room on mount, then shows share buttons
 * - Shows loading state during room creation
 * - Shows error state if room creation fails
 */
export function InvitePlayersTab() {
  const { roomData, isInRoom, getRoomShareUrl, isLoading: isRoomDataLoading } = useRoomData()
  const { mutateAsync: createRoom, isPending: isCreating } = useCreateRoom()
  const [error, setError] = useState<string | null>(null)
  const hasAttemptedCreation = useRef(false)

  // Lazy room creation: only create if not already in a room
  const createQuickRoom = useCallback(async () => {
    if (isRoomDataLoading || isInRoom || isCreating || hasAttemptedCreation.current) {
      return // Already in a room, loading, creating, or already attempted
    }

    hasAttemptedCreation.current = true
    setError(null)

    try {
      await createRoom({
        name: 'Quick Room',
        gameName: 'matching',
        creatorName: 'Player',
        gameConfig: { difficulty: 6, gameType: 'abacus-numeral', turnTimer: 30 },
      })
      // Room will be automatically updated in cache by the mutation's onSuccess
    } catch (err) {
      console.error('[InvitePlayersTab] Failed to create room:', err)
      setError(err instanceof Error ? err.message : 'Failed to create room')
      hasAttemptedCreation.current = false // Allow retry on error
    }
  }, [isRoomDataLoading, isInRoom, isCreating, createRoom])

  // Auto-create room on mount if not in one
  useEffect(() => {
    if (!isRoomDataLoading && !isInRoom && !isCreating && !error && !hasAttemptedCreation.current) {
      createQuickRoom()
    }
  }, [isRoomDataLoading, isInRoom, isCreating, error, createQuickRoom])

  // Loading state - show loading only if we're truly loading and not in a room yet
  if ((isRoomDataLoading || isCreating) && !isInRoom && !error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(139, 92, 246, 0.3)',
            borderTop: '3px solid rgba(139, 92, 246, 1)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div
          style={{
            fontSize: '13px',
            color: '#6b7280',
            fontWeight: '500',
          }}
        >
          Creating room...
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `,
          }}
        />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 16px',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <div
          style={{
            fontSize: '13px',
            color: '#ef4444',
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null)
            createQuickRoom()
          }}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.3))',
            border: '2px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '8px',
            color: '#8b5cf6',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.4))'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.3))'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
          }}
        >
          Try Again
        </button>
      </div>
    )
  }

  // Success state: Show room share buttons
  if (isInRoom && roomData) {
    const shareUrl = getRoomShareUrl(roomData.code)

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px 8px 8px',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '4px',
          }}
        >
          Share to invite players
        </div>
        <RoomShareButtons joinCode={roomData.code} shareUrl={shareUrl} />

        {/* Historical players who can be invited back */}
        <div style={{ marginTop: '8px' }}>
          <HistoricalPlayersInvite />
        </div>
      </div>
    )
  }

  // Fallback (should not reach here)
  return null
}
