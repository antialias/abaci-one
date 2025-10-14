import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { useViewerId } from './useViewerId'

export interface RoomMember {
  id: string
  userId: string
  displayName: string
  isOnline: boolean
  isCreator: boolean
}

export interface RoomPlayer {
  id: string
  name: string
  emoji: string
  color: string
}

export interface RoomData {
  id: string
  name: string
  code: string
  gameName: string
  accessMode: 'open' | 'password' | 'approval-only' | 'restricted' | 'locked' | 'retired'
  members: RoomMember[]
  memberPlayers: Record<string, RoomPlayer[]> // userId -> players
}

export interface CreateRoomParams {
  name: string | null
  gameName: string
  creatorName?: string
  gameConfig?: Record<string, unknown>
  accessMode?: 'open' | 'password' | 'approval-only' | 'restricted' | 'locked' | 'retired'
  password?: string
}

export interface JoinRoomResult {
  member: RoomMember
  room: RoomData
  activePlayers: RoomPlayer[]
  autoLeave?: {
    roomIds: string[]
    message: string
  }
}

/**
 * Query key factory for rooms
 */
export const roomKeys = {
  all: ['rooms'] as const,
  current: () => [...roomKeys.all, 'current'] as const,
}

/**
 * Fetch the user's current room
 */
async function fetchCurrentRoom(): Promise<RoomData | null> {
  const response = await fetch('/api/arcade/rooms/current')
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch current room')
  }
  const data = await response.json()
  if (!data.room) return null
  return {
    id: data.room.id,
    name: data.room.name,
    code: data.room.code,
    gameName: data.room.gameName,
    accessMode: data.room.accessMode || 'open',
    members: data.members || [],
    memberPlayers: data.memberPlayers || {},
  }
}

/**
 * Create a new room
 */
async function createRoomApi(params: CreateRoomParams): Promise<RoomData> {
  const response = await fetch('/api/arcade/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      gameName: params.gameName,
      creatorName: params.creatorName || 'Player',
      gameConfig: params.gameConfig || { difficulty: 6 },
      accessMode: params.accessMode,
      password: params.password,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to create room')
  }

  const data = await response.json()
  return {
    id: data.room.id,
    name: data.room.name,
    code: data.room.code,
    gameName: data.room.gameName,
    accessMode: data.room.accessMode || 'open',
    members: data.members || [],
    memberPlayers: data.memberPlayers || {},
  }
}

/**
 * Join a room
 */
async function joinRoomApi(params: {
  roomId: string
  displayName?: string
  password?: string
}): Promise<JoinRoomResult> {
  const response = await fetch(`/api/arcade/rooms/${params.roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: params.displayName || 'Player',
      password: params.password,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to join room')
  }

  const data = await response.json()
  return {
    ...data,
    room: {
      id: data.room.id,
      name: data.room.name,
      code: data.room.code,
      gameName: data.room.gameName,
      accessMode: data.room.accessMode || 'open',
      members: data.members || [],
      memberPlayers: data.memberPlayers || {},
    },
  }
}

/**
 * Leave a room
 */
async function leaveRoomApi(roomId: string): Promise<void> {
  const response = await fetch(`/api/arcade/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to leave room')
  }
}

/**
 * Get room by join code
 */
async function getRoomByCodeApi(code: string): Promise<RoomData> {
  const response = await fetch(`/api/arcade/rooms/code/${code}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Room not found')
    }
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to find room')
  }

  const data = await response.json()
  return {
    id: data.room.id,
    name: data.room.name,
    code: data.room.code,
    gameName: data.room.gameName,
    accessMode: data.room.accessMode || 'open',
    members: data.members || [],
    memberPlayers: data.memberPlayers || {},
  }
}

export interface ModerationEvent {
  type: 'kicked' | 'banned' | 'report' | 'invitation'
  data: {
    roomId?: string
    kickedBy?: string
    bannedBy?: string
    reason?: string
    reportId?: string
    reporterName?: string
    reportedUserName?: string
    reportedUserId?: string
    // Invitation fields
    invitationId?: string
    invitedBy?: string
    invitedByName?: string
    invitationType?: 'manual' | 'auto-unban' | 'auto-create'
    message?: string
  }
}

/**
 * Hook to fetch and subscribe to the user's current room data
 * Returns null if user is not in any room
 */
export function useRoomData() {
  const { data: userId } = useViewerId()
  const queryClient = useQueryClient()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [moderationEvent, setModerationEvent] = useState<ModerationEvent | null>(null)

  // Fetch current room with TanStack Query
  const {
    data: roomData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: roomKeys.current(),
    queryFn: fetchCurrentRoom,
    enabled: !!userId,
    staleTime: 30000, // Consider data fresh for 30 seconds
  })

  // Initialize socket connection when user is authenticated (regardless of room membership)
  useEffect(() => {
    if (!userId) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const sock = io({ path: '/api/socket' })

    sock.on('connect', () => {
      // Always join user-specific channel for personal notifications (invitations, bans, kicks)
      sock.emit('join-user-channel', { userId })

      // Join room channel only if user is in a room
      if (roomData?.id) {
        sock.emit('join-room', { roomId: roomData.id, userId })
      }
    })

    sock.on('disconnect', () => {
      // Socket disconnected
    })

    setSocket(sock)

    return () => {
      if (sock.connected) {
        // Leave the room before disconnecting (if in a room)
        if (roomData?.id) {
          sock.emit('leave-room', { roomId: roomData.id, userId })
        }
        sock.disconnect()
      }
    }
  }, [userId, roomData?.id])

  // Subscribe to real-time updates via socket
  useEffect(() => {
    if (!socket) return

    const handleRoomJoined = (data: {
      roomId: string
      members: RoomMember[]
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: data.members,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    const handleMemberJoined = (data: {
      roomId: string
      userId: string
      members: RoomMember[]
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: data.members,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    const handleMemberLeft = (data: {
      roomId: string
      userId: string
      members: RoomMember[]
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: data.members,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    const handleRoomPlayersUpdated = (data: {
      roomId: string
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    // Moderation event handlers
    const handleKickedFromRoom = (data: { roomId: string; kickedBy: string }) => {
      console.log('[useRoomData] User was kicked from room:', data)
      setModerationEvent({
        type: 'kicked',
        data: {
          roomId: data.roomId,
          kickedBy: data.kickedBy,
        },
      })
      // Clear room data since user was kicked
      queryClient.setQueryData(roomKeys.current(), null)
    }

    const handleBannedFromRoom = (data: { roomId: string; bannedBy: string; reason: string }) => {
      console.log('[useRoomData] User was banned from room:', data)
      setModerationEvent({
        type: 'banned',
        data: {
          roomId: data.roomId,
          bannedBy: data.bannedBy,
          reason: data.reason,
        },
      })
      // Clear room data since user was banned
      queryClient.setQueryData(roomKeys.current(), null)
    }

    const handleReportSubmitted = (data: {
      roomId: string
      report: {
        id: string
        reporterName: string
        reportedUserName: string
        reportedUserId: string
        reason: string
        createdAt: Date
      }
    }) => {
      console.log('[useRoomData] New report submitted:', data)
      setModerationEvent({
        type: 'report',
        data: {
          roomId: data.roomId,
          reportId: data.report.id,
          reporterName: data.report.reporterName,
          reportedUserName: data.report.reportedUserName,
          reportedUserId: data.report.reportedUserId,
          reason: data.report.reason,
        },
      })
    }

    const handleInvitationReceived = (data: {
      invitation: {
        id: string
        roomId: string
        invitedBy: string
        invitedByName: string
        invitationType?: 'manual' | 'auto-unban' | 'auto-create'
        message?: string
        createdAt: Date
      }
    }) => {
      console.log('[useRoomData] Room invitation received:', data)
      setModerationEvent({
        type: 'invitation',
        data: {
          roomId: data.invitation.roomId,
          invitationId: data.invitation.id,
          invitedBy: data.invitation.invitedBy,
          invitedByName: data.invitation.invitedByName,
          invitationType: data.invitation.invitationType,
          message: data.invitation.message,
        },
      })
    }

    socket.on('room-joined', handleRoomJoined)
    socket.on('member-joined', handleMemberJoined)
    socket.on('member-left', handleMemberLeft)
    socket.on('room-players-updated', handleRoomPlayersUpdated)
    socket.on('kicked-from-room', handleKickedFromRoom)
    socket.on('banned-from-room', handleBannedFromRoom)
    socket.on('report-submitted', handleReportSubmitted)
    socket.on('room-invitation-received', handleInvitationReceived)

    return () => {
      socket.off('room-joined', handleRoomJoined)
      socket.off('member-joined', handleMemberJoined)
      socket.off('member-left', handleMemberLeft)
      socket.off('room-players-updated', handleRoomPlayersUpdated)
      socket.off('kicked-from-room', handleKickedFromRoom)
      socket.off('banned-from-room', handleBannedFromRoom)
      socket.off('report-submitted', handleReportSubmitted)
      socket.off('room-invitation-received', handleInvitationReceived)
    }
  }, [socket, roomData?.id, queryClient])

  // Function to notify room members of player updates
  const notifyRoomOfPlayerUpdate = useCallback(() => {
    if (socket && roomData?.id && userId) {
      console.log('[useRoomData] Notifying room of player update')
      socket.emit('players-updated', { roomId: roomData.id, userId })
    }
  }, [socket, roomData?.id, userId])

  /**
   * Generate a shareable URL for the room using the join code
   */
  const getRoomShareUrl = useCallback((code: string): string => {
    return `${window.location.origin}/join/${code.toUpperCase()}`
  }, [])

  /**
   * Clear the moderation event after it's been handled
   */
  const clearModerationEvent = useCallback(() => {
    setModerationEvent(null)
  }, [])

  return {
    // Data
    roomData: roomData ?? null,
    isLoading,
    isInRoom: !!roomData,
    moderationEvent,
    // Actions
    refetch,
    getRoomShareUrl,
    notifyRoomOfPlayerUpdate,
    clearModerationEvent,
  }
}

/**
 * Hook: Create a room
 */
export function useCreateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRoomApi,
    onSuccess: (newRoom) => {
      // Optimistically set the cache with the new room data
      queryClient.setQueryData(roomKeys.current(), newRoom)
    },
  })
}

/**
 * Hook: Join a room
 */
export function useJoinRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: joinRoomApi,
    onSuccess: (result) => {
      // Optimistically set the cache with the joined room data
      queryClient.setQueryData(roomKeys.current(), result.room)
    },
  })
}

/**
 * Hook: Leave a room
 */
export function useLeaveRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leaveRoomApi,
    onSuccess: () => {
      // Optimistically clear the room data
      queryClient.setQueryData(roomKeys.current(), null)
    },
  })
}

/**
 * Hook: Get room by code
 */
export function useGetRoomByCode() {
  return useMutation({
    mutationFn: getRoomByCodeApi,
  })
}
