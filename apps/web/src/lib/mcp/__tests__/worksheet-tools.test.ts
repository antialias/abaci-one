/**
 * Tests for MCP worksheet generation tools
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the database module
vi.mock('@/db', () => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  })
  const mockFindFirst = vi.fn()

  return {
    db: {
      insert: mockInsert,
      query: {
        worksheetShares: {
          findFirst: mockFindFirst,
        },
      },
    },
    schema: {
      worksheetShares: {},
    },
  }
})

// Mock the worksheetShares table
vi.mock('@/db/schema', () => ({
  parentChild: {},
  worksheetShares: {
    id: 'id',
    worksheetType: 'worksheet_type',
    config: 'config',
    createdAt: 'created_at',
    views: 'views',
    creatorIp: 'creator_ip',
    title: 'title',
  },
}))

// Mock generateShareId to return predictable values
vi.mock('@/lib/generateShareId', () => {
  return {
    generateShareId: vi.fn().mockReturnValue('abcdef1234'),
    isValidShareId: vi.fn().mockReturnValue(true),
  }
})

// Import after mocking
import { db } from '@/db'
import { worksheetShares } from '@/db/schema'
import { generateShareId, isValidShareId } from '@/lib/generateShareId'
import { generateWorksheet, getWorksheetInfo, listDifficultyProfiles } from '../tools'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
} from '@/app/create/worksheets/difficultyProfiles'

describe('MCP Worksheet Tools', () => {
  const mockInsert = db.insert as ReturnType<typeof vi.fn>
  const mockFindFirst = db.query.worksheetShares.findFirst as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock to return a unique value
    ;(generateShareId as ReturnType<typeof vi.fn>).mockReturnValue('abcdef1234')
    // Reset isValidShareId to return true by default
    ;(isValidShareId as ReturnType<typeof vi.fn>).mockReturnValue(true)
    // Mock insert chain
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })
  })

  describe('listDifficultyProfiles', () => {
    it('returns all difficulty profiles', () => {
      const result = listDifficultyProfiles()

      expect(result.profiles).toHaveLength(DIFFICULTY_PROGRESSION.length)
      expect(result.progression).toEqual(DIFFICULTY_PROGRESSION)
    })

    it('includes correct profile names in order', () => {
      const result = listDifficultyProfiles()

      expect(result.progression).toEqual([
        'beginner',
        'earlyLearner',
        'practice',
        'intermediate',
        'advanced',
        'expert',
      ])
    })

    it('includes regrouping settings for each profile', () => {
      const result = listDifficultyProfiles()

      // Check beginner profile (no regrouping)
      const beginner = result.profiles.find((p) => p.name === 'beginner')
      expect(beginner).toBeDefined()
      expect(beginner!.regrouping.pAnyStart).toBe(0)
      expect(beginner!.regrouping.pAllStart).toBe(0)
      expect(beginner!.regrouping.percent).toBe(0)

      // Check earlyLearner (25% regrouping)
      const earlyLearner = result.profiles.find((p) => p.name === 'earlyLearner')
      expect(earlyLearner).toBeDefined()
      expect(earlyLearner!.regrouping.pAnyStart).toBe(0.25)
      expect(earlyLearner!.regrouping.percent).toBe(25)

      // Check advanced (90% regrouping)
      const advanced = result.profiles.find((p) => p.name === 'advanced')
      expect(advanced).toBeDefined()
      expect(advanced!.regrouping.pAnyStart).toBe(0.9)
      expect(advanced!.regrouping.percent).toBe(90)
    })

    it('includes scaffolding settings for each profile', () => {
      const result = listDifficultyProfiles()

      // Check beginner profile (full scaffolding)
      const beginner = result.profiles.find((p) => p.name === 'beginner')
      expect(beginner!.scaffolding.carryBoxes).toBe('always')
      expect(beginner!.scaffolding.answerBoxes).toBe('always')
      expect(beginner!.scaffolding.placeValueColors).toBe('always')

      // Check expert profile (no scaffolding)
      const expert = result.profiles.find((p) => p.name === 'expert')
      expect(expert!.scaffolding.carryBoxes).toBe('never')
      expect(expert!.scaffolding.answerBoxes).toBe('never')
      expect(expert!.scaffolding.placeValueColors).toBe('never')
    })

    it('includes description and label for each profile', () => {
      const result = listDifficultyProfiles()

      result.profiles.forEach((profile) => {
        expect(profile.label).toBeTruthy()
        expect(profile.description).toBeTruthy()
        expect(typeof profile.label).toBe('string')
        expect(typeof profile.description).toBe('string')
      })
    })
  })

  describe('generateWorksheet', () => {
    it('generates worksheet with default options', async () => {
      const result = await generateWorksheet({})

      expect(result.shareId).toBe('abcdef1234')
      expect(result.shareUrl).toContain('/worksheets/shared/abcdef1234')
      expect(result.downloadUrl).toContain('/api/worksheets/download/abcdef1234')
      expect(result.summary).toBeDefined()
    })

    it('uses earlyLearner as default difficulty profile', async () => {
      const result = await generateWorksheet({})

      expect(result.summary.difficultyProfile).toBe('earlyLearner')
      expect(result.summary.regroupingPercent).toBe(25)
    })

    it('applies custom difficulty profile', async () => {
      const result = await generateWorksheet({ difficultyProfile: 'advanced' })

      expect(result.summary.difficultyProfile).toBe('advanced')
      expect(result.summary.regroupingPercent).toBe(90)
    })

    it('sets correct operator', async () => {
      const addition = await generateWorksheet({ operator: 'addition' })
      expect(addition.summary.operator).toBe('addition')

      const subtraction = await generateWorksheet({ operator: 'subtraction' })
      expect(subtraction.summary.operator).toBe('subtraction')

      const mixed = await generateWorksheet({ operator: 'mixed' })
      expect(mixed.summary.operator).toBe('mixed')
    })

    it('validates digit range', async () => {
      // Valid range
      const result = await generateWorksheet({ digitRange: { min: 2, max: 4 } })
      expect(result.summary.digitRange.min).toBe(2)
      expect(result.summary.digitRange.max).toBe(4)
    })

    it('clamps digit range to valid bounds', async () => {
      // Out of bounds values should be clamped
      // Note: min: 0 falls back to default 2 due to || operator, then clamped
      const result = await generateWorksheet({ digitRange: { min: 0, max: 10 } })
      expect(result.summary.digitRange.min).toBe(2) // 0 || 2 = 2, then clamped to 1-5
      expect(result.summary.digitRange.max).toBe(5) // 10 clamped to 5

      // Test explicit min value clamping
      const result2 = await generateWorksheet({ digitRange: { min: -5, max: 3 } })
      expect(result2.summary.digitRange.min).toBe(1) // -5 || 2 = 2 (but clamped), wait -5 is truthy
      // Actually -5 is truthy, so Math.max(1, Math.min(5, -5)) = Math.max(1, -5) = 1
    })

    it('fixes inverted digit range', async () => {
      const result = await generateWorksheet({ digitRange: { min: 4, max: 2 } })
      expect(result.summary.digitRange.min).toBe(4)
      expect(result.summary.digitRange.max).toBe(4)
    })

    it('sets correct page count and problems', async () => {
      const result = await generateWorksheet({ pages: 3, problemsPerPage: 15 })

      expect(result.summary.pages).toBe(3)
      expect(result.summary.problemsPerPage).toBe(15)
      expect(result.summary.totalProblems).toBe(45)
    })

    it('clamps problems per page to valid range', async () => {
      // Too high
      const high = await generateWorksheet({ problemsPerPage: 100 })
      expect(high.summary.problemsPerPage).toBe(40)

      // Too low
      const low = await generateWorksheet({ problemsPerPage: 0 })
      expect(low.summary.problemsPerPage).toBe(1)
    })

    it('clamps pages to valid range', async () => {
      // Too high
      const high = await generateWorksheet({ pages: 50 })
      expect(high.summary.pages).toBe(20)

      // Too low
      const low = await generateWorksheet({ pages: 0 })
      expect(low.summary.pages).toBe(1)
    })

    it('sets orientation correctly', async () => {
      const landscape = await generateWorksheet({ orientation: 'landscape' })
      expect(landscape.summary.orientation).toBe('landscape')

      const portrait = await generateWorksheet({ orientation: 'portrait' })
      expect(portrait.summary.orientation).toBe('portrait')
    })

    it('sets columns correctly', async () => {
      const result = await generateWorksheet({ cols: 4 })
      expect(result.summary.cols).toBe(4)
    })

    it('clamps columns to valid range', async () => {
      const high = await generateWorksheet({ cols: 10 })
      expect(high.summary.cols).toBe(6)

      const low = await generateWorksheet({ cols: 0 })
      expect(low.summary.cols).toBe(1)
    })

    it('sets includeAnswerKey correctly', async () => {
      const withKey = await generateWorksheet({ includeAnswerKey: true })
      expect(withKey.summary.includeAnswerKey).toBe(true)

      const withoutKey = await generateWorksheet({ includeAnswerKey: false })
      expect(withoutKey.summary.includeAnswerKey).toBe(false)
    })

    it('inserts share record into database', async () => {
      await generateWorksheet({ title: 'Test Worksheet' })

      expect(mockInsert).toHaveBeenCalledWith(worksheetShares)
      const insertCall = mockInsert.mock.results[0].value
      expect(insertCall.values).toHaveBeenCalled()
    })

    it('includes scaffolding settings from difficulty profile', async () => {
      const beginner = await generateWorksheet({ difficultyProfile: 'beginner' })
      expect(beginner.summary.scaffolding.carryBoxes).toBe('always')
      expect(beginner.summary.scaffolding.answerBoxes).toBe('always')

      const expert = await generateWorksheet({ difficultyProfile: 'expert' })
      expect(expert.summary.scaffolding.carryBoxes).toBe('never')
      expect(expert.summary.scaffolding.answerBoxes).toBe('never')
    })

    it('falls back to earlyLearner for unknown profile', async () => {
      const result = await generateWorksheet({ difficultyProfile: 'unknownProfile' })

      expect(result.summary.difficultyProfile).toBe('earlyLearner')
    })
  })

  describe('getWorksheetInfo', () => {
    const mockShareRecord = {
      id: 'testshare12',
      worksheetType: 'addition',
      config: JSON.stringify({
        version: 4,
        mode: 'custom',
        operator: 'addition',
        digitRange: { min: 2, max: 3 },
        problemsPerPage: 20,
        pages: 2,
        cols: 5,
        orientation: 'landscape',
        name: 'Test',
        fontSize: 16,
        pAnyStart: 0.25,
        pAllStart: 0,
        interpolate: true,
        difficultyProfile: 'earlyLearner',
        includeAnswerKey: true,
        includeQRCode: false,
        displayRules: {
          carryBoxes: 'whenRegrouping',
          answerBoxes: 'always',
          placeValueColors: 'always',
          tenFrames: 'whenRegrouping',
          borrowNotation: 'whenRegrouping',
          borrowingHints: 'always',
          problemNumbers: 'always',
          cellBorders: 'never',
        },
      }),
      createdAt: new Date('2026-01-15T10:00:00Z'),
      views: 5,
      title: 'Morning Practice',
    }

    beforeEach(() => {
      mockFindFirst.mockResolvedValue(mockShareRecord)
    })

    it('returns worksheet info for valid share ID', async () => {
      const result = await getWorksheetInfo('testshare12')

      expect(result.shareId).toBe('testshare12')
      expect(result.title).toBe('Morning Practice')
      expect(result.worksheetType).toBe('addition')
      expect(result.views).toBe(5)
    })

    it('returns correct URLs', async () => {
      const result = await getWorksheetInfo('testshare12')

      expect(result.shareUrl).toContain('/worksheets/shared/testshare12')
      expect(result.downloadUrl).toContain('/api/worksheets/download/testshare12')
    })

    it('parses config correctly', async () => {
      const result = await getWorksheetInfo('testshare12')

      expect(result.config.operator).toBe('addition')
      expect(result.config.digitRange).toEqual({ min: 2, max: 3 })
      expect(result.config.totalProblems).toBe(40) // 20 * 2
      expect(result.config.pages).toBe(2)
      expect(result.config.problemsPerPage).toBe(20)
      expect(result.config.cols).toBe(5)
      expect(result.config.orientation).toBe('landscape')
    })

    it('identifies difficulty profile', async () => {
      const result = await getWorksheetInfo('testshare12')

      expect(result.config.difficultyProfile).toBe('earlyLearner')
      expect(result.config.difficultyLabel).toBe('Early Learner')
      expect(result.config.regroupingPercent).toBe(25)
    })

    it('returns createdAt as ISO string', async () => {
      const result = await getWorksheetInfo('testshare12')

      expect(result.createdAt).toBe('2026-01-15T10:00:00.000Z')
    })

    it('throws error for invalid share ID format', async () => {
      ;(isValidShareId as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)

      await expect(getWorksheetInfo('invalid')).rejects.toThrow('Invalid share ID format')
    })

    it('throws error when share not found', async () => {
      mockFindFirst.mockResolvedValue(null)

      await expect(getWorksheetInfo('notfound12')).rejects.toThrow('Worksheet not found')
    })

    it('handles worksheet without title', async () => {
      mockFindFirst.mockResolvedValue({
        ...mockShareRecord,
        title: null,
      })

      const result = await getWorksheetInfo('testshare12')

      expect(result.title).toBeNull()
    })

    it('handles custom profile (no matching preset)', async () => {
      mockFindFirst.mockResolvedValue({
        ...mockShareRecord,
        config: JSON.stringify({
          version: 4,
          mode: 'custom',
          operator: 'addition',
          digitRange: { min: 2, max: 2 },
          problemsPerPage: 20,
          pages: 1,
          cols: 5,
          orientation: 'landscape',
          name: 'Custom Test',
          fontSize: 16,
          pAnyStart: 0.5, // Not matching any preset
          pAllStart: 0.1,
          interpolate: true,
          includeAnswerKey: false,
          includeQRCode: false,
          // No difficultyProfile field
          displayRules: {
            carryBoxes: 'always',
            answerBoxes: 'always',
            placeValueColors: 'always',
            tenFrames: 'always',
            borrowNotation: 'always',
            borrowingHints: 'always',
            problemNumbers: 'always',
            cellBorders: 'never',
          },
        }),
      })

      const result = await getWorksheetInfo('testshare12')

      expect(result.config.difficultyProfile).toBe('custom')
      expect(result.config.difficultyLabel).toBe('Custom')
    })
  })
})
