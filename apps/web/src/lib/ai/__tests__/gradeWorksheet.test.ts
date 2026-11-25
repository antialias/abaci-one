/**
 * @vitest-environment node
 */

import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SINGLE_CARRY_PATH } from '@/app/create/worksheets/progressionPath'

const vision = vi.fn()
const trackedCall = vi.fn()

vi.mock('@/lib/llm', () => ({ llm: { vision: (...a: unknown[]) => vision(...a) } }))
vi.mock('@/lib/ai-usage/llm-middleware', () => ({
  trackedCall: (...a: unknown[]) => trackedCall(...a),
}))

import { gradeWorksheetWithVision } from '../gradeWorksheet'

const graded = {
  problems: [
    {
      index: 0,
      operandA: 12,
      operandB: 9,
      correctAnswer: 21,
      studentAnswer: 21,
      isCorrect: true,
      digitCount: 2,
      requiresRegrouping: true,
    },
  ],
  totalProblems: 1,
  correctCount: 1,
  accuracy: 1,
  errorPatterns: [],
  currentStepEstimate: SINGLE_CARRY_PATH[0].id,
  suggestedStepId: SINGLE_CARRY_PATH[0].id,
  reasoning: 'All correct.',
  feedback: 'Well done.',
}

async function worksheetImage(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'grade-'))
  const path = join(dir, 'sheet.png')
  await writeFile(path, Buffer.from([1, 2, 3]))
  return path
}

describe('gradeWorksheetWithVision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the parsed grading, sending the image as a data URL', async () => {
    vision.mockResolvedValue({ data: graded })

    const result = await gradeWorksheetWithVision(await worksheetImage())

    expect(result).toEqual(graded)
    const req = vision.mock.calls[0][0]
    expect(req.images).toEqual(['data:image/png;base64,AQID'])
    expect(req.reasoningEffort).toBe('high')
    expect(trackedCall).not.toHaveBeenCalled()
  })

  it('records usage when a user is known', async () => {
    trackedCall.mockResolvedValue({ data: graded })

    await gradeWorksheetWithVision(await worksheetImage(), 2, 'user-1')

    expect(trackedCall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ images: ['data:image/png;base64,AQID'] }),
      expect.objectContaining({ userId: 'user-1' })
    )
  })

  it('asks again with feedback when the grading does not add up', async () => {
    vision
      .mockResolvedValueOnce({ data: { ...graded, totalProblems: 3 } })
      .mockResolvedValueOnce({ data: graded })

    const result = await gradeWorksheetWithVision(await worksheetImage())

    expect(result.totalProblems).toBe(1)
    expect(vision).toHaveBeenCalledTimes(2)
    expect(vision.mock.calls[1][0].prompt).toContain('totalProblems')
  })
})
