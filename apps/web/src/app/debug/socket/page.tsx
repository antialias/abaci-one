'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { css } from '../../../../styled-system/css'

interface LogEntry {
  id: number
  timestamp: string
  direction: 'in' | 'out' | 'system'
  event: string
  data?: unknown
}

export default function SocketDebugPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<string[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [roomInput, setRoomInput] = useState('')
  const [eventInput, setEventInput] = useState('')
  const [dataInput, setDataInput] = useState('{}')
  const [buildInfo, setBuildInfo] = useState<Record<string, unknown> | null>(null)
  const logIdRef = useRef(0)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((direction: LogEntry['direction'], event: string, data?: unknown) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      direction,
      event,
      data,
    }
    setLogs((prev) => [...prev.slice(-99), entry]) // Keep last 100 entries
  }, [])

  // Fetch build info on mount
  useEffect(() => {
    fetch('/api/build-info')
      .then((res) => res.json())
      .then(setBuildInfo)
      .catch(console.error)
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Connect to Socket.IO
  useEffect(() => {
    const newSocket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      setConnected(true)
      setSocketId(newSocket.id ?? null)
      addLog('system', 'connected', { socketId: newSocket.id })
    })

    newSocket.on('disconnect', (reason) => {
      setConnected(false)
      setSocketId(null)
      setRooms([])
      addLog('system', 'disconnected', { reason })
    })

    newSocket.on('connect_error', (error) => {
      addLog('system', 'connect_error', { message: error.message })
    })

    // Log all incoming events
    newSocket.onAny((event, ...args) => {
      addLog('in', event, args.length === 1 ? args[0] : args)
    })

    // Track remote camera events specifically
    newSocket.on('remote-camera:connected', (data) => {
      addLog('in', 'remote-camera:connected', data)
    })

    newSocket.on('remote-camera:disconnected', (data) => {
      addLog('in', 'remote-camera:disconnected', data)
    })

    newSocket.on('remote-camera:frame', (data) => {
      // Don't log full frame data, just metadata
      addLog('in', 'remote-camera:frame', {
        mode: data.mode,
        timestamp: data.timestamp,
        hasCorners: !!data.detectedCorners,
        imageSize: data.imageData?.length,
      })
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [addLog])

  const joinRoom = useCallback(() => {
    if (!socket || !roomInput.trim()) return
    const room = roomInput.trim()

    // Try different join events based on room prefix
    if (room.startsWith('remote-camera:')) {
      const sessionId = room.replace('remote-camera:', '')
      socket.emit('remote-camera:subscribe', { sessionId })
      addLog('out', 'remote-camera:subscribe', { sessionId })
    } else if (room.startsWith('arcade:')) {
      const userId = room.replace('arcade:', '')
      socket.emit('join-arcade-session', { userId })
      addLog('out', 'join-arcade-session', { userId })
    } else if (room.startsWith('game:')) {
      const roomId = room.replace('game:', '')
      socket.emit('join-arcade-session', { userId: 'debug', roomId })
      addLog('out', 'join-arcade-session', { userId: 'debug', roomId })
    } else {
      // Generic room join (may not work without specific handler)
      addLog('system', 'warning', {
        message: `No handler for room prefix. Try: remote-camera:{sessionId}, arcade:{userId}, game:{roomId}`,
      })
    }

    setRooms((prev) => (prev.includes(room) ? prev : [...prev, room]))
    setRoomInput('')
  }, [socket, roomInput, addLog])

  const leaveRoom = useCallback(
    (room: string) => {
      if (!socket) return

      if (room.startsWith('remote-camera:')) {
        const sessionId = room.replace('remote-camera:', '')
        socket.emit('remote-camera:leave', { sessionId })
        addLog('out', 'remote-camera:leave', { sessionId })
      }

      setRooms((prev) => prev.filter((r) => r !== room))
    },
    [socket, addLog]
  )

  const sendEvent = useCallback(() => {
    if (!socket || !eventInput.trim()) return

    try {
      const data = JSON.parse(dataInput)
      socket.emit(eventInput.trim(), data)
      addLog('out', eventInput.trim(), data)
    } catch {
      addLog('system', 'error', { message: 'Invalid JSON in data input' })
    }
  }, [socket, eventInput, dataInput, addLog])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <div className={css({ p: 4, maxW: '1200px', mx: 'auto' })}>
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 4 })}>Socket.IO Debug</h1>

      {/* Instance Info */}
      <div
        className={css({
          mb: 4,
          p: 4,
          bg: 'gray.100',
          rounded: 'md',
          fontFamily: 'mono',
          fontSize: 'sm',
        })}
      >
        <h2 className={css({ fontWeight: 'bold', mb: 2 })}>Instance Info</h2>
        {buildInfo ? (
          <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 })}>
            <div>
              <strong>Commit:</strong> {String(buildInfo.commit).slice(0, 8)}
            </div>
            <div>
              <strong>Hostname:</strong>{' '}
              {(buildInfo.instance as Record<string, string>)?.hostname || 'unknown'}
            </div>
            <div>
              <strong>Container:</strong>{' '}
              {(buildInfo.instance as Record<string, string>)?.containerId || 'unknown'}
            </div>
            <div>
              <strong>Redis:</strong>{' '}
              {(buildInfo.redis as Record<string, unknown>)?.connected
                ? '✅ Connected'
                : '❌ Not connected'}{' '}
              ({(buildInfo.redis as Record<string, string>)?.status})
            </div>
            <div>
              <strong>Socket Adapter:</strong>{' '}
              {(buildInfo.socketio as Record<string, string>)?.adapter || 'unknown'}
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>

      {/* Connection Status */}
      <div
        className={css({
          mb: 4,
          p: 4,
          bg: connected ? 'green.100' : 'red.100',
          rounded: 'md',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <div
            className={css({
              w: 3,
              h: 3,
              rounded: 'full',
              bg: connected ? 'green.500' : 'red.500',
            })}
          />
          <span className={css({ fontWeight: 'bold' })}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {socketId && (
            <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'gray.600' })}>
              (ID: {socketId})
            </span>
          )}
        </div>
      </div>

      {/* Room Management */}
      <div
        className={css({
          mb: 4,
          p: 4,
          border: '1px solid',
          borderColor: 'gray.300',
          rounded: 'md',
        })}
      >
        <h2 className={css({ fontWeight: 'bold', mb: 2 })}>Rooms</h2>

        <div className={css({ display: 'flex', gap: 2, mb: 2 })}>
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="remote-camera:{sessionId} or arcade:{userId}"
            className={css({
              flex: 1,
              px: 3,
              py: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              rounded: 'md',
              fontFamily: 'mono',
              fontSize: 'sm',
            })}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button
            onClick={joinRoom}
            disabled={!connected}
            className={css({
              px: 4,
              py: 2,
              bg: 'blue.500',
              color: 'white',
              rounded: 'md',
              cursor: 'pointer',
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              _hover: { bg: 'blue.600' },
            })}
          >
            Join
          </button>
        </div>

        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: 2 })}>
          {rooms.map((room) => (
            <div
              key={room}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                bg: 'blue.100',
                rounded: 'full',
                fontSize: 'sm',
              })}
            >
              <span className={css({ fontFamily: 'mono' })}>{room}</span>
              <button
                onClick={() => leaveRoom(room)}
                className={css({
                  w: 4,
                  h: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bg: 'blue.200',
                  rounded: 'full',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.300' },
                })}
              >
                ×
              </button>
            </div>
          ))}
          {rooms.length === 0 && (
            <span className={css({ color: 'gray.500', fontStyle: 'italic' })}>No rooms joined</span>
          )}
        </div>
      </div>

      {/* Send Event */}
      <div
        className={css({
          mb: 4,
          p: 4,
          border: '1px solid',
          borderColor: 'gray.300',
          rounded: 'md',
        })}
      >
        <h2 className={css({ fontWeight: 'bold', mb: 2 })}>Send Event</h2>

        <div className={css({ display: 'flex', gap: 2, mb: 2 })}>
          <input
            type="text"
            value={eventInput}
            onChange={(e) => setEventInput(e.target.value)}
            placeholder="Event name"
            className={css({
              w: '200px',
              px: 3,
              py: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              rounded: 'md',
              fontFamily: 'mono',
              fontSize: 'sm',
            })}
          />
          <input
            type="text"
            value={dataInput}
            onChange={(e) => setDataInput(e.target.value)}
            placeholder='{"key": "value"}'
            className={css({
              flex: 1,
              px: 3,
              py: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              rounded: 'md',
              fontFamily: 'mono',
              fontSize: 'sm',
            })}
          />
          <button
            onClick={sendEvent}
            disabled={!connected}
            className={css({
              px: 4,
              py: 2,
              bg: 'green.500',
              color: 'white',
              rounded: 'md',
              cursor: 'pointer',
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              _hover: { bg: 'green.600' },
            })}
          >
            Send
          </button>
        </div>
      </div>

      {/* Event Log */}
      <div className={css({ p: 4, border: '1px solid', borderColor: 'gray.300', rounded: 'md' })}>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          })}
        >
          <h2 className={css({ fontWeight: 'bold' })}>Event Log</h2>
          <button
            onClick={clearLogs}
            className={css({
              px: 3,
              py: 1,
              bg: 'gray.200',
              rounded: 'md',
              fontSize: 'sm',
              cursor: 'pointer',
              _hover: { bg: 'gray.300' },
            })}
          >
            Clear
          </button>
        </div>

        <div
          className={css({
            h: '400px',
            overflow: 'auto',
            bg: 'gray.900',
            color: 'gray.100',
            rounded: 'md',
            p: 2,
            fontFamily: 'mono',
            fontSize: 'xs',
          })}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              className={css({
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'gray.700',
                display: 'flex',
                gap: 2,
              })}
            >
              <span className={css({ color: 'gray.500', flexShrink: 0 })}>{log.timestamp}</span>
              <span
                className={css({
                  flexShrink: 0,
                  color:
                    log.direction === 'in'
                      ? 'green.400'
                      : log.direction === 'out'
                        ? 'blue.400'
                        : 'yellow.400',
                })}
              >
                {log.direction === 'in' ? '←' : log.direction === 'out' ? '→' : '●'}
              </span>
              <span className={css({ color: 'cyan.400', flexShrink: 0 })}>{log.event}</span>
              {log.data !== undefined && (
                <span
                  className={css({
                    color: 'gray.400',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  })}
                >
                  {JSON.stringify(log.data)}
                </span>
              )}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
