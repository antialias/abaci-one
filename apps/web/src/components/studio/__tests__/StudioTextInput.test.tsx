/**
 * StudioTextInput — smoke cover for the studio's text field. The disabled case
 * is the one worth pinning: the field stays on screen with `disabledReason`
 * standing in for the value, so an engraving slot held by a teaching aid reads
 * as "showing Friends of 10" (which names what to move) rather than vanishing,
 * which would read as "you can't write here at all".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudioTextInput } from '../StudioTextInput'

describe('StudioTextInput', () => {
  it('labels the field and reports what is typed', () => {
    const onChange = vi.fn()
    render(<StudioTextInput label="Top left" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Top left'), { target: { value: 'Mia' } })
    expect(onChange).toHaveBeenCalledWith('Mia')
  })

  it('shows the reason in place of the value while disabled', () => {
    render(
      <StudioTextInput
        label="Top left"
        value="Mia"
        onChange={vi.fn()}
        disabled
        disabledReason="showing Friends of 10"
      />
    )
    const input = screen.getByLabelText('Top left') as HTMLInputElement
    expect(input).toBeDisabled()
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('showing Friends of 10')
    expect(input.closest('[data-element="studio-text-input"]')).toHaveAttribute(
      'data-disabled',
      'true'
    )
  })
})
