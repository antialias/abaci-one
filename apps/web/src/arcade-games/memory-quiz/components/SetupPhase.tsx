import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { useMemoryQuiz } from '../Provider'
import { DIFFICULTY_LEVELS, type DifficultyLevel, type QuizCard } from '../types'

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
    svgComponent: (
      <AbacusReact
        value={number}
        columns="auto"
        beadShape={appConfig.beadShape}
        colorScheme={appConfig.colorScheme}
        hideInactiveBeads={appConfig.hideInactiveBeads}
        scaleFactor={1.0}
        interactive={false}
        showNumbers={false}
        animated={false}
        soundEnabled={appConfig.soundEnabled}
        soundVolume={appConfig.soundVolume}
      />
    ),
    element: null,
  }))
}

export function SetupPhase() {
  const { state, setConfig, startQuiz } = useMemoryQuiz()
  const appConfig = useAbacusConfig()

  const handleCountSelect = (count: number) => {
    setConfig?.('selectedCount', count)
  }

  const handleTimeChange = (time: number) => {
    setConfig?.('displayTime', time)
  }

  const handleDifficultySelect = (difficulty: DifficultyLevel) => {
    setConfig?.('selectedDifficulty', difficulty)
  }

  const handlePlayModeSelect = (playMode: 'cooperative' | 'competitive') => {
    setConfig?.('playMode', playMode)
  }

  const handleStartQuiz = () => {
    const quizCards = generateQuizCards(
      state.selectedCount ?? 5,
      state.selectedDifficulty ?? 'easy',
      appConfig
    )
    startQuiz?.(quizCards)
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px',
        maxWidth: '100%',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'auto',
        }}
      >
        <div style={{ margin: '12px 0' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Difficulty Level:
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              justifyContent: 'center',
            }}
          >
            {Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => (
              <button
                key={key}
                type="button"
                style={{
                  background: state.selectedDifficulty === key ? '#3b82f6' : 'white',
                  color: state.selectedDifficulty === key ? 'white' : '#1f2937',
                  border: '2px solid',
                  borderColor: state.selectedDifficulty === key ? '#3b82f6' : '#d1d5db',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  fontSize: '12px',
                }}
                onClick={() => handleDifficultySelect(key as DifficultyLevel)}
                title={level.description}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{level.name}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Play Mode:
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              justifyContent: 'center',
            }}
          >
            <button
              key="cooperative"
              type="button"
              style={{
                background: state.playMode === 'cooperative' ? '#10b981' : 'white',
                color: state.playMode === 'cooperative' ? 'white' : '#1f2937',
                border: '2px solid',
                borderColor: state.playMode === 'cooperative' ? '#10b981' : '#d1d5db',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                fontSize: '12px',
              }}
              onClick={() => handlePlayModeSelect('cooperative')}
              title="Work together as a team to find all numbers"
            >
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>🤝 Cooperative</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Work together</div>
            </button>
            <button
              key="competitive"
              type="button"
              style={{
                background: state.playMode === 'competitive' ? '#ef4444' : 'white',
                color: state.playMode === 'competitive' ? 'white' : '#1f2937',
                border: '2px solid',
                borderColor: state.playMode === 'competitive' ? '#ef4444' : '#d1d5db',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                fontSize: '12px',
              }}
              onClick={() => handlePlayModeSelect('competitive')}
              title="Compete for the highest score"
            >
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>🏆 Competitive</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Battle for score</div>
            </button>
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Cards to Quiz:
          </label>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {[2, 5, 8, 12, 15].map((count) => (
              <button
                key={count}
                type="button"
                style={{
                  background: state.selectedCount === count ? '#3b82f6' : 'white',
                  color: state.selectedCount === count ? 'white' : '#1f2937',
                  border: '2px solid',
                  borderColor: state.selectedCount === count ? '#3b82f6' : '#d1d5db',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  minWidth: '50px',
                }}
                onClick={() => handleCountSelect(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Display Time per Card:
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={state.displayTime ?? 2.0}
              onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
              style={{
                flex: 1,
                maxWidth: '200px',
              }}
            />
            <span
              style={{
                fontWeight: 'bold',
                color: '#3b82f6',
                minWidth: '40px',
                fontSize: '14px',
              }}
            >
              {(state.displayTime ?? 2.0).toFixed(1)}s
            </span>
          </div>
        </div>

        <button
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '16px',
            width: '100%',
            maxWidth: '200px',
          }}
          onClick={handleStartQuiz}
        >
          Start Quiz
        </button>
      </div>
    </div>
  )
}
