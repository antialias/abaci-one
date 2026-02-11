'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { css } from '../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'

interface TaskSummary {
  id: string
  type: string
  status: string
  progress: number
  progressMessage: string | null
  createdAt: string
  completedAt: string | null
}

interface Stats {
  total: number
  running: number
  pending: number
  completed: number
  failed: number
  cancelled: number
}

/**
 * Admin Dashboard
 *
 * Live overview of system status with auto-updating task monitor.
 */
export default function AdminDashboardPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const socketRef = useRef<Socket | null>(null)
  const subscribedTasksRef = useRef<Set<string>>(new Set())

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/admin/tasks?limit=20')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks)

        // Calculate stats
        const newStats: Stats = {
          total: data.tasks.length,
          running: 0,
          pending: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }
        for (const task of data.tasks) {
          if (task.status in newStats) {
            newStats[task.status as keyof Stats]++
          }
        }
        setStats(newStats)
        setLastUpdate(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to task updates
  const subscribeToTask = (taskId: string) => {
    if (!socketRef.current || subscribedTasksRef.current.has(taskId)) return
    socketRef.current.emit('task:subscribe', taskId)
    subscribedTasksRef.current.add(taskId)
  }

  useEffect(() => {
    fetchTasks()
    const pollInterval = setInterval(fetchTasks, 3000)

    // Socket.IO for live updates
    const socket = createSocket({ reconnection: true })
    socketRef.current = socket

    socket.on('connect', () => {
      subscribedTasksRef.current.forEach((taskId) => {
        socket.emit('task:subscribe', taskId)
      })
    })

    socket.on('task:event', (event: { taskId: string; eventType: string; payload: unknown }) => {
      const payload = event.payload as Record<string, unknown>

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== event.taskId) return t

          const updates: Partial<TaskSummary> = {}
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
              updates.completedAt = new Date().toISOString()
              break
            case 'failed':
              updates.status = 'failed'
              break
            case 'cancelled':
              updates.status = 'cancelled'
              break
          }

          return { ...t, ...updates }
        })
      )
      setLastUpdate(new Date())
    })

    return () => {
      clearInterval(pollInterval)
      socket.disconnect()
    }
  }, [])

  // Subscribe to active tasks
  useEffect(() => {
    tasks
      .filter((t) => t.status === 'pending' || t.status === 'running')
      .forEach((task) => subscribeToTask(task.id))
  }, [tasks])

  const activeTasks = tasks.filter((t) => t.status === 'running' || t.status === 'pending')
  const recentTasks = tasks.slice(0, 10)

  return (
    <div
      className={css({
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
      })}
    >
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>

      <div
        className={css({
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
        })}
      >
        {/* Header */}
        <div className={css({ marginBottom: '24px' })}>
          <h1 className={css({ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' })}>
            System Status
          </h1>
          <p className={css({ fontSize: '13px', color: '#8b949e' })}>
            Real-time overview of background processing across the app. Last updated:{' '}
            {lastUpdate.toLocaleTimeString()}
            {loading && ' (loading...)'}
          </p>
        </div>

        {/* Stats Cards */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          })}
        >
          <StatCard
            label="Running"
            value={stats.running}
            color="#2196F3"
            pulse={stats.running > 0}
          />
          <StatCard label="Pending" value={stats.pending} color="#FF9800" />
          <StatCard label="Completed" value={stats.completed} color="#4CAF50" />
          <StatCard label="Failed" value={stats.failed} color="#f44336" />
        </div>

        {/* Active Tasks */}
        {activeTasks.length > 0 && (
          <div className={css({ marginBottom: '24px' })}>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#58a6ff',
              })}
            >
              Active Tasks
            </h2>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
              {activeTasks.map((task) => (
                <ActiveTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className={css({ marginBottom: '24px' })}>
          <h2 className={css({ fontSize: '16px', fontWeight: '600', marginBottom: '8px' })}>
            System Configuration
          </h2>
          <p className={css({ fontSize: '13px', color: '#8b949e', marginBottom: '12px' })}>
            These settings affect how the app behaves for all students.
          </p>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            })}
          >
            <QuickLink
              href="/admin/tasks"
              icon="📊"
              title="Task Monitor"
              description="Watch worksheet parsing, vision training, and other background jobs as they process. See event logs and debug failures."
            />
            <QuickLink
              href="/admin/bkt-settings"
              icon="🧠"
              title="BKT Settings"
              description="Controls how students' skills are classified (Weak/Developing/Strong). Affects skill maps, practice recommendations, and teacher reports."
            />
            <QuickLink
              href="/flowchart/admin"
              icon="🗺️"
              title="Flowcharts"
              description="Manage the curriculum sequence - which skills exist, how they connect, and what order students learn them. Seeds built-in flowcharts."
            />
            <QuickLink
              href="/admin/constant-images"
              icon="🎨"
              title="Constant Images"
              description="Generate AI illustrations for math constants on the number line. Metaphor and blueprint style images for each constant."
            />
            <QuickLink
              href="/vision-training"
              icon="👁️"
              title="Vision Training"
              description="Train the ML model that recognizes handwritten numbers on worksheets. Affects accuracy of automatic problem grading."
            />
          </div>
        </div>

        {/* Recent Tasks */}
        <div>
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            })}
          >
            <h2 className={css({ fontSize: '16px', fontWeight: '600' })}>Recent Tasks</h2>
            <Link
              href="/admin/tasks"
              className={css({
                fontSize: '13px',
                color: '#58a6ff',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              })}
            >
              View all →
            </Link>
          </div>
          <div
            className={css({
              backgroundColor: '#161b22',
              borderRadius: '8px',
              border: '1px solid #30363d',
              overflow: 'hidden',
            })}
          >
            {recentTasks.length === 0 ? (
              <div className={css({ padding: '24px', textAlign: 'center', color: '#8b949e' })}>
                No tasks yet
              </div>
            ) : (
              <table
                className={css({ width: '100%', borderCollapse: 'collapse', fontSize: '13px' })}
              >
                <thead>
                  <tr className={css({ borderBottom: '1px solid #30363d' })}>
                    <th
                      className={css({
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#8b949e',
                      })}
                    >
                      Type
                    </th>
                    <th
                      className={css({
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#8b949e',
                      })}
                    >
                      Status
                    </th>
                    <th
                      className={css({
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#8b949e',
                      })}
                    >
                      Progress
                    </th>
                    <th
                      className={css({
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#8b949e',
                      })}
                    >
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr
                      key={task.id}
                      className={css({
                        borderBottom: '1px solid #21262d',
                        '&:hover': { backgroundColor: '#1c2128' },
                        cursor: 'pointer',
                      })}
                      onClick={() => (window.location.href = `/admin/tasks?selected=${task.id}`)}
                    >
                      <td className={css({ padding: '10px 12px' })}>{task.type}</td>
                      <td className={css({ padding: '10px 12px' })}>
                        <StatusBadge status={task.status} />
                      </td>
                      <td className={css({ padding: '10px 12px' })}>
                        {task.status === 'running' || task.status === 'pending' ? (
                          <div
                            className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}
                          >
                            <div
                              className={css({
                                flex: 1,
                                height: '4px',
                                backgroundColor: '#30363d',
                                borderRadius: '2px',
                                maxWidth: '100px',
                              })}
                            >
                              <div
                                className={css({
                                  height: '100%',
                                  backgroundColor: '#2196F3',
                                  borderRadius: '2px',
                                  transition: 'width 0.3s',
                                })}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <span className={css({ fontSize: '11px', color: '#8b949e' })}>
                              {task.progress}%
                            </span>
                          </div>
                        ) : (
                          <span className={css({ color: '#8b949e' })}>-</span>
                        )}
                      </td>
                      <td className={css({ padding: '10px 12px', color: '#8b949e' })}>
                        {formatTimeAgo(task.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  pulse,
}: {
  label: string
  value: number
  color: string
  pulse?: boolean
}) {
  return (
    <div
      className={css({
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: '1px solid #30363d',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      })}
    >
      {pulse && (
        <div
          className={css({
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
            animation: 'pulse 2s infinite',
          })}
        />
      )}
      <div className={css({ fontSize: '28px', fontWeight: 'bold', color })}>{value}</div>
      <div className={css({ fontSize: '13px', color: '#8b949e' })}>{label}</div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

function ActiveTaskCard({ task }: { task: TaskSummary }) {
  return (
    <Link
      href={`/admin/tasks?selected=${task.id}`}
      className={css({
        display: 'block',
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: '1px solid #30363d',
        padding: '12px 16px',
        textDecoration: 'none',
        color: 'inherit',
        '&:hover': { borderColor: '#58a6ff' },
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        })}
      >
        <span className={css({ fontWeight: '600' })}>{task.type}</span>
        <StatusBadge status={task.status} />
      </div>
      <div className={css({ marginBottom: '4px' })}>
        <div
          className={css({
            height: '6px',
            backgroundColor: '#30363d',
            borderRadius: '3px',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              height: '100%',
              backgroundColor: '#2196F3',
              borderRadius: '3px',
              transition: 'width 0.3s',
            })}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>
      <div className={css({ fontSize: '12px', color: '#8b949e' })}>
        {task.progressMessage || `${task.progress}%`}
      </div>
    </Link>
  )
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className={css({
        display: 'block',
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: '1px solid #30363d',
        padding: '16px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: '#58a6ff',
          backgroundColor: '#1c2128',
        },
      })}
    >
      <div className={css({ fontSize: '24px', marginBottom: '8px' })}>{icon}</div>
      <div className={css({ fontWeight: '600', marginBottom: '4px' })}>{title}</div>
      <div className={css({ fontSize: '12px', color: '#8b949e' })}>{description}</div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    running: { bg: '#1f6feb33', text: '#58a6ff' },
    pending: { bg: '#9e6a0333', text: '#d29922' },
    completed: { bg: '#23863533', text: '#3fb950' },
    failed: { bg: '#f8514933', text: '#f85149' },
    cancelled: { bg: '#6e768133', text: '#8b949e' },
  }
  const color = colors[status] || colors.cancelled

  return (
    <span
      className={css({
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '500',
        backgroundColor: color.bg,
        color: color.text,
      })}
    >
      {status}
    </span>
  )
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return date.toLocaleDateString()
}
