import { useEffect, useState } from 'react'
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
  members: RoomMember[]
  memberPlayers: Record<string, RoomPlayer[]> // userId -> players
}

/**
 * Hook to fetch and subscribe to the user's current room data
 * Returns null if user is not in any room
 */
export function useRoomData() {
  const { data: userId, isPending: isUserIdPending } = useViewerId()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)

  // Fetch the user's current room
  useEffect(() => {
    if (!userId) {
      setRoomData(null)
      setHasAttemptedFetch(false)
      return
    }

    setIsLoading(true)
    setHasAttemptedFetch(false)

    // Fetch current room data
    fetch('/api/arcade/rooms/current')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch current room')
        return res.json()
      })
      .then((data) => {
        if (data.room) {
          const roomData = {
            id: data.room.id,
            name: data.room.name,
            code: data.room.code,
            gameName: data.room.gameName,
            members: data.members || [],
            memberPlayers: data.memberPlayers || {},
          }
          setRoomData(roomData)
        } else {
          setRoomData(null)
        }
        setIsLoading(false)
        setHasAttemptedFetch(true)
      })
      .catch((error) => {
        console.error('[useRoomData] Failed to fetch room data:', error)
        setRoomData(null)
        setIsLoading(false)
        setHasAttemptedFetch(true)
      })
  }, [userId])

  // Initialize socket connection when user has a room
  useEffect(() => {
    if (!roomData?.id || !userId) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const sock = io({ path: '/api/socket' })

    sock.on('connect', () => {
      // Join the room to receive updates
      sock.emit('join-room', { roomId: roomData.id, userId })
    })

    sock.on('disconnect', () => {
      // Socket disconnected
    })

    setSocket(sock)

    return () => {
      if (sock.connected) {
        // Leave the room before disconnecting
        sock.emit('leave-room', { roomId: roomData.id, userId })
        sock.disconnect()
      }
    }
  }, [roomData?.id, userId])

  // Subscribe to real-time updates via socket
  useEffect(() => {
    if (!socket || !roomData?.id) return

    const handleRoomJoined = (data: {
      roomId: string
      members: RoomMember[]
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomData.id) {
        setRoomData((prev) => {
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
      if (data.roomId === roomData.id) {
        setRoomData((prev) => {
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
      if (data.roomId === roomData.id) {
        setRoomData((prev) => {
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
      if (data.roomId === roomData.id) {
        setRoomData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    socket.on('room-joined', handleRoomJoined)
    socket.on('member-joined', handleMemberJoined)
    socket.on('member-left', handleMemberLeft)
    socket.on('room-players-updated', handleRoomPlayersUpdated)

    return () => {
      socket.off('room-joined', handleRoomJoined)
      socket.off('member-joined', handleMemberJoined)
      socket.off('member-left', handleMemberLeft)
      socket.off('room-players-updated', handleRoomPlayersUpdated)
    }
  }, [socket, roomData?.id])

  return {
    roomData,
    // Loading if: userId is pending, currently fetching, or have userId but haven't tried fetching yet
    isLoading: isUserIdPending || isLoading || (!!userId && !hasAttemptedFetch),
    isInRoom: !!roomData,
  }
}
