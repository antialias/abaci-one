import { useAbacusConfig } from '@soroban/abacus-react'
import { useMemoryQuiz } from '../context/MemoryQuizContext'
import { DIFFICULTY_LEVELS, type DifficultyLevel, type QuizCard } from '../types'
import { ResultsCardGrid } from './ResultsCardGrid'

// Generate quiz cards with difficulty-based number ranges
const generateQuizCards = (
  count: number,
  difficulty: DifficultyLevel,
  appConfig: any
): QuizCard[] => {
  const { min, max } = DIFFICULTY_LEVELS[difficulty].range

  // Generate unique numbers - no duplicates allowed
  const numbers: number[] = []
  const maxAttempts = (max - min + 1) * 10 // Prevent infinite loops
  let attempts = 0

  while (numbers.length < count && attempts < maxAttempts) {
    const newNumber = Math.floor(Math.random() * (max - min + 1)) + min
    if (!numbers.includes(newNumber)) {
      numbers.push(newNumber)
    }
    attempts++
  }

  // If we couldn't generate enough unique numbers, fill with sequential numbers
  if (numbers.length < count) {
    for (let i = min; i <= max && numbers.length < count; i++) {
      if (!numbers.includes(i)) {
        numbers.push(i)
      }
    }
  }

  return numbers.map((number) => ({
    number,
    svgComponent: <div />, // Placeholder - not used in results phase
    element: null,
  }))
}

export function ResultsPhase() {
  const { state, resetGame, startQuiz } = useMemoryQuiz()
  const appConfig = useAbacusConfig()
  const correct = state.foundNumbers.length
  const total = state.correctAnswers.length
  const percentage = Math.round((correct / total) * 100)

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        maxWidth: '800px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <h3
        style={{
          marginBottom: '20px',
          color: '#1f2937',
          fontSize: '18px',
          fontWeight: '600',
        }}
      >
        Quiz Results
      </h3>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #3b82f6, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold',
          }}
        >
          <span>{percentage}%</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '16px',
            }}
          >
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Correct:</span>
            <span style={{ fontWeight: 'bold' }}>{correct}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '16px',
            }}
          >
            <span style={{ fontWeight: '500', color: '#6b7280' }}>Total:</span>
            <span style={{ fontWeight: 'bold' }}>{total}</span>
          </div>
        </div>
      </div>

      {/* Results card grid - reuse CardGrid but with all cards revealed and status indicators */}
      <div style={{ marginTop: '12px', flex: 1, overflow: 'auto' }}>
        <ResultsCardGrid state={state} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '16px',
          flexWrap: 'wrap',
        }}
      >
        <button
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: '#10b981',
            color: 'white',
            minWidth: '120px',
          }}
          onClick={() => {
            resetGame?.()
            const quizCards = generateQuizCards(
              state.selectedCount,
              state.selectedDifficulty,
              appConfig
            )
            startQuiz?.(quizCards)
          }}
        >
          Try Again
        </button>
        <button
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: '#6b7280',
            color: 'white',
            minWidth: '120px',
          }}
          onClick={() => resetGame?.()}
        >
          Back to Cards
        </button>
      </div>
    </div>
  )
}
