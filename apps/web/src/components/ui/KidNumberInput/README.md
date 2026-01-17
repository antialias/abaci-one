# KidNumberInput

A kid-friendly number input component with touch-friendly on-screen keypad and auto-validation support.

## Overview

This component provides a consistent, accessible number input experience designed for children. It features large touch targets, visual feedback for correct/incorrect answers, and works seamlessly with both on-screen keypad and physical keyboard input.

## Components

### `KidNumberInput`

The main UI component that renders a number display and optional on-screen keypad.

```tsx
import { KidNumberInput } from '@/components/ui/KidNumberInput'

<KidNumberInput
  value={inputValue}
  onDigit={(digit) => setInputValue(prev => prev + digit)}
  onBackspace={() => setInputValue(prev => prev.slice(0, -1))}
  feedback="none"
  showKeypad={true}
  keypadMode="inline"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Current input value |
| `onDigit` | `(digit: string) => void` | required | Called when a digit (0-9) is pressed |
| `onBackspace` | `() => void` | required | Called when backspace is pressed |
| `disabled` | `boolean` | `false` | Whether input is disabled |
| `placeholder` | `string` | `"?"` | Text shown when value is empty |
| `feedback` | `FeedbackState` | `"none"` | Visual feedback state |
| `showKeypad` | `boolean` | `true` | Whether to show the on-screen keypad |
| `keypadMode` | `"fixed" \| "inline"` | `"fixed"` | Keypad positioning mode |
| `displaySize` | `"sm" \| "md" \| "lg" \| "xl"` | `"xl"` | Size of the number display |

#### Feedback States

- `"none"` - Default blue gradient background
- `"correct"` - Green background with pulse animation
- `"incorrect"` - Red background with shake animation

#### Keypad Modes

- `"fixed"` - Keypad attaches to screen edges (bottom in portrait, right side in landscape). Best for full-screen game experiences.
- `"inline"` - Keypad renders in place as a 3x4 grid. Best for forms or when you need multiple inputs on screen.

### `useKidNumberInput`

A hook that manages input state with automatic validation. Use this when you want the input to auto-validate when the user has entered enough digits.

```tsx
import { useKidNumberInput } from '@/components/ui/KidNumberInput'

const { state, actions } = useKidNumberInput({
  correctAnswer: 42,
  onCorrect: (answer, responseTimeMs) => {
    console.log(`Correct! Answered in ${responseTimeMs}ms`)
  },
  onIncorrect: (answer, correctAnswer, responseTimeMs) => {
    console.log(`Wrong: ${answer} !== ${correctAnswer}`)
  },
})

// Use with KidNumberInput
<KidNumberInput
  value={state.value}
  onDigit={actions.addDigit}
  onBackspace={actions.backspace}
  feedback={feedback}
/>
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `correctAnswer` | `number` | required | The correct answer to validate against |
| `onCorrect` | `(answer, responseTimeMs) => void` | required | Called when correct answer is entered |
| `onIncorrect` | `(answer, correctAnswer, responseTimeMs) => void` | optional | Called when incorrect answer is entered |
| `disabled` | `boolean` | `false` | Whether input is disabled |
| `useGlobalKeyboard` | `boolean` | `true` | Listen for keyboard events globally |
| `maxDigits` | `number` | auto | Max digits allowed (defaults to correctAnswer's digit count) |
| `clearOnCorrect` | `boolean` | `true` | Clear input after correct answer |
| `clearOnIncorrect` | `boolean` | `true` | Clear input after incorrect answer |

#### Returned State

```typescript
interface KidNumberInputState {
  value: string           // Current input value
  disabled: boolean       // Whether input is disabled
  startTime: number | null // When first digit was entered (for response timing)
}
```

#### Returned Actions

```typescript
interface KidNumberInputActions {
  addDigit: (digit: string) => void  // Add a digit (0-9)
  backspace: () => void              // Remove last digit
  clear: () => void                  // Clear all input
  reset: () => void                  // Reset for new question
}
```

## Usage Patterns

### Pattern 1: Game Mode (auto-clear)

For games where you want rapid-fire questions, the input clears automatically after each answer:

```tsx
function GameMode() {
  const [feedback, setFeedback] = useState<FeedbackState>('none')
  const [question, setQuestion] = useState({ a: 3, b: 4 })

  const { state, actions } = useKidNumberInput({
    correctAnswer: question.a + question.b,
    clearOnCorrect: true,  // Auto-clear (default)
    onCorrect: () => {
      setFeedback('correct')
      setTimeout(() => {
        setFeedback('none')
        setQuestion(generateNewQuestion())
      }, 500)
    },
    onIncorrect: () => {
      setFeedback('incorrect')
      setTimeout(() => setFeedback('none'), 300)
    },
  })

  return (
    <div>
      <h2>{question.a} + {question.b} = ?</h2>
      <KidNumberInput
        value={state.value}
        onDigit={actions.addDigit}
        onBackspace={actions.backspace}
        feedback={feedback}
        keypadMode="inline"
      />
    </div>
  )
}
```

### Pattern 2: Form Mode (persist answer)

For forms or flowchart checkpoints where you want the answer to stay visible:

```tsx
function FormMode() {
  const [feedback, setFeedback] = useState<FeedbackState>('none')
  const [isComplete, setIsComplete] = useState(false)

  const { state, actions } = useKidNumberInput({
    correctAnswer: 42,
    clearOnCorrect: false,  // Keep answer visible!
    onCorrect: () => {
      setFeedback('correct')
      setIsComplete(true)
    },
    onIncorrect: () => {
      setFeedback('incorrect')
      setTimeout(() => setFeedback('none'), 400)
    },
  })

  return (
    <div>
      <h2>What is 6 × 7?</h2>
      <KidNumberInput
        value={state.value}
        onDigit={actions.addDigit}
        onBackspace={actions.backspace}
        feedback={feedback}
        disabled={isComplete}
        showKeypad={!isComplete}
        keypadMode="inline"
      />
      {isComplete && <button onClick={onContinue}>Continue →</button>}
    </div>
  )
}
```

### Pattern 3: Multiple Inputs with Focus Management

For forms with multiple number inputs (like fractions):

```tsx
function MultiplInputs() {
  const [focusedInput, setFocusedInput] = useState<0 | 1>(0)
  const [values, setValues] = useState(['', ''])
  const [feedbacks, setFeedbacks] = useState<[FeedbackState, FeedbackState]>(['none', 'none'])

  const correctAnswers = [3, 6] // For 1/2 = 3/6

  const handleDigit = useCallback((digit: string) => {
    // Add digit to focused input, validate, auto-advance on correct
    // ... (see stories for full implementation)
  }, [focusedInput, values])

  const handleBackspace = useCallback(() => {
    // Remove digit from focused input
  }, [focusedInput, values])

  // Global keyboard listener routes to focused input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDigit, handleBackspace])

  return (
    <div>
      {/* Custom display for each input */}
      <div onClick={() => setFocusedInput(0)}>
        Numerator: {values[0] || '?'}
      </div>
      <div onClick={() => setFocusedInput(1)}>
        Denominator: {values[1] || '?'}
      </div>

      {/* Single shared keypad */}
      <KidNumberInput
        value=""
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        showKeypad={true}
        keypadMode="inline"
      />
    </div>
  )
}
```

## Keyboard Support

When `useGlobalKeyboard` is `true` (default), the hook listens for:
- **0-9**: Adds the digit to input
- **Backspace**: Removes the last digit

For multiple inputs, disable `useGlobalKeyboard` on the hook and manage keyboard events yourself (see Pattern 3).

## Styling

The component uses:
- **Panda CSS** for layout via the `css()` function
- **CSS custom properties** for keypad theming (supports light/dark mode)
- **CSS animations** defined in `KidNumberInput.css`

### Theme Variables

The keypad responds to these CSS variables:
- `--kid-keypad-bg`: Keypad background
- `--kid-keypad-btn-bg`: Button background
- `--kid-keypad-btn-color`: Button text color
- `--kid-keypad-btn-border`: Button border
- `--kid-keypad-btn-shadow`: Button shadow
- `--kid-keypad-bksp-bg`: Backspace button background
- `--kid-keypad-bksp-color`: Backspace button text
- `--kid-keypad-bksp-border`: Backspace button border

## Storybook

Run `pnpm storybook` to see interactive examples:

- **Basic** - Simple controlled input
- **WithAutoValidation** - Single digit with auto-validation
- **AnswerPersistsAfterCorrect** - Form-like behavior where answer stays visible
- **TwoDigitAnswer** - Two-digit addition problems
- **ThreeDigitAnswer** - Three-digit subtraction
- **MultipleInputsWithFocus** - Multiple inputs with focus management
- **SingleInputAllStates** - All feedback states demonstrated
- **SequentialInputsAutoAdvance** - Multi-step progression
- **ComplementPractice** - Rapid-fire complement-to-10 game
- **DisplaySizes** - Size comparison (sm/md/lg/xl)
- **FeedbackStates** - Visual feedback comparison
- **FixedKeypadMode** - Full-screen with fixed keypad

## Dependencies

- `react-simple-keyboard`: On-screen keyboard component
- `@/contexts/ThemeContext`: For dark/light mode detection
- Panda CSS: For styling

## Files

```
src/components/ui/KidNumberInput/
├── index.ts              # Public exports
├── KidNumberInput.tsx    # Main component
├── KidNumberInput.css    # Animations and keypad styles
├── KidNumberInput.stories.tsx  # Storybook stories
├── useKidNumberInput.ts  # Auto-validation hook
└── README.md             # This file
```
