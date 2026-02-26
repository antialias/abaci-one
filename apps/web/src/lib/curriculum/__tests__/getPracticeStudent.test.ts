import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the player-manager module before importing getPracticeStudent
vi.mock('@/lib/arcade/player-manager', () => ({
  getPlayer: vi.fn(),
}))

import { getPlayer } from '@/lib/arcade/player-manager'
import { getPracticeStudent } from '../practice-student'

const mockGetPlayer = vi.mocked(getPlayer)

// Minimal valid player
function makePlayer(
  overrides: Partial<{
    id: string
    isPracticeStudent: boolean
  }> = {}
) {
  return {
    id: overrides.id ?? 'player-1',
    userId: 'user-1',
    name: 'Test Student',
    emoji: '🧑',
    color: '#FF0000',
    isActive: true,
    createdAt: new Date(),
    helpSettings: null,
    notes: null,
    isArchived: false,
    isPracticeStudent: overrides.isPracticeStudent ?? true,
    birthday: null,
    familyCode: null,
    familyCodeGeneratedAt: null,
  }
}

describe('getPracticeStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the player when isPracticeStudent is true', async () => {
    const player = makePlayer({ isPracticeStudent: true })
    mockGetPlayer.mockResolvedValue(player)

    const result = await getPracticeStudent('player-1')

    expect(mockGetPlayer).toHaveBeenCalledWith('player-1')
    expect(result).toEqual(player)
  })

  it('returns undefined when isPracticeStudent is false', async () => {
    const player = makePlayer({ isPracticeStudent: false })
    mockGetPlayer.mockResolvedValue(player)

    const result = await getPracticeStudent('player-1')

    expect(mockGetPlayer).toHaveBeenCalledWith('player-1')
    expect(result).toBeUndefined()
  })

  it('returns undefined when player does not exist', async () => {
    mockGetPlayer.mockResolvedValue(undefined)

    const result = await getPracticeStudent('nonexistent')

    expect(mockGetPlayer).toHaveBeenCalledWith('nonexistent')
    expect(result).toBeUndefined()
  })
})
