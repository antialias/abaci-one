import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  useCreateRoom,
  useGetRoomByCode,
  useJoinRoom,
  useLeaveRoom,
  useRoomData,
} from '../useRoomData'

// Mock the useUserId hook
vi.mock('../useUserId', () => ({
  useUserId: () => ({ data: 'test-user-id' }),
}))

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}))

describe('useRoomData hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('useRoomData', () => {
    test('returns null roomData when not in a room', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useRoomData(), { wrapper })

      await waitFor(() => {
        expect(result.current.roomData).toBeNull()
        expect(result.current.isInRoom).toBe(false)
      })
    })

    test('returns room data when user is in a room', async () => {
      const mockRoomData = {
        room: {
          id: 'room-123',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
        },
        members: [],
        memberPlayers: {},
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRoomData,
      })

      const { result } = renderHook(() => useRoomData(), { wrapper })

      await waitFor(() => {
        expect(result.current.roomData).toEqual({
          id: 'room-123',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
          gameConfig: null,
          accessMode: 'open',
          members: [],
          memberPlayers: {},
        })
        expect(result.current.isInRoom).toBe(true)
      })
    })

    test('provides getRoomShareUrl function', () => {
      const { result } = renderHook(() => useRoomData(), { wrapper })

      const url = result.current.getRoomShareUrl('ABC123')
      expect(url).toContain('/join/ABC123')
    })
  })

  describe('useCreateRoom', () => {
    test('creates a room successfully', async () => {
      const mockCreatedRoom = {
        room: {
          id: 'new-room-123',
          name: 'New Room',
          code: 'XYZ789',
          gameName: 'matching',
        },
        members: [],
        memberPlayers: {},
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCreatedRoom,
      })

      const { result } = renderHook(() => useCreateRoom(), { wrapper })

      let createdRoom: any
      result.current.mutate(
        {
          name: 'New Room',
          gameName: 'matching',
          creatorName: 'Player 1',
        },
        {
          onSuccess: (data) => {
            createdRoom = data
          },
        }
      )

      await waitFor(() => {
        expect(createdRoom).toEqual({
          room: {
            id: 'new-room-123',
            name: 'New Room',
            code: 'XYZ789',
            gameName: 'matching',
            gameConfig: null,
            accessMode: 'open',
            members: [],
            memberPlayers: {},
          },
          autoLeave: undefined,
        })
      })

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/arcade/rooms',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Room',
            gameName: 'matching',
            creatorName: 'Player 1',
            gameConfig: null,
          }),
        })
      )
    })

    test('handles create room error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid game name' }),
      })

      const { result } = renderHook(() => useCreateRoom(), { wrapper })

      let error: any
      result.current.mutate(
        {
          name: 'Bad Room',
          gameName: 'invalid-game' as any,
          creatorName: 'Player 1',
        },
        {
          onError: (err) => {
            error = err
          },
        }
      )

      await waitFor(() => {
        expect(error).toBeDefined()
        expect(error.message).toContain('Invalid game name')
      })
    })

    test('updates cache after creating room', async () => {
      const mockCreatedRoom = {
        room: {
          id: 'new-room-123',
          name: 'New Room',
          code: 'XYZ789',
          gameName: 'matching',
        },
        members: [],
        memberPlayers: {},
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCreatedRoom,
      })

      const { result } = renderHook(() => useCreateRoom(), { wrapper })

      result.current.mutate({
        name: 'New Room',
        gameName: 'matching',
        creatorName: 'Player 1',
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify cache was updated
      const cachedData = queryClient.getQueryData(['rooms', 'current'])
      expect(cachedData).toEqual({
        id: 'new-room-123',
        name: 'New Room',
        code: 'XYZ789',
        gameName: 'matching',
        gameConfig: null,
        accessMode: 'open',
        members: [],
        memberPlayers: {},
      })
    })
  })

  describe('useJoinRoom', () => {
    test('joins a room successfully', async () => {
      const mockApiResponse = {
        member: {
          id: 'member-1',
          userId: 'test-user-id',
          displayName: 'Player 1',
          isOnline: true,
          isCreator: false,
        },
        room: {
          id: 'room-123',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
        },
        members: [],
        memberPlayers: {},
        activePlayers: [],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      })

      const { result } = renderHook(() => useJoinRoom(), { wrapper })

      let joinedRoom: any
      result.current.mutate(
        {
          roomId: 'room-123',
          displayName: 'Player 1',
        },
        {
          onSuccess: (data) => {
            joinedRoom = data
          },
        }
      )

      await waitFor(() => {
        expect(joinedRoom).toEqual({
          ...mockApiResponse,
          room: {
            id: 'room-123',
            name: 'Test Room',
            code: 'ABC123',
            gameName: 'matching',
            gameConfig: null,
            accessMode: 'open',
            members: [],
            memberPlayers: {},
          },
        })
      })

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/arcade/rooms/room-123/join',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: 'Player 1' }),
        })
      )
    })

    test('handles join room error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Room is locked' }),
      })

      const { result } = renderHook(() => useJoinRoom(), { wrapper })

      let error: any
      result.current.mutate(
        {
          roomId: 'locked-room',
          displayName: 'Player 1',
        },
        {
          onError: (err) => {
            error = err
          },
        }
      )

      await waitFor(() => {
        expect(error).toBeDefined()
        expect(error.message).toContain('Room is locked')
      })
    })
  })

  describe('useLeaveRoom', () => {
    test('leaves a room successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      })

      const { result } = renderHook(() => useLeaveRoom(), { wrapper })

      let success = false
      result.current.mutate('room-123', {
        onSuccess: () => {
          success = true
        },
      })

      await waitFor(() => {
        expect(success).toBe(true)
      })

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/arcade/rooms/room-123/leave',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Verify cache was cleared
      const cachedData = queryClient.getQueryData(['rooms', 'current'])
      expect(cachedData).toBeNull()
    })

    test('handles leave room error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Not in room' }),
      })

      const { result } = renderHook(() => useLeaveRoom(), { wrapper })

      let error: any
      result.current.mutate('room-123', {
        onError: (err) => {
          error = err
        },
      })

      await waitFor(() => {
        expect(error).toBeDefined()
        expect(error.message).toContain('Not in room')
      })
    })
  })

  describe('useGetRoomByCode', () => {
    test('fetches room by code successfully', async () => {
      const mockRoom = {
        room: {
          id: 'room-123',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
        },
        members: [],
        memberPlayers: {},
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      })

      const { result } = renderHook(() => useGetRoomByCode(), { wrapper })

      let fetchedRoom: any
      result.current.mutate('ABC123', {
        onSuccess: (data) => {
          fetchedRoom = data
        },
      })

      await waitFor(() => {
        expect(fetchedRoom).toEqual({
          id: 'room-123',
          name: 'Test Room',
          code: 'ABC123',
          gameName: 'matching',
          gameConfig: null,
          accessMode: 'open',
          members: [],
          memberPlayers: {},
        })
      })

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith('/api/arcade/rooms/code/ABC123')
    })

    test('handles room not found error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useGetRoomByCode(), { wrapper })

      let error: any
      result.current.mutate('INVALID', {
        onError: (err) => {
          error = err
        },
      })

      await waitFor(() => {
        expect(error).toBeDefined()
        expect(error.message).toBe('Room not found')
      })
    })
  })
})
