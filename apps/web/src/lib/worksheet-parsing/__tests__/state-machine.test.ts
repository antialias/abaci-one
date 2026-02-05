import { describe, expect, it } from 'vitest'
import {
  parsingReducer,
  initialParsingState,
  isParsingAttachment,
  isAnyParsingActive,
  getStreamingStatus,
  getStreamingState,
  getActiveParsingCount,
  type ParsingAction,
} from '../state-machine'
import type { WorksheetParsingResult } from '../schemas'

const TEST_ATTACHMENT_ID = 'attachment-1'
const TEST_ATTACHMENT_ID_2 = 'attachment-2'

describe('parsingReducer', () => {
  describe('START_STREAMING', () => {
    it('should initialize streaming state for initial parse', () => {
      const action: ParsingAction = {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      }

      const result = parsingReducer(initialParsingState, action)
      const stream = result.activeStreams.get(TEST_ATTACHMENT_ID)

      expect(stream).not.toBeNull()
      expect(stream?.status).toBe('connecting')
      expect(stream?.streamType).toBe('initial')
      expect(stream?.reasoningText).toBe('')
      expect(stream?.outputText).toBe('')
      expect(stream?.completedProblems).toEqual([])
      expect(stream?.completedIndices).toBeUndefined()
      // Previous error should be cleared
      expect(result.lastErrors.has(TEST_ATTACHMENT_ID)).toBe(false)
    })

    it('should initialize streaming state for reparse with totalProblems', () => {
      const action: ParsingAction = {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'reparse',
        totalProblems: 5,
      }

      const result = parsingReducer(initialParsingState, action)
      const stream = result.activeStreams.get(TEST_ATTACHMENT_ID)

      expect(stream?.streamType).toBe('reparse')
      expect(stream?.totalProblems).toBe(5)
      expect(stream?.currentProblemIndex).toBe(0)
      expect(stream?.completedIndices).toEqual([])
    })

    it('should support multiple concurrent streams', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID_2,
        streamType: 'initial',
      })

      expect(state.activeStreams.size).toBe(2)
      expect(state.activeStreams.has(TEST_ATTACHMENT_ID)).toBe(true)
      expect(state.activeStreams.has(TEST_ATTACHMENT_ID_2)).toBe(true)
    })
  })

  describe('STREAM_REASONING', () => {
    it('should set status to reasoning for initial parse', () => {
      const startedState = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      const action: ParsingAction = {
        type: 'STREAM_REASONING',
        attachmentId: TEST_ATTACHMENT_ID,
        text: 'Analyzing the worksheet...',
        append: false,
      }

      const result = parsingReducer(startedState, action)
      const stream = result.activeStreams.get(TEST_ATTACHMENT_ID)

      expect(stream?.status).toBe('reasoning')
      expect(stream?.reasoningText).toBe('Analyzing the worksheet...')
      expect(stream?.progressMessage).toBe('AI is thinking...')
    })

    it('should append text when append is true', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'STREAM_REASONING',
        attachmentId: TEST_ATTACHMENT_ID,
        text: 'First part. ',
        append: false,
      })

      state = parsingReducer(state, {
        type: 'STREAM_REASONING',
        attachmentId: TEST_ATTACHMENT_ID,
        text: 'Second part.',
        append: true,
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.reasoningText).toBe('First part. Second part.')
    })

    it('should preserve status for reparse (not change to reasoning)', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'reparse',
        totalProblems: 3,
      })

      // Simulate problem_start which sets status to processing
      state = parsingReducer(state, {
        type: 'STREAM_REPARSE_PROGRESS',
        attachmentId: TEST_ATTACHMENT_ID,
        current: 0,
        total: 3,
      })

      expect(state.activeStreams.get(TEST_ATTACHMENT_ID)?.status).toBe('processing')

      // Now send reasoning - status should stay as processing for reparse
      state = parsingReducer(state, {
        type: 'STREAM_REASONING',
        attachmentId: TEST_ATTACHMENT_ID,
        text: 'Analyzing problem...',
        append: false,
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.status).toBe('processing')
      expect(stream?.reasoningText).toBe('Analyzing problem...')
    })

    it('should not modify state if attachment not streaming', () => {
      const action: ParsingAction = {
        type: 'STREAM_REASONING',
        attachmentId: 'non-existent',
        text: 'test',
        append: false,
      }

      const result = parsingReducer(initialParsingState, action)
      // activeStreams should still be unchanged (empty)
      expect(result.activeStreams.size).toBe(0)
      expect(result.activeStreams.has('non-existent')).toBe(false)
    })
  })

  describe('STREAM_OUTPUT', () => {
    it('should accumulate output text and set status to generating', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'STREAM_OUTPUT',
        attachmentId: TEST_ATTACHMENT_ID,
        text: '{"problems": [',
      })

      let stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.status).toBe('generating')
      expect(stream?.outputText).toBe('{"problems": [')

      state = parsingReducer(state, {
        type: 'STREAM_OUTPUT',
        attachmentId: TEST_ATTACHMENT_ID,
        text: '{"problemNumber": 1}',
      })

      stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.outputText).toBe('{"problems": [{"problemNumber": 1}')
    })
  })

  describe('STREAM_PROBLEM_COMPLETE', () => {
    it('should add completed problem to array', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      const problem = {
        problemNumber: 1,
        problemBoundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      }

      state = parsingReducer(state, {
        type: 'STREAM_PROBLEM_COMPLETE',
        attachmentId: TEST_ATTACHMENT_ID,
        problem,
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.completedProblems).toHaveLength(1)
      expect(stream?.completedProblems[0]).toEqual(problem)
    })

    it('should add to completedIndices for reparse', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'reparse',
        totalProblems: 3,
      })

      const problem = {
        problemNumber: 5,
        problemBoundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      }

      state = parsingReducer(state, {
        type: 'STREAM_PROBLEM_COMPLETE',
        attachmentId: TEST_ATTACHMENT_ID,
        problem,
        problemIndex: 2,
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.completedIndices).toContain(2)
    })
  })

  describe('STREAM_REPARSE_PROGRESS', () => {
    it('should update progress for reparse and set status to processing', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'reparse',
        totalProblems: 5,
      })

      state = parsingReducer(state, {
        type: 'STREAM_REPARSE_PROGRESS',
        attachmentId: TEST_ATTACHMENT_ID,
        current: 2,
        total: 5,
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.status).toBe('processing')
      expect(stream?.currentProblemIndex).toBe(2)
      expect(stream?.totalProblems).toBe(5)
      expect(stream?.progressMessage).toBe('Analyzing problem 3 of 5...')
    })
  })

  describe('STREAM_PROGRESS_MESSAGE', () => {
    it('should update progress message', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'STREAM_PROGRESS_MESSAGE',
        attachmentId: TEST_ATTACHMENT_ID,
        message: 'Custom progress message',
      })

      const stream = state.activeStreams.get(TEST_ATTACHMENT_ID)
      expect(stream?.progressMessage).toBe('Custom progress message')
    })
  })

  describe('PARSE_COMPLETE', () => {
    it('should remove from active streams and store result', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      // Use a minimal mock result - the reducer only stores it, doesn't validate
      const result = {
        problems: [{ problemNumber: 1, terms: [1, 2], correctAnswer: 3 }],
        pageMetadata: {
          lessonId: null,
          weekId: null,
          detectedFormat: 'vertical' as const,
        },
        overallConfidence: 0.95,
        warnings: [],
        needsReview: false,
      } as unknown as WorksheetParsingResult

      state = parsingReducer(state, {
        type: 'PARSE_COMPLETE',
        attachmentId: TEST_ATTACHMENT_ID,
        result,
        stats: {
          totalProblems: 1,
          correctCount: 1,
          incorrectCount: 0,
          unansweredCount: 0,
          accuracy: 1,
          skillsDetected: [],
        },
      })

      // Stream should be removed from activeStreams
      expect(state.activeStreams.has(TEST_ATTACHMENT_ID)).toBe(false)
      // Result should be stored in lastResults
      expect(state.lastResults.get(TEST_ATTACHMENT_ID)).toEqual(result)
      // Stats should be stored in lastStats
      expect(state.lastStats.get(TEST_ATTACHMENT_ID)?.totalProblems).toBe(1)
    })
  })

  describe('PARSE_FAILED', () => {
    it('should remove from active streams and store error', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'PARSE_FAILED',
        attachmentId: TEST_ATTACHMENT_ID,
        error: 'Network error occurred',
      })

      // Stream should be removed from activeStreams
      expect(state.activeStreams.has(TEST_ATTACHMENT_ID)).toBe(false)
      // Error should be stored in lastErrors
      expect(state.lastErrors.get(TEST_ATTACHMENT_ID)).toBe('Network error occurred')
    })
  })

  describe('CANCEL', () => {
    it('should remove specific stream from active streams', () => {
      // Start two streams
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })
      state = parsingReducer(state, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID_2,
        streamType: 'initial',
      })

      expect(state.activeStreams.size).toBe(2)

      // Cancel only the first one
      state = parsingReducer(state, {
        type: 'CANCEL',
        attachmentId: TEST_ATTACHMENT_ID,
      })

      expect(state.activeStreams.has(TEST_ATTACHMENT_ID)).toBe(false)
      expect(state.activeStreams.has(TEST_ATTACHMENT_ID_2)).toBe(true)
    })
  })

  describe('CANCEL_ALL', () => {
    it('should clear all active streams', () => {
      // Start two streams
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })
      state = parsingReducer(state, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID_2,
        streamType: 'initial',
      })

      expect(state.activeStreams.size).toBe(2)

      state = parsingReducer(state, { type: 'CANCEL_ALL' })

      expect(state.activeStreams.size).toBe(0)
    })
  })

  describe('RESET', () => {
    it('should reset to initial state', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      state = parsingReducer(state, {
        type: 'PARSE_FAILED',
        attachmentId: TEST_ATTACHMENT_ID,
        error: 'Some error',
      })

      state = parsingReducer(state, { type: 'RESET' })

      // Maps are not strictly equal but should have same contents
      expect(state.activeStreams.size).toBe(0)
      expect(state.lastResults.size).toBe(0)
      expect(state.lastStats.size).toBe(0)
      expect(state.lastErrors.size).toBe(0)
    })
  })
})

describe('helper functions', () => {
  describe('isParsingAttachment', () => {
    it('should return true when attachment is actively being parsed', () => {
      const state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      expect(isParsingAttachment(state, TEST_ATTACHMENT_ID)).toBe(true)
      expect(isParsingAttachment(state, TEST_ATTACHMENT_ID_2)).toBe(false)
    })

    it('should return false when not streaming', () => {
      expect(isParsingAttachment(initialParsingState, TEST_ATTACHMENT_ID)).toBe(false)
    })
  })

  describe('isAnyParsingActive', () => {
    it('should return true when streaming', () => {
      const state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      expect(isAnyParsingActive(state)).toBe(true)
    })

    it('should return false when not streaming', () => {
      expect(isAnyParsingActive(initialParsingState)).toBe(false)
    })
  })

  describe('getStreamingStatus', () => {
    it('should return current streaming status for matching attachment', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      expect(getStreamingStatus(state, TEST_ATTACHMENT_ID)).toBe('connecting')

      state = parsingReducer(state, {
        type: 'STREAM_REASONING',
        attachmentId: TEST_ATTACHMENT_ID,
        text: 'test',
        append: false,
      })

      expect(getStreamingStatus(state, TEST_ATTACHMENT_ID)).toBe('reasoning')
    })

    it('should return null for non-matching attachment', () => {
      const state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      expect(getStreamingStatus(state, TEST_ATTACHMENT_ID_2)).toBeNull()
    })

    it('should return null when not streaming', () => {
      expect(getStreamingStatus(initialParsingState, TEST_ATTACHMENT_ID)).toBeNull()
    })
  })

  describe('getStreamingState', () => {
    it('should return full streaming state for attachment', () => {
      const state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      const streamState = getStreamingState(state, TEST_ATTACHMENT_ID)
      expect(streamState).not.toBeNull()
      expect(streamState?.status).toBe('connecting')
      expect(streamState?.streamType).toBe('initial')
    })

    it('should return null for non-existent attachment', () => {
      expect(getStreamingState(initialParsingState, 'non-existent')).toBeNull()
    })
  })

  describe('getActiveParsingCount', () => {
    it('should return count of active parsing operations', () => {
      let state = parsingReducer(initialParsingState, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID,
        streamType: 'initial',
      })

      expect(getActiveParsingCount(state)).toBe(1)

      state = parsingReducer(state, {
        type: 'START_STREAMING',
        attachmentId: TEST_ATTACHMENT_ID_2,
        streamType: 'initial',
      })

      expect(getActiveParsingCount(state)).toBe(2)
    })

    it('should return 0 when no parsing active', () => {
      expect(getActiveParsingCount(initialParsingState)).toBe(0)
    })
  })
})
