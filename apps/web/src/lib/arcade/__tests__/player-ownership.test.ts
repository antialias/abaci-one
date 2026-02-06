/**
 * Tests for player ownership utilities
 */

import { describe, expect, it } from 'vitest'
import type { RoomData } from '@/hooks/useRoomData'
import {
  buildPlayerMetadata,
  buildPlayerOwnershipFromRoomData,
  filterPlayersByOwner,
  getPlayerOwner,
  getUniqueOwners,
  groupPlayersByOwner,
  isPlayerOwnedByUser,
  type PlayerOwnershipMap,
} from '../player-ownership'

describe('player-ownership utilities', () => {
  // Sample data for tests
  const mockOwnershipMap: PlayerOwnershipMap = {
    'player-1': 'user-a',
    'player-2': 'user-a',
    'player-3': 'user-b',
    'player-4': 'user-c',
  }

  const mockRoomData: RoomData = {
    id: 'room-123',
    name: 'Test Room',
    code: 'ABCD',
    gameName: 'memory-pairs',
    accessMode: 'open',
    members: [
      {
        id: 'member-1',
        userId: 'user-a',
        displayName: 'User A',
        isOnline: true,
        isCreator: true,
      },
      {
        id: 'member-2',
        userId: 'user-b',
        displayName: 'User B',
        isOnline: true,
        isCreator: false,
      },
    ],
    memberPlayers: {
      'user-a': [
        { id: 'player-1', name: 'Player 1', emoji: '🐶', color: '#ff0000' },
        { id: 'player-2', name: 'Player 2', emoji: '🐱', color: '#00ff00' },
      ],
      'user-b': [{ id: 'player-3', name: 'Player 3', emoji: '🐭', color: '#0000ff' }],
    },
  }

  describe('buildPlayerOwnershipFromRoomData', () => {
    it('should build ownership map from room data', () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData)

      expect(ownership).toEqual({
        'player-1': 'user-a',
        'player-2': 'user-a',
        'player-3': 'user-b',
      })
    })

    it('should return empty map for null room data', () => {
      const ownership = buildPlayerOwnershipFromRoomData(null)
      expect(ownership).toEqual({})
    })

    it('should return empty map for undefined room data', () => {
      const ownership = buildPlayerOwnershipFromRoomData(undefined)
      expect(ownership).toEqual({})
    })

    it('should return empty map when memberPlayers is missing', () => {
      const roomDataWithoutPlayers = {
        ...mockRoomData,
        memberPlayers: undefined as any,
      }
      const ownership = buildPlayerOwnershipFromRoomData(roomDataWithoutPlayers)
      expect(ownership).toEqual({})
    })
  })

  describe('isPlayerOwnedByUser', () => {
    it('should return true when player belongs to user', () => {
      expect(isPlayerOwnedByUser('player-1', 'user-a', mockOwnershipMap)).toBe(true)
      expect(isPlayerOwnedByUser('player-2', 'user-a', mockOwnershipMap)).toBe(true)
    })

    it('should return false when player does not belong to user', () => {
      expect(isPlayerOwnedByUser('player-1', 'user-b', mockOwnershipMap)).toBe(false)
      expect(isPlayerOwnedByUser('player-3', 'user-a', mockOwnershipMap)).toBe(false)
    })

    it('should return false for non-existent player', () => {
      expect(isPlayerOwnedByUser('player-999', 'user-a', mockOwnershipMap)).toBe(false)
    })
  })

  describe('getPlayerOwner', () => {
    it('should return the owner user ID for a player', () => {
      expect(getPlayerOwner('player-1', mockOwnershipMap)).toBe('user-a')
      expect(getPlayerOwner('player-3', mockOwnershipMap)).toBe('user-b')
      expect(getPlayerOwner('player-4', mockOwnershipMap)).toBe('user-c')
    })

    it('should return undefined for non-existent player', () => {
      expect(getPlayerOwner('player-999', mockOwnershipMap)).toBeUndefined()
    })
  })

  describe('buildPlayerMetadata', () => {
    const mockPlayersMap = new Map([
      ['player-1', { name: 'Dog', emoji: '🐶', color: '#ff0000' }],
      ['player-2', { name: 'Cat', emoji: '🐱', color: '#00ff00' }],
      ['player-3', { name: 'Mouse', emoji: '🐭', color: '#0000ff' }],
    ])

    it('should build metadata with correct ownership', () => {
      const metadata = buildPlayerMetadata(
        ['player-1', 'player-2', 'player-3'],
        mockOwnershipMap,
        mockPlayersMap
      )

      expect(metadata).toEqual({
        'player-1': {
          id: 'player-1',
          name: 'Dog',
          emoji: '🐶',
          color: '#ff0000',
          userId: 'user-a',
        },
        'player-2': {
          id: 'player-2',
          name: 'Cat',
          emoji: '🐱',
          color: '#00ff00',
          userId: 'user-a',
        },
        'player-3': {
          id: 'player-3',
          name: 'Mouse',
          emoji: '🐭',
          color: '#0000ff',
          userId: 'user-b',
        },
      })
    })

    it('should use fallback userId when player not in ownership map', () => {
      const metadata = buildPlayerMetadata(['player-1'], {}, mockPlayersMap, 'fallback-user')

      expect(metadata['player-1'].userId).toBe('fallback-user')
    })

    it('should skip players not in players map', () => {
      const metadata = buildPlayerMetadata(
        ['player-1', 'player-999'],
        mockOwnershipMap,
        mockPlayersMap
      )

      expect(metadata['player-1']).toBeDefined()
      expect(metadata['player-999']).toBeUndefined()
    })
  })

  describe('filterPlayersByOwner', () => {
    it('should return only players owned by specified user', () => {
      const playerIds = ['player-1', 'player-2', 'player-3', 'player-4']

      const userAPlayers = filterPlayersByOwner(playerIds, 'user-a', mockOwnershipMap)
      expect(userAPlayers).toEqual(['player-1', 'player-2'])

      const userBPlayers = filterPlayersByOwner(playerIds, 'user-b', mockOwnershipMap)
      expect(userBPlayers).toEqual(['player-3'])

      const userCPlayers = filterPlayersByOwner(playerIds, 'user-c', mockOwnershipMap)
      expect(userCPlayers).toEqual(['player-4'])
    })

    it('should return empty array when user owns no players', () => {
      const playerIds = ['player-1', 'player-2', 'player-3']
      const result = filterPlayersByOwner(playerIds, 'user-nonexistent', mockOwnershipMap)
      expect(result).toEqual([])
    })

    it('should return empty array for empty input', () => {
      const result = filterPlayersByOwner([], 'user-a', mockOwnershipMap)
      expect(result).toEqual([])
    })
  })

  describe('getUniqueOwners', () => {
    it('should return array of unique user IDs', () => {
      const owners = getUniqueOwners(mockOwnershipMap)
      expect(owners).toHaveLength(3)
      expect(owners).toContain('user-a')
      expect(owners).toContain('user-b')
      expect(owners).toContain('user-c')
    })

    it('should return empty array for empty ownership map', () => {
      const owners = getUniqueOwners({})
      expect(owners).toEqual([])
    })

    it('should deduplicate user IDs', () => {
      const ownership: PlayerOwnershipMap = {
        'player-1': 'user-a',
        'player-2': 'user-a',
        'player-3': 'user-a',
      }
      const owners = getUniqueOwners(ownership)
      expect(owners).toEqual(['user-a'])
    })
  })

  describe('groupPlayersByOwner', () => {
    it('should group players by their owner', () => {
      const playerIds = ['player-1', 'player-2', 'player-3', 'player-4']
      const groups = groupPlayersByOwner(playerIds, mockOwnershipMap)

      expect(groups.size).toBe(3)
      expect(groups.get('user-a')).toEqual(['player-1', 'player-2'])
      expect(groups.get('user-b')).toEqual(['player-3'])
      expect(groups.get('user-c')).toEqual(['player-4'])
    })

    it('should return empty map for empty input', () => {
      const groups = groupPlayersByOwner([], mockOwnershipMap)
      expect(groups.size).toBe(0)
    })

    it('should skip players not in ownership map', () => {
      const playerIds = ['player-1', 'player-999']
      const groups = groupPlayersByOwner(playerIds, mockOwnershipMap)

      expect(groups.size).toBe(1)
      expect(groups.get('user-a')).toEqual(['player-1'])
    })
  })
})
