'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'

interface DemoTaskOutput {
  message: string
  completedAt: string
  totalEvents?: number
  totalPayloadBytes?: number
}

const inputStyle = css({
  width: '80px',
  padding: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '14px',
})

const labelStyle = css({ fontSize: '14px', whiteSpace: 'nowrap' })

export default function TaskDemoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get taskId from URL so it survives page reloads
  const taskId = searchParams.get('taskId')

  const [duration, setDuration] = useState(10)
  const [eventCount, setEventCount] = useState(10)
  const [payloadSizeKb, setPayloadSizeKb] = useState(0)
  const [isStarting, setIsStarting] = useState(false)
  const { state, cancel, isLoading, error } = useBackgroundTask<DemoTaskOutput>(taskId)

  const isRunning = !!taskId && state?.status === 'running'

  const startTask = async (shouldFail: boolean) => {
    setIsStarting(true)
    try {
      const res = await fetch('/api/demo/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          shouldFail,
          eventCount,
          payloadSizeBytes: payloadSizeKb * 1024,
        }),
      })
      const { taskId: newTaskId } = await res.json()
      router.push(`/demo/tasks?taskId=${newTaskId}`)
    } catch (err) {
      console.error('Failed to start task:', err)
    } finally {
      setIsStarting(false)
    }
  }

  const resetTask = () => {
    router.push('/demo/tasks')
  }

  return (
    <div
      className={css({
        padding: '24px',
        maxWidth: '700px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      })}
      data-component="TaskDemoPage"
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        })}
      >
        <h1 className={css({ fontSize: '24px', fontWeight: 'bold' })}>Background Task Demo</h1>
        <Link
          href="/demo/tasks/stress"
          className={css({
            fontSize: '14px',
            color: '#2196F3',
            textDecoration: 'none',
            _hover: { textDecoration: 'underline' },
          })}
        >
          Stress Test →
        </Link>
      </div>
      <p className={css({ color: '#666', marginBottom: '24px' })}>
        Test the Socket.IO-based background task system. Try reloading the page mid-task to see
        event replay.
      </p>

      {/* Controls */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px',
          background: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #eee',
        })}
        data-element="controls"
      >
        <div className={css({ display: 'flex', gap: '16px', flexWrap: 'wrap' })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
            <label htmlFor="duration" className={labelStyle}>
              Duration (s):
            </label>
            <input
              id="duration"
              type="number"
              min="1"
              max="300"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isRunning}
              className={inputStyle}
            />
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
            <label htmlFor="eventCount" className={labelStyle}>
              Events:
            </label>
            <input
              id="eventCount"
              type="number"
              min="1"
              max="10000"
              value={eventCount}
              onChange={(e) => setEventCount(Number(e.target.value))}
              disabled={isRunning}
              className={inputStyle}
            />
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
            <label htmlFor="payloadSize" className={labelStyle}>
              Payload (KB):
            </label>
            <input
              id="payloadSize"
              type="number"
              min="0"
              max="1000"
              value={payloadSizeKb}
              onChange={(e) => setPayloadSizeKb(Number(e.target.value))}
              disabled={isRunning}
              className={inputStyle}
            />
          </div>
        </div>

        <div className={css({ display: 'flex', gap: '8px', flexWrap: 'wrap' })}>
          <button
            onClick={() => startTask(false)}
            disabled={isStarting || isRunning}
            className={css({
              padding: '8px 16px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: isStarting || isRunning ? 0.5 : 1,
              _hover: { background: '#45a049' },
            })}
            data-action="start-task"
          >
            {isStarting ? 'Starting...' : 'Start Task'}
          </button>

          <button
            onClick={() => startTask(true)}
            disabled={isStarting || isRunning}
            className={css({
              padding: '8px 16px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: isStarting || isRunning ? 0.5 : 1,
              _hover: { background: '#da190b' },
            })}
            data-action="start-failing-task"
          >
            Start Failing Task
          </button>

          {state?.status === 'running' && (
            <button
              onClick={cancel}
              className={css({
                padding: '8px 16px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                _hover: { background: '#f57c00' },
              })}
              data-action="cancel-task"
            >
              Cancel
            </button>
          )}

          {taskId && state?.status !== 'running' && state?.status !== 'pending' && (
            <button
              onClick={resetTask}
              className={css({
                padding: '8px 16px',
                background: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                _hover: { background: '#757575' },
              })}
              data-action="reset"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Task State */}
      {taskId && (
        <div
          className={css({
            padding: '20px',
            background: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '16px',
          })}
          data-element="task-state"
        >
          {isLoading && !state && <p className={css({ color: '#666' })}>Loading task state...</p>}

          {error && <p className={css({ color: '#f44336', fontWeight: 'bold' })}>Error: {error}</p>}

          {state && (
            <>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '8px 16px',
                  marginBottom: '16px',
                })}
              >
                <span className={css({ fontWeight: 'bold' })}>Task ID:</span>
                <code className={css({ fontSize: '12px', wordBreak: 'break-all' })}>{taskId}</code>

                <span className={css({ fontWeight: 'bold' })}>Status:</span>
                <span
                  className={css({
                    fontWeight: 'bold',
                    color:
                      state.status === 'completed'
                        ? '#4CAF50'
                        : state.status === 'failed'
                          ? '#f44336'
                          : state.status === 'cancelled'
                            ? '#ff9800'
                            : state.status === 'running'
                              ? '#2196F3'
                              : '#666',
                  })}
                >
                  {state.status.toUpperCase()}
                </span>

                <span className={css({ fontWeight: 'bold' })}>Progress:</span>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                  <div
                    className={css({
                      flex: 1,
                      height: '20px',
                      background: '#ddd',
                      borderRadius: '10px',
                      overflow: 'hidden',
                    })}
                  >
                    <div
                      className={css({
                        height: '100%',
                        background:
                          state.status === 'failed'
                            ? '#f44336'
                            : state.status === 'cancelled'
                              ? '#ff9800'
                              : '#4CAF50',
                        transition: 'width 0.3s ease',
                      })}
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                  <span className={css({ minWidth: '45px', textAlign: 'right' })}>
                    {state.progress}%
                  </span>
                </div>

                {state.progressMessage && (
                  <>
                    <span className={css({ fontWeight: 'bold' })}>Message:</span>
                    <span>{state.progressMessage}</span>
                  </>
                )}

                {state.error && (
                  <>
                    <span className={css({ fontWeight: 'bold', color: '#f44336' })}>Error:</span>
                    <span className={css({ color: '#f44336' })}>{state.error}</span>
                  </>
                )}

                {state.output && (
                  <>
                    <span className={css({ fontWeight: 'bold', color: '#4CAF50' })}>Output:</span>
                    <code className={css({ fontSize: '12px' })}>
                      {JSON.stringify(state.output)}
                    </code>
                  </>
                )}
              </div>

              {/* Events */}
              <details className={css({ marginTop: '16px' })}>
                <summary
                  className={css({
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                  })}
                >
                  Events ({state.events?.length ?? 0})
                </summary>
                <div
                  className={css({
                    maxHeight: '300px',
                    overflow: 'auto',
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '8px',
                  })}
                >
                  {state.events?.length === 0 && (
                    <p className={css({ color: '#666', fontSize: '14px' })}>No events yet</p>
                  )}
                  {state.events?.map((event, idx) => (
                    <div
                      key={idx}
                      className={css({
                        padding: '4px 8px',
                        borderBottom: '1px solid #eee',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        _last: { borderBottom: 'none' },
                      })}
                    >
                      <span
                        className={css({
                          fontWeight: 'bold',
                          color: event.replayed ? '#9e9e9e' : '#333',
                        })}
                      >
                        {event.eventType}
                        {event.replayed && (
                          <span className={css({ color: '#9e9e9e', fontWeight: 'normal' })}>
                            {' '}
                            (replayed)
                          </span>
                        )}
                      </span>
                      {(() => {
                        const payload = event.payload as Record<string, unknown> | null
                        if (
                          payload &&
                          typeof payload === 'object' &&
                          Object.keys(payload).length > 0
                        ) {
                          // Truncate large data fields for display
                          const displayPayload = { ...payload }
                          if (
                            typeof displayPayload.data === 'string' &&
                            displayPayload.data.length > 100
                          ) {
                            displayPayload.data = `[${displayPayload.data.length} bytes]`
                          }
                          return (
                            <pre
                              className={css({
                                margin: '4px 0 0 0',
                                fontSize: '11px',
                                color: '#666',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              })}
                            >
                              {JSON.stringify(displayPayload, null, 2)}
                            </pre>
                          )
                        }
                        return null
                      })()}
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      <div
        className={css({
          padding: '16px',
          background: '#e3f2fd',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: 1.6,
        })}
        data-element="instructions"
      >
        <strong>Test Checklist:</strong>
        <ol className={css({ marginTop: '8px', paddingLeft: '20px' })}>
          <li>Start a 10-second task and watch progress update in real-time</li>
          <li>Reload the page mid-task - events should replay and progress should resume</li>
          <li>Open a second browser tab - both should receive updates</li>
          <li>Start a failing task - should show error at 70%</li>
          <li>Start a task and click Cancel mid-progress</li>
          <li>Try 100 events with 10KB payload to test throughput</li>
        </ol>
      </div>
    </div>
  )
}
