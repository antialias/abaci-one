'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../styled-system/css'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'

interface TaskConfig {
  duration: number
  eventCount: number
  payloadSizeBytes: number
  shouldFail: boolean
  failAt: number
}

interface StressPreset {
  name: string
  description: string
  taskCount: number
  config: TaskConfig
}

const PRESETS: StressPreset[] = [
  {
    name: 'Concurrent Light',
    description: '10 tasks, 10 events each, no payload',
    taskCount: 10,
    config: { duration: 5, eventCount: 10, payloadSizeBytes: 0, shouldFail: false, failAt: 70 },
  },
  {
    name: 'Concurrent Heavy',
    description: '20 tasks, 50 events each, 1KB payload',
    taskCount: 20,
    config: { duration: 10, eventCount: 50, payloadSizeBytes: 1024, shouldFail: false, failAt: 70 },
  },
  {
    name: 'Rapid Fire',
    description: '5 tasks, 500 events each, 10ms intervals',
    taskCount: 5,
    config: { duration: 5, eventCount: 500, payloadSizeBytes: 0, shouldFail: false, failAt: 70 },
  },
  {
    name: 'Large Payloads',
    description: '3 tasks, 20 events each, 50KB payload',
    taskCount: 3,
    config: { duration: 10, eventCount: 20, payloadSizeBytes: 50 * 1024, shouldFail: false, failAt: 70 },
  },
  {
    name: 'Event Replay Stress',
    description: '1 task, 1000 events (test replay performance)',
    taskCount: 1,
    config: { duration: 20, eventCount: 1000, payloadSizeBytes: 100, shouldFail: false, failAt: 70 },
  },
  {
    name: 'Mixed Failures',
    description: '10 tasks, 50% fail at random points',
    taskCount: 10,
    config: { duration: 5, eventCount: 20, payloadSizeBytes: 0, shouldFail: true, failAt: 50 },
  },
]

interface TaskInfo {
  id: string
  startedAt: number
  config: TaskConfig
}

interface AggregateStats {
  totalTasks: number
  running: number
  completed: number
  failed: number
  cancelled: number
  totalEvents: number
  eventsPerSecond: number
  startTime: number | null
}

// Mini component to track a single task
function TaskTracker({
  taskId,
  onStats
}: {
  taskId: string
  onStats: (taskId: string, status: string, eventCount: number) => void
}) {
  const { state } = useBackgroundTask(taskId)
  const lastReportedRef = useRef({ status: '', eventCount: 0 })

  useEffect(() => {
    if (state) {
      const currentStatus = state.status
      const currentEventCount = state.events?.length ?? 0

      if (currentStatus !== lastReportedRef.current.status ||
          currentEventCount !== lastReportedRef.current.eventCount) {
        lastReportedRef.current = { status: currentStatus, eventCount: currentEventCount }
        onStats(taskId, currentStatus, currentEventCount)
      }
    }
  }, [state, taskId, onStats])

  if (!state) return null

  const statusColor = {
    pending: '#666',
    running: '#2196F3',
    completed: '#4CAF50',
    failed: '#f44336',
    cancelled: '#ff9800',
  }[state.status] ?? '#666'

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        background: '#f5f5f5',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
      })}
    >
      <span
        className={css({
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: statusColor,
        })}
      />
      <span className={css({ color: '#666' })}>{taskId.slice(0, 8)}</span>
      <span className={css({ color: statusColor, fontWeight: 'bold' })}>
        {state.status}
      </span>
      <span>{state.progress}%</span>
      <span className={css({ color: '#999' })}>
        {state.events?.length ?? 0} events
      </span>
    </div>
  )
}

export default function StressTestPage() {
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<StressPreset>(PRESETS[0])
  const [customTaskCount, setCustomTaskCount] = useState(10)
  const [stats, setStats] = useState<AggregateStats>({
    totalTasks: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    totalEvents: 0,
    eventsPerSecond: 0,
    startTime: null,
  })

  const taskStatsRef = useRef<Map<string, { status: string; eventCount: number }>>(new Map())
  const startTimeRef = useRef<number | null>(null)

  // Callback for task trackers to report their status
  const handleTaskStats = useCallback((taskId: string, status: string, eventCount: number) => {
    taskStatsRef.current.set(taskId, { status, eventCount })

    // Recalculate aggregate stats
    let running = 0, completed = 0, failed = 0, cancelled = 0, totalEvents = 0
    for (const [, taskStat] of taskStatsRef.current) {
      totalEvents += taskStat.eventCount
      switch (taskStat.status) {
        case 'running': running++; break
        case 'completed': completed++; break
        case 'failed': failed++; break
        case 'cancelled': cancelled++; break
      }
    }

    const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 1
    const eventsPerSecond = Math.round(totalEvents / elapsed)

    setStats(prev => ({
      ...prev,
      running,
      completed,
      failed,
      cancelled,
      totalEvents,
      eventsPerSecond,
    }))

    // Check if all tasks are done
    if (running === 0 && taskStatsRef.current.size > 0 &&
        taskStatsRef.current.size === completed + failed + cancelled) {
      setIsRunning(false)
    }
  }, [])

  const startStressTest = async (preset: StressPreset, taskCount: number) => {
    setIsRunning(true)
    setTasks([])
    taskStatsRef.current.clear()
    startTimeRef.current = Date.now()

    setStats({
      totalTasks: taskCount,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalEvents: 0,
      eventsPerSecond: 0,
      startTime: Date.now(),
    })

    // Start all tasks concurrently
    const newTasks: TaskInfo[] = []
    const promises = []

    for (let i = 0; i < taskCount; i++) {
      const config = { ...preset.config }

      // For mixed failures, randomize the fail point
      if (preset.name === 'Mixed Failures') {
        config.shouldFail = Math.random() > 0.5
        config.failAt = Math.floor(Math.random() * 80) + 10 // 10-90%
      }

      promises.push(
        fetch('/api/demo/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
          .then(res => res.json())
          .then(({ taskId }) => {
            newTasks.push({ id: taskId, startedAt: Date.now(), config })
          })
          .catch(err => console.error('Failed to start task:', err))
      )
    }

    await Promise.all(promises)
    setTasks(newTasks)
  }

  const stopAllTasks = async () => {
    // Note: This would require implementing a bulk cancel endpoint
    // For now, we just mark as not running
    setIsRunning(false)
  }

  const clearResults = () => {
    setTasks([])
    taskStatsRef.current.clear()
    setStats({
      totalTasks: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalEvents: 0,
      eventsPerSecond: 0,
      startTime: null,
    })
  }

  // Calculate elapsed time
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!stats.startTime || !isRunning) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stats.startTime!) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [stats.startTime, isRunning])

  return (
    <div
      className={css({
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      })}
      data-component="StressTestPage"
    >
      <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' })}>
        <h1 className={css({ fontSize: '24px', fontWeight: 'bold' })}>
          Background Task Stress Test
        </h1>
        <Link
          href="/demo/tasks"
          className={css({
            fontSize: '14px',
            color: '#2196F3',
            textDecoration: 'none',
            _hover: { textDecoration: 'underline' },
          })}
        >
          ← Basic Demo
        </Link>
      </div>
      <p className={css({ color: '#666', marginBottom: '24px' })}>
        Test system limits with concurrent tasks, rapid events, and large payloads.
      </p>

      {/* Presets */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        })}
        data-element="presets"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setSelectedPreset(preset)}
            disabled={isRunning}
            className={css({
              padding: '12px',
              background: selectedPreset.name === preset.name ? '#e3f2fd' : '#f5f5f5',
              border: selectedPreset.name === preset.name ? '2px solid #2196F3' : '2px solid transparent',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
              transition: 'all 0.2s',
              _hover: {
                background: isRunning ? undefined : '#e3f2fd',
              },
            })}
          >
            <div className={css({ fontWeight: 'bold', marginBottom: '4px' })}>{preset.name}</div>
            <div className={css({ fontSize: '12px', color: '#666' })}>{preset.description}</div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          padding: '16px',
          background: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #eee',
          flexWrap: 'wrap',
        })}
        data-element="controls"
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
          <label className={css({ fontSize: '14px' })}>Tasks:</label>
          <input
            type="number"
            min="1"
            max="100"
            value={customTaskCount}
            onChange={(e) => setCustomTaskCount(Number(e.target.value))}
            disabled={isRunning}
            className={css({
              width: '70px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            })}
          />
        </div>

        <button
          onClick={() => startStressTest(selectedPreset, customTaskCount)}
          disabled={isRunning}
          className={css({
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.5 : 1,
            _hover: { background: '#45a049' },
          })}
        >
          {isRunning ? 'Running...' : `Start ${selectedPreset.name}`}
        </button>

        {tasks.length > 0 && !isRunning && (
          <button
            onClick={clearResults}
            className={css({
              padding: '10px 20px',
              background: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              _hover: { background: '#757575' },
            })}
          >
            Clear Results
          </button>
        )}
      </div>

      {/* Stats Dashboard */}
      {(tasks.length > 0 || stats.totalTasks > 0) && (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          })}
          data-element="stats"
        >
          <StatCard label="Total" value={stats.totalTasks} color="#333" />
          <StatCard label="Running" value={stats.running} color="#2196F3" />
          <StatCard label="Completed" value={stats.completed} color="#4CAF50" />
          <StatCard label="Failed" value={stats.failed} color="#f44336" />
          <StatCard label="Cancelled" value={stats.cancelled} color="#ff9800" />
          <StatCard label="Events" value={stats.totalEvents} color="#9c27b0" />
          <StatCard label="Events/s" value={stats.eventsPerSecond} color="#00bcd4" />
          <StatCard label="Elapsed" value={`${elapsed}s`} color="#666" />
        </div>
      )}

      {/* Task List */}
      {tasks.length > 0 && (
        <div
          className={css({
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '8px',
            maxHeight: '400px',
            overflow: 'auto',
          })}
          data-element="task-list"
        >
          <div className={css({ fontWeight: 'bold', marginBottom: '12px' })}>
            Tasks ({tasks.length})
          </div>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            })}
          >
            {tasks.map((task) => (
              <TaskTracker key={task.id} taskId={task.id} onStats={handleTaskStats} />
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div
        className={css({
          marginTop: '24px',
          padding: '16px',
          background: '#fff3e0',
          borderRadius: '8px',
          fontSize: '14px',
        })}
      >
        <strong>Stress Test Scenarios:</strong>
        <ul className={css({ marginTop: '8px', paddingLeft: '20px' })}>
          <li><strong>Concurrent Light/Heavy</strong> - Tests database write contention and Socket.IO room management</li>
          <li><strong>Rapid Fire</strong> - Tests event throughput (high events/second)</li>
          <li><strong>Large Payloads</strong> - Tests serialization and memory pressure</li>
          <li><strong>Event Replay</strong> - Tests replay performance when subscribing to task with many events</li>
          <li><strong>Mixed Failures</strong> - Tests error handling under load</li>
        </ul>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className={css({
        padding: '16px',
        background: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      })}
    >
      <div className={css({ fontSize: '24px', fontWeight: 'bold', color })}>{value}</div>
      <div className={css({ fontSize: '12px', color: '#666', marginTop: '4px' })}>{label}</div>
    </div>
  )
}
