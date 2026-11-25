import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SongFailureCard } from '../SongFailureCard'

describe('SongFailureCard', () => {
  it('offers to make the song once songs work again', () => {
    const onRetry = vi.fn()
    render(
      <SongFailureCard
        failureKind="rate_limited"
        errorDetail={null}
        viewerIsOwner={false}
        canRetry
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Songs are working again!')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /make my song now/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows no button while the cause has not cleared', () => {
    render(
      <SongFailureCard
        failureKind="rate_limited"
        errorDetail={null}
        viewerIsOwner={false}
        canRetry={false}
        onRetry={() => {}}
      />
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says why a tap did not start the song', () => {
    render(
      <SongFailureCard
        failureKind="transient"
        errorDetail={null}
        viewerIsOwner={false}
        canRetry
        onRetry={() => {}}
        retryError="Songs are not working yet; try again later"
      />
    )

    expect(screen.getByText('Songs are not working yet; try again later')).toBeTruthy()
  })
})
