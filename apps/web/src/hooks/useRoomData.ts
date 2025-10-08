import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'

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
 * Hook to fetch and subscribe to room data when on a room page
 * Returns null if not on a room page
 */
export function useRoomData() {
  const pathname = usePathname()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Extract roomId from pathname like /arcade/rooms/[roomId]/...
  const roomId = pathname?.match(/\/arcade\/rooms\/([^/]+)/)?.[1]

  // Initialize socket connection when on a room page
  useEffect(() => {
    if (!roomId) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const sock = io({ path: '/api/socket' })
    setSocket(sock)

    return () => {
      sock.disconnect()
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setRoomData(null)
      return
    }

    setIsLoading(true)

    // Fetch initial room data
    fetch(`/api/arcade/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch room')
        return res.json()
      })
      .then((data) => {
        setRoomData({
          id: data.room.id,
          name: data.room.name,
          code: data.room.code,
          gameName: data.room.gameName,
          members: data.members || [],
          memberPlayers: data.memberPlayers || {},
        })
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Failed to fetch room data:', error)
        setIsLoading(false)
      })
  }, [roomId])

  // Subscribe to real-time updates via socket
  useEffect(() => {
    if (!socket || !roomId) return

    const handleMemberJoined = (data: {
      roomId: string
      userId: string
      members: RoomMember[]
      memberPlayers: Record<string, RoomPlayer[]>
    }) => {
      if (data.roomId === roomId) {
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
      if (data.roomId === roomId) {
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
      if (data.roomId === roomId) {
        setRoomData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            memberPlayers: data.memberPlayers,
          }
        })
      }
    }

    socket.on('member-joined', handleMemberJoined)
    socket.on('member-left', handleMemberLeft)
    socket.on('room-players-updated', handleRoomPlayersUpdated)

    return () => {
      socket.off('member-joined', handleMemberJoined)
      socket.off('member-left', handleMemberLeft)
      socket.off('room-players-updated', handleRoomPlayersUpdated)
    }
  }, [socket, roomId])

  return {
    roomData,
    isLoading,
    isInRoom: !!roomId,
  }
}
