/**
 * StudioSelect — smoke cover for the studio's <select>. The rails' own suite
 * (create/abacus/__tests__/studio-rails.test.tsx) drives it in anger; what is
 * pinned here is the house rule the control exists to keep: an option the
 * current geometry can't seat stays VISIBLE and disabled, with the reason in its
 * own label, because hiding it would say "we don't support that" when the true
 * statement is "not at these settings".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudioSelect } from '../StudioSelect'

describe('StudioSelect', () => {
  it('labels the control and reports the chosen value', () => {
    const onChange = vi.fn()
    render(
      <StudioSelect label="Palette" value="warm" options={['warm', 'cool']} onChange={onChange} />
    )
    const select = screen.getByLabelText('Palette')
    fireEvent.change(select, { target: { value: 'cool' } })
    expect(onChange).toHaveBeenCalledWith('cool')
  })

  it('keeps an unseatable option visible and disabled', () => {
    render(
      <StudioSelect
        label="Feet"
        value="none"
        options={[
          { value: 'none', label: 'None' },
          { value: 'bumper', label: '1/2" bumper — needs a wider brim', disabled: true },
        ]}
        onChange={vi.fn()}
      />
    )
    const option = screen.getByRole('option', {
      name: '1/2" bumper — needs a wider brim',
    }) as HTMLOptionElement
    expect(option).toBeInTheDocument()
    expect(option.disabled).toBe(true)
  })
})
