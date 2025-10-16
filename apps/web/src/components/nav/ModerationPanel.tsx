import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import type { RoomBan, RoomReport } from '@/db/schema'
import type { RoomMember } from '@/hooks/useRoomData'

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

type Tab = 'members' | 'bans' | 'history' | 'settings'

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

  // Settings state
  const [accessMode, setAccessMode] = useState<string>('open')
  const [originalAccessMode, setOriginalAccessMode] = useState<string>('open')
  const [roomPassword, setRoomPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('')
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [passwordCopied, setPasswordCopied] = useState(false)

  // Inline feedback state
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

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
        } else {
          const errorData = await reportsRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load reports')
        }

        // Load bans
        const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
        if (bansRes.ok) {
          const data = await bansRes.json()
          setBans(data.bans || [])
        } else {
          const errorData = await bansRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load bans')
        }

        // Load historical members
        const historyRes = await fetch(`/api/arcade/rooms/${roomId}/history`)
        if (historyRes.ok) {
          const data = await historyRes.json()
          setHistoricalMembers(data.historicalMembers || [])
        } else {
          const errorData = await historyRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load history')
        }
      } catch (err) {
        console.error('Failed to load moderation data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
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
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to kick player')
      }

      // Success - member will be removed via socket update
      showSuccess('Player kicked from room')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to kick player')
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
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to ban player')
      }

      // Reload bans
      const bansRes = await fetch(`/api/arcade/rooms/${roomId}/ban`)
      if (bansRes.ok) {
        const data = await bansRes.json()
        setBans(data.bans || [])
      }

      showSuccess('Player banned from room')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to ban player')
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
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to unban player')
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

      showSuccess('Player unbanned')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to unban player')
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
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to unban player')
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

      showSuccess(`${userName} has been unbanned and invited back to the room`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to unban player')
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

      showSuccess(`Invitation sent to ${userName}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setActionLoading(null)
    }
  }

  // Load room settings and join requests when Settings tab is opened
  useEffect(() => {
    if (!isOpen || activeTab !== 'settings') return

    const loadSettings = async () => {
      try {
        // Fetch current room data to get access mode and password
        const roomRes = await fetch(`/api/arcade/rooms/${roomId}`)
        if (roomRes.ok) {
          const data = await roomRes.json()
          const currentAccessMode = data.room?.accessMode || 'open'
          setAccessMode(currentAccessMode)
          setOriginalAccessMode(currentAccessMode)

          // Set password field if room has a password and user is the creator
          if (currentAccessMode === 'password' && data.room?.displayPassword) {
            setRoomPassword(data.room.displayPassword)
            setShowPasswordInput(true)
          }
        }

        // Fetch join requests if any
        const requestsRes = await fetch(`/api/arcade/rooms/${roomId}/join-requests`)
        if (requestsRes.ok) {
          const data = await requestsRes.json()
          setJoinRequests(data.requests || [])
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }

    loadSettings()
  }, [isOpen, activeTab, roomId])

  // Handlers for Settings tab
  const handleUpdateAccessMode = async () => {
    setActionLoading('update-settings')
    try {
      const body: any = { accessMode }
      if (accessMode === 'password' && roomPassword) {
        body.password = roomPassword
      }

      const res = await fetch(`/api/arcade/rooms/${roomId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update settings')
      }

      showSuccess('Room settings updated successfully')
      setOriginalAccessMode(accessMode) // Update original to current
      setShowPasswordInput(false)
      setRoomPassword('')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setActionLoading(null)
    }
  }

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return

    const newOwner = members.find((m) => m.userId === selectedNewOwner)
    if (!newOwner) return

    if (!confirm(`Transfer ownership to ${newOwner.displayName}? You will no longer be the host.`))
      return

    setActionLoading('transfer-ownership')
    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to transfer ownership')
      }

      showSuccess(`Ownership transferred to ${newOwner.displayName}`)
      setTimeout(() => onClose(), 2000) // Close panel after showing message
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to transfer ownership')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveJoinRequest = async (requestId: string) => {
    setActionLoading(`approve-request-${requestId}`)
    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/join-requests/${requestId}/approve`, {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to approve request')
      }

      // Reload requests
      const requestsRes = await fetch(`/api/arcade/rooms/${roomId}/join-requests`)
      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setJoinRequests(data.requests || [])
      }

      showSuccess('Join request approved')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to approve request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDenyJoinRequest = async (requestId: string) => {
    setActionLoading(`deny-request-${requestId}`)
    try {
      const res = await fetch(`/api/arcade/rooms/${roomId}/join-requests/${requestId}/deny`, {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to deny request')
      }

      // Reload requests
      const requestsRes = await fetch(`/api/arcade/rooms/${roomId}/join-requests`)
      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setJoinRequests(data.requests || [])
      }

      showSuccess('Join request denied')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to deny request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopyPassword = async () => {
    if (!roomPassword) return

    try {
      await navigator.clipboard.writeText(roomPassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy password:', err)
      showError('Failed to copy password to clipboard')
    }
  }

  // Utility functions for showing feedback
  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setErrorMessage('')
    setTimeout(() => setSuccessMessage(''), 5000)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setSuccessMessage('')
    setTimeout(() => setErrorMessage(''), 5000)
  }

  const pendingReports = reports.filter((r) => r.status === 'pending')
  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  // Check if there are unsaved changes in settings
  const hasUnsavedAccessModeChanges = accessMode !== originalAccessMode

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

        {/* Success/Error Messages */}
        {(successMessage || errorMessage) && (
          <div
            style={{
              padding: '12px 16px',
              background: successMessage ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: successMessage
                ? '1px solid rgba(34, 197, 94, 0.4)'
                : '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: 1,
              }}
            >
              <span style={{ fontSize: '16px' }}>{successMessage ? '✓' : '⚠'}</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: successMessage ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
                }}
              >
                {successMessage || errorMessage}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccessMessage('')
                setErrorMessage('')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: successMessage ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
          }}
        >
          {(['members', 'bans', 'history', 'settings'] as Tab[]).map((tab) => (
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
              {tab === 'settings' && (
                <span>
                  ⚙️ Settings
                  {joinRequests.filter((r: any) => r.status === 'pending').length > 0 && (
                    <span
                      style={{
                        marginLeft: '6px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.8)',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      {joinRequests.filter((r: any) => r.status === 'pending').length} pending
                    </span>
                  )}
                </span>
              )}
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

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Access Mode Section */}
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: 'rgba(253, 186, 116, 1)',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    🔒 Room Access Mode
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(75, 85, 99, 0.3)',
                      borderRadius: '8px',
                    }}
                  >
                    {/* Access mode button grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      {[
                        { value: 'open', emoji: '🌐', label: 'Open', desc: 'Anyone' },
                        { value: 'password', emoji: '🔑', label: 'Password', desc: 'With key' },
                        { value: 'approval-only', emoji: '✋', label: 'Approval', desc: 'Request' },
                        {
                          value: 'restricted',
                          emoji: '🚫',
                          label: 'Restricted',
                          desc: 'Invite only',
                        },
                        { value: 'locked', emoji: '🔒', label: 'Locked', desc: 'No new members' },
                        { value: 'retired', emoji: '🏁', label: 'Retired', desc: 'Closed' },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          disabled={actionLoading === 'update-settings'}
                          onClick={() => {
                            setAccessMode(mode.value)
                            setShowPasswordInput(mode.value === 'password')
                          }}
                          style={{
                            padding: '10px 12px',
                            background:
                              accessMode === mode.value
                                ? 'rgba(253, 186, 116, 0.15)'
                                : 'rgba(255, 255, 255, 0.05)',
                            border:
                              accessMode === mode.value
                                ? '2px solid rgba(253, 186, 116, 0.6)'
                                : '2px solid rgba(75, 85, 99, 0.5)',
                            borderRadius: '8px',
                            color:
                              accessMode === mode.value
                                ? 'rgba(253, 186, 116, 1)'
                                : 'rgba(209, 213, 219, 0.8)',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: actionLoading === 'update-settings' ? 'not-allowed' : 'pointer',
                            opacity: actionLoading === 'update-settings' ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                          onMouseEnter={(e) => {
                            if (actionLoading !== 'update-settings' && accessMode !== mode.value) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                              e.currentTarget.style.borderColor = 'rgba(253, 186, 116, 0.4)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (accessMode !== mode.value) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                              e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
                            }
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>{mode.emoji}</span>
                          <div style={{ textAlign: 'left', flex: 1, lineHeight: '1.2' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{mode.label}</div>
                            <div style={{ fontSize: '11px', opacity: 0.7 }}>{mode.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Password input (conditional) */}
                    {(accessMode === 'password' || showPasswordInput) && (
                      <div style={{ marginBottom: '12px' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'rgba(209, 213, 219, 0.8)',
                            marginBottom: '6px',
                          }}
                        >
                          Room Password
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={roomPassword}
                            onChange={(e) => setRoomPassword(e.target.value)}
                            placeholder="Enter password to share with guests"
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(75, 85, 99, 0.5)',
                              borderRadius: '6px',
                              color: 'rgba(209, 213, 219, 1)',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'border-color 0.2s ease',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(253, 186, 116, 0.6)'
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCopyPassword}
                            disabled={!roomPassword}
                            title="Copy password to clipboard"
                            style={{
                              padding: '10px 16px',
                              background: passwordCopied
                                ? 'rgba(34, 197, 94, 0.2)'
                                : roomPassword
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : 'rgba(75, 85, 99, 0.2)',
                              color: passwordCopied
                                ? 'rgba(34, 197, 94, 1)'
                                : roomPassword
                                  ? 'rgba(59, 130, 246, 1)'
                                  : 'rgba(156, 163, 175, 1)',
                              border: passwordCopied
                                ? '1px solid rgba(34, 197, 94, 0.4)'
                                : roomPassword
                                  ? '1px solid rgba(59, 130, 246, 0.4)'
                                  : '1px solid rgba(75, 85, 99, 0.3)',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: roomPassword ? 'pointer' : 'not-allowed',
                              opacity: roomPassword ? 1 : 0.5,
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              if (roomPassword && !passwordCopied) {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (roomPassword && !passwordCopied) {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                              }
                            }}
                          >
                            {passwordCopied ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'rgba(156, 163, 175, 1)',
                            marginTop: '4px',
                          }}
                        >
                          Share this password with guests to allow them to join
                        </div>
                      </div>
                    )}

                    {hasUnsavedAccessModeChanges && (
                      <button
                        type="button"
                        onClick={handleUpdateAccessMode}
                        disabled={actionLoading === 'update-settings'}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background:
                            actionLoading === 'update-settings'
                              ? 'rgba(75, 85, 99, 0.3)'
                              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))',
                          color: 'white',
                          border:
                            actionLoading === 'update-settings'
                              ? '1px solid rgba(75, 85, 99, 0.5)'
                              : '1px solid rgba(59, 130, 246, 0.6)',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: actionLoading === 'update-settings' ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === 'update-settings' ? 0.5 : 1,
                        }}
                      >
                        {actionLoading === 'update-settings' ? 'Updating...' : 'Update Access Mode'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Join Requests Section (for approval-only mode) */}
                {joinRequests.filter((r: any) => r.status === 'pending').length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: 'rgba(59, 130, 246, 1)',
                        marginBottom: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      🙋 Pending Join Requests
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {joinRequests
                        .filter((r: any) => r.status === 'pending')
                        .map((request: any) => (
                          <div
                            key={request.id}
                            style={{
                              padding: '12px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
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
                                {request.userName || 'Anonymous User'}
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'rgba(156, 163, 175, 1)',
                                  marginTop: '2px',
                                }}
                              >
                                Requested {new Date(request.createdAt).toLocaleString()}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleDenyJoinRequest(request.id)}
                                disabled={actionLoading === `deny-request-${request.id}`}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: 'rgba(239, 68, 68, 1)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor:
                                    actionLoading === `deny-request-${request.id}`
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity: actionLoading === `deny-request-${request.id}` ? 0.5 : 1,
                                }}
                              >
                                {actionLoading === `deny-request-${request.id}`
                                  ? 'Denying...'
                                  : 'Deny'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveJoinRequest(request.id)}
                                disabled={actionLoading === `approve-request-${request.id}`}
                                style={{
                                  padding: '6px 12px',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  color: 'rgba(34, 197, 94, 1)',
                                  border: '1px solid rgba(34, 197, 94, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor:
                                    actionLoading === `approve-request-${request.id}`
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity:
                                    actionLoading === `approve-request-${request.id}` ? 0.5 : 1,
                                }}
                              >
                                {actionLoading === `approve-request-${request.id}`
                                  ? 'Approving...'
                                  : 'Approve'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Transfer Ownership Section */}
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: 'rgba(251, 146, 60, 1)',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    👑 Transfer Ownership
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(251, 146, 60, 0.08)',
                      border: '1px solid rgba(251, 146, 60, 0.3)',
                      borderRadius: '8px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'rgba(209, 213, 219, 0.8)',
                        marginBottom: '12px',
                      }}
                    >
                      Transfer host privileges to another member. You will no longer be the host.
                    </p>

                    <select
                      value={selectedNewOwner}
                      onChange={(e) => setSelectedNewOwner(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(75, 85, 99, 0.5)',
                        borderRadius: '6px',
                        color: 'rgba(209, 213, 219, 1)',
                        fontSize: '14px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Select new owner...</option>
                      {otherMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.displayName}
                          {member.isOnline ? ' (Online)' : ' (Offline)'}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleTransferOwnership}
                      disabled={!selectedNewOwner || actionLoading === 'transfer-ownership'}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background:
                          !selectedNewOwner || actionLoading === 'transfer-ownership'
                            ? 'rgba(75, 85, 99, 0.3)'
                            : 'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(249, 115, 22, 0.8))',
                        color: 'white',
                        border:
                          !selectedNewOwner || actionLoading === 'transfer-ownership'
                            ? '1px solid rgba(75, 85, 99, 0.5)'
                            : '1px solid rgba(251, 146, 60, 0.6)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor:
                          !selectedNewOwner || actionLoading === 'transfer-ownership'
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          !selectedNewOwner || actionLoading === 'transfer-ownership' ? 0.5 : 1,
                      }}
                    >
                      {actionLoading === 'transfer-ownership'
                        ? 'Transferring...'
                        : 'Transfer Ownership'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="button"
            onClick={hasUnsavedAccessModeChanges ? undefined : onClose}
            disabled={hasUnsavedAccessModeChanges}
            title={
              hasUnsavedAccessModeChanges
                ? 'Please update access mode settings before closing'
                : undefined
            }
            style={{
              padding: '10px 20px',
              background: hasUnsavedAccessModeChanges
                ? 'rgba(75, 85, 99, 0.2)'
                : 'rgba(75, 85, 99, 0.3)',
              color: hasUnsavedAccessModeChanges
                ? 'rgba(156, 163, 175, 1)'
                : 'rgba(209, 213, 219, 1)',
              border: hasUnsavedAccessModeChanges
                ? '1px solid rgba(251, 146, 60, 0.4)'
                : '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: hasUnsavedAccessModeChanges ? 'not-allowed' : 'pointer',
              opacity: hasUnsavedAccessModeChanges ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!hasUnsavedAccessModeChanges) {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
              } else {
                e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.8)'
              }
            }}
            onMouseLeave={(e) => {
              if (!hasUnsavedAccessModeChanges) {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
              } else {
                e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.4)'
              }
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
