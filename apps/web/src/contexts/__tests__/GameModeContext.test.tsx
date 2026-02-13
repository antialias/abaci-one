import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { GameModeProvider, useGameMode } from '../GameModeContext'
import type { GameModeProviderProps } from '../GameModeContext'

// Mock dependencies
vi.mock('@/utils/playerNames', () => ({
  generateUniquePlayerName: vi.fn(
    (existing: string[], _emoji: string) => `Player${existing.length + 1}`
  ),
}))

vi.mock('@/types/player', () => ({
  getNextPlayerColor: vi.fn(() => '#ff0000'),
}))

const mockCreatePlayer = vi.fn()
const mockUpdatePlayerMutation = vi.fn()
const mockDeletePlayer = vi.fn()
const mockNotifyRoomOfPlayerUpdate = vi.fn()

const defaultProps: Omit<GameModeProviderProps, 'children'> = {
  dbPlayers: [],
  isLoading: false,
  createPlayer: mockCreatePlayer,
  updatePlayerMutation: mockUpdatePlayerMutation,
  deletePlayer: mockDeletePlayer,
  roomData: null,
  notifyRoomOfPlayerUpdate: mockNotifyRoomOfPlayerUpdate,
  viewerId: 'viewer-1',
}

function createWrapper(overrides: Partial<Omit<GameModeProviderProps, 'children'>> = {}) {
  const props = { ...defaultProps, ...overrides }
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameModeProvider {...props}>{children}</GameModeProvider>
  }
}

describe('GameModeContext', () => {
  beforeEach(() => {
    mockCreatePlayer.mockClear()
    mockUpdatePlayerMutation.mockClear()
    mockDeletePlayer.mockClear()
    mockNotifyRoomOfPlayerUpdate.mockClear()
  })

  it('returns default context when no provider is present', () => {
    const { result } = renderHook(() => useGameMode())
    expect(result.current.gameMode).toBe('single')
    expect(result.current.players.size).toBe(0)
    expect(result.current.activePlayers.size).toBe(0)
    expect(result.current.activePlayerCount).toBe(0)
    expect(result.current.isLoading).toBe(true)
  })

  it('provides game mode as single when no active players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper(),
    })
    expect(result.current.gameMode).toBe('single')
  })

  it('provides game mode as single with one active player', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    expect(result.current.gameMode).toBe('single')
    expect(result.current.activePlayerCount).toBe(1)
  })

  it('provides game mode as battle with two active players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
          {
            id: 'p2',
            name: 'Bob',
            emoji: '😎',
            color: '#8b5cf6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    expect(result.current.gameMode).toBe('battle')
    expect(result.current.activePlayerCount).toBe(2)
  })

  it('provides game mode as tournament with 3+ active players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
          {
            id: 'p2',
            name: 'Bob',
            emoji: '😎',
            color: '#8b5cf6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
          {
            id: 'p3',
            name: 'Charlie',
            emoji: '🤠',
            color: '#10b981',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    expect(result.current.gameMode).toBe('tournament')
    expect(result.current.activePlayerCount).toBe(3)
  })

  it('converts dbPlayers to Map with isLocal flag', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    const player = result.current.getPlayer('p1')
    expect(player).toBeDefined()
    expect(player!.name).toBe('Alice')
    expect(player!.isLocal).toBe(true)
  })

  it('getAllPlayers returns all players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
          {
            id: 'p2',
            name: 'Bob',
            emoji: '😎',
            color: '#8b5cf6',
            createdAt: new Date(),
            isActive: false,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    const all = result.current.getAllPlayers()
    expect(all.length).toBe(2)
  })

  it('getActivePlayers returns only active players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
          {
            id: 'p2',
            name: 'Bob',
            emoji: '😎',
            color: '#8b5cf6',
            createdAt: new Date(),
            isActive: false,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })
    const active = result.current.getActivePlayers()
    expect(active.length).toBe(1)
    expect(active[0].name).toBe('Alice')
  })

  it('addPlayer calls createPlayer mutation', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.addPlayer({ name: 'NewPlayer', emoji: '🎮', color: '#f00' })
    })

    expect(mockCreatePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'NewPlayer',
        emoji: '🎮',
        color: '#f00',
      }),
      expect.any(Object)
    )
  })

  it('updatePlayer calls updatePlayerMutation for local players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })

    act(() => {
      result.current.updatePlayer('p1', { name: 'AliceUpdated' })
    })

    expect(mockUpdatePlayerMutation).toHaveBeenCalledWith(
      { id: 'p1', updates: { name: 'AliceUpdated' } },
      expect.any(Object)
    )
  })

  it('removePlayer calls deletePlayer for local players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })

    act(() => {
      result.current.removePlayer('p1')
    })

    expect(mockDeletePlayer).toHaveBeenCalledWith('p1', expect.any(Object))
  })

  it('setActive calls updatePlayerMutation for local players', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: false,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })

    act(() => {
      result.current.setActive('p1', true)
    })

    expect(mockUpdatePlayerMutation).toHaveBeenCalledWith(
      { id: 'p1', updates: { isActive: true } },
      expect.any(Object)
    )
  })

  it('creates default players when dbPlayers is empty and not loading', () => {
    renderHook(() => useGameMode(), {
      wrapper: createWrapper({ dbPlayers: [], isLoading: false }),
    })

    // Should create 4 default players
    expect(mockCreatePlayer).toHaveBeenCalledTimes(4)
  })

  it('does not create default players when loading', () => {
    renderHook(() => useGameMode(), {
      wrapper: createWrapper({ dbPlayers: [], isLoading: true }),
    })

    expect(mockCreatePlayer).not.toHaveBeenCalled()
  })

  it('does not create default players when dbPlayers exist', () => {
    renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
      }),
    })

    expect(mockCreatePlayer).not.toHaveBeenCalled()
  })

  it('merges room players from other members', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [
          {
            id: 'p1',
            name: 'Alice',
            emoji: '😀',
            color: '#3b82f6',
            createdAt: new Date(),
            isActive: true,
            userId: 'u1',
            updatedAt: new Date(),
            age: null,
          },
        ],
        roomData: {
          id: 'room-1',
          memberPlayers: {
            'viewer-1': [{ id: 'p1', name: 'Alice', emoji: '😀', color: '#3b82f6' }],
            'other-user': [{ id: 'remote-1', name: 'Bob', emoji: '🎮', color: '#10b981' }],
          },
        },
        viewerId: 'viewer-1',
      }),
    })

    const all = result.current.getAllPlayers()
    expect(all.length).toBe(2) // 1 local + 1 remote
    const remotePlayer = result.current.getPlayer('remote-1')
    expect(remotePlayer).toBeDefined()
    expect(remotePlayer!.isLocal).toBe(false)
  })

  it('does not allow updating remote players', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [],
        roomData: {
          id: 'room-1',
          memberPlayers: {
            'other-user': [{ id: 'remote-1', name: 'Bob', emoji: '🎮', color: '#10b981' }],
          },
        },
        viewerId: 'viewer-1',
      }),
    })

    act(() => {
      result.current.updatePlayer('remote-1', { name: 'Hacked' })
    })

    expect(mockUpdatePlayerMutation).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot update remote player'),
      'remote-1'
    )
    warnSpy.mockRestore()
  })

  it('does not allow removing remote players', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({
        dbPlayers: [],
        roomData: {
          id: 'room-1',
          memberPlayers: {
            'other-user': [{ id: 'remote-1', name: 'Bob', emoji: '🎮', color: '#10b981' }],
          },
        },
        viewerId: 'viewer-1',
      }),
    })

    act(() => {
      result.current.removePlayer('remote-1')
    })

    expect(mockDeletePlayer).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('provides isLoading from props', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper({ isLoading: true }),
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('provides all expected functions', () => {
    const { result } = renderHook(() => useGameMode(), {
      wrapper: createWrapper(),
    })

    expect(typeof result.current.addPlayer).toBe('function')
    expect(typeof result.current.updatePlayer).toBe('function')
    expect(typeof result.current.removePlayer).toBe('function')
    expect(typeof result.current.setActive).toBe('function')
    expect(typeof result.current.getActivePlayers).toBe('function')
    expect(typeof result.current.getPlayer).toBe('function')
    expect(typeof result.current.getAllPlayers).toBe('function')
    expect(typeof result.current.resetPlayers).toBe('function')
  })
})
