'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  SkillTutorialControlAction,
  SkillTutorialControlEvent,
} from '@/lib/classroom/socket-events'

interface UseTutorialControlResult {
  /** Whether connected to the socket */
  isConnected: boolean
  /** Send a control action to the student */
  sendControl: (action: SkillTutorialControlAction) => void
}

/**
 * Hook for teachers to send control events to a student's skill tutorial
 *
 * @param classroomId - The classroom ID (used for the socket channel)
 * @param playerId - The student's player ID
 * @param enabled - Whether control is enabled (default: true)
 */
export function useTutorialControl(
  classroomId: string | undefined,
  playerId: string | undefined,
  enabled = true
): UseTutorialControlResult {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Connect to socket and join classroom channel
  useEffect(() => {
    if (!classroomId || !playerId || !enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[TutorialControl] Connected, joining classroom channel:', classroomId)
      setIsConnected(true)
      // Join the classroom channel to send control events
      socket.emit('join-classroom', { classroomId })
    })

    socket.on('disconnect', () => {
      console.log('[TutorialControl] Disconnected')
      setIsConnected(false)
    })

    return () => {
      console.log('[TutorialControl] Cleaning up socket connection')
      socket.emit('leave-classroom', { classroomId })
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [classroomId, playerId, enabled])

  // Send control action to student
  const sendControl = useCallback(
    (action: SkillTutorialControlAction) => {
      if (!socketRef.current || !isConnected || !playerId) {
        console.warn('[TutorialControl] Cannot send control - not connected or no playerId')
        return
      }

      const event: SkillTutorialControlEvent = {
        playerId,
        action,
      }

      socketRef.current.emit('skill-tutorial-control', event)
      console.log('[TutorialControl] Sent control:', action)
    },
    [isConnected, playerId]
  )

  return {
    isConnected,
    sendControl,
  }
}
