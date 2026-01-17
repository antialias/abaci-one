import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlowchartCheckpoint } from '../FlowchartCheckpoint'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// Mock react-simple-keyboard
vi.mock('react-simple-keyboard', () => ({
  default: ({ onKeyPress }: { onKeyPress: (key: string) => void }) => (
    <div data-testid="mock-keyboard">
      <button data-testid="key-1" onClick={() => onKeyPress('1')}>
        1
      </button>
      <button data-testid="key-2" onClick={() => onKeyPress('2')}>
        2
      </button>
      <button data-testid="key-3" onClick={() => onKeyPress('3')}>
        3
      </button>
      <button data-testid="key-4" onClick={() => onKeyPress('4')}>
        4
      </button>
      <button data-testid="key-5" onClick={() => onKeyPress('5')}>
        5
      </button>
      <button data-testid="key-0" onClick={() => onKeyPress('0')}>
        0
      </button>
      <button data-testid="key-bksp" onClick={() => onKeyPress('{bksp}')}>
        ⌫
      </button>
    </div>
  ),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

vi.mock('../../../../styled-system/patterns', () => ({
  hstack: vi.fn(() => 'mocked-hstack-class'),
  vstack: vi.fn(() => 'mocked-vstack-class'),
}))

describe('FlowchartCheckpoint', () => {
  const defaultProps = {
    prompt: 'What is 2 + 2?',
    inputType: 'number' as const,
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with data attributes', () => {
      render(<FlowchartCheckpoint {...defaultProps} />)
      const container = screen.getByTestId('checkpoint-container')
      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('data-input-type', 'number')
    })

    it('renders the prompt', () => {
      render(<FlowchartCheckpoint {...defaultProps} prompt="Test prompt" />)
      expect(screen.getByTestId('checkpoint-prompt')).toHaveTextContent('Test prompt')
    })

    it('renders Check button for number input', () => {
      render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)
      expect(screen.getByTestId('checkpoint-check-button')).toBeInTheDocument()
    })

    it('renders Check button for text input', () => {
      render(<FlowchartCheckpoint {...defaultProps} inputType="text" />)
      expect(screen.getByTestId('checkpoint-check-button')).toBeInTheDocument()
    })
  })

  describe('number input type', () => {
    it('renders KidNumberInput for number type', () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)
      expect(container.querySelector('[data-component="kid-number-input"]')).toBeInTheDocument()
    })

    it('shows inline keypad for number input', () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)
      expect(container.querySelector('[data-element="keypad-inline"]')).toBeInTheDocument()
    })

    it('accepts digit input via keypad', async () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)

      // Click on keypad buttons
      fireEvent.click(screen.getAllByTestId('key-4')[0])

      // The value should be shown in the display (not the keypad button)
      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('4')
      })
    })

    it('accepts multiple digits', async () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)

      fireEvent.click(screen.getAllByTestId('key-4')[0])
      fireEvent.click(screen.getAllByTestId('key-2')[0])

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('42')
      })
    })

    it('handles backspace via keypad', async () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)

      fireEvent.click(screen.getAllByTestId('key-4')[0])
      fireEvent.click(screen.getAllByTestId('key-2')[0])

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('42')
      })

      fireEvent.click(screen.getAllByTestId('key-bksp')[0])

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('4')
      })
    })

    it('calls onSubmit with number when Check is clicked', async () => {
      const onSubmit = vi.fn()
      const { container } = render(
        <FlowchartCheckpoint {...defaultProps} inputType="number" onSubmit={onSubmit} />
      )

      fireEvent.click(screen.getAllByTestId('key-4')[0])

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('4')
      })

      fireEvent.click(screen.getByTestId('checkpoint-check-button'))

      expect(onSubmit).toHaveBeenCalledWith(4)
    })

    it('does not submit when value is empty', () => {
      const onSubmit = vi.fn()
      render(<FlowchartCheckpoint {...defaultProps} inputType="number" onSubmit={onSubmit} />)

      fireEvent.click(screen.getByTestId('checkpoint-check-button'))

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('text input type', () => {
    it('renders native text input for text type', () => {
      render(<FlowchartCheckpoint {...defaultProps} inputType="text" />)
      expect(screen.getByTestId('checkpoint-input')).toHaveAttribute('type', 'text')
    })

    it('does not render KidNumberInput for text type', () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="text" />)
      expect(container.querySelector('[data-component="kid-number-input"]')).not.toBeInTheDocument()
    })

    it('accepts text input', async () => {
      const onSubmit = vi.fn()
      render(<FlowchartCheckpoint {...defaultProps} inputType="text" onSubmit={onSubmit} />)

      const input = screen.getByTestId('checkpoint-input')
      fireEvent.change(input, { target: { value: 'hello' } })
      fireEvent.click(screen.getByTestId('checkpoint-check-button'))

      expect(onSubmit).toHaveBeenCalledWith('hello')
    })
  })

  describe('two-numbers input type', () => {
    const twoNumbersProps = {
      ...defaultProps,
      inputType: 'two-numbers' as const,
      inputLabels: ['Numerator', 'Denominator'] as [string, string],
    }

    it('renders two KidNumberInput components', () => {
      const { container } = render(<FlowchartCheckpoint {...twoNumbersProps} />)
      const kidInputs = container.querySelectorAll('[data-component="kid-number-input"]')
      // 2 displays + 1 keypad
      expect(kidInputs.length).toBeGreaterThanOrEqual(2)
    })

    it('renders input labels', () => {
      render(<FlowchartCheckpoint {...twoNumbersProps} />)
      expect(screen.getByText('Numerator')).toBeInTheDocument()
      expect(screen.getByText('Denominator')).toBeInTheDocument()
    })

    it('renders shared keypad', () => {
      const { container } = render(<FlowchartCheckpoint {...twoNumbersProps} />)
      expect(container.querySelector('[data-element="keypad-inline"]')).toBeInTheDocument()
    })

    it('has clickable input wrappers for focus switching', () => {
      render(<FlowchartCheckpoint {...twoNumbersProps} />)
      expect(screen.getByTestId('checkpoint-input-1-wrapper')).toBeInTheDocument()
      expect(screen.getByTestId('checkpoint-input-2-wrapper')).toBeInTheDocument()
    })

    it('shows "and" separator between inputs', () => {
      render(<FlowchartCheckpoint {...twoNumbersProps} />)
      expect(screen.getByText('and')).toBeInTheDocument()
    })
  })

  describe('feedback display', () => {
    it('shows correct feedback', () => {
      render(
        <FlowchartCheckpoint
          {...defaultProps}
          feedback={{ correct: true, expected: 4, userAnswer: 4 }}
        />
      )

      expect(screen.getByTestId('checkpoint-feedback')).toHaveAttribute(
        'data-feedback-correct',
        'true'
      )
      expect(screen.getByText('Correct!')).toBeInTheDocument()
    })

    it('shows incorrect feedback with expected value', () => {
      render(
        <FlowchartCheckpoint
          {...defaultProps}
          feedback={{ correct: false, expected: 4, userAnswer: 5 }}
        />
      )

      const feedback = screen.getByTestId('checkpoint-feedback')
      expect(feedback).toHaveAttribute('data-feedback-correct', 'false')
      expect(feedback).toHaveTextContent('Not quite')
      expect(feedback).toHaveTextContent('5')
      expect(feedback).toHaveTextContent('4')
    })

    it('shows two-numbers feedback with partial correctness', () => {
      render(
        <FlowchartCheckpoint
          {...defaultProps}
          inputType="two-numbers"
          feedback={{
            correct: false,
            expected: [3, 4] as [number, number],
            userAnswer: [3, 5] as [number, number],
          }}
        />
      )

      const feedback = screen.getByTestId('checkpoint-feedback')
      expect(feedback).toBeInTheDocument()
      // First is correct, second is wrong
      expect(screen.getByText(/Second should be 4/)).toBeInTheDocument()
    })
  })

  describe('hint display', () => {
    it('shows hint when provided', () => {
      render(<FlowchartCheckpoint {...defaultProps} hint="Remember to carry the 1" />)

      expect(screen.getByTestId('checkpoint-hint')).toHaveTextContent('Remember to carry the 1')
    })

    it('does not show hint when not provided', () => {
      render(<FlowchartCheckpoint {...defaultProps} />)

      expect(screen.queryByTestId('checkpoint-hint')).not.toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables Check button when disabled', () => {
      render(<FlowchartCheckpoint {...defaultProps} disabled />)

      expect(screen.getByTestId('checkpoint-check-button')).toBeDisabled()
    })

    it('does not accept keypad input when disabled', async () => {
      const { container } = render(
        <FlowchartCheckpoint {...defaultProps} inputType="number" disabled />
      )

      fireEvent.click(screen.getAllByTestId('key-4')[0])

      // Should still show placeholder
      const display = container.querySelector('[data-element="input-display"]')
      expect(display?.textContent).toBe('?')
    })
  })

  describe('keyboard input', () => {
    afterEach(() => {
      // Clean up event listeners
    })

    it('accepts physical keyboard digit input for number type', async () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)

      fireEvent.keyDown(window, { key: '5' })

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('5')
      })
    })

    it('handles physical keyboard backspace', async () => {
      const { container } = render(<FlowchartCheckpoint {...defaultProps} inputType="number" />)

      fireEvent.keyDown(window, { key: '5' })
      fireEvent.keyDown(window, { key: '2' })

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('52')
      })

      fireEvent.keyDown(window, { key: 'Backspace' })

      await waitFor(() => {
        const display = container.querySelector('[data-element="input-display"]')
        expect(display?.textContent).toBe('5')
      })
    })

    it('does not handle keyboard input when disabled', async () => {
      const { container } = render(
        <FlowchartCheckpoint {...defaultProps} inputType="number" disabled />
      )

      fireEvent.keyDown(window, { key: '5' })

      // Should still show placeholder
      const display = container.querySelector('[data-element="input-display"]')
      expect(display?.textContent).toBe('?')
    })

    it('does not handle keyboard input during feedback', async () => {
      const { container } = render(
        <FlowchartCheckpoint
          {...defaultProps}
          inputType="number"
          feedback={{ correct: true, expected: 5, userAnswer: 5 }}
        />
      )

      // Store initial display value
      const initialDisplay = container.querySelector('[data-element="input-display"]')
      const initialValue = initialDisplay?.textContent

      // Keyboard events are ignored during feedback display
      fireEvent.keyDown(window, { key: '5' })

      // The value should not be updated during feedback
      const display = container.querySelector('[data-element="input-display"]')
      expect(display?.textContent).toBe(initialValue)
    })
  })
})
