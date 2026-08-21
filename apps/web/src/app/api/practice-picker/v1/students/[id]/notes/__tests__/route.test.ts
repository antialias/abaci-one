// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isParentOf } from '@/lib/classroom/access-control'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: { query: { players: { findFirst: findFirstMock } } },
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'viewer-1'),
}))

vi.mock('@/lib/classroom/access-control', () => ({
  isParentOf: vi.fn(),
}))

import { GET } from '../route'

const isParentOfMock = vi.mocked(isParentOf)
const request = new NextRequest(
  'http://localhost/api/practice-picker/v1/students/student-1/notes'
)
const context = { params: Promise.resolve({ id: 'student-1' }) } as never

describe('GET /api/practice-picker/v1/students/[id]/notes', () => {
  beforeEach(() => {
    isParentOfMock.mockReset()
    findFirstMock.mockReset()
  })

  it('uses the canonical parent-access rule and conceals unauthorized students', async () => {
    isParentOfMock.mockResolvedValue(false)

    const response = await GET(request, context)

    expect(response.status).toBe(404)
    expect(isParentOfMock).toHaveBeenCalledWith('viewer-1', 'student-1')
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('selects and returns only the private notes contract', async () => {
    isParentOfMock.mockResolvedValue(true)
    findFirstMock.mockResolvedValue({ id: 'student-1', notes: 'Remember complements' })

    const response = await GET(request, context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      version: 1,
      studentId: 'student-1',
      notes: 'Remember complements',
    })
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ columns: { id: true, notes: true } })
    )
  })
})
