import type { QuizAction, SorobanQuizState } from './types'

export const initialState: SorobanQuizState = {
  cards: [],
  quizCards: [],
  correctAnswers: [],
  currentCardIndex: 0,
  displayTime: 2.0,
  selectedCount: 5,
  selectedDifficulty: 'easy', // Default to easy level
  foundNumbers: [],
  guessesRemaining: 0,
  currentInput: '',
  incorrectGuesses: 0,
  // Multiplayer state
  activePlayers: [],
  playerMetadata: {},
  playerScores: {},
  playMode: 'cooperative', // Default to cooperative
  numberFoundBy: {},
  // UI state
  gamePhase: 'setup',
  prefixAcceptanceTimeout: null,
  finishButtonsBound: false,
  wrongGuessAnimations: [],
  // Keyboard state (persistent across re-renders)
  hasPhysicalKeyboard: null,
  testingMode: false,
  showOnScreenKeyboard: false,
}

export function quizReducer(state: SorobanQuizState, action: QuizAction): SorobanQuizState {
  switch (action.type) {
    case 'SET_CARDS':
      return { ...state, cards: action.cards }
    case 'SET_DISPLAY_TIME':
      return { ...state, displayTime: action.time }
    case 'SET_SELECTED_COUNT':
      return { ...state, selectedCount: action.count }
    case 'SET_DIFFICULTY':
      return { ...state, selectedDifficulty: action.difficulty }
    case 'SET_PLAY_MODE':
      return { ...state, playMode: action.playMode }
    case 'START_QUIZ':
      return {
        ...state,
        quizCards: action.quizCards,
        correctAnswers: action.quizCards.map((card) => card.number),
        currentCardIndex: 0,
        foundNumbers: [],
        guessesRemaining: action.quizCards.length + Math.floor(action.quizCards.length / 2),
        gamePhase: 'display',
      }
    case 'NEXT_CARD':
      return { ...state, currentCardIndex: state.currentCardIndex + 1 }
    case 'SHOW_INPUT_PHASE':
      return { ...state, gamePhase: 'input' }
    case 'ACCEPT_NUMBER': {
      // In competitive mode, track which player guessed correctly
      const newPlayerScores = { ...state.playerScores }
      if (state.playMode === 'competitive' && action.playerId) {
        const currentScore = newPlayerScores[action.playerId] || { correct: 0, incorrect: 0 }
        newPlayerScores[action.playerId] = {
          ...currentScore,
          correct: currentScore.correct + 1,
        }
      }
      return {
        ...state,
        foundNumbers: [...state.foundNumbers, action.number],
        currentInput: '',
        playerScores: newPlayerScores,
      }
    }
    case 'REJECT_NUMBER': {
      // In competitive mode, track which player guessed incorrectly
      const newPlayerScores = { ...state.playerScores }
      if (state.playMode === 'competitive' && action.playerId) {
        const currentScore = newPlayerScores[action.playerId] || { correct: 0, incorrect: 0 }
        newPlayerScores[action.playerId] = {
          ...currentScore,
          incorrect: currentScore.incorrect + 1,
        }
      }
      return {
        ...state,
        guessesRemaining: state.guessesRemaining - 1,
        incorrectGuesses: state.incorrectGuesses + 1,
        currentInput: '',
        playerScores: newPlayerScores,
      }
    }
    case 'SET_INPUT':
      return { ...state, currentInput: action.input }
    case 'SET_PREFIX_TIMEOUT':
      return { ...state, prefixAcceptanceTimeout: action.timeout }
    case 'ADD_WRONG_GUESS_ANIMATION':
      return {
        ...state,
        wrongGuessAnimations: [
          ...state.wrongGuessAnimations,
          {
            number: action.number,
            id: `wrong-${action.number}-${Date.now()}`,
            timestamp: Date.now(),
          },
        ],
      }
    case 'CLEAR_WRONG_GUESS_ANIMATIONS':
      return {
        ...state,
        wrongGuessAnimations: [],
      }
    case 'SHOW_RESULTS':
      return { ...state, gamePhase: 'results' }
    case 'RESET_QUIZ':
      return {
        ...initialState,
        cards: state.cards, // Preserve generated cards
        displayTime: state.displayTime,
        selectedCount: state.selectedCount,
        selectedDifficulty: state.selectedDifficulty,
        playMode: state.playMode, // Preserve play mode
        // Preserve keyboard state across resets
        hasPhysicalKeyboard: state.hasPhysicalKeyboard,
        testingMode: state.testingMode,
        showOnScreenKeyboard: state.showOnScreenKeyboard,
      }
    case 'SET_PHYSICAL_KEYBOARD':
      return { ...state, hasPhysicalKeyboard: action.hasKeyboard }
    case 'SET_TESTING_MODE':
      return { ...state, testingMode: action.enabled }
    case 'TOGGLE_ONSCREEN_KEYBOARD':
      return { ...state, showOnScreenKeyboard: !state.showOnScreenKeyboard }
    default:
      return state
  }
}
