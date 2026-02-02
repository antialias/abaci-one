'use client'

/**
 * Admin Tasks Monitor
 *
 * Real-time view of background tasks as they progress through stages.
 * Auto-updates via Socket.IO subscriptions.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'

interface TaskEvent {
  id: number
  taskId: string
  eventType: string
  payload: unknown
  createdAt: string
  replayed?: boolean
}

interface Task {
  id: string
  type: string
  status: string
  progress: number
  progressMessage: string | null
  error: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  events: TaskEvent[]
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const subscribedTasksRef = useRef<Set<string>>(new Set())

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tasks')
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = await response.json()
      setTasks(data.tasks)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Subscribe to a task's updates
  const subscribeToTask = useCallback((taskId: string) => {
    if (!socketRef.current || subscribedTasksRef.current.has(taskId)) return

    console.log('[AdminTasks] Subscribing to task:', taskId)
    socketRef.current.emit('task:subscribe', taskId)
    subscribedTasksRef.current.add(taskId)
  }, [])

  // Initialize socket and fetch tasks
  useEffect(() => {
    fetchTasks()

    // Set up polling for new tasks
    const pollInterval = setInterval(fetchTasks, 5000)

    // Set up Socket.IO
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[AdminTasks] Socket connected')
      // Re-subscribe to all active tasks
      subscribedTasksRef.current.forEach((taskId) => {
        socket.emit('task:subscribe', taskId)
      })
    })

    // Handle task state updates
    socket.on('task:state', (taskState: Partial<Task> & { id: string }) => {
      console.log('[AdminTasks] Received task:state:', taskState.id, taskState.status)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskState.id ? { ...t, ...taskState, events: t.events } : t))
      )
    })

    // Handle task events
    socket.on(
      'task:event',
      (event: {
        taskId: string
        eventType: string
        payload: unknown
        createdAt: string
        replayed?: boolean
      }) => {
        console.log('[AdminTasks] Received task:event:', event.taskId, event.eventType)

        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== event.taskId) return t

            const newEvent: TaskEvent = {
              id: Date.now(),
              taskId: event.taskId,
              eventType: event.eventType,
              payload: event.payload,
              createdAt: event.createdAt,
              replayed: event.replayed,
            }

            // Update task based on event type
            const updates: Partial<Task> = {}
            const payload = event.payload as Record<string, unknown>

            switch (event.eventType) {
              case 'started':
                updates.status = 'running'
                break
              case 'progress':
                updates.progress = (payload.progress as number) ?? t.progress
                updates.progressMessage = (payload.message as string) ?? t.progressMessage
                break
              case 'completed':
                updates.status = 'completed'
                updates.progress = 100
                break
              case 'failed':
                updates.status = 'failed'
                updates.error = (payload.error as string) ?? 'Unknown error'
                break
              case 'cancelled':
                updates.status = 'cancelled'
                break
            }

            return {
              ...t,
              ...updates,
              events: [...t.events, newEvent],
            }
          })
        )
      }
    )

    return () => {
      clearInterval(pollInterval)
      socket.disconnect()
      socketRef.current = null
    }
  }, [fetchTasks])

  // Subscribe to active tasks when task list changes
  useEffect(() => {
    const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'running')
    activeTasks.forEach((task) => subscribeToTask(task.id))
  }, [tasks, subscribeToTask])

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#888'
      case 'running':
        return '#2196F3'
      case 'completed':
        return '#4CAF50'
      case 'failed':
        return '#f44336'
      case 'cancelled':
        return '#FF9800'
      default:
        return '#888'
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleTimeString()
  }

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return '-'
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date()
    const ms = endDate.getTime() - startDate.getTime()
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  if (loading) {
    return (
      <div className={css({ minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#eee' })}>
        <AppNavBar />
        <div className={css({ paddingTop: '56px' })}>
          <AdminNav />
        </div>
        <div className={css({ padding: '24px', fontFamily: 'monospace' })}>Loading tasks...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={css({ minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#eee' })}>
        <AppNavBar />
        <div className={css({ paddingTop: '56px' })}>
          <AdminNav />
        </div>
        <div className={css({ padding: '24px', fontFamily: 'monospace', color: '#f44336' })}>
          Error: {error}
        </div>
      </div>
    )
  }

  // AdminNav height is ~54px, AppNavBar is 56px
  const headerHeight = 56 + 54

  return (
    <div
      className={css({
        minHeight: '100vh',
        backgroundColor: '#1a1a2e',
        color: '#eee',
      })}
    >
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div
        className={css({
          display: 'flex',
          height: `calc(100vh - ${headerHeight}px)`,
          fontFamily: 'monospace',
          fontSize: '13px',
        })}
      >
        {/* Task List */}
        <div
          className={css({
            width: '400px',
            borderRight: '1px solid #333',
            overflow: 'auto',
          })}
        >
          <div
            className={css({
              padding: '12px 16px',
              borderBottom: '1px solid #333',
              backgroundColor: '#16213e',
            })}
          >
            <div className={css({ fontWeight: 'bold', fontSize: '14px' })}>
              Background Tasks ({tasks.length})
            </div>
            <div className={css({ fontSize: '11px', color: '#8b949e', marginTop: '4px' })}>
              Worksheet parsing, vision training, and other async jobs
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className={css({ padding: '16px', color: '#888' })}>No tasks found</div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={css({
                  padding: '12px 16px',
                  borderBottom: '1px solid #2a2a4a',
                  cursor: 'pointer',
                  backgroundColor: selectedTaskId === task.id ? '#2a2a5a' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#2a2a4a',
                  },
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  })}
                >
                  <span className={css({ fontWeight: 'bold' })}>{task.type}</span>
                  <span
                    className={css({
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      backgroundColor: getStatusColor(task.status),
                      color: 'white',
                    })}
                  >
                    {task.status}
                  </span>
                </div>
                <div className={css({ fontSize: '11px', color: '#888', marginBottom: '4px' })}>
                  {task.id}
                </div>
                {(task.status === 'running' || task.status === 'pending') && (
                  <div className={css({ marginTop: '8px' })}>
                    <div
                      className={css({
                        height: '4px',
                        backgroundColor: '#333',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      })}
                    >
                      <div
                        className={css({
                          height: '100%',
                          backgroundColor: '#2196F3',
                          transition: 'width 0.3s',
                        })}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className={css({ fontSize: '10px', color: '#888', marginTop: '4px' })}>
                      {task.progress}% - {task.progressMessage || 'Working...'}
                    </div>
                  </div>
                )}
                {task.error && (
                  <div className={css({ fontSize: '11px', color: '#f44336', marginTop: '4px' })}>
                    {task.error}
                  </div>
                )}
                <div className={css({ fontSize: '10px', color: '#666', marginTop: '4px' })}>
                  {formatTime(task.createdAt)} | Duration:{' '}
                  {formatDuration(task.startedAt, task.completedAt)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Task Details */}
        <div className={css({ flex: 1, overflow: 'auto' })}>
          {selectedTask ? (
            <div className={css({ padding: '16px' })}>
              <h2 className={css({ marginBottom: '16px', fontSize: '18px' })}>
                Task: {selectedTask.type}
              </h2>

              <div className={css({ marginBottom: '24px' })}>
                <table className={css({ width: '100%', borderCollapse: 'collapse' })}>
                  <tbody>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888', width: '120px' })}>
                        ID
                      </td>
                      <td className={css({ padding: '4px 8px' })}>{selectedTask.id}</td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Status</td>
                      <td className={css({ padding: '4px 8px' })}>
                        <span
                          className={css({
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            backgroundColor: getStatusColor(selectedTask.status),
                            color: 'white',
                          })}
                        >
                          {selectedTask.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Progress</td>
                      <td className={css({ padding: '4px 8px' })}>{selectedTask.progress}%</td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Message</td>
                      <td className={css({ padding: '4px 8px' })}>
                        {selectedTask.progressMessage || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Created</td>
                      <td className={css({ padding: '4px 8px' })}>
                        {formatTime(selectedTask.createdAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Started</td>
                      <td className={css({ padding: '4px 8px' })}>
                        {formatTime(selectedTask.startedAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Completed</td>
                      <td className={css({ padding: '4px 8px' })}>
                        {formatTime(selectedTask.completedAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className={css({ padding: '4px 8px', color: '#888' })}>Duration</td>
                      <td className={css({ padding: '4px 8px' })}>
                        {formatDuration(selectedTask.startedAt, selectedTask.completedAt)}
                      </td>
                    </tr>
                    {selectedTask.error && (
                      <tr>
                        <td className={css({ padding: '4px 8px', color: '#888' })}>Error</td>
                        <td className={css({ padding: '4px 8px', color: '#f44336' })}>
                          {selectedTask.error}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <h3 className={css({ marginBottom: '12px', fontSize: '14px' })}>
                Events ({selectedTask.events.length})
              </h3>

              <div
                className={css({
                  maxHeight: '60vh',
                  overflow: 'auto',
                  backgroundColor: '#0d1117',
                  borderRadius: '8px',
                  padding: '8px',
                })}
              >
                {selectedTask.events.length === 0 ? (
                  <div className={css({ padding: '16px', color: '#888' })}>No events yet</div>
                ) : (
                  selectedTask.events.map((event, index) => (
                    <div
                      key={event.id || index}
                      className={css({
                        padding: '8px 12px',
                        borderBottom: '1px solid #21262d',
                        '&:last-child': { borderBottom: 'none' },
                      })}
                    >
                      <div
                        className={css({
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        })}
                      >
                        <span
                          className={css({
                            fontWeight: 'bold',
                            color: getEventColor(event.eventType),
                          })}
                        >
                          {event.eventType}
                          {event.replayed && (
                            <span
                              className={css({
                                color: '#888',
                                fontWeight: 'normal',
                                marginLeft: '8px',
                              })}
                            >
                              (replayed)
                            </span>
                          )}
                        </span>
                        <span className={css({ fontSize: '10px', color: '#666' })}>
                          {formatTime(event.createdAt)}
                        </span>
                      </div>
                      <pre
                        className={css({
                          fontSize: '11px',
                          color: '#8b949e',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          maxHeight: '200px',
                          overflow: 'auto',
                        })}
                      >
                        {formatPayload(event.payload)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#888',
              })}
            >
              Select a task to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'started':
    case 'parsing_started':
    case 'reparse_started':
      return '#2196F3'
    case 'progress':
      return '#888'
    case 'reasoning':
      return '#9c27b0'
    case 'output_delta':
      return '#ff9800'
    case 'problem_start':
      return '#00bcd4'
    case 'problem_complete':
      return '#8bc34a'
    case 'complete':
    case 'completed':
      return '#4CAF50'
    case 'error':
    case 'failed':
    case 'problem_error':
      return '#f44336'
    case 'cancelled':
      return '#FF9800'
    default:
      return '#888'
  }
}

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '-'

  try {
    const str = JSON.stringify(payload, null, 2)
    // Truncate very long strings (like base64 images)
    if (str.length > 2000) {
      return str.substring(0, 2000) + '\n... (truncated)'
    }
    return str
  } catch {
    return String(payload)
  }
}
