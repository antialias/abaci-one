/**
 * Tests for worksheet download API endpoint
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the database module
vi.mock('@/db', () => {
  const mockFindFirst = vi.fn()

  return {
    db: {
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
  worksheetShares: {
    id: 'id',
  },
}))

// Mock generateShareId
vi.mock('@/lib/generateShareId', () => ({
  isValidShareId: vi.fn().mockReturnValue(true),
}))

// Mock the worksheet config parsing
vi.mock('@/app/create/worksheets/config-schemas', () => ({
  parseAdditionConfig: vi.fn().mockReturnValue({
    version: 4,
    mode: 'custom',
    operator: 'addition',
    digitRange: { min: 2, max: 2 },
    problemsPerPage: 20,
    pages: 1,
    cols: 5,
    orientation: 'landscape',
    pAnyStart: 0.25,
    pAllStart: 0,
    total: 20,
    seed: 12345,
  }),
}))

// Mock the validation
vi.mock('@/app/create/worksheets/validation', () => ({
  validateWorksheetConfig: vi.fn().mockReturnValue({
    isValid: true,
    config: {
      version: 4,
      mode: 'custom',
      operator: 'addition',
      digitRange: { min: 2, max: 2 },
      problemsPerPage: 20,
      pages: 1,
      cols: 5,
      total: 20,
      rows: 4,
      orientation: 'landscape',
      pAnyStart: 0.25,
      pAllStart: 0,
      seed: 12345,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping',
      },
    },
  }),
}))

// Mock problem generators
vi.mock('@/app/create/worksheets/problemGenerator', () => ({
  generateProblems: vi.fn().mockReturnValue([
    { a: 23, b: 45, operator: 'add' },
    { a: 12, b: 34, operator: 'add' },
  ]),
  generateSubtractionProblems: vi.fn().mockReturnValue([]),
  generateMixedProblems: vi.fn().mockReturnValue([]),
}))

// Mock Typst generator
vi.mock('@/app/create/worksheets/typstGenerator', () => ({
  generateTypstSource: vi.fn().mockResolvedValue(['#set page(width: 11in)\n// Typst content']),
}))

// Mock child_process for Typst compilation
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    execSync: vi.fn().mockReturnValue(Buffer.from('fake-pdf-content')),
  }
})

// Import after mocking
import { db } from '@/db'
import { isValidShareId } from '@/lib/generateShareId'
import { GET } from '../[id]/route'

describe('Worksheet Download API', () => {
  const mockFindFirst = db.query.worksheetShares.findFirst as ReturnType<typeof vi.fn>

  const validShareRecord = {
    id: 'testshare12',
    worksheetType: 'addition',
    config: '{}', // Will be parsed by mock
    createdAt: new Date('2026-01-15T10:00:00Z'),
    views: 5,
    title: 'Test Worksheet',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(isValidShareId as ReturnType<typeof vi.fn>).mockReturnValue(true)
    mockFindFirst.mockResolvedValue(validShareRecord)
  })

  it('returns 400 for invalid share ID format', async () => {
    ;(isValidShareId as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const request = new NextRequest('http://localhost:3000/api/worksheets/download/invalid')
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid share ID format')
  })

  it('returns 404 when share not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/worksheets/download/notfound12')
    const response = await GET(request, { params: Promise.resolve({ id: 'notfound12' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Share not found')
  })

  it('returns PDF for valid share ID', async () => {
    const request = new NextRequest('http://localhost:3000/api/worksheets/download/testshare12')
    const response = await GET(request, { params: Promise.resolve({ id: 'testshare12' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('worksheet-Test-Worksheet.pdf')
  })

  it('uses share ID in filename when no title', async () => {
    mockFindFirst.mockResolvedValue({
      ...validShareRecord,
      title: null,
    })

    const request = new NextRequest('http://localhost:3000/api/worksheets/download/testshare12')
    const response = await GET(request, { params: Promise.resolve({ id: 'testshare12' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('worksheet-testshare12.pdf')
  })

  it('sanitizes title for filename', async () => {
    mockFindFirst.mockResolvedValue({
      ...validShareRecord,
      title: 'Test/Worksheet:With*Special?Chars',
    })

    const request = new NextRequest('http://localhost:3000/api/worksheets/download/testshare12')
    const response = await GET(request, { params: Promise.resolve({ id: 'testshare12' }) })

    expect(response.status).toBe(200)
    // Special characters should be replaced with hyphens
    expect(response.headers.get('Content-Disposition')).toContain(
      'worksheet-Test-Worksheet-With-Special-Chars.pdf'
    )
  })
})
