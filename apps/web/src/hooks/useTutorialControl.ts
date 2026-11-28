'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type {
  SkillTutorialControlAction,
  SkillTutorialControlEvent,
} from '@/lib/classroom/socket-events'
import { createSocket } from '@/lib/socket'

interface UseTutorialControlResult {
  /** Whether connected to the socket */
  isConnected: boolean
  /** Send a control action to the student */
  sendControl: (action: SkillTutorialControlAction) => void
}

/**
 * Hook for teachers to send control events to a student's skill tutorial
 *
 * The server checks `control-tutorial` against the socket's verified viewer
 * and sends the control to the student's own channel `player:<id>`, where the
 * student's device listens (§10 P4d-9). Sending needs no room joined.
 *
 * @param classroomId - The student's classroom (control is offered only within one)
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

  // Connect to socket
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
    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[TutorialControl] Connected')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[TutorialControl] Disconnected')
      setIsConnected(false)
    })

    return () => {
      console.log('[TutorialControl] Cleaning up socket connection')
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
