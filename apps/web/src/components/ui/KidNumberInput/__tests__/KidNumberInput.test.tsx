import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KidNumberInput } from '../KidNumberInput'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// Mock react-simple-keyboard
vi.mock('react-simple-keyboard', () => ({
  default: ({ onKeyPress, layout }: { onKeyPress: (key: string) => void; layout: any }) => (
    <div data-testid="mock-keyboard">
      {/* Render clickable buttons for testing */}
      <button data-testid="key-1" onClick={() => onKeyPress('1')}>
        1
      </button>
      <button data-testid="key-2" onClick={() => onKeyPress('2')}>
        2
      </button>
      <button data-testid="key-3" onClick={() => onKeyPress('3')}>
        3
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
vi.mock('../../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

describe('KidNumberInput', () => {
  const defaultProps = {
    value: '',
    onDigit: vi.fn(),
    onBackspace: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the component with data attribute', () => {
      const { container } = render(<KidNumberInput {...defaultProps} />)
      expect(container.querySelector('[data-component="kid-number-input"]')).toBeInTheDocument()
    })

    it('renders display area with placeholder when value is empty', () => {
      render(<KidNumberInput {...defaultProps} value="" placeholder="?" />)
      const display = screen.getByText('?')
      expect(display).toBeInTheDocument()
    })

    it('renders display area with value when provided', () => {
      render(<KidNumberInput {...defaultProps} value="42" />)
      const display = screen.getByText('42')
      expect(display).toBeInTheDocument()
    })

    it('renders keypad when showKeypad is true (default)', () => {
      render(<KidNumberInput {...defaultProps} />)
      // Fixed mode renders both portrait and landscape keyboards
      const keyboards = screen.getAllByTestId('mock-keyboard')
      expect(keyboards.length).toBeGreaterThanOrEqual(1)
    })

    it('does not render keypad when showKeypad is false', () => {
      render(<KidNumberInput {...defaultProps} showKeypad={false} />)
      expect(screen.queryByTestId('mock-keyboard')).not.toBeInTheDocument()
    })
  })

  describe('feedback states', () => {
    it('has feedback="none" data attribute by default', () => {
      const { container } = render(<KidNumberInput {...defaultProps} />)
      expect(container.querySelector('[data-feedback="none"]')).toBeInTheDocument()
    })

    it('has feedback="correct" data attribute when correct', () => {
      const { container } = render(<KidNumberInput {...defaultProps} feedback="correct" />)
      expect(container.querySelector('[data-feedback="correct"]')).toBeInTheDocument()
    })

    it('has feedback="incorrect" data attribute when incorrect', () => {
      const { container } = render(<KidNumberInput {...defaultProps} feedback="incorrect" />)
      expect(container.querySelector('[data-feedback="incorrect"]')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('has disabled=false data attribute by default', () => {
      const { container } = render(<KidNumberInput {...defaultProps} />)
      expect(container.querySelector('[data-disabled="false"]')).toBeInTheDocument()
    })

    it('has disabled=true data attribute when disabled', () => {
      const { container } = render(<KidNumberInput {...defaultProps} disabled />)
      expect(container.querySelector('[data-disabled="true"]')).toBeInTheDocument()
    })

    it('does not call onDigit when disabled and key is pressed', () => {
      const onDigit = vi.fn()
      render(<KidNumberInput {...defaultProps} onDigit={onDigit} disabled />)

      // Use first keyboard found (fixed mode has multiple)
      fireEvent.click(screen.getAllByTestId('key-1')[0])
      expect(onDigit).not.toHaveBeenCalled()
    })

    it('does not call onBackspace when disabled and backspace is pressed', () => {
      const onBackspace = vi.fn()
      render(<KidNumberInput {...defaultProps} onBackspace={onBackspace} disabled />)

      // Use first keyboard found
      fireEvent.click(screen.getAllByTestId('key-bksp')[0])
      expect(onBackspace).not.toHaveBeenCalled()
    })
  })

  describe('keypad interaction', () => {
    it('calls onDigit when a number key is pressed', () => {
      const onDigit = vi.fn()
      render(<KidNumberInput {...defaultProps} onDigit={onDigit} />)

      // Use first keyboard found (fixed mode has multiple)
      fireEvent.click(screen.getAllByTestId('key-1')[0])
      expect(onDigit).toHaveBeenCalledWith('1')

      fireEvent.click(screen.getAllByTestId('key-2')[0])
      expect(onDigit).toHaveBeenCalledWith('2')
    })

    it('calls onBackspace when backspace key is pressed', () => {
      const onBackspace = vi.fn()
      render(<KidNumberInput {...defaultProps} onBackspace={onBackspace} />)

      // Use first keyboard found
      fireEvent.click(screen.getAllByTestId('key-bksp')[0])
      expect(onBackspace).toHaveBeenCalled()
    })
  })

  describe('display sizes', () => {
    it('renders with default size xl', () => {
      render(<KidNumberInput {...defaultProps} />)
      // Size is handled by CSS, just verify it renders
      const display = screen.getByText('?')
      expect(display).toBeInTheDocument()
    })

    it('renders with size sm', () => {
      render(<KidNumberInput {...defaultProps} displaySize="sm" />)
      const display = screen.getByText('?')
      expect(display).toBeInTheDocument()
    })

    it('renders with size md', () => {
      render(<KidNumberInput {...defaultProps} displaySize="md" />)
      const display = screen.getByText('?')
      expect(display).toBeInTheDocument()
    })

    it('renders with size lg', () => {
      render(<KidNumberInput {...defaultProps} displaySize="lg" />)
      const display = screen.getByText('?')
      expect(display).toBeInTheDocument()
    })
  })

  describe('keypad modes', () => {
    it('renders fixed keypad by default', () => {
      const { container } = render(<KidNumberInput {...defaultProps} keypadMode="fixed" />)
      // Fixed mode renders portrait and landscape containers
      expect(container.querySelector('[data-element="keypad-portrait"]')).toBeInTheDocument()
      expect(container.querySelector('[data-element="keypad-landscape"]')).toBeInTheDocument()
    })

    it('renders inline keypad when mode is inline', () => {
      const { container } = render(<KidNumberInput {...defaultProps} keypadMode="inline" />)
      expect(container.querySelector('[data-element="keypad-inline"]')).toBeInTheDocument()
      expect(container.querySelector('[data-element="keypad-portrait"]')).not.toBeInTheDocument()
    })
  })
})
