import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import type { RoomBan, RoomMember, RoomReport } from '@/db/schema'

export interface RoomPlayer {
  id: string
  name: string
  emoji: string
  color: string
}

export interface ModerationPanelProps {
  /**
   * Whether the panel is open
   */
  isOpen: boolean

  /**
   * Callback when panel should close
   */
  onClose: () => void

  /**
   * The room ID
   */
  roomId: string

  /**
   * Current room members
   */
  members: RoomMember[]

  /**
   * Member players (userId -> players)
   */
  memberPlayers: Record<string, RoomPlayer[]>

  /**
   * Current user ID (the host)
   */
  currentUserId: string

  /**
   * Optional: User ID to focus/highlight when opening the panel
   */
  focusedUserId?: string
}

type Tab = 'members' | 'bans' | 'history'

export interface HistoricalMemberWithStatus {
  userId: string
  displayName: string
  firstJoinedAt: Date
  lastSeenAt: Date
  status: 'active' | 'banned' | 'kicked' | 'left'
  isCurrentlyInRoom: boolean
  isBanned: boolean
  banDetails?: {
    reason: string
    bannedBy: string
    bannedByName: string
    bannedAt: Date
  }
  invitationStatus?: 'pending' | 'accepted' | 'declined' | 'expired' | null
}

/**
 * Moderation panel for room hosts
 */
export function ModerationPanel({
  isOpen,
  onClose,
  roomId,
  members,
  memberPlayers,
  currentUserId,
  focusedUserId,
}: ModerationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [reports, setReports] = useState<RoomReport[]>([])
  const [bans, setBans] = useState<RoomBan[]>([])
  const [historicalMembers, setHistoricalMembers] = useState<HistoricalMemberWithStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false)
  const [banTargetUserId, setBanTargetUserId] = useState<string | null>(null)
  const [banTargetUserName, setBanTargetUserName] = useState<string | null>(null)
  const [selectedBanReason, setSelectedBanReason] = useState<string>('harassment')

  // Unban confirmation state
  const [confirmingUnbanUserId, setConfirmingUnbanUserId] = useState<string | null>(null)

  // Unban & invite confirmation state (for history tab)
  const [confirmingUnbanInviteUserId, setConfirmingUnbanInviteUserId] = useState<string | null>(
    null
  )

  // Auto-switch to Members tab when focusedUserId is provided
  useEffect(() => {
    if (isOpen && focusedUserId) {
      setActiveTab('members')
    }
  }, [isOpen, focusedUserId])

  // Load reports and bans when panel opens
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      setIsLoading(true)
      setError('')

      try {
        // Load reports
        const reportsRes = await fetch(`/api/arcade/rooms/${roomId}/reports`)
        if (reportsRes.ok) {
          const data = await reportsRes.json()
          setReports(data.reports || [])
        }

        // Load bans
        const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
        if (bansRes.ok) {
          const data = await bansRes.json()
          setBans(data.bans || [])
        }

        // Load historical members
        const historyRes = await fetch(`/api/arcade/rooms/${roomId}/history`)
        if (historyRes.ok) {
          const data = await historyRes.json()
          setHistoricalMembers(data.historicalMembers || [])
        }
      } catch (err) {
        console.error('Failed to load moderation data:', err)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isOpen, roomId, members])

  const handleKick = async (userId: string) => {
    if (!confirm('Kick this player from the room?')) return

    setActionLoading(`kick-${userId}`)
    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        throw new Error('Failed to kick player')
      }

      // Success - member will be removed via socket update
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to kick player')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBan = (userId: string, userName: string) => {
    setBanTargetUserId(userId)
    setBanTargetUserName(userName)
    setSelectedBanReason('harassment')
    setShowBanModal(true)
  }

  const handleConfirmBan = async () => {
    if (!banTargetUserId) return

    setActionLoading(`ban-${banTargetUserId}`)
    setShowBanModal(false)

    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: banTargetUserId, reason: selectedBanReason }),
      })

      if (!res.ok) {
        throw new Error('Failed to ban player')
      }

      // Reload bans
      const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
      if (bansRes.ok) {
        const data = await bansRes.json()
        setBans(data.bans || [])
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to ban player')
    } finally {
      setActionLoading(null)
      setBanTargetUserId(null)
      setBanTargetUserName(null)
    }
  }

  const handleUnban = async (userId: string) => {
    setActionLoading(`unban-${userId}`)
    setConfirmingUnbanUserId(null)

    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/ban`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        throw new Error('Failed to unban player')
      }

      // Reload bans and history
      const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
      if (bansRes.ok) {
        const data = await bansRes.json()
        setBans(data.bans || [])
      }

      const historyRes = await fetch(`/api/arcade/rooms/${roomId}/history`)
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistoricalMembers(data.historicalMembers || [])
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unban player')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnbanAndInvite = async (userId: string, userName: string) => {
    setActionLoading(`unban-invite-${userId}`)
    setConfirmingUnbanInviteUserId(null)

    try {
      // Unban the user (which also auto-invites them)
      const res = await fetch(`/api/arcade/rooms/${roomId}/ban`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        throw new Error('Failed to unban player')
      }

      // Reload bans and history
      const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
      if (bansRes.ok) {
        const data = await bansRes.json()
        setBans(data.bans || [])
      }

      const historyRes = await fetch(`/api/arcade/rooms/${roomId}/history`)
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistoricalMembers(data.historicalMembers || [])
      }

      alert(`${userName} has been unbanned and invited back to the room!`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unban player')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInvite = async (userId: string, userName: string) => {
    setActionLoading(`invite-${userId}`)

    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      // Reload history to update invitation status
      const historyRes = await fetch(`/api/arcade/rooms/${roomId}/history`)
      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistoricalMembers(data.historicalMembers || [])
      }

      alert(`Invitation sent to ${userName}!`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingReports = reports.filter((r) => r.status === 'pending')
  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  // Group reports by reported user ID
  const reportsByUser = pendingReports.reduce(
    (acc, report) => {
      if (!acc[report.reportedUserId]) {
        acc[report.reportedUserId] = []
      }
      acc[report.reportedUserId].push(report)
      return acc
    },
    {} as Record<string, typeof pendingReports>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="moderation-modal">
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'rgba(253, 186, 116, 1)',
          }}
        >
          👑 Room Moderation
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(209, 213, 219, 0.8)',
            marginBottom: '20px',
          }}
        >
          Manage members, reports, and bans
        </p>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
          }}
        >
          {(['members', 'bans', 'history'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                background: activeTab === tab ? 'rgba(251, 146, 60, 0.2)' : 'transparent',
                color: activeTab === tab ? 'rgba(253, 186, 116, 1)' : 'rgba(156, 163, 175, 1)',
                border: 'none',
                borderBottom:
                  activeTab === tab ? '2px solid rgba(251, 146, 60, 1)' : '2px solid transparent',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab === 'members' && (
                <span>
                  Members ({otherMembers.length})
                  {pendingReports.length > 0 && (
                    <span
                      style={{
                        marginLeft: '6px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.8)',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      {pendingReports.length} report{pendingReports.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              )}
              {tab === 'bans' && `Banned (${bans.length})`}
              {tab === 'history' && `History (${historicalMembers.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: '13px', color: 'rgba(248, 113, 113, 1)' }}>{error}</p>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(156, 163, 175, 1)' }}>
            Loading...
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {/* Members Tab */}
            {activeTab === 'members' && (
              <div>
                {otherMembers.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'rgba(156, 163, 175, 1)',
                    }}
                  >
                    No other members
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {otherMembers.map((member) => {
                      const memberReports = reportsByUser[member.userId] || []
                      const hasReports = memberReports.length > 0
                      const isFocused = focusedUserId === member.userId

                      return (
                        <div
                          key={member.id}
                          style={{
                            padding: '12px',
                            background: hasReports
                              ? 'rgba(239, 68, 68, 0.08)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: isFocused
                              ? '2px solid rgba(251, 146, 60, 1)'
                              : hasReports
                                ? '1px solid rgba(239, 68, 68, 0.6)'
                                : '1px solid rgba(75, 85, 99, 0.3)',
                            borderRadius: '8px',
                            boxShadow: isFocused ? '0 0 0 3px rgba(251, 146, 60, 0.2)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Member header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: hasReports ? '12px' : 0,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: 'rgba(209, 213, 219, 1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                              >
                                {/* Player emojis */}
                                {memberPlayers[member.userId]?.map((player) => (
                                  <span
                                    key={player.id}
                                    style={{
                                      fontSize: '18px',
                                      lineHeight: 1,
                                    }}
                                    title={player.name}
                                  >
                                    {player.emoji}
                                  </span>
                                ))}
                                {member.displayName}
                                {hasReports && (
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      background: 'rgba(239, 68, 68, 0.8)',
                                      color: 'white',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {memberReports.length} report
                                    {memberReports.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: 'rgba(156, 163, 175, 1)' }}>
                                {member.isOnline ? '🟢 Online' : '⚫ Offline'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleKick(member.userId)}
                                disabled={actionLoading === `kick-${member.userId}`}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(251, 146, 60, 0.2)',
                                  color: 'rgba(251, 146, 60, 1)',
                                  border: '1px solid rgba(251, 146, 60, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor:
                                    actionLoading === `kick-${member.userId}`
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity: actionLoading === `kick-${member.userId}` ? 0.5 : 1,
                                }}
                              >
                                {actionLoading === `kick-${member.userId}` ? 'Kicking...' : 'Kick'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBan(member.userId, member.displayName)}
                                disabled={actionLoading === `ban-${member.userId}`}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: 'rgba(239, 68, 68, 1)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor:
                                    actionLoading === `ban-${member.userId}`
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity: actionLoading === `ban-${member.userId}` ? 0.5 : 1,
                                }}
                              >
                                {actionLoading === `ban-${member.userId}` ? 'Banning...' : 'Ban'}
                              </button>
                            </div>
                          </div>

                          {/* Member reports */}
                          {hasReports && (
                            <div
                              style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: 'rgba(239, 68, 68, 1)',
                                  marginBottom: '8px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                Reports:
                              </div>
                              {memberReports.map((report) => (
                                <div
                                  key={report.id}
                                  style={{
                                    fontSize: '12px',
                                    color: 'rgba(209, 213, 219, 0.9)',
                                    marginBottom: '6px',
                                    paddingLeft: '8px',
                                    borderLeft: '2px solid rgba(239, 68, 68, 0.4)',
                                  }}
                                >
                                  <div style={{ marginBottom: '2px' }}>
                                    <strong style={{ color: 'rgba(252, 165, 165, 1)' }}>
                                      {report.reporterName}:
                                    </strong>{' '}
                                    {report.reason.replace(/-/g, ' ')}
                                  </div>
                                  {report.details && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: 'rgba(156, 163, 175, 1)',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      "{report.details}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bans Tab */}
            {activeTab === 'bans' && (
              <div>
                {bans.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'rgba(156, 163, 175, 1)',
                    }}
                  >
                    No banned users
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {bans.map((ban) => {
                      const isConfirming = confirmingUnbanUserId === ban.userId

                      return (
                        <div
                          key={ban.id}
                          style={{
                            padding: '12px',
                            background: isConfirming
                              ? 'rgba(34, 197, 94, 0.08)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: isConfirming
                              ? '1px solid rgba(34, 197, 94, 0.6)'
                              : '1px solid rgba(75, 85, 99, 0.3)',
                            borderRadius: '8px',
                          }}
                        >
                          {/* Ban info */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: isConfirming ? '12px' : 0,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: 'rgba(209, 213, 219, 1)',
                                }}
                              >
                                {ban.userName}
                              </div>
                              <div style={{ fontSize: '12px', color: 'rgba(156, 163, 175, 1)' }}>
                                {ban.reason.replace(/-/g, ' ')}
                              </div>
                              {ban.notes && (
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: 'rgba(156, 163, 175, 1)',
                                    fontStyle: 'italic',
                                    marginTop: '4px',
                                  }}
                                >
                                  "{ban.notes}"
                                </div>
                              )}
                            </div>

                            {/* Initial unban button */}
                            {!isConfirming && (
                              <button
                                type="button"
                                onClick={() => setConfirmingUnbanUserId(ban.userId)}
                                disabled={actionLoading === `unban-${ban.userId}`}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  color: 'rgba(34, 197, 94, 1)',
                                  border: '1px solid rgba(34, 197, 94, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor:
                                    actionLoading === `unban-${ban.userId}`
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity: actionLoading === `unban-${ban.userId}` ? 0.5 : 1,
                                }}
                              >
                                {actionLoading === `unban-${ban.userId}` ? 'Unbanning...' : 'Unban'}
                              </button>
                            )}
                          </div>

                          {/* Inline confirmation */}
                          {isConfirming && (
                            <div
                              style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid rgba(34, 197, 94, 0.2)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: 'rgba(134, 239, 172, 1)',
                                  marginBottom: '12px',
                                }}
                              >
                                ✓ Unban {ban.userName}?
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'rgba(209, 213, 219, 0.8)',
                                  marginBottom: '12px',
                                }}
                              >
                                This player will be able to rejoin the room.
                              </div>
                              <div
                                style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setConfirmingUnbanUserId(null)}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'rgba(75, 85, 99, 0.3)',
                                    color: 'rgba(209, 213, 219, 1)',
                                    border: '1px solid rgba(75, 85, 99, 0.5)',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnban(ban.userId)}
                                  style={{
                                    padding: '6px 12px',
                                    background:
                                      'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))',
                                    color: 'white',
                                    border: '1px solid rgba(34, 197, 94, 0.6)',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background =
                                      'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                      'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))'
                                  }}
                                >
                                  Confirm Unban
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                {historicalMembers.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'rgba(156, 163, 175, 1)',
                    }}
                  >
                    No historical members
                  </div>
                ) : (
                  <div>
                    {/* Group by status */}
                    {['active', 'banned', 'kicked', 'left'].map((statusFilter) => {
                      const filteredMembers = historicalMembers.filter(
                        (h) => h.status === statusFilter
                      )
                      if (filteredMembers.length === 0) return null

                      const statusConfig: Record<
                        string,
                        { label: string; emoji: string; color: string }
                      > = {
                        active: { label: 'Active', emoji: '🟢', color: 'rgba(34, 197, 94, 1)' },
                        banned: { label: 'Banned', emoji: '🚫', color: 'rgba(239, 68, 68, 1)' },
                        kicked: { label: 'Kicked', emoji: '👢', color: 'rgba(251, 146, 60, 1)' },
                        left: { label: 'Left', emoji: '👋', color: 'rgba(156, 163, 175, 1)' },
                      }

                      const config = statusConfig[statusFilter]

                      return (
                        <div key={statusFilter} style={{ marginBottom: '20px' }}>
                          {/* Status header */}
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '700',
                              color: config.color,
                              marginBottom: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>{config.emoji}</span>
                            {config.label} ({filteredMembers.length})
                          </div>

                          {/* Members in this status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredMembers.map((member) => {
                              const isConfirmingUnbanInvite =
                                confirmingUnbanInviteUserId === member.userId

                              return (
                                <div
                                  key={member.userId}
                                  style={{
                                    padding: '12px',
                                    background: isConfirmingUnbanInvite
                                      ? 'rgba(34, 197, 94, 0.08)'
                                      : 'rgba(255, 255, 255, 0.05)',
                                    border: isConfirmingUnbanInvite
                                      ? '1px solid rgba(34, 197, 94, 0.6)'
                                      : '1px solid rgba(75, 85, 99, 0.3)',
                                    borderRadius: '8px',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: isConfirmingUnbanInvite ? '12px' : 0,
                                    }}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          fontSize: '14px',
                                          fontWeight: '600',
                                          color: 'rgba(209, 213, 219, 1)',
                                        }}
                                      >
                                        {member.displayName}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          color: 'rgba(156, 163, 175, 1)',
                                          marginTop: '2px',
                                        }}
                                      >
                                        First joined:{' '}
                                        {new Date(member.firstJoinedAt).toLocaleDateString()}
                                      </div>
                                      {member.invitationStatus === 'pending' &&
                                        !member.isBanned &&
                                        !member.isCurrentlyInRoom && (
                                          <div
                                            style={{
                                              fontSize: '11px',
                                              color: 'rgba(139, 92, 246, 1)',
                                              marginTop: '4px',
                                              fontWeight: '600',
                                            }}
                                          >
                                            ✉️ Pending invitation
                                          </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {!isConfirmingUnbanInvite && (
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        {!member.isCurrentlyInRoom && !member.isBanned && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInvite(member.userId, member.displayName)
                                            }
                                            disabled={actionLoading === `invite-${member.userId}`}
                                            style={{
                                              padding: '6px 12px',
                                              background:
                                                member.invitationStatus === 'pending'
                                                  ? 'rgba(139, 92, 246, 0.2)'
                                                  : 'rgba(59, 130, 246, 0.2)',
                                              color:
                                                member.invitationStatus === 'pending'
                                                  ? 'rgba(139, 92, 246, 1)'
                                                  : 'rgba(59, 130, 246, 1)',
                                              border:
                                                member.invitationStatus === 'pending'
                                                  ? '1px solid rgba(139, 92, 246, 0.4)'
                                                  : '1px solid rgba(59, 130, 246, 0.4)',
                                              borderRadius: '6px',
                                              fontSize: '13px',
                                              fontWeight: '600',
                                              cursor:
                                                actionLoading === `invite-${member.userId}`
                                                  ? 'not-allowed'
                                                  : 'pointer',
                                              opacity:
                                                actionLoading === `invite-${member.userId}`
                                                  ? 0.5
                                                  : 1,
                                            }}
                                          >
                                            {actionLoading === `invite-${member.userId}`
                                              ? 'Inviting...'
                                              : member.invitationStatus === 'pending'
                                                ? '🔔 Re-Invite'
                                                : 'Invite'}
                                          </button>
                                        )}
                                        {member.isCurrentlyInRoom && (
                                          <div
                                            style={{
                                              padding: '6px 12px',
                                              background: 'rgba(34, 197, 94, 0.2)',
                                              color: 'rgba(34, 197, 94, 1)',
                                              border: '1px solid rgba(34, 197, 94, 0.4)',
                                              borderRadius: '6px',
                                              fontSize: '13px',
                                              fontWeight: '600',
                                            }}
                                          >
                                            In Room
                                          </div>
                                        )}
                                        {member.isBanned && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setConfirmingUnbanInviteUserId(member.userId)
                                            }
                                            disabled={
                                              actionLoading === `unban-invite-${member.userId}`
                                            }
                                            style={{
                                              padding: '6px 12px',
                                              background: 'rgba(34, 197, 94, 0.2)',
                                              color: 'rgba(34, 197, 94, 1)',
                                              border: '1px solid rgba(34, 197, 94, 0.4)',
                                              borderRadius: '6px',
                                              fontSize: '13px',
                                              fontWeight: '600',
                                              cursor:
                                                actionLoading === `unban-invite-${member.userId}`
                                                  ? 'not-allowed'
                                                  : 'pointer',
                                              opacity:
                                                actionLoading === `unban-invite-${member.userId}`
                                                  ? 0.5
                                                  : 1,
                                            }}
                                          >
                                            {actionLoading === `unban-invite-${member.userId}`
                                              ? 'Processing...'
                                              : 'Unban & Invite'}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Inline confirmation for unban & invite */}
                                  {isConfirmingUnbanInvite && (
                                    <div
                                      style={{
                                        marginTop: '12px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid rgba(34, 197, 94, 0.2)',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          color: 'rgba(134, 239, 172, 1)',
                                          marginBottom: '8px',
                                        }}
                                      >
                                        🚫 → ✉️ Unban and invite {member.displayName}?
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '12px',
                                          color: 'rgba(209, 213, 219, 0.8)',
                                          marginBottom: '12px',
                                        }}
                                      >
                                        This player is currently banned. They will be unbanned and
                                        automatically sent an invitation to rejoin the room.
                                      </div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '8px',
                                          justifyContent: 'flex-end',
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setConfirmingUnbanInviteUserId(null)}
                                          style={{
                                            padding: '6px 12px',
                                            background: 'rgba(75, 85, 99, 0.3)',
                                            color: 'rgba(209, 213, 219, 1)',
                                            border: '1px solid rgba(75, 85, 99, 0.5)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                              'rgba(75, 85, 99, 0.4)'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                              'rgba(75, 85, 99, 0.3)'
                                          }}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUnbanAndInvite(member.userId, member.displayName)
                                          }
                                          style={{
                                            padding: '6px 12px',
                                            background:
                                              'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))',
                                            color: 'white',
                                            border: '1px solid rgba(34, 197, 94, 0.6)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                              'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                              'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))'
                                          }}
                                        >
                                          Confirm Unban & Invite
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(75, 85, 99, 0.3)',
              color: 'rgba(209, 213, 219, 1)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Ban Reason Modal */}
      <Dialog.Root open={showBanModal} onOpenChange={setShowBanModal}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 10001,
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              zIndex: 10002,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            <Dialog.Title
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                marginBottom: '8px',
                color: 'rgba(252, 165, 165, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '24px' }}>🚫</span>
              Ban {banTargetUserName}
            </Dialog.Title>
            <Dialog.Description
              style={{
                fontSize: '14px',
                color: 'rgba(209, 213, 219, 0.8)',
                marginBottom: '20px',
              }}
            >
              Select a reason for banning this player. They will not be able to rejoin this room.
            </Dialog.Description>

            {/* Ban reason options */}
            <div style={{ marginBottom: '24px' }}>
              {[
                { value: 'harassment', label: 'Harassment' },
                { value: 'cheating', label: 'Cheating' },
                { value: 'inappropriate-name', label: 'Inappropriate Name' },
                { value: 'spam', label: 'Spam' },
                { value: 'afk', label: 'AFK / Inactive' },
                { value: 'other', label: 'Other' },
              ].map((reason) => (
                <label
                  key={reason.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    background:
                      selectedBanReason === reason.value
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      selectedBanReason === reason.value
                        ? '1px solid rgba(239, 68, 68, 0.6)'
                        : '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedBanReason !== reason.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedBanReason !== reason.value) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="banReason"
                    value={reason.value}
                    checked={selectedBanReason === reason.value}
                    onChange={(e) => setSelectedBanReason(e.target.value)}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: selectedBanReason === reason.value ? '600' : '500',
                      color:
                        selectedBanReason === reason.value
                          ? 'rgba(252, 165, 165, 1)'
                          : 'rgba(209, 213, 219, 1)',
                    }}
                  >
                    {reason.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Dialog.Close asChild>
                <button
                  type="button"
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(75, 85, 99, 0.3)',
                    color: 'rgba(209, 213, 219, 1)',
                    border: '1px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirmBan}
                style={{
                  padding: '10px 20px',
                  background:
                    'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))',
                  color: 'white',
                  border: '1px solid rgba(239, 68, 68, 0.6)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))'
                }}
              >
                Confirm Ban
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Modal>
  )
}
