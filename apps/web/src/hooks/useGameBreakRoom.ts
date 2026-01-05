'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { roomKeys, useCreateRoom, useLeaveRoom, useSetRoomGame, type RoomData } from './useRoomData'

export interface UseGameBreakRoomOptions {
  studentName: string
  enabled: boolean
  onRoomReady?: (room: RoomData) => void
  onError?: (error: Error) => void
}

export interface UseGameBreakRoomResult {
  room: RoomData | null
  isCreating: boolean
  isSettingGame: boolean
  error: Error | null
  selectGame: (gameName: string) => Promise<void>
  cleanup: () => Promise<void>
}

export function useGameBreakRoom({
  studentName,
  enabled,
  onRoomReady,
  onError,
}: UseGameBreakRoomOptions): UseGameBreakRoomResult {
  const queryClient = useQueryClient()
  const [room, setRoom] = useState<RoomData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const roomIdRef = useRef<string | null>(null)
  const isCleaningUpRef = useRef(false)
  const hasStartedRef = useRef(false)

  const onRoomReadyRef = useRef(onRoomReady)
  const onErrorRef = useRef(onError)
  onRoomReadyRef.current = onRoomReady
  onErrorRef.current = onError

  const createRoom = useCreateRoom()
  const leaveRoom = useLeaveRoom()
  const setRoomGame = useSetRoomGame()

  const createRoomRef = useRef(createRoom)
  const leaveRoomRef = useRef(leaveRoom)
  createRoomRef.current = createRoom
  leaveRoomRef.current = leaveRoom

  // Track if room creation is in progress to prevent duplicates
  const isCreatingRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false
      return
    }

    // Skip if already started or already have a room
    if (
      hasStartedRef.current ||
      roomIdRef.current ||
      isCleaningUpRef.current ||
      isCreatingRef.current
    ) {
      return
    }
    hasStartedRef.current = true
    isCreatingRef.current = true

    async function initRoom() {
      try {
        const result = await createRoomRef.current.mutateAsync({
          name: `${studentName}'s Game Break`,
          gameName: null,
          accessMode: 'open',
        })
        const newRoom = result.room

        // Always set the room - don't check mounted flag during Strict Mode
        // The cleanup() function handles proper teardown when truly unmounting
        if (!roomIdRef.current) {
          roomIdRef.current = newRoom.id
          setRoom(newRoom)
          onRoomReadyRef.current?.(newRoom)
        } else {
          // Another room was already set (shouldn't happen with guards), leave this one
          console.log('[useGameBreakRoom] Room already exists, leaving duplicate')
          await leaveRoomRef.current.mutateAsync(newRoom.id).catch(() => {})
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onErrorRef.current?.(error)
      } finally {
        isCreatingRef.current = false
      }
    }

    initRoom()

    // No cleanup needed here - cleanup() handles room teardown
  }, [enabled, studentName])

  const selectGame = useCallback(
    async (gameName: string) => {
      if (!room) {
        throw new Error('No room available')
      }

      await setRoomGame.mutateAsync({
        roomId: room.id,
        gameName,
      })

      setRoom((prev) => (prev ? { ...prev, gameName } : null))
    },
    [room, setRoomGame]
  )

  const cleanup = useCallback(async () => {
    if (isCleaningUpRef.current) return
    isCleaningUpRef.current = true

    const roomId = roomIdRef.current
    if (roomId) {
      try {
        await leaveRoomRef.current.mutateAsync(roomId)
      } catch {
        // Intentionally swallow cleanup errors
      }
      roomIdRef.current = null
      queryClient.setQueryData(roomKeys.current(), null)
    }

    setRoom(null)
    hasStartedRef.current = false
    isCleaningUpRef.current = false
  }, [queryClient])

  return {
    room,
    isCreating: createRoom.isPending,
    isSettingGame: setRoomGame.isPending,
    error,
    selectGame,
    cleanup,
  }
}
