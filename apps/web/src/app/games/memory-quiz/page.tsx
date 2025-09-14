'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { grid } from '../../../styled-system/patterns'
import { ServerSorobanSVG } from '../../../components/ServerSorobanSVG'

interface GameConfig {
  cardCount: number
  displayTime: number // in seconds
  numberRange: { min: number; max: number }
}

interface GameStats {
  totalCards: number
  correct: number
  incorrect: number
  averageTime: number
  accuracy: number
}

interface Card {
  id: number
  number: number
  userInput: string
  isCorrect?: boolean
}

const DIFFICULTY_CONFIGS: Record<string, GameConfig> = {
  beginner: {
    cardCount: 3,
    displayTime: 3.0,
    numberRange: { min: 1, max: 9 }
  },
  intermediate: {
    cardCount: 5,
    displayTime: 2.0,
    numberRange: { min: 10, max: 99 }
  },
  advanced: {
    cardCount: 8,
    displayTime: 1.5,
    numberRange: { min: 100, max: 999 }
  }
}

export default function MemoryQuizPage() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'input' | 'results'>('menu')
  const [difficulty, setDifficulty] = useState<keyof typeof DIFFICULTY_CONFIGS>('beginner')
  const [currentCards, setCurrentCards] = useState<Card[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [gameStats, setGameStats] = useState<GameStats>({
    totalCards: 0,
    correct: 0,
    incorrect: 0,
    averageTime: 0,
    accuracy: 0
  })
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [inputTimes, setInputTimes] = useState<number[]>([])

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Generate random numbers for the current difficulty
  const generateCards = (config: GameConfig): Card[] => {
    const cards: Card[] = []
    for (let i = 0; i < config.cardCount; i++) {
      const number = Math.floor(Math.random() * (config.numberRange.max - config.numberRange.min + 1)) + config.numberRange.min
      cards.push({
        id: i,
        number,
        userInput: ''
      })
    }
    return cards
  }

  const startGame = (selectedDifficulty: keyof typeof DIFFICULTY_CONFIGS) => {
    const config = DIFFICULTY_CONFIGS[selectedDifficulty]
    const cards = generateCards(config)

    setDifficulty(selectedDifficulty)
    setCurrentCards(cards)
    setCurrentCardIndex(0)
    setGameState('playing')
    setStartTime(new Date())
    setInputTimes([])
  }

  const handleCardTimeout = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    } else {
      // All cards shown, move to input phase
      setGameState('input')
      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }

  const handleInputChange = (cardIndex: number, value: string) => {
    setCurrentCards(prev =>
      prev.map((card, index) =>
        index === cardIndex ? { ...card, userInput: value } : card
      )
    )
  }

  const handleInputKeyDown = (e: React.KeyboardEvent, cardIndex: number) => {
    if (e.key === 'Enter' && cardIndex < currentCards.length - 1) {
      inputRefs.current[cardIndex + 1]?.focus()
    }
  }

  const submitAnswers = () => {
    const inputEndTime = new Date()
    const totalInputTime = startTime ? (inputEndTime.getTime() - startTime.getTime()) / 1000 : 0

    // Calculate results
    const results = currentCards.map(card => ({
      ...card,
      isCorrect: parseInt(card.userInput) === card.number
    }))

    const correct = results.filter(card => card.isCorrect).length
    const accuracy = (correct / results.length) * 100

    setCurrentCards(results)
    setGameStats({
      totalCards: results.length,
      correct,
      incorrect: results.length - correct,
      averageTime: totalInputTime / results.length,
      accuracy
    })
    setGameState('results')
  }

  const resetGame = () => {
    setGameState('menu')
    setCurrentCards([])
    setCurrentCardIndex(0)
    setStartTime(null)
    setInputTimes([])
  }

  // Auto-advance cards during display
  useEffect(() => {
    if (gameState === 'playing') {
      const config = DIFFICULTY_CONFIGS[difficulty]
      const timer = setTimeout(handleCardTimeout, config.displayTime * 1000)
      return () => clearTimeout(timer)
    }
  }, [gameState, currentCardIndex, difficulty])

  if (gameState === 'menu') {
    return (
      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        py: '8'
      })}>
        <div className={css({ maxW: '4xl', mx: 'auto', px: { base: '4', md: '6' } })}>
          {/* Header */}
          <div className={css({ textAlign: 'center', mb: '12' })}>
            <Link
              href="/games"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                color: 'gray.600',
                textDecoration: 'none',
                mb: '4',
                _hover: { color: 'gray.800' }
              })}
            >
              ← Back to Games
            </Link>
            <h1 className={css({
              fontSize: { base: '3xl', md: '4xl' },
              fontWeight: 'bold',
              color: 'gray.900',
              mb: '4'
            })}>
              🧠 Speed Memory Quiz
            </h1>
            <p className={css({
              fontSize: 'lg',
              color: 'gray.600',
              maxW: '2xl',
              mx: 'auto'
            })}>
              Cards will flash briefly - memorize the abacus patterns and input the numbers you remember
            </p>
          </div>

          {/* Difficulty Selection */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg',
            mb: '8'
          })}>
            <h2 className={css({
              fontSize: '2xl',
              fontWeight: 'semibold',
              mb: '6',
              textAlign: 'center'
            })}>
              Choose Your Difficulty
            </h2>

            <div className={grid({ columns: { base: 1, md: 3 }, gap: '6' })}>
              {Object.entries(DIFFICULTY_CONFIGS).map(([level, config]) => (
                <button
                  key={level}
                  onClick={() => startGame(level as keyof typeof DIFFICULTY_CONFIGS)}
                  className={css({
                    bg: 'white',
                    border: '2px solid',
                    borderColor: level === 'beginner' ? 'green.300' : level === 'intermediate' ? 'blue.300' : 'red.300',
                    rounded: 'xl',
                    p: '6',
                    textAlign: 'center',
                    transition: 'all',
                    _hover: {
                      borderColor: level === 'beginner' ? 'green.500' : level === 'intermediate' ? 'blue.500' : 'red.500',
                      transform: 'translateY(-2px)',
                      shadow: 'lg'
                    }
                  })}
                >
                  <div className={css({
                    w: '12',
                    h: '12',
                    bg: level === 'beginner' ? 'green.100' : level === 'intermediate' ? 'blue.100' : 'red.100',
                    rounded: 'full',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: '4',
                    fontSize: '2xl'
                  })}>
                    {level === 'beginner' ? '🌱' : level === 'intermediate' ? '🔥' : '⚡'}
                  </div>
                  <h3 className={css({
                    fontSize: 'xl',
                    fontWeight: 'semibold',
                    mb: '2',
                    textTransform: 'capitalize',
                    color: level === 'beginner' ? 'green.700' : level === 'intermediate' ? 'blue.700' : 'red.700'
                  })}>
                    {level}
                  </h3>
                  <div className={css({ fontSize: 'sm', color: 'gray.600', space: 'y-1' })}>
                    <div>{config.cardCount} cards</div>
                    <div>{config.displayTime}s display time</div>
                    <div>{config.numberRange.min}-{config.numberRange.max}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className={css({
            bg: 'blue.50',
            rounded: 'xl',
            p: '6',
            border: '1px solid',
            borderColor: 'blue.200'
          })}>
            <h3 className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'blue.800',
              mb: '3'
            })}>
              How to Play:
            </h3>
            <ol className={css({
              color: 'blue.700',
              pl: '4',
              space: 'y-2'
            })}>
              <li>1. Watch as abacus cards flash on screen</li>
              <li>2. Memorize each number shown</li>
              <li>3. Input all the numbers you remember</li>
              <li>4. See how well you did!</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'playing') {
    const config = DIFFICULTY_CONFIGS[difficulty]
    const currentCard = currentCards[currentCardIndex]
    const progress = ((currentCardIndex + 1) / currentCards.length) * 100

    return (
      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      })}>
        <div className={css({ textAlign: 'center', maxW: 'md', mx: 'auto', px: '4' })}>
          {/* Progress Bar */}
          <div className={css({ mb: '8' })}>
            <div className={css({
              w: 'full',
              h: '2',
              bg: 'gray.200',
              rounded: 'full',
              overflow: 'hidden'
            })}>
              <div
                className={css({
                  h: 'full',
                  bg: 'green.500',
                  transition: 'width 0.3s',
                  rounded: 'full'
                })}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={css({
              mt: '2',
              fontSize: 'sm',
              color: 'gray.600'
            })}>
              Card {currentCardIndex + 1} of {currentCards.length}
            </p>
          </div>

          {/* Current Card */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: '2xl',
            mb: '8'
          })}>
            <h2 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              mb: '6',
              color: 'gray.800'
            })}>
              Memorize this number:
            </h2>
            <div className={css({
              display: 'flex',
              justifyContent: 'center',
              mb: '4'
            })}>
              <ServerSorobanSVG
                number={currentCard.number}
                width={200}
                height={280}
                className={css({
                  filter: 'drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))'
                })}
              />
            </div>
            <div className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'green.600'
            })}>
              {currentCard.number}
            </div>
          </div>

          {/* Timer indicator */}
          <div className={css({
            fontSize: 'lg',
            color: 'gray.600'
          })}>
            Next card in {config.displayTime} seconds...
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'input') {
    return (
      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        py: '8'
      })}>
        <div className={css({ maxW: '2xl', mx: 'auto', px: { base: '4', md: '6' } })}>
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg'
          })}>
            <h2 className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              textAlign: 'center',
              mb: '8'
            })}>
              Enter the numbers you remember:
            </h2>

            <div className={grid({ columns: { base: 1, sm: 2, md: 3 }, gap: '4', mb: '8' })}>
              {currentCards.map((card, index) => (
                <div key={card.id} className={css({
                  textAlign: 'center'
                })}>
                  <label className={css({
                    display: 'block',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.700',
                    mb: '2'
                  })}>
                    Card {index + 1}
                  </label>
                  <input
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="number"
                    value={card.userInput}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, index)}
                    className={css({
                      w: 'full',
                      px: '4',
                      py: '3',
                      border: '2px solid',
                      borderColor: 'gray.300',
                      rounded: 'lg',
                      fontSize: 'lg',
                      textAlign: 'center',
                      _focus: {
                        outline: 'none',
                        borderColor: 'blue.500',
                        ring: '2px',
                        ringColor: 'blue.200'
                      }
                    })}
                    placeholder="?"
                  />
                </div>
              ))}
            </div>

            <div className={css({ textAlign: 'center' })}>
              <button
                onClick={submitAnswers}
                disabled={currentCards.some(card => !card.userInput)}
                className={css({
                  px: '8',
                  py: '3',
                  bg: 'green.600',
                  color: 'white',
                  fontWeight: 'semibold',
                  rounded: 'lg',
                  transition: 'all',
                  _hover: {
                    bg: 'green.700',
                    transform: 'translateY(-1px)'
                  },
                  _disabled: {
                    bg: 'gray.300',
                    cursor: 'not-allowed',
                    transform: 'none'
                  }
                })}
              >
                Submit Answers
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'results') {
    return (
      <div className={css({
        minH: 'screen',
        bg: 'gradient-to-br',
        gradientFrom: 'green.50',
        gradientTo: 'blue.50',
        py: '8'
      })}>
        <div className={css({ maxW: '4xl', mx: 'auto', px: { base: '4', md: '6' } })}>
          {/* Results Header */}
          <div className={css({
            textAlign: 'center',
            mb: '8'
          })}>
            <h1 className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              mb: '4'
            })}>
              Quiz Complete!
              {gameStats.accuracy >= 80 ? ' 🎉' : gameStats.accuracy >= 60 ? ' 👍' : ' 💪'}
            </h1>

            {/* Score Summary */}
            <div className={css({
              bg: 'white',
              rounded: 'xl',
              p: '6',
              shadow: 'lg',
              display: 'inline-block',
              mb: '8'
            })}>
              <div className={css({
                fontSize: '4xl',
                fontWeight: 'bold',
                color: gameStats.accuracy >= 80 ? 'green.600' : gameStats.accuracy >= 60 ? 'blue.600' : 'orange.600'
              })}>
                {gameStats.accuracy.toFixed(1)}%
              </div>
              <div className={css({ color: 'gray.600' })}>
                {gameStats.correct} of {gameStats.totalCards} correct
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className={css({
            bg: 'white',
            rounded: 'xl',
            p: '8',
            shadow: 'lg',
            mb: '8'
          })}>
            <h2 className={css({
              fontSize: '2xl',
              fontWeight: 'semibold',
              mb: '6',
              textAlign: 'center'
            })}>
              Review Your Answers
            </h2>

            <div className={grid({ columns: { base: 1, md: 2 }, gap: '6' })}>
              {currentCards.map((card, index) => (
                <div
                  key={card.id}
                  className={css({
                    border: '2px solid',
                    borderColor: card.isCorrect ? 'green.300' : 'red.300',
                    bg: card.isCorrect ? 'green.50' : 'red.50',
                    rounded: 'lg',
                    p: '4'
                  })}
                >
                  <div className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4'
                  })}>
                    <div className={css({ flexShrink: 0 })}>
                      <ServerSorobanSVG
                        number={card.number}
                        width={80}
                        height={100}
                      />
                    </div>
                    <div className={css({ flex: '1' })}>
                      <div className={css({
                        fontSize: 'sm',
                        fontWeight: 'medium',
                        color: 'gray.700',
                        mb: '1'
                      })}>
                        Card {index + 1}
                      </div>
                      <div className={css({
                        fontSize: 'lg',
                        fontWeight: 'semibold'
                      })}>
                        Correct: {card.number}
                      </div>
                      <div className={css({
                        fontSize: 'lg',
                        color: card.isCorrect ? 'green.600' : 'red.600'
                      })}>
                        Your answer: {card.userInput || '(empty)'}
                      </div>
                      <div className={css({
                        fontSize: 'sm',
                        fontWeight: 'semibold',
                        color: card.isCorrect ? 'green.600' : 'red.600'
                      })}>
                        {card.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className={css({
            textAlign: 'center',
            display: 'flex',
            gap: '4',
            justifyContent: 'center',
            flexWrap: 'wrap'
          })}>
            <button
              onClick={() => startGame(difficulty)}
              className={css({
                px: '6',
                py: '3',
                bg: 'green.600',
                color: 'white',
                fontWeight: 'semibold',
                rounded: 'lg',
                transition: 'all',
                _hover: {
                  bg: 'green.700',
                  transform: 'translateY(-1px)'
                }
              })}
            >
              Play Again
            </button>
            <button
              onClick={resetGame}
              className={css({
                px: '6',
                py: '3',
                bg: 'gray.600',
                color: 'white',
                fontWeight: 'semibold',
                rounded: 'lg',
                transition: 'all',
                _hover: {
                  bg: 'gray.700',
                  transform: 'translateY(-1px)'
                }
              })}
            >
              Change Difficulty
            </button>
            <Link
              href="/games"
              className={css({
                display: 'inline-block',
                px: '6',
                py: '3',
                bg: 'blue.600',
                color: 'white',
                fontWeight: 'semibold',
                rounded: 'lg',
                textDecoration: 'none',
                transition: 'all',
                _hover: {
                  bg: 'blue.700',
                  transform: 'translateY(-1px)'
                }
              })}
            >
              More Games
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}