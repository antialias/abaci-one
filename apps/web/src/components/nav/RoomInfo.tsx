import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLeaveRoom, useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { getRoomDisplayWithEmoji } from '@/utils/room-display'
import { CreateRoomModal } from './CreateRoomModal'
import { JoinRoomModal } from './JoinRoomModal'
import { ModerationPanel } from './ModerationPanel'
import { RoomShareButtons } from './RoomShareButtons'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface RoomInfoProps {
  roomName?: string | null
  gameName: string
  playerCount: number
  joinCode?: string
  roomId?: string
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
  onOpenModerationWithFocus?: (userId: string) => void
}

/**
 * Displays current arcade room/session with unified dropdown for join code + game menu
 */
export function RoomInfo({
  roomName,
  gameName,
  playerCount,
  joinCode,
  roomId,
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
  onOpenModerationWithFocus,
}: RoomInfoProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showModerationPanel, setShowModerationPanel] = useState(false)
  const [focusedUserId, setFocusedUserId] = useState<string | undefined>(undefined)
  const [pendingReportsCount, setPendingReportsCount] = useState(0)
  const [pendingJoinRequestsCount, setPendingJoinRequestsCount] = useState(0)
  const { getRoomShareUrl, roomData } = useRoomData()
  const { data: currentUserId } = useViewerId()
  const { mutateAsync: leaveRoom } = useLeaveRoom()

  // Use room display utility for consistent naming
  const displayName = joinCode
    ? getRoomDisplayWithEmoji({ name: roomName || null, code: joinCode, gameName })
    : roomName || gameName
  const shareUrl = joinCode ? getRoomShareUrl(joinCode) : ''

  // Determine ownership status
  const currentMember = roomData?.members.find((m) => m.userId === currentUserId)
  const isCurrentUserCreator = currentMember?.isCreator ?? false
  const creatorMember = roomData?.members.find((m) => m.isCreator)
  const creatorName = creatorMember?.displayName

  // Fetch pending reports count if user is host
  useEffect(() => {
    if (!isCurrentUserCreator || !roomId) return

    const fetchPendingReports = async () => {
      try {
        const res = await fetch(`/api/arcade/rooms/${roomId}/reports`)
        if (res.ok) {
          const data = await res.json()
          const pending = data.reports?.filter((r: any) => r.status === 'pending') || []
          setPendingReportsCount(pending.length)
        }
      } catch (error) {
        console.error('[RoomInfo] Failed to fetch reports:', error)
      }
    }

    fetchPendingReports()
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingReports, 30000)
    return () => clearInterval(interval)
  }, [isCurrentUserCreator, roomId])

  // Fetch pending join requests count if user is host
  useEffect(() => {
    if (!isCurrentUserCreator || !roomId) return

    const fetchPendingJoinRequests = async () => {
      try {
        const res = await fetch(`/api/arcade/rooms/${roomId}/join-requests`)
        if (res.ok) {
          const data = await res.json()
          const pending = data.requests?.filter((r: any) => r.status === 'pending') || []
          setPendingJoinRequestsCount(pending.length)
        }
      } catch (error) {
        console.error('[RoomInfo] Failed to fetch join requests:', error)
      }
    }

    fetchPendingJoinRequests()
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingJoinRequests, 30000)
    return () => clearInterval(interval)
  }, [isCurrentUserCreator, roomId])

  // Listen for moderation events to update report count in real-time
  const { moderationEvent } = useRoomData()
  useEffect(() => {
    if (moderationEvent?.type === 'report' && isCurrentUserCreator) {
      // Increment count immediately when new report comes in
      setPendingReportsCount((prev) => prev + 1)
    }
  }, [moderationEvent, isCurrentUserCreator])

  // Expose a way to open moderation panel with focused user
  const handleOpenModerationWithFocus = (userId: string) => {
    setFocusedUserId(userId)
    setShowModerationPanel(true)
  }

  // Call the callback prop if provided (so parent can trigger this)
  useEffect(() => {
    if (onOpenModerationWithFocus) {
      // Store reference so parent can call it
      ;(window as any).__openModerationWithFocus = handleOpenModerationWithFocus
    }
    return () => {
      delete (window as any).__openModerationWithFocus
    }
  }, [onOpenModerationWithFocus])

  const handleLeaveRoom = async () => {
    if (!roomId) return

    try {
      await leaveRoom(roomId)
      // Navigate to arcade lobby after leaving room
      router.push('/arcade')
    } catch (error) {
      console.error('[RoomInfo] Failed to leave room:', error)
    }
  }

  return (
    <>
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
                  color: 'rgba(17, 24, 39, 0.9)',
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
                    color: 'rgba(17, 24, 39, 0.5)',
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
                  color: 'rgba(17, 24, 39, 0.65)',
                  lineHeight: 1,
                }}
              >
                {displayName}
              </div>

              {/* Host indicator badge */}
              {isCurrentUserCreator ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    background:
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.2))',
                    border: '1.5px solid rgba(251, 191, 36, 0.6)',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: '700',
                    color: 'rgba(146, 64, 14, 1)',
                    lineHeight: 1,
                    marginTop: '2px',
                    position: 'relative',
                  }}
                  title="You're the host"
                >
                  <span style={{ fontSize: '10px', lineHeight: 1 }}>👑</span>
                  <span style={{ lineHeight: 1 }}>You are host</span>
                  {/* Pending items badge (reports + join requests) */}
                  {(pendingReportsCount > 0 || pendingJoinRequestsCount > 0) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background:
                          pendingJoinRequestsCount > 0
                            ? 'rgba(59, 130, 246, 1)'
                            : 'rgba(239, 68, 68, 1)',
                        color: 'white',
                        fontSize: '8px',
                        fontWeight: '700',
                        marginLeft: '2px',
                      }}
                      title={
                        pendingJoinRequestsCount > 0 && pendingReportsCount > 0
                          ? `${pendingJoinRequestsCount} join request${pendingJoinRequestsCount > 1 ? 's' : ''}, ${pendingReportsCount} report${pendingReportsCount > 1 ? 's' : ''}`
                          : pendingJoinRequestsCount > 0
                            ? `${pendingJoinRequestsCount} join request${pendingJoinRequestsCount > 1 ? 's' : ''}`
                            : `${pendingReportsCount} report${pendingReportsCount > 1 ? 's' : ''}`
                      }
                    >
                      {pendingReportsCount + pendingJoinRequestsCount}
                    </span>
                  )}
                </div>
              ) : (
                creatorName && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      background: 'rgba(75, 85, 99, 0.15)',
                      border: '1px solid rgba(75, 85, 99, 0.3)',
                      borderRadius: '4px',
                      fontSize: '8px',
                      fontWeight: '600',
                      color: 'rgba(75, 85, 99, 0.8)',
                      lineHeight: 1,
                      marginTop: '2px',
                    }}
                    title={`Host: ${creatorName}`}
                  >
                    <span style={{ fontSize: '9px', lineHeight: 1 }}>👑</span>
                    <span style={{ lineHeight: 1 }}>Host: {creatorName}</span>
                  </div>
                )
              )}
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

            {/* Moderation - only show for host */}
            {isCurrentUserCreator && roomId && (
              <DropdownMenu.Item
                onSelect={() => {
                  setOpen(false)
                  setShowModerationPanel(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: pendingReportsCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  color:
                    pendingReportsCount > 0 ? 'rgba(252, 165, 165, 1)' : 'rgba(209, 213, 219, 1)',
                  fontSize: '14px',
                  fontWeight: pendingReportsCount > 0 ? '600' : '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    pendingReportsCount > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(251, 146, 60, 0.2)'
                  e.currentTarget.style.color = 'rgba(253, 186, 116, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    pendingReportsCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'transparent'
                  e.currentTarget.style.color =
                    pendingReportsCount > 0 ? 'rgba(252, 165, 165, 1)' : 'rgba(209, 213, 219, 1)'
                }}
              >
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <span>Moderation</span>
                {pendingReportsCount > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                      borderRadius: '9px',
                      background: 'rgba(239, 68, 68, 1)',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '700',
                      marginLeft: 'auto',
                    }}
                  >
                    {pendingReportsCount}
                  </span>
                )}
              </DropdownMenu.Item>
            )}

            {/* Room Navigation Submenu */}
            {(onSetup || onNewGame || onQuit || isCurrentUserCreator) && (
              <DropdownMenu.Separator
                style={{
                  height: '1px',
                  background: 'rgba(75, 85, 99, 0.5)',
                  margin: '4px 0',
                }}
              />
            )}

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'rgba(139, 92, 246, 0.05)',
                  color: 'rgba(209, 213, 219, 1)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'
                  e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)'
                  e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>🏠</span>
                  <span>Room: {displayName}</span>
                </div>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>▸</span>
              </DropdownMenu.SubTrigger>

              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={8}
                  alignOffset={-8}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    padding: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',
                    minWidth: '220px',
                    zIndex: 10000,
                    animation: 'dropdownFadeIn 0.2s ease-out',
                  }}
                >
                  {/* Current Room Section */}
                  {joinCode && roomId && (
                    <>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: 'rgba(139, 92, 246, 0.7)',
                          marginBottom: '8px',
                          marginLeft: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}
                      >
                        Current Room
                      </div>

                      <RoomShareButtons joinCode={joinCode} shareUrl={shareUrl} />

                      <DropdownMenu.Separator
                        style={{
                          height: '1px',
                          background: 'rgba(75, 85, 99, 0.5)',
                          margin: '8px 0',
                        }}
                      />
                    </>
                  )}

                  {/* Switch Rooms Section */}
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: 'rgba(139, 92, 246, 0.7)',
                      marginBottom: '8px',
                      marginLeft: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    Switch Rooms
                  </div>

                  <DropdownMenu.Item
                    onSelect={() => {
                      setOpen(false)
                      setShowCreateModal(true)
                    }}
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
                      e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)'
                      e.currentTarget.style.color = 'rgba(134, 239, 172, 1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🆕</span>
                    <span>Create New</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onSelect={() => {
                      setOpen(false)
                      setShowJoinModal(true)
                    }}
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
                    <span style={{ fontSize: '16px' }}>🚪</span>
                    <span>Join Another</span>
                  </DropdownMenu.Item>

                  {/* Leave Room - only show when in a room */}
                  {roomId && (
                    <>
                      <DropdownMenu.Separator
                        style={{
                          height: '1px',
                          background: 'rgba(75, 85, 99, 0.5)',
                          margin: '8px 0',
                        }}
                      />
                      <DropdownMenu.Item
                        onSelect={handleLeaveRoom}
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
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                          e.currentTarget.style.color = 'rgba(252, 165, 165, 1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>🚫</span>
                        <span>Leave This Room</span>
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            {onQuit && (
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
                <span>Room Lobby</span>
              </DropdownMenu.Item>
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

      {/* Modals */}
      <JoinRoomModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} />
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Moderation Panel - only render if host */}
      {isCurrentUserCreator && roomId && roomData && currentUserId && (
        <ModerationPanel
          isOpen={showModerationPanel}
          onClose={() => {
            setShowModerationPanel(false)
            setFocusedUserId(undefined)
          }}
          roomId={roomId}
          members={roomData.members}
          memberPlayers={roomData.memberPlayers}
          currentUserId={currentUserId}
          focusedUserId={focusedUserId}
        />
      )}
    </>
  )
}
