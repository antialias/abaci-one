'use client'

import { useCallback, useEffect, useRef } from 'react'
import { css } from '../../../../styled-system/css'
import { useTypeRacerJr } from '../Provider'
import { useKeyboardInput } from '../hooks/useKeyboardInput'
import { useTypingTTS } from '../hooks/useTypingTTS'
import { LetterDisplay } from './LetterDisplay'
import { WordProgress } from './WordProgress'
import { TimerBar } from './TimerBar'
import { CelebrationBurst } from './CelebrationBurst'
import { OnScreenKeyboard } from './OnScreenKeyboard'
import { AbacusScoreCounter } from './AbacusScoreCounter'
import { StreakEffect } from './StreakEffect'

export function PlayingPhase() {
  const {
    state,
    localState,
    currentWord,
    typeLetter,
    endGame,
    dismissCelebration,
  } = useTypeRacerJr()

  const tts = useTypingTTS()

  // Track previous values for transition detection
  const prevGamePhaseRef = useRef(state.gamePhase)
  const prevWordRef = useRef<string | null>(null)
  const prevCelebrationRef = useRef(false)
  const prevDifficultyRef = useRef(state.currentDifficulty)

  // TTS: speak on game start
  useEffect(() => {
    if (state.gamePhase === 'playing' && prevGamePhaseRef.current !== 'playing') {
      tts.speakGameStart()
    }
    prevGamePhaseRef.current = state.gamePhase
  }, [state.gamePhase, tts])

  // TTS: say the word then spell it out when a new word appears
  useEffect(() => {
    const wordText = currentWord?.word ?? null
    if (wordText && wordText !== prevWordRef.current && !localState.showCelebration) {
      tts.spellBack(wordText)
    }
    prevWordRef.current = wordText
  }, [currentWord?.word, localState.showCelebration, tts])

  // TTS: encourage on word completion
  useEffect(() => {
    if (localState.showCelebration && !prevCelebrationRef.current) {
      tts.speakWordComplete()
    }
    prevCelebrationRef.current = localState.showCelebration
  }, [localState.showCelebration, tts])

  // TTS: speak on difficulty advance
  useEffect(() => {
    if (state.currentDifficulty !== prevDifficultyRef.current) {
      tts.speakDifficultyAdvance()
    }
    prevDifficultyRef.current = state.currentDifficulty
  }, [state.currentDifficulty, tts])

  // Suppress TTS after 3 consecutive clean words
  useEffect(() => {
    if (state.consecutiveCleanWords >= 3) {
      tts.suppressAfterCleanStreak()
    }
  }, [state.consecutiveCleanWords, tts])

  // Physical keyboard input
  const { hasPhysicalKeyboard } = useKeyboardInput({
    enabled: state.gamePhase === 'playing' && !localState.showCelebration,
    onKeyPress: typeLetter,
  })

  const handleTimerUp = useCallback(() => {
    endGame('timer-expired')
  }, [endGame])

  const handleTimerWarning = useCallback(() => {
    tts.speakTimerWarning()
  }, [tts])

  if (!currentWord && !localState.showCelebration) {
    return null
  }

  const wordNumber = state.completedWords.length + 1
  const totalWords = state.wordQueue.length

  return (
    <div
      data-component="PlayingPhase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4',
        p: '4',
        flex: 1,
        position: 'relative',
      })}
    >
      {/* Timer bar for beat-the-clock */}
      {state.gameMode === 'beat-the-clock' &&
        state.timeLimit &&
        state.gameStartTime && (
          <TimerBar
            totalSeconds={state.timeLimit}
            startTime={state.gameStartTime}
            onTimeUp={handleTimerUp}
            onWarning={handleTimerWarning}
          />
        )}

      {/* Score overlay */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '400px',
          fontSize: 'sm',
          color: 'gray.600',
        })}
      >
        <span>
          Word {wordNumber}/{totalWords}
        </span>
        <AbacusScoreCounter
          totalStars={state.totalStars}
          celebrate={state.consecutiveCleanWords >= 3}
        />
        {state.bestStreak > 1 && (
          <span>
            🔥 {state.bestStreak}
          </span>
        )}
      </div>

      {/* Streak-wrapped play area */}
      <StreakEffect streak={state.consecutiveCleanWords}>
        {/* Emoji */}
        {currentWord && (
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              fontSize: '80px',
              lineHeight: 1,
              animation: 'bob 2s ease-in-out infinite',
              userSelect: 'none',
            })}
          >
            {currentWord.emoji}
          </div>
        )}

        {/* Letter display */}
        {currentWord && (
          <div
            className={css({
              display: 'flex',
              gap: '2',
              flexWrap: 'wrap',
              justifyContent: 'center',
              mb: '2',
              mt: '4',
            })}
          >
            {currentWord.word.split('').map((letter, i) => {
              let letterState: 'upcoming' | 'current' | 'correct' | 'wrong'
              if (i < localState.currentLetterIndex) {
                letterState = 'correct'
              } else if (i === localState.currentLetterIndex) {
                // Check if last typed letter at this position was wrong
                const lastTyped = localState.typedLetters[localState.typedLetters.length - 1]
                letterState =
                  lastTyped && !lastTyped.correct && i === localState.currentLetterIndex
                    ? 'wrong'
                    : 'current'
              } else {
                letterState = 'upcoming'
              }
              return <LetterDisplay key={i} letter={letter} state={letterState} />
            })}
          </div>
        )}
      </StreakEffect>

      {/* Word progress */}
      {currentWord && (
        <WordProgress
          totalLetters={currentWord.word.length}
          completedLetters={localState.currentLetterIndex}
        />
      )}

      {/* Difficulty badge */}
      <div
        className={css({
          fontSize: 'xs',
          color: 'gray.500',
          bg: 'gray.100',
          px: '3',
          py: '1',
          borderRadius: 'full',
        })}
      >
        {state.currentDifficulty === 'level1'
          ? 'Easy'
          : state.currentDifficulty === 'level2'
            ? 'Medium'
            : 'Hard'}
      </div>

      {/* On-screen keyboard (hidden when physical keyboard detected) */}
      {!hasPhysicalKeyboard && !localState.showCelebration && currentWord && (
        <OnScreenKeyboard
          onKeyPress={typeLetter}
          highlightedLetter={currentWord.word[localState.currentLetterIndex]}
        />
      )}

      {/* Celebration overlay */}
      {localState.showCelebration && (
        <CelebrationBurst
          stars={localState.celebrationStars}
          onDone={dismissCelebration}
        />
      )}
    </div>
  )
}
