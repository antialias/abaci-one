'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { useStudentPresence } from './useClassroom'
import type {
  SkillTutorialStateEvent,
  SkillTutorialControlEvent,
  SkillTutorialControlAction,
} from '@/lib/classroom/socket-events'
import type { SkillTutorialBroadcastState } from '@/components/tutorial/SkillTutorialLauncher'

export type { SkillTutorialBroadcastState }

interface UseSkillTutorialBroadcastResult {
  /** Whether connected to the socket */
  isConnected: boolean
  /** Whether actively broadcasting */
  isBroadcasting: boolean
}

/**
 * Hook to broadcast skill tutorial state to observers via WebSocket
 *
 * Only broadcasts if the student is currently present in a classroom.
 * This enables teachers to observe student tutorials in real-time.
 *
 * @param playerId - The student's player ID
 * @param playerName - The student's display name
 * @param state - Current tutorial state (or null if not viewing a tutorial)
 * @param onControlReceived - Callback when a control event is received from teacher
 */
export function useSkillTutorialBroadcast(
  playerId: string | undefined,
  playerName: string | undefined,
  state: SkillTutorialBroadcastState | null,
  onControlReceived?: (action: SkillTutorialControlAction) => void
): UseSkillTutorialBroadcastResult {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  // Keep state in a ref so socket event handlers can access current state
  const stateRef = useRef<SkillTutorialBroadcastState | null>(null)
  stateRef.current = state

  // Keep callback in ref to avoid effect re-runs when callback changes
  const onControlReceivedRef = useRef(onControlReceived)
  onControlReceivedRef.current = onControlReceived

  // Keep player info in refs for stable socket event handlers
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId
  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName

  // Check if student is present in a classroom
  const { data: presence } = useStudentPresence(playerId)
  const isInClassroom = !!presence?.classroomId
  const classroomId = presence?.classroomId

  // Helper to broadcast current state (uses refs, no dependencies that change)
  const broadcastState = useCallback(() => {
    const currentState = stateRef.current
    const pid = playerIdRef.current
    const pname = playerNameRef.current
    if (!socketRef.current?.connected || !pid || !pname || !currentState) {
      return
    }

    const event: SkillTutorialStateEvent = {
      playerId: pid,
      playerName: pname,
      launcherState: currentState.launcherState,
      skillId: currentState.skillId,
      skillTitle: currentState.skillTitle,
      tutorialState: currentState.tutorialState,
    }

    socketRef.current.emit('skill-tutorial-state', event)
    console.log('[SkillTutorialBroadcast] Emitted skill-tutorial-state:', {
      launcherState: currentState.launcherState,
      skillId: currentState.skillId,
      hasTutorialState: !!currentState.tutorialState,
      tutorialStep: currentState.tutorialState?.currentStepIndex,
    })
  }, []) // No dependencies - uses refs

  // Connect to socket and join classroom channel when in classroom with active tutorial
  // Only depends on: whether we have a state, whether we're in classroom, and classroom ID
  const shouldConnect = !!state && !!playerId && !!playerName && isInClassroom && !!classroomId

  // Store classroomId in ref for use in socket handlers
  const classroomIdRef = useRef(classroomId)
  classroomIdRef.current = classroomId

  useEffect(() => {
    // Track if this effect is still mounted
    let isMounted = true

    if (!shouldConnect || !classroomId) {
      // Clean up if we were connected
      if (socketRef.current) {
        console.log(
          '[SkillTutorialBroadcast] Disconnecting - no longer in classroom or tutorial ended'
        )
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // Already connected to the same classroom? Don't create a new socket
    if (socketRef.current?.connected) {
      console.log('[SkillTutorialBroadcast] Already connected, skipping socket creation')
      return
    }

    // Clean up any existing socket before creating a new one
    if (socketRef.current) {
      console.log('[SkillTutorialBroadcast] Cleaning up existing disconnected socket')
      socketRef.current.disconnect()
      socketRef.current = null
    }

    // Create socket connection
    console.log(
      '[SkillTutorialBroadcast] Creating new socket connection for classroom:',
      classroomId
    )
    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    const currentClassroomId = classroomId // Capture for closure

    socket.on('connect', () => {
      // Only proceed if still mounted
      if (!isMounted) {
        console.log('[SkillTutorialBroadcast] Connected but effect unmounted, ignoring')
        return
      }
      console.log(
        '[SkillTutorialBroadcast] Connected, joining classroom channel:',
        currentClassroomId
      )
      setIsConnected(true)
      // Join the classroom channel for skill tutorial events
      socket.emit('join-classroom', { classroomId: currentClassroomId })
      // Broadcast current state immediately
      broadcastState()
    })

    socket.on('disconnect', () => {
      if (!isMounted) return
      console.log('[SkillTutorialBroadcast] Disconnected')
      setIsConnected(false)
    })

    // Listen for control events from teacher
    socket.on('skill-tutorial-control', (data: SkillTutorialControlEvent) => {
      if (!isMounted) return
      // Only handle events for this player - use ref for current value
      if (data.playerId !== playerIdRef.current) return

      console.log('[SkillTutorialBroadcast] Received control:', data.action)
      onControlReceivedRef.current?.(data.action)
    })

    return () => {
      isMounted = false
      console.log('[SkillTutorialBroadcast] Cleaning up socket connection')
      socket.emit('leave-classroom', { classroomId: currentClassroomId })
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
    // Only re-run when shouldConnect or classroomId actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, classroomId])

  // Broadcast state changes
  useEffect(() => {
    broadcastState()
  }, [
    broadcastState,
    state?.launcherState,
    state?.skillId,
    state?.tutorialState?.currentStepIndex,
    state?.tutorialState?.currentMultiStep,
    state?.tutorialState?.currentValue,
    state?.tutorialState?.isStepCompleted,
  ])

  return {
    isConnected,
    isBroadcasting: isConnected && isInClassroom && !!state,
  }
}
