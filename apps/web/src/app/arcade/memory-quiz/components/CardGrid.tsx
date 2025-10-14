import { AbacusReact } from '@soroban/abacus-react'
import type { SorobanQuizState } from '../types'

interface CardGridProps {
  state: SorobanQuizState
}

export function CardGrid({ state }: CardGridProps) {
  if (state.quizCards.length === 0) return null

  // Calculate optimal grid layout based on number of cards
  const cardCount = state.quizCards.length

  // Define static grid classes that Panda can generate
  const getGridClass = (count: number) => {
    if (count <= 2) return 'repeat(2, 1fr)'
    if (count <= 4) return 'repeat(2, 1fr)'
    if (count <= 6) return 'repeat(3, 1fr)'
    if (count <= 9) return 'repeat(3, 1fr)'
    if (count <= 12) return 'repeat(4, 1fr)'
    return 'repeat(5, 1fr)'
  }

  const getCardSize = (count: number) => {
    if (count <= 2) return { minSize: '180px', cardHeight: '160px' }
    if (count <= 4) return { minSize: '160px', cardHeight: '150px' }
    if (count <= 6) return { minSize: '140px', cardHeight: '140px' }
    if (count <= 9) return { minSize: '120px', cardHeight: '130px' }
    if (count <= 12) return { minSize: '110px', cardHeight: '120px' }
    return { minSize: '100px', cardHeight: '110px' }
  }

  const gridClass = getGridClass(cardCount)
  const cardSize = getCardSize(cardCount)

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '12px',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        maxHeight: '50vh',
        overflowY: 'auto',
      }}
    >
      <h4
        style={{
          textAlign: 'center',
          color: '#374151',
          marginBottom: '12px',
          fontSize: '14px',
          fontWeight: '600',
        }}
      >
        Cards you saw ({cardCount}):
      </h4>

      <div
        style={{
          display: 'grid',
          gap: '8px',
          maxWidth: '100%',
          margin: '0 auto',
          width: 'fit-content',
          gridTemplateColumns: gridClass,
        }}
      >
        {state.quizCards.map((card, index) => {
          const isRevealed = state.foundNumbers.includes(card.number)
          return (
            <div
              key={`card-${index}-${card.number}`}
              style={{
                perspective: '1000px',
                maxWidth: '200px',
                height: cardSize.cardHeight,
                minWidth: cardSize.minSize,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  textAlign: 'center',
                  transition: 'transform 0.8s',
                  transformStyle: 'preserve-3d',
                  transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Card back (hidden state) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                    color: 'white',
                    fontSize: '32px',
                    fontWeight: 'bold',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                    border: '2px solid #5f3dc4',
                  }}
                >
                  <div style={{ opacity: 0.8 }}>?</div>
                </div>

                {/* Card front (revealed state) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                    background: 'white',
                    border: '2px solid #28a745',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '4px',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AbacusReact
                        value={card.number}
                        columns="auto"
                        beadShape="diamond"
                        colorScheme="place-value"
                        hideInactiveBeads={false}
                        scaleFactor={1.2}
                        interactive={false}
                        showNumbers={false}
                        animated={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary row for large numbers of cards */}
      {cardCount > 8 && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 8px',
            background: '#eff6ff',
            borderRadius: '6px',
            border: '1px solid #bfdbfe',
            textAlign: 'center',
            fontSize: '12px',
            color: '#1d4ed8',
          }}
        >
          <strong>{state.foundNumbers.length}</strong> of <strong>{cardCount}</strong> cards found
          {state.foundNumbers.length > 0 && (
            <span style={{ marginLeft: '6px', fontWeight: 'normal' }}>
              ({Math.round((state.foundNumbers.length / cardCount) * 100)}% complete)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
