/**
 * KidNumberInput - Kid-friendly number input with on-screen keypad and auto-validation
 *
 * This component provides a consistent touch-friendly number input experience
 * for children across different parts of the app.
 *
 * ## Components
 *
 * - `KidNumberInput` - The main UI component with display and keypad
 * - `useKidNumberInput` - Hook for managing input state with auto-validation
 *
 * ## Usage Patterns
 *
 * ### Basic with hook (recommended for auto-validation)
 *
 * ```tsx
 * function MyComponent() {
 *   const [feedback, setFeedback] = useState<FeedbackState>('none')
 *
 *   const { state, actions } = useKidNumberInput({
 *     correctAnswer: 7,
 *     onCorrect: (answer, time) => {
 *       setFeedback('correct')
 *       // Advance to next question
 *     },
 *     onIncorrect: (answer, correct, time) => {
 *       setFeedback('incorrect')
 *       setTimeout(() => setFeedback('none'), 300)
 *     },
 *   })
 *
 *   return (
 *     <KidNumberInput
 *       value={state.value}
 *       onDigit={actions.addDigit}
 *       onBackspace={actions.backspace}
 *       feedback={feedback}
 *     />
 *   )
 * }
 * ```
 *
 * ### Controlled without hook (manual validation)
 *
 * ```tsx
 * function MyComponent() {
 *   const [value, setValue] = useState('')
 *
 *   return (
 *     <KidNumberInput
 *       value={value}
 *       onDigit={(d) => setValue(prev => prev + d)}
 *       onBackspace={() => setValue(prev => prev.slice(0, -1))}
 *       showKeypad={true}
 *       keypadMode="inline"
 *     />
 *   )
 * }
 * ```
 *
 * ## Keypad Modes
 *
 * - `fixed` (default): Keypad is fixed to screen edge (bottom in portrait, right in landscape)
 * - `inline`: Keypad renders in place, good for forms with multiple inputs
 */

export { KidNumberInput, type KidNumberInputProps, type FeedbackState } from './KidNumberInput'
export {
  useKidNumberInput,
  type UseKidNumberInputOptions,
  type KidNumberInputState,
  type KidNumberInputActions,
} from './useKidNumberInput'
