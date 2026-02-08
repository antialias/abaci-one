import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useShareCode } from '../useShareCode'

// ============================================================================
// Mock clipboard
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ============================================================================
// Tests
// ============================================================================

describe('useShareCode', () => {
  it('returns code and share URL', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    expect(result.current.code).toBe('ABC123')
    // URL should contain the code and use the join path
    expect(result.current.shareUrl).toContain('/join/classroom/ABC123')
  })

  it('generates correct URL for family type', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'family',
        code: 'FAM456',
      })
    )

    expect(result.current.shareUrl).toContain('/join/family/FAM456')
  })

  it('generates correct URL for room type', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'room',
        code: 'ROOM789',
      })
    )

    expect(result.current.shareUrl).toContain('/arcade/join/ROOM789')
  })

  it('generates correct URL for observe type', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'observe',
        code: 'OBS101',
      })
    )

    expect(result.current.shareUrl).toContain('/observe/OBS101')
  })

  it('initializes with codeCopied=false and linkCopied=false', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    expect(result.current.codeCopied).toBe(false)
    expect(result.current.linkCopied).toBe(false)
  })

  it('copies code to clipboard', async () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    await act(async () => {
      result.current.copyCode()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABC123')
    expect(result.current.codeCopied).toBe(true)
  })

  it('copies link to clipboard', async () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    await act(async () => {
      result.current.copyLink()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/join/classroom/ABC123')
    )
    expect(result.current.linkCopied).toBe(true)
  })

  it('resets link copied state when copying code', async () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    // Copy link first
    await act(async () => {
      result.current.copyLink()
    })
    expect(result.current.linkCopied).toBe(true)

    // Copy code should reset link copied
    await act(async () => {
      result.current.copyCode()
    })
    expect(result.current.codeCopied).toBe(true)
    expect(result.current.linkCopied).toBe(false)
  })

  it('resets code copied state when copying link', async () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    // Copy code first
    await act(async () => {
      result.current.copyCode()
    })
    expect(result.current.codeCopied).toBe(true)

    // Copy link should reset code copied
    await act(async () => {
      result.current.copyLink()
    })
    expect(result.current.linkCopied).toBe(true)
    expect(result.current.codeCopied).toBe(false)
  })

  it('returns undefined regenerate when no onRegenerate provided', () => {
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
      })
    )

    expect(result.current.regenerate).toBeUndefined()
    expect(result.current.isRegenerating).toBe(false)
  })

  it('provides regenerate function when onRegenerate is provided', () => {
    const onRegenerate = vi.fn().mockResolvedValue('NEW123')
    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
        onRegenerate,
      })
    )

    expect(result.current.regenerate).toBeDefined()
    expect(typeof result.current.regenerate).toBe('function')
  })

  it('calls onRegenerate and manages isRegenerating state', async () => {
    let resolveRegenerate: (value: string) => void
    const onRegenerate = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => { resolveRegenerate = resolve })
    )

    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
        onRegenerate,
      })
    )

    expect(result.current.isRegenerating).toBe(false)

    let regeneratePromise: Promise<void>
    act(() => {
      regeneratePromise = result.current.regenerate!()
    })

    expect(result.current.isRegenerating).toBe(true)

    await act(async () => {
      resolveRegenerate!('NEW123')
      await regeneratePromise!
    })

    expect(result.current.isRegenerating).toBe(false)
    expect(onRegenerate).toHaveBeenCalledOnce()
  })

  it('resets isRegenerating even when onRegenerate throws', async () => {
    const onRegenerate = vi.fn().mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() =>
      useShareCode({
        type: 'classroom',
        code: 'ABC123',
        onRegenerate,
      })
    )

    await act(async () => {
      try {
        await result.current.regenerate!()
      } catch {
        // expected
      }
    })

    expect(result.current.isRegenerating).toBe(false)
  })
})
