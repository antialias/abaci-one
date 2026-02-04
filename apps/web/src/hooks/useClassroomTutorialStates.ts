'use client'

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import type { SkillTutorialStateEvent } from '@/lib/classroom/socket-events'

/**
 * Tutorial state for a student in the classroom
 */
export interface ClassroomTutorialState extends SkillTutorialStateEvent {
  /** When this state was last updated */
  lastUpdatedAt: number
}

/**
 * Hook to listen for skill tutorial state events from students in a classroom
 *
 * Teachers use this to see which students are viewing tutorials and observe them.
 *
 * @param classroomId - The classroom ID to listen for tutorial events
 * @param enabled - Whether to enable listening (default: true)
 */
export function useClassroomTutorialStates(
  classroomId: string | undefined,
  enabled = true
): {
  tutorialStates: Map<string, ClassroomTutorialState>
  isConnected: boolean
} {
  const [tutorialStates, setTutorialStates] = useState<Map<string, ClassroomTutorialState>>(
    new Map()
  )
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!classroomId || !enabled) {
      setTutorialStates(new Map())
      return
    }

    // Create socket connection
    const socket: Socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      console.log('[ClassroomTutorialStates] Connected, joining classroom:', classroomId)
      setIsConnected(true)
      // Join the classroom channel to receive tutorial events
      socket.emit('join-classroom', { classroomId })
    })

    socket.on('disconnect', () => {
      console.log('[ClassroomTutorialStates] Disconnected')
      setIsConnected(false)
    })

    // Listen for skill tutorial state events
    socket.on('skill-tutorial-state', (data: SkillTutorialStateEvent) => {
      console.log('[ClassroomTutorialStates] Received skill-tutorial-state:', {
        playerId: data.playerId,
        launcherState: data.launcherState,
        skillId: data.skillId,
        hasTutorialState: !!data.tutorialState,
        tutorialStep: data.tutorialState?.currentStepIndex,
        currentValue: data.tutorialState?.currentValue,
      })

      setTutorialStates((prev) => {
        const newMap = new Map(prev)

        // If tutorial is complete, remove from map after a short delay
        if (data.launcherState === 'complete') {
          // Keep it briefly so UI can show completion, then remove
          setTimeout(() => {
            setTutorialStates((current) => {
              const updated = new Map(current)
              updated.delete(data.playerId)
              return updated
            })
          }, 2000)
        }

        // Update the state
        newMap.set(data.playerId, {
          ...data,
          lastUpdatedAt: Date.now(),
        })

        return newMap
      })
    })

    // Clean up stale states (if no update for 30 seconds, assume tutorial ended)
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      const staleThreshold = 30 * 1000 // 30 seconds

      setTutorialStates((prev) => {
        const newMap = new Map(prev)
        let hasChanges = false

        for (const [playerId, state] of newMap) {
          if (now - state.lastUpdatedAt > staleThreshold) {
            newMap.delete(playerId)
            hasChanges = true
          }
        }

        return hasChanges ? newMap : prev
      })
    }, 10000) // Check every 10 seconds

    return () => {
      console.log('[ClassroomTutorialStates] Cleaning up')
      clearInterval(cleanupInterval)
      socket.emit('leave-classroom', { classroomId })
      socket.disconnect()
    }
  }, [classroomId, enabled])

  return {
    tutorialStates,
    isConnected,
  }
}
