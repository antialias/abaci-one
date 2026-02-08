import { describe, expect, it } from 'vitest'
import {
  extractCompletedProblems,
  getCompletedProblemCount,
  estimateTotalProblems,
} from '../usePartialJsonParser'

// ============================================================================
// extractCompletedProblems
// ============================================================================

describe('extractCompletedProblems', () => {
  it('returns empty array for empty string', () => {
    expect(extractCompletedProblems('')).toEqual([])
  })

  it('returns empty array when no problems array found', () => {
    expect(extractCompletedProblems('{"pageMetadata": {}}')).toEqual([])
  })

  it('returns empty array when problems array is incomplete', () => {
    const partial = '{"problems": [{"problemNumber": 1, "problemBoundingBox":'
    expect(extractCompletedProblems(partial)).toEqual([])
  })

  it('extracts a single completed problem', () => {
    const json = `{"problems": [{"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}}]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toEqual({
      problemNumber: 1,
      problemBoundingBox: { x: 10, y: 20, width: 100, height: 50 },
    })
  })

  it('extracts multiple completed problems', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}},
      {"problemNumber": 2, "problemBoundingBox": {"x": 10, "y": 80, "width": 100, "height": 50}},
      {"problemNumber": 3, "problemBoundingBox": {"x": 10, "y": 140, "width": 100, "height": 50}}
    ]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(3)
    expect(problems[0].problemNumber).toBe(1)
    expect(problems[1].problemNumber).toBe(2)
    expect(problems[2].problemNumber).toBe(3)
  })

  it('extracts completed problems from partial stream with incomplete last object', () => {
    const partial = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}},
      {"problemNumber": 2, "problemBoundingBox": {"x": 10, "y": 80, "width": 100`
    const problems = extractCompletedProblems(partial)
    // Only the first problem is complete
    expect(problems).toHaveLength(1)
    expect(problems[0].problemNumber).toBe(1)
  })

  it('handles objects with extra fields', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "answer": "5+3=8", "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}, "extra": true}
    ]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
    expect(problems[0].problemNumber).toBe(1)
    expect(problems[0].problemBoundingBox).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })

  it('skips objects missing required fields', () => {
    const json = `{"problems": [
      {"problemNumber": 1},
      {"problemNumber": 2, "problemBoundingBox": {"x": 10, "y": 80, "width": 100, "height": 50}}
    ]}`
    const problems = extractCompletedProblems(json)
    // First object missing problemBoundingBox, only second should be returned
    expect(problems).toHaveLength(1)
    expect(problems[0].problemNumber).toBe(2)
  })

  it('skips objects with incomplete bounding box', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20}},
      {"problemNumber": 2, "problemBoundingBox": {"x": 10, "y": 80, "width": 100, "height": 50}}
    ]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
    expect(problems[0].problemNumber).toBe(2)
  })

  it('handles strings containing braces in JSON', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "label": "problem {1}", "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}}
    ]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
    expect(problems[0].problemNumber).toBe(1)
  })

  it('handles escaped quotes in strings', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "label": "say \\"hello\\"", "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}}
    ]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
  })

  it('handles "problems":[ without space', () => {
    const json = `{"problems":[{"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}}]}`
    const problems = extractCompletedProblems(json)
    expect(problems).toHaveLength(1)
  })
})

// ============================================================================
// getCompletedProblemCount
// ============================================================================

describe('getCompletedProblemCount', () => {
  it('returns 0 for empty string', () => {
    expect(getCompletedProblemCount('')).toBe(0)
  })

  it('counts completed problems', () => {
    const json = `{"problems": [
      {"problemNumber": 1, "problemBoundingBox": {"x": 10, "y": 20, "width": 100, "height": 50}},
      {"problemNumber": 2, "problemBoundingBox": {"x": 10, "y": 80, "width": 100, "height": 50}}
    ]}`
    expect(getCompletedProblemCount(json)).toBe(2)
  })
})

// ============================================================================
// estimateTotalProblems
// ============================================================================

describe('estimateTotalProblems', () => {
  it('returns null when no totalProblems found', () => {
    expect(estimateTotalProblems('')).toBeNull()
    expect(estimateTotalProblems('{"problems": []}')).toBeNull()
  })

  it('extracts totalProblems from pageMetadata', () => {
    const json = `{"pageMetadata": {"totalProblems": 24}, "problems": []}`
    expect(estimateTotalProblems(json)).toBe(24)
  })

  it('extracts totalProblems even from partial stream', () => {
    const partial = `{"pageMetadata": {"totalProblems": 12}, "problems": [{"problemNu`
    expect(estimateTotalProblems(partial)).toBe(12)
  })
})
