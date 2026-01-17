import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useKidNumberInput } from '../useKidNumberInput'

describe('useKidNumberInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with empty value', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
        })
      )

      expect(result.current.state.value).toBe('')
    })

    it('starts with null startTime', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
        })
      )

      expect(result.current.state.startTime).toBeNull()
    })

    it('reflects disabled prop', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
          disabled: true,
        })
      )

      expect(result.current.state.disabled).toBe(true)
    })
  })

  describe('addDigit', () => {
    it('adds a digit to the value', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.value).toBe('1')
    })

    it('appends multiple digits', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 123,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
        result.current.actions.addDigit('2')
      })

      expect(result.current.state.value).toBe('12')
    })

    it('does not add digit when disabled', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
          disabled: true,
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.value).toBe('')
    })

    it('ignores non-digit characters', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('a')
        result.current.actions.addDigit('!')
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.value).toBe('1')
    })

    it('respects maxDigits based on correctAnswer length', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5, // 1 digit
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
        result.current.actions.addDigit('2') // Should be ignored
      })

      expect(result.current.state.value).toBe('1')
    })

    it('respects custom maxDigits', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
          maxDigits: 3,
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
        result.current.actions.addDigit('2')
        result.current.actions.addDigit('3')
        result.current.actions.addDigit('4') // Should be ignored
      })

      expect(result.current.state.value).toBe('123')
    })

    it('sets startTime on first digit', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
        })
      )

      expect(result.current.state.startTime).toBeNull()

      act(() => {
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.startTime).not.toBeNull()
    })
  })

  describe('backspace', () => {
    it('removes the last digit', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 123,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
        result.current.actions.addDigit('2')
        result.current.actions.backspace()
      })

      expect(result.current.state.value).toBe('1')
    })

    it('does nothing when value is empty', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.backspace()
      })

      expect(result.current.state.value).toBe('')
    })

    it('does nothing when disabled', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
          disabled: true,
        })
      )

      // Start with some value by enabling then disabling
      const { result: enabledResult } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
          disabled: false,
        })
      )

      act(() => {
        enabledResult.current.actions.addDigit('1')
      })

      // Now test disabled behavior
      act(() => {
        result.current.actions.backspace()
      })

      expect(result.current.state.value).toBe('')
    })
  })

  describe('clear', () => {
    it('clears the value', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 123,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
        result.current.actions.addDigit('2')
        result.current.actions.clear()
      })

      expect(result.current.state.value).toBe('')
    })

    it('resets startTime', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.startTime).not.toBeNull()

      act(() => {
        result.current.actions.clear()
      })

      expect(result.current.state.startTime).toBeNull()
    })
  })

  describe('reset', () => {
    it('clears value and startTime', () => {
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect: vi.fn(),
        })
      )

      act(() => {
        result.current.actions.addDigit('1')
      })

      expect(result.current.state.value).toBe('1')
      expect(result.current.state.startTime).not.toBeNull()

      act(() => {
        result.current.actions.reset()
      })

      expect(result.current.state.value).toBe('')
      expect(result.current.state.startTime).toBeNull()
    })
  })

  describe('validation', () => {
    it('calls onCorrect when correct answer is entered', async () => {
      const onCorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
        })
      )

      act(() => {
        result.current.actions.addDigit('5')
      })

      // Wait for setTimeout in validateAndSubmit
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(onCorrect).toHaveBeenCalledWith(5, expect.any(Number))
    })

    it('calls onIncorrect when wrong answer is entered', async () => {
      const onCorrect = vi.fn()
      const onIncorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
          onIncorrect,
        })
      )

      act(() => {
        result.current.actions.addDigit('3')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(onIncorrect).toHaveBeenCalledWith(3, 5, expect.any(Number))
      expect(onCorrect).not.toHaveBeenCalled()
    })

    it('clears value after correct answer by default', async () => {
      const onCorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
        })
      )

      act(() => {
        result.current.actions.addDigit('5')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.value).toBe('')
    })

    it('keeps value after correct when clearOnCorrect is false', async () => {
      const onCorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
          clearOnCorrect: false,
        })
      )

      act(() => {
        result.current.actions.addDigit('5')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.value).toBe('5')
    })

    it('clears value after incorrect answer by default', async () => {
      const onCorrect = vi.fn()
      const onIncorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
          onIncorrect,
        })
      )

      act(() => {
        result.current.actions.addDigit('3')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.value).toBe('')
    })

    it('keeps value after incorrect when clearOnIncorrect is false', async () => {
      const onCorrect = vi.fn()
      const onIncorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 5,
          onCorrect,
          onIncorrect,
          clearOnIncorrect: false,
        })
      )

      act(() => {
        result.current.actions.addDigit('3')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.value).toBe('3')
    })

    it('validates multi-digit answers', async () => {
      const onCorrect = vi.fn()
      const { result } = renderHook(() =>
        useKidNumberInput({
          correctAnswer: 42,
          onCorrect,
        })
      )

      act(() => {
        result.current.actions.addDigit('4')
        result.current.actions.addDigit('2')
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(onCorrect).toHaveBeenCalledWith(42, expect.any(Number))
    })
  })

  describe('correctAnswer changes', () => {
    it('resets when correctAnswer changes', () => {
      const { result, rerender } = renderHook(
        ({ correctAnswer }) =>
          useKidNumberInput({
            correctAnswer,
            onCorrect: vi.fn(),
          }),
        { initialProps: { correctAnswer: 5 } }
      )

      act(() => {
        result.current.actions.addDigit('3')
      })

      expect(result.current.state.value).toBe('3')

      // Change correctAnswer (new question)
      rerender({ correctAnswer: 10 })

      expect(result.current.state.value).toBe('')
    })
  })
})
