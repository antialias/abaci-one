// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPracticePickerV1Data } from '@/lib/practice-picker/server'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/practice-picker/server', () => ({
  getPracticePickerV1Data: vi.fn(),
}))

import { GET } from '../route'

const getPracticePickerV1DataMock = vi.mocked(getPracticePickerV1Data)
const request = new NextRequest('http://localhost/api/practice-picker/v1/students')

describe('GET /api/practice-picker/v1/students', () => {
  beforeEach(() => {
    getPracticePickerV1DataMock.mockReset()
  })

  it('returns the versioned bounded response unchanged', async () => {
    getPracticePickerV1DataMock.mockResolvedValue({
      version: 1,
      students: [],
      counts: { active: 0, archived: 0, total: 0 },
    })

    const response = await GET(request, {} as never)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      version: 1,
      students: [],
      counts: { active: 0, archived: 0, total: 0 },
    })
  })

  it('does not leak server error details', async () => {
    getPracticePickerV1DataMock.mockRejectedValue(new Error('database-password'))
    const response = await GET(request, {} as never)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch practice students' })
  })
})
