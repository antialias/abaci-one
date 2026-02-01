'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { TaskStatus } from '@/db/schema/background-tasks'

/**
 * Event received from the task system
 */
export interface TaskEvent {
  taskId: string
  eventType: string
  payload: unknown
  createdAt: Date | string
  replayed?: boolean
}

/**
 * State of a background task
 */
export interface TaskState<TOutput = unknown> {
  id: string
  type: string
  status: TaskStatus
  progress: number
  progressMessage: string | null
  input: unknown
  output: TOutput | null
  error: string | null
  createdAt: Date | string
  startedAt: Date | string | null
  completedAt: Date | string | null
  userId: string | null
  events: TaskEvent[]
}

interface UseBackgroundTaskResult<TOutput = unknown> {
  /** Current task state (null if not yet loaded) */
  state: TaskState<TOutput> | null
  /** Whether connected to the socket */
  isConnected: boolean
  /** Whether currently loading initial state */
  isLoading: boolean
  /** Error message if subscription failed */
  error: string | null
  /** Cancel the task */
  cancel: () => void
}

/**
 * Hook to subscribe to background task updates via Socket.IO
 *
 * Provides real-time updates for long-running tasks with automatic event replay
 * on page reload.
 *
 * @param taskId - The task ID to subscribe to (null to not subscribe)
 * @returns Task state, connection status, and control methods
 *
 * @example
 * ```tsx
 * function TaskProgress({ taskId }: { taskId: string }) {
 *   const { state, cancel } = useBackgroundTask<MyOutput>(taskId)
 *
 *   if (!state) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       <p>Status: {state.status}</p>
 *       <p>Progress: {state.progress}%</p>
 *       {state.status === 'running' && <button onClick={cancel}>Cancel</button>}
 *       {state.output && <pre>{JSON.stringify(state.output)}</pre>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useBackgroundTask<TOutput = unknown>(
  taskId: string | null
): UseBackgroundTaskResult<TOutput> {
  const [state, setState] = useState<TaskState<TOutput> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!taskId) {
      // Clean up if taskId becomes null
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
        setState(null)
        setError(null)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    const handleConnect = () => {
      console.log('[useBackgroundTask] Connected, subscribing to task:', taskId)
      setIsConnected(true)
      socket.emit('task:subscribe', taskId)
    }

    socket.on('connect', handleConnect)

    // If already connected (shared Manager), trigger manually
    if (socket.connected) {
      handleConnect()
    }

    socket.on('disconnect', () => {
      console.log('[useBackgroundTask] Disconnected')
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[useBackgroundTask] Connection error:', err)
      setError('Failed to connect to task server')
      setIsLoading(false)
    })

    // Handle initial task state
    socket.on('task:state', (task: TaskState<TOutput>) => {
      console.log('[useBackgroundTask] Received task state:', task.status)
      setState((prev) => ({
        ...task,
        events: prev?.events ?? [],
      }))
      setIsLoading(false)
    })

    // Handle task events (real-time and replayed)
    socket.on('task:event', (event: TaskEvent) => {
      if (event.taskId !== taskId) return

      console.log('[useBackgroundTask] Received event:', event.eventType, event.replayed ? '(replayed)' : '')

      setState((prev) => {
        if (!prev) return prev

        const newState = {
          ...prev,
          events: [...prev.events, event],
        }

        // Update state based on event type
        switch (event.eventType) {
          case 'started':
            newState.status = 'running'
            break
          case 'progress': {
            const payload = event.payload as { progress: number; message?: string }
            newState.progress = payload.progress
            newState.progressMessage = payload.message ?? null
            break
          }
          case 'completed': {
            const payload = event.payload as { output: TOutput }
            newState.status = 'completed'
            newState.progress = 100
            newState.output = payload.output
            break
          }
          case 'failed': {
            const payload = event.payload as { error: string }
            newState.status = 'failed'
            newState.error = payload.error
            break
          }
          case 'cancelled':
            newState.status = 'cancelled'
            break
        }

        return newState
      })
    })

    // Handle errors
    socket.on('task:error', (data: { taskId: string; error: string }) => {
      if (data.taskId === taskId) {
        console.error('[useBackgroundTask] Error:', data.error)
        setError(data.error)
        setIsLoading(false)
      }
    })

    return () => {
      console.log('[useBackgroundTask] Cleaning up')
      socket.emit('task:unsubscribe', taskId)
      socket.disconnect()
      socketRef.current = null
    }
  }, [taskId])

  const cancel = useCallback(() => {
    if (socketRef.current && taskId) {
      socketRef.current.emit('task:cancel', taskId)
    }
  }, [taskId])

  return {
    state,
    isConnected,
    isLoading,
    error,
    cancel,
  }
}
