'use client'

import { useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  data?: any
}

export default function ArcadeRoomsTestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [roomId, setRoomId] = useState('')
  const [socket1, setSocket1] = useState<Socket | null>(null)
  const [socket2, setSocket2] = useState<Socket | null>(null)

  const updateResult = (name: string, updates: Partial<TestResult>) => {
    setResults((prev) => {
      const existing = prev.find((r) => r.name === name)
      if (existing) {
        return prev.map((r) => (r.name === name ? { ...r, ...updates } : r))
      }
      return [...prev, { name, status: 'pending', ...updates }]
    })
  }

  const log = (name: string, message: string, data?: any) => {
    console.log(`[${name}]`, message, data)
    updateResult(name, { message, data })
  }

  const clearResults = () => {
    setResults([])
    socket1?.disconnect()
    socket2?.disconnect()
    setSocket1(null)
    setSocket2(null)
  }

  // Test 1: Create Room
  const testCreateRoom = async () => {
    const testName = 'Create Room'
    updateResult(testName, { status: 'running' })

    try {
      const response = await fetch('/api/arcade/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Room ${Date.now()}`,
          createdBy: 'test-user-1',
          creatorName: 'Test User 1',
          gameName: 'matching',
          gameConfig: { difficulty: 6 },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setRoomId(data.room.id)
      log(testName, `✅ Room created: ${data.room.code}`, data.room)
      updateResult(testName, { status: 'success' })
    } catch (error) {
      log(testName, `❌ ${error}`)
      updateResult(testName, { status: 'error' })
    }
  }

  // Test 2: Join Room (Socket)
  const testJoinRoom = async (testRoomId?: string) => {
    const testName = 'Join Room'
    const activeRoomId = testRoomId || roomId
    if (!activeRoomId) {
      log(testName, '❌ No room ID - create room first')
      updateResult(testName, { status: 'error' })
      return
    }

    updateResult(testName, { status: 'running' })

    const sock = createSocket()
    setSocket1(sock)

    sock.on('connect', () => {
      log(testName, `Connected: ${sock.id}`)
      sock.emit('join-room', { roomId: activeRoomId, userId: 'test-user-1' })
    })

    sock.on('room-joined', (data) => {
      log(testName, `✅ Joined room`, data)
      updateResult(testName, { status: 'success' })
    })

    sock.on('room-error', (error) => {
      log(testName, `❌ ${error.error}`)
      updateResult(testName, { status: 'error' })
    })
  }

  // Test 3: Multi-User Join
  const testMultiUserJoin = async (testRoomId?: string) => {
    const testName = 'Multi-User Join'
    const activeRoomId = testRoomId || roomId
    if (!activeRoomId || !socket1) {
      log(testName, '❌ Join room first (Test 2)')
      updateResult(testName, { status: 'error' })
      return
    }

    updateResult(testName, { status: 'running' })

    // Listen on socket1 for member-joined
    socket1.once('member-joined', (data) => {
      log(testName, `✅ User 2 joined, ${data.onlineMembers.length} online`, data)
      updateResult(testName, { status: 'success' })
    })

    // Connect socket2
    const sock2 = createSocket()
    setSocket2(sock2)

    sock2.on('connect', () => {
      log(testName, `User 2 connected: ${sock2.id}`)
      sock2.emit('join-room', { roomId: activeRoomId, userId: 'test-user-2' })
    })

    sock2.on('room-error', (error) => {
      log(testName, `❌ ${error.error}`)
      updateResult(testName, { status: 'error' })
    })
  }

  // Test 4: Game Move Broadcast
  const testGameMoveBroadcast = async (testRoomId?: string) => {
    const testName = 'Game Move Broadcast'
    const activeRoomId = testRoomId || roomId
    if (!activeRoomId || !socket1 || !socket2) {
      log(testName, '❌ Run Multi-User Join first (Test 3)')
      updateResult(testName, { status: 'error' })
      return
    }

    updateResult(testName, { status: 'running' })

    let socket1Received = false
    let socket2Received = false

    const checkComplete = () => {
      if (socket1Received && socket2Received) {
        log(testName, '✅ Both sockets received move')
        updateResult(testName, { status: 'success' })
      }
    }

    socket1.once('room-move-accepted', (data) => {
      log(testName, 'Socket 1 received move', data.move.type)
      socket1Received = true
      checkComplete()
    })

    socket2.once('room-move-accepted', (data) => {
      log(testName, 'Socket 2 received move', data.move.type)
      socket2Received = true
      checkComplete()
    })

    // Send move from socket1
    socket1.emit('room-game-move', {
      roomId: activeRoomId,
      userId: 'test-guest-1',
      move: {
        type: 'START_GAME',
        playerId: 'player-1',
        timestamp: Date.now(),
        data: { activePlayers: ['player-1'] },
      },
    })
  }

  // Test 5: Solo Play (Backward Compatibility)
  const testSoloPlay = async () => {
    const testName = 'Solo Play'
    updateResult(testName, { status: 'running' })

    const soloSocket = createSocket()

    soloSocket.on('connect', () => {
      log(testName, `Solo connected: ${soloSocket.id}`)
      soloSocket.emit('join-arcade-session', {
        userId: `solo-guest-${Date.now()}`,
      })
    })

    soloSocket.on('no-active-session', () => {
      log(testName, 'No active session (expected)')

      // Send START_GAME
      soloSocket.emit('game-move', {
        userId: `solo-guest-${Date.now()}`,
        move: {
          type: 'START_GAME',
          playerId: 'player-1',
          timestamp: Date.now(),
          data: { activePlayers: ['player-1'] },
        },
      })
    })

    soloSocket.on('move-accepted', (data) => {
      log(testName, '✅ Solo move accepted', data)
      updateResult(testName, { status: 'success' })
      soloSocket.disconnect()
    })

    soloSocket.on('move-rejected', (error) => {
      log(testName, `❌ ${error.error}`)
      updateResult(testName, { status: 'error' })
      soloSocket.disconnect()
    })
  }

  // Test 6: Room Isolation (ensure solo doesn't leak to room)
  const testRoomIsolation = async () => {
    const testName = 'Room Isolation'
    if (!socket1) {
      log(testName, '❌ Join room first (Test 2)')
      updateResult(testName, { status: 'error' })
      return
    }

    updateResult(testName, { status: 'running' })

    let receivedSoloMove = false

    socket1.once('room-move-accepted', (data) => {
      if (data.userId.includes('solo-guest')) {
        receivedSoloMove = true
        log(testName, '❌ LEAK: Received solo move in room!')
        updateResult(testName, { status: 'error' })
      }
    })

    // Create solo session
    const soloSocket = createSocket()
    soloSocket.on('connect', () => {
      const soloUserId = `solo-guest-${Date.now()}`
      soloSocket.emit('join-arcade-session', { userId: soloUserId })

      setTimeout(() => {
        soloSocket.emit('game-move', {
          userId: soloUserId,
          move: {
            type: 'START_GAME',
            playerId: 'player-1',
            timestamp: Date.now(),
            data: { activePlayers: ['player-1'] },
          },
        })
      }, 500)
    })

    soloSocket.on('move-accepted', () => {
      // Wait to see if room received it
      setTimeout(() => {
        if (!receivedSoloMove) {
          log(testName, '✅ Solo move did not leak to room')
          updateResult(testName, { status: 'success' })
        }
        soloSocket.disconnect()
      }, 1000)
    })
  }

  const runAllTests = async () => {
    clearResults()
    setRoomId('') // Reset room ID
    setSocket1(null)
    setSocket2(null)

    // Test 1: Create Room
    updateResult('Run All Tests', {
      status: 'running',
      message: 'Creating room...',
    })

    try {
      const response = await fetch('/api/arcade/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Room ${Date.now()}`,
          createdBy: 'test-user-1',
          creatorName: 'Test User 1',
          gameName: 'matching',
          gameConfig: { difficulty: 6 },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const createdRoomId = data.room.id
      setRoomId(createdRoomId)

      log('Create Room', `✅ Room created: ${data.room.code}`, data.room)
      updateResult('Create Room', { status: 'success' })

      updateResult('Run All Tests', {
        message: 'Room created, running tests...',
      })
      await new Promise((r) => setTimeout(r, 1000))

      // Now run tests with the roomId we just got
      await runTestsWithRoom(createdRoomId)
    } catch (error) {
      log('Create Room', `❌ ${error}`)
      updateResult('Create Room', { status: 'error' })
      updateResult('Run All Tests', {
        status: 'error',
        message: 'Room creation failed',
      })
    }
  }

  const runTestsWithRoom = async (testRoomId: string) => {
    // Pass testRoomId to each test to avoid state closure issues

    // Test 2: Join Room
    await testJoinRoom(testRoomId)
    await new Promise((r) => setTimeout(r, 2000))

    // Test 3: Multi-User Join
    await testMultiUserJoin(testRoomId)
    await new Promise((r) => setTimeout(r, 2000))

    // Test 4: Game Move Broadcast
    await testGameMoveBroadcast(testRoomId)
    await new Promise((r) => setTimeout(r, 2000))

    // Test 5: Solo Play (doesn't need roomId)
    await testSoloPlay()
    await new Promise((r) => setTimeout(r, 2000))

    // Test 6: Room Isolation (doesn't need roomId parameter since it uses socket1)
    await testRoomIsolation()
    await new Promise((r) => setTimeout(r, 1000))

    updateResult('Run All Tests', {
      status: 'success',
      message: '✅ All tests completed',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Arcade Rooms Manual Testing</h1>
        <p className="text-gray-600 mb-8">Phase 1 & 2: Room CRUD, Socket.IO Integration</p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={runAllTests}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🚀 Run All Tests
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              🗑️ Clear Results
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={testCreateRoom}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              1. Create Room
            </button>
            <button
              onClick={testJoinRoom}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              2. Join Room
            </button>
            <button
              onClick={testMultiUserJoin}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              3. Multi-User Join
            </button>
            <button
              onClick={testGameMoveBroadcast}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              4. Game Move Broadcast
            </button>
            <button
              onClick={testSoloPlay}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              5. Solo Play
            </button>
            <button
              onClick={testRoomIsolation}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              6. Room Isolation
            </button>
          </div>

          {roomId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm">
                <strong>Room ID:</strong> <code className="text-xs">{roomId}</code>
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>

          {results.length === 0 && (
            <p className="text-gray-500 italic">No tests run yet. Click a button above to start.</p>
          )}

          <div className="space-y-3">
            {results.map((result, i) => (
              <div
                key={i}
                className={`p-4 rounded border ${
                  result.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : result.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : result.status === 'running'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{result.name}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          result.status === 'success'
                            ? 'bg-green-200 text-green-800'
                            : result.status === 'error'
                              ? 'bg-red-200 text-red-800'
                              : result.status === 'running'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                    {result.message && (
                      <p className="text-sm mt-1 text-gray-700">{result.message}</p>
                    )}
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          View data
                        </summary>
                        <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4 text-sm">
          <p className="font-semibold mb-2">💡 Testing Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Run tests in order (1-6) for dependencies to work</li>
            <li>Or use "Run All Tests" to execute the full suite</li>
            <li>Check browser console for detailed Socket.IO logs</li>
            <li>Tests 2-4 require active WebSocket connections</li>
            <li>Test 6 verifies room/solo session isolation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
