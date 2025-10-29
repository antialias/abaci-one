import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
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
  gameName: string | null // Nullable to support game selection in room
  gameConfig?: Record<string, unknown> | null // Game-specific settings
  accessMode: 'open' | 'password' | 'approval-only' | 'restricted' | 'locked' | 'retired'
  members: RoomMember[]
  memberPlayers: Record<string, RoomPlayer[]> // userId -> players
}

export interface CreateRoomParams {
  name: string | null
  gameName?: string | null // Optional - rooms can be created without a game
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
    gameConfig: data.room.gameConfig || null,
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
      gameName: params.gameName || null,
      creatorName: params.creatorName || 'Player',
      gameConfig: params.gameConfig || null,
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
    gameConfig: data.room.gameConfig || null,
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
      gameConfig: data.room.gameConfig || null,
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
    gameConfig: data.room.gameConfig || null,
    accessMode: data.room.accessMode || 'open',
    members: data.members || [],
    memberPlayers: data.memberPlayers || {},
  }
}

export interface ModerationEvent {
  type: 'kicked' | 'banned' | 'report' | 'invitation' | 'join-request'
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
    // Join request fields
    requestId?: string
    requesterId?: string
    requesterName?: string
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
    const handleKickedFromRoom = (data: { roomId: string; kickedBy: string; reason?: string }) => {
      setModerationEvent({
        type: 'kicked',
        data: {
          roomId: data.roomId,
          kickedBy: data.kickedBy,
          reason: data.reason,
        },
      })
      // Clear room data since user was kicked
      queryClient.setQueryData(roomKeys.current(), null)
    }

    const handleBannedFromRoom = (data: { roomId: string; bannedBy: string; reason: string }) => {
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

    const handleJoinRequestSubmitted = (data: {
      roomId: string
      request: {
        id: string
        userId: string
        userName: string
        createdAt: Date
      }
    }) => {
      setModerationEvent({
        type: 'join-request',
        data: {
          roomId: data.roomId,
          requestId: data.request.id,
          requesterId: data.request.userId,
          requesterName: data.request.userName,
        },
      })
    }

    const handleRoomGameChanged = (data: {
      roomId: string
      gameName: string | null
      gameConfig?: Record<string, unknown>
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            gameName: data.gameName,
            // Only update gameConfig if it was provided in the broadcast
            ...(data.gameConfig !== undefined ? { gameConfig: data.gameConfig } : {}),
          }
        })
      }
    }

    const handleOwnershipTransferred = (data: {
      roomId: string
      oldOwnerId: string
      newOwnerId: string
      newOwnerName: string
      members: RoomMember[]
    }) => {
      if (data.roomId === roomData?.id) {
        queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: data.members,
          }
        })
      }
    }

    socket.on('room-joined', handleRoomJoined)
    socket.on('member-joined', handleMemberJoined)
    socket.on('member-left', handleMemberLeft)
    socket.on('room-players-updated', handleRoomPlayersUpdated)
    socket.on('kicked-from-room', handleKickedFromRoom)
    socket.on('banned-from-room', handleBannedFromRoom)
    socket.on('report-submitted', handleReportSubmitted)
    socket.on('room-invitation-received', handleInvitationReceived)
    socket.on('join-request-submitted', handleJoinRequestSubmitted)
    socket.on('room-game-changed', handleRoomGameChanged)
    socket.on('ownership-transferred', handleOwnershipTransferred)

    return () => {
      socket.off('room-joined', handleRoomJoined)
      socket.off('member-joined', handleMemberJoined)
      socket.off('member-left', handleMemberLeft)
      socket.off('room-players-updated', handleRoomPlayersUpdated)
      socket.off('kicked-from-room', handleKickedFromRoom)
      socket.off('banned-from-room', handleBannedFromRoom)
      socket.off('report-submitted', handleReportSubmitted)
      socket.off('room-invitation-received', handleInvitationReceived)
      socket.off('join-request-submitted', handleJoinRequestSubmitted)
      socket.off('room-game-changed', handleRoomGameChanged)
      socket.off('ownership-transferred', handleOwnershipTransferred)
    }
  }, [socket, roomData?.id, queryClient])

  // Function to notify room members of player updates
  const notifyRoomOfPlayerUpdate = useCallback(() => {
    if (socket && roomData?.id && userId) {
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

/**
 * Set game for a room
 */
async function setRoomGameApi(params: {
  roomId: string
  gameName: string
  gameConfig?: Record<string, unknown>
}): Promise<void> {
  // Only include gameConfig in the request if it was explicitly provided
  // Otherwise, we preserve the existing gameConfig in the database
  const body: { gameName: string; gameConfig?: Record<string, unknown> } = {
    gameName: params.gameName,
  }

  if (params.gameConfig !== undefined) {
    body.gameConfig = params.gameConfig
  }

  const response = await fetch(`/api/arcade/rooms/${params.roomId}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to set room game')
  }
}

/**
 * Hook: Set game for a room
 */
export function useSetRoomGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setRoomGameApi,
    onSuccess: (_, variables) => {
      // Update the cache with the new game
      queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
        if (!prev) return null
        return {
          ...prev,
          gameName: variables.gameName,
        }
      })
      // Refetch to get the full updated room data
      queryClient.invalidateQueries({ queryKey: roomKeys.current() })
    },
  })
}

/**
 * Clear/reset game for a room (host only)
 * This only clears gameName (returns to game selection) but preserves gameConfig
 * so settings persist when the user selects a game again.
 */
async function clearRoomGameApi(roomId: string): Promise<void> {
  const response = await fetch(`/api/arcade/rooms/${roomId}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameName: null,
      // DO NOT send gameConfig: null - we want to preserve settings!
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to clear room game')
  }
}

/**
 * Hook: Clear/reset game for a room (returns to game selection screen)
 */
export function useClearRoomGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearRoomGameApi,
    onSuccess: () => {
      // Update the cache to clear the game
      queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
        if (!prev) return null
        return {
          ...prev,
          gameName: null,
        }
      })
      // Refetch to get the full updated room data
      queryClient.invalidateQueries({ queryKey: roomKeys.current() })
    },
  })
}

/**
 * Update game config for current room (game-specific settings)
 */
async function updateGameConfigApi(params: {
  roomId: string
  gameConfig: Record<string, unknown>
}): Promise<void> {
  const response = await fetch(`/api/arcade/rooms/${params.roomId}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameConfig: params.gameConfig,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to update game config')
  }
}

/**
 * Hook: Update game config for current room
 * This allows games to persist their settings (e.g., difficulty, card count)
 */
export function useUpdateGameConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateGameConfigApi,
    onSuccess: (_, variables) => {
      // Update the cache with the new gameConfig
      queryClient.setQueryData<RoomData | null>(roomKeys.current(), (prev) => {
        if (!prev) return null
        return {
          ...prev,
          gameConfig: variables.gameConfig,
        }
      })
    },
  })
}

/**
 * Kick a user from the room (host only)
 */
async function kickUserFromRoomApi(params: { roomId: string; userId: string }): Promise<void> {
  const response = await fetch(`/api/arcade/rooms/${params.roomId}/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: params.userId }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to kick user')
  }
}

/**
 * Hook: Kick a user from the room (host only)
 */
export function useKickUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: kickUserFromRoomApi,
    onSuccess: () => {
      // The socket will handle updating members, but invalidate just in case
      queryClient.invalidateQueries({ queryKey: roomKeys.current() })
    },
  })
}
