'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { SkillTutorialBroadcastState } from '@/components/tutorial/SkillTutorialLauncher'
import type {
  SkillTutorialControlAction,
  SkillTutorialControlEvent,
  SkillTutorialStateEvent,
} from '@/lib/classroom/socket-events'
import { createSocket } from '@/lib/socket'
import { useStudentPresence } from './useClassroom'

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
 * Channels (§10 P4d-9, socket identity PR 3): the state goes to the server,
 * which sends it to the teacher-only room `classroom:<id>` of every classroom
 * the player is enrolled in, decided there by enrollment. The device joins no
 * classroom room, so the state needs no join first: the first frame, sent on
 * connect, reaches the teacher like every later one. Controls come back on the
 * player's own channel `player:<id>` (`join-player`, gated at `view`).
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

  // Connect while the present student has a tutorial open
  const shouldConnect = !!state && !!playerId && !!playerName && isInClassroom && !!classroomId

  useEffect(() => {
    // Track if this effect is still mounted
    let isMounted = true

    if (!shouldConnect || !playerId) {
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

    // Already connected? Don't create a new socket
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
    console.log('[SkillTutorialBroadcast] Creating new socket connection for player:', playerId)
    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    const currentPlayerId = playerId // Capture for closure

    socket.on('connect', () => {
      // Only proceed if still mounted
      if (!isMounted) {
        console.log('[SkillTutorialBroadcast] Connected but effect unmounted, ignoring')
        return
      }
      console.log('[SkillTutorialBroadcast] Connected, joining player channel:', currentPlayerId)
      setIsConnected(true)
      // The teacher's controls come on the player's own channel
      socket.emit('join-player', { playerId: currentPlayerId })
      // Broadcast current state immediately (routed by enrollment, no room needed)
      broadcastState()
    })

    socket.on('disconnect', () => {
      if (!isMounted) return
      console.log('[SkillTutorialBroadcast] Disconnected')
      setIsConnected(false)
    })

    // Listen for control events from teacher (on `player:<id>`)
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
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
    // Only re-run when shouldConnect or the player actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, playerId])

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
