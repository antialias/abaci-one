# Card Sorting Challenge - Arcade Room Port Plan

## Executive Summary

Porting the Card Sorting Challenge from standalone HTML to the arcade room platform as a single-player game. The game challenges players to arrange abacus cards in ascending order using only visual patterns (no numbers shown).

**Complexity**: Medium - Simpler than matching/memory-quiz (no multiplayer turn logic), but more complex scoring algorithm.

**Timeline Estimate**: 1-2 days for full implementation and testing

---

## 1. Game Analysis

### 1.1 Current Implementation (web_generator.py)

**Core Mechanics**:

- Player selects difficulty (5, 8, 12, or 15 cards)
- Cards displayed in random order with abacus SVGs only (numbers hidden)
- Player arranges cards using click-to-select + click-to-place interaction
- "Reveal Numbers" button available (affects scoring but not shown)
- Timer tracks duration
- Smart scoring algorithm (not just exact position matching)

**Key Features**:

1. **Card Pool**: Uses existing flashcard data (AbacusReact components)
2. **Interaction Model**:
   - Click card → select
   - Click position slot OR insert button (+) → place
   - Click placed card → remove back to available
3. **Position Slots**: Visual gradient from dark (smallest) to light (largest)
4. **Scoring Algorithm** (3 metrics):
   - Longest Common Subsequence (50% weight) - relative order
   - Exact Position Matches (30% weight) - correct positions
   - Inversion Count (20% weight) - overall organization
5. **Feedback**: Detailed breakdown of score components
6. **Timer**: Tracks elapsed time, displayed in results

**State Management**:

```javascript
{
  cards: [],              // All available cards from flashcards
  sortingCards: [],       // Selected subset for this game
  selectedCount: 5,       // Difficulty setting
  currentOrder: [],       // Cards still available to place
  correctOrder: [],       // Sorted correct answer
  placedCards: [],        // Array of placed cards (null = empty slot)
  selectedCard: null,     // Currently selected card
  numbersRevealed: false, // Whether player used reveal button
  startTime: Date,        // For timer
  timerInterval: null     // Timer interval ID
}
```

### 1.2 Arcade Platform Requirements

**Must implement**:

- SDK-compatible types (GameConfig, GameState, GameMove)
- Server-side Validator class
- Client-side Provider with useArcadeSession
- React component structure (Setup, Playing, Results phases)
- Config persistence to database
- Move validation and state transitions

**Platform Conventions**:

- Phase-based: `setup` → `playing` → `results`
- Standard moves: `START_GAME`, `GO_TO_SETUP`, `SET_CONFIG`
- Pause/Resume pattern (optional for single-player)
- Config changes tracked and persisted

---

## 2. Architecture Design

### 2.1 Directory Structure

```
src/arcade-games/card-sorting/
├── index.ts                      # Game definition & registration
├── types.ts                      # TypeScript type definitions
├── Provider.tsx                  # Client-side state management
├── Validator.ts                  # Server-side game logic
├── components/
│   ├── index.ts                  # Component exports
│   ├── GameComponent.tsx         # Main wrapper component
│   ├── SetupPhase.tsx            # Configuration UI
│   ├── PlayingPhase.tsx          # Main game UI
│   └── ResultsPhase.tsx          # Score display & feedback
└── utils/
    ├── cardGeneration.ts         # Random card selection
    ├── scoringAlgorithm.ts       # LCS, inversions, etc.
    └── validation.ts             # Move validation helpers
```

### 2.2 Type Definitions (types.ts)

```typescript
import type { GameConfig, GameState } from "@/lib/arcade/game-sdk/types";

// ============================================================================
// Configuration
// ============================================================================

export interface CardSortingConfig extends GameConfig {
  cardCount: 5 | 8 | 12 | 15; // Difficulty (number of cards)
  showNumbers: boolean; // Allow reveal numbers button
  timeLimit: number | null; // Optional time limit (seconds), null = unlimited
}

// ============================================================================
// Core Data Types
// ============================================================================

export type GamePhase = "setup" | "playing" | "results";

export interface SortingCard {
  id: string; // Unique ID for this card instance
  number: number; // The abacus value (0-99+)
  svgContent: string; // Serialized AbacusReact SVG
}

export interface PlacedCard {
  card: SortingCard; // The card data
  position: number; // Which slot it's in (0-indexed)
}

export interface ScoreBreakdown {
  finalScore: number; // 0-100 weighted average
  exactMatches: number; // Cards in exactly correct position
  lcsLength: number; // Longest common subsequence length
  inversions: number; // Number of out-of-order pairs
  relativeOrderScore: number; // 0-100 based on LCS
  exactPositionScore: number; // 0-100 based on exact matches
  inversionScore: number; // 0-100 based on inversions
  elapsedTime: number; // Seconds taken
  numbersRevealed: boolean; // Whether player used reveal
}

// ============================================================================
// Game State
// ============================================================================

export interface CardSortingState extends GameState {
  // Configuration
  cardCount: 5 | 8 | 12 | 15;
  showNumbers: boolean;
  timeLimit: number | null;

  // Game phase
  gamePhase: GamePhase;

  // Player & timing
  playerId: string; // Single player ID
  playerMetadata: PlayerMetadata; // Player display info
  gameStartTime: number | null;
  gameEndTime: number | null;

  // Cards
  selectedCards: SortingCard[]; // The N cards for this game
  correctOrder: SortingCard[]; // Sorted by number (answer key)
  availableCards: SortingCard[]; // Cards not yet placed
  placedCards: (SortingCard | null)[]; // Array of N slots (null = empty)

  // UI state (client-only, not in server state)
  selectedCardId: string | null; // Currently selected card
  numbersRevealed: boolean; // If player revealed numbers

  // Results
  scoreBreakdown: ScoreBreakdown | null; // Final score details

  // Pause/Resume (standard pattern)
  originalConfig?: CardSortingConfig;
  pausedGamePhase?: GamePhase;
  pausedGameState?: {
    selectedCards: SortingCard[];
    availableCards: SortingCard[];
    placedCards: (SortingCard | null)[];
    gameStartTime: number;
    numbersRevealed: boolean;
  };
}

// ============================================================================
// Game Moves
// ============================================================================

export type CardSortingMove =
  | {
      type: "START_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        playerMetadata: PlayerMetadata;
        selectedCards: SortingCard[]; // Pre-selected random cards
      };
    }
  | {
      type: "PLACE_CARD";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        cardId: string; // Which card to place
        position: number; // Which slot (0-indexed)
      };
    }
  | {
      type: "REMOVE_CARD";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        position: number; // Which slot to remove from
      };
    }
  | {
      type: "REVEAL_NUMBERS";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {};
    }
  | {
      type: "CHECK_SOLUTION";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {};
    }
  | {
      type: "GO_TO_SETUP";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {};
    }
  | {
      type: "SET_CONFIG";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        field: "cardCount" | "showNumbers" | "timeLimit";
        value: any;
      };
    }
  | {
      type: "RESUME_GAME";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {};
    };

// ============================================================================
// Component Props
// ============================================================================

export interface SortingCardProps {
  card: SortingCard;
  isSelected: boolean;
  isPlaced: boolean;
  isCorrect?: boolean; // After checking solution
  onClick: () => void;
  showNumber: boolean; // If revealed
}

export interface PositionSlotProps {
  position: number;
  card: SortingCard | null;
  isActive: boolean; // If slot is clickable
  isCorrect?: boolean; // After checking solution
  gradientStyle: React.CSSProperties;
  onClick: () => void;
}

export interface ScoreDisplayProps {
  breakdown: ScoreBreakdown;
  correctOrder: SortingCard[];
  userOrder: SortingCard[];
  onNewGame: () => void;
  onExit: () => void;
}
```

### 2.3 Validator (Validator.ts)

**Responsibilities**:

- Validate all moves server-side
- Calculate scores when checking solution
- Manage state transitions
- Generate initial state from config

**Key Methods**:

```typescript
class CardSortingValidator
  implements GameValidator<CardSortingState, CardSortingMove>
{
  validateMove(state, move, context): ValidationResult {
    switch (move.type) {
      case "START_GAME":
        return this.validateStartGame(state, move.data);
      case "PLACE_CARD":
        return this.validatePlaceCard(
          state,
          move.data.cardId,
          move.data.position,
        );
      case "REMOVE_CARD":
        return this.validateRemoveCard(state, move.data.position);
      case "REVEAL_NUMBERS":
        return this.validateRevealNumbers(state);
      case "CHECK_SOLUTION":
        return this.validateCheckSolution(state);
      case "GO_TO_SETUP":
        return this.validateGoToSetup(state);
      case "SET_CONFIG":
        return this.validateSetConfig(state, move.data.field, move.data.value);
      case "RESUME_GAME":
        return this.validateResumeGame(state);
    }
  }

  // Core validation methods
  private validatePlaceCard(state, cardId, position): ValidationResult {
    // Must be in playing phase
    // Card must exist in availableCards
    // Position must be valid (0 to cardCount-1)
    // Position can be null (insert) or occupied (swap logic)

    const card = state.availableCards.find((c) => c.id === cardId);
    if (!card) return { valid: false, error: "Card not found" };

    if (position < 0 || position >= state.cardCount) {
      return { valid: false, error: "Invalid position" };
    }

    // Create new state with card placed
    const newAvailable = state.availableCards.filter((c) => c.id !== cardId);
    const newPlaced = [...state.placedCards];

    // Shift logic (compress gaps to left)
    // ... implementation similar to web_generator.py

    return {
      valid: true,
      newState: {
        ...state,
        availableCards: newAvailable,
        placedCards: newPlaced,
      },
    };
  }

  private validateCheckSolution(state): ValidationResult {
    // All slots must be filled
    if (state.placedCards.some((c) => c === null)) {
      return { valid: false, error: "Must place all cards first" };
    }

    // Calculate score using scoring algorithms
    const userSequence = state.placedCards.map((c) => c!.number);
    const correctSequence = state.correctOrder.map((c) => c.number);

    const scoreBreakdown = this.calculateScore(
      userSequence,
      correctSequence,
      state.gameStartTime,
      state.numbersRevealed,
    );

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: "results",
        gameEndTime: Date.now(),
        scoreBreakdown,
      },
    };
  }

  // Scoring algorithm (port from web_generator.py)
  private calculateScore(
    userSeq,
    correctSeq,
    startTime,
    revealed,
  ): ScoreBreakdown {
    const lcs = this.longestCommonSubsequence(userSeq, correctSeq);
    const exactMatches = userSeq.filter((n, i) => n === correctSeq[i]).length;
    const inversions = this.countInversions(userSeq, correctSeq);

    const relativeOrderScore = (lcs / correctSeq.length) * 100;
    const exactPositionScore = (exactMatches / correctSeq.length) * 100;
    const maxInversions = (correctSeq.length * (correctSeq.length - 1)) / 2;
    const inversionScore = Math.max(
      0,
      ((maxInversions - inversions) / maxInversions) * 100,
    );

    const finalScore = Math.round(
      relativeOrderScore * 0.5 +
        exactPositionScore * 0.3 +
        inversionScore * 0.2,
    );

    return {
      finalScore,
      exactMatches,
      lcsLength: lcs,
      inversions,
      relativeOrderScore: Math.round(relativeOrderScore),
      exactPositionScore: Math.round(exactPositionScore),
      inversionScore: Math.round(inversionScore),
      elapsedTime: Math.floor((Date.now() - startTime) / 1000),
      numbersRevealed: revealed,
    };
  }

  private longestCommonSubsequence(seq1, seq2): number {
    // Dynamic programming LCS algorithm
    // Port from web_generator.py lines 9470-9486
  }

  private countInversions(userSeq, correctSeq): number {
    // Count out-of-order pairs
    // Port from web_generator.py lines 9488-9509
  }

  getInitialState(config: CardSortingConfig): CardSortingState {
    return {
      cardCount: config.cardCount,
      showNumbers: config.showNumbers,
      timeLimit: config.timeLimit,
      gamePhase: "setup",
      playerId: "",
      playerMetadata: {},
      gameStartTime: null,
      gameEndTime: null,
      selectedCards: [],
      correctOrder: [],
      availableCards: [],
      placedCards: new Array(config.cardCount).fill(null),
      selectedCardId: null,
      numbersRevealed: false,
      scoreBreakdown: null,
    };
  }
}
```

### 2.4 Provider (Provider.tsx)

**Responsibilities**:

- Wrap children with context provider
- Integrate with useArcadeSession hook
- Provide action creators (startGame, placeCard, etc.)
- Handle optimistic updates for smooth UX
- Manage local UI state (selected card highlight, etc.)

**Key Implementation**:

```typescript
export function CardSortingProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  // Get local player (single player game)
  const localPlayerId = useMemo(() => {
    return Array.from(activePlayers).find(id => {
      const player = players.get(id)
      return player?.isLocal
    })
  }, [activePlayers, players])

  // Merge saved config with defaults
  const initialState = useMemo((): CardSortingState => {
    const savedConfig = roomData?.gameConfig?.['card-sorting']

    return {
      cardCount: savedConfig?.cardCount ?? 5,
      showNumbers: savedConfig?.showNumbers ?? true,
      timeLimit: savedConfig?.timeLimit ?? null,
      gamePhase: 'setup',
      // ... rest of initial state
    }
  }, [roomData?.gameConfig])

  // Arcade session integration
  const {
    state: serverState,
    sendMove,
    exitSession,
    lastError,
    clearError,
  } = useArcadeSession<CardSortingState>({
    userId: viewerId || '',
    roomId: roomData?.id,
    initialState,
    applyMove: applyMoveOptimistically,  // For responsive UI
  })

  // Local UI state (not synced)
  const [localUIState, setLocalUIState] = useState({
    selectedCardId: null as string | null,
    highlightedSlot: null as number | null,
  })

  // Action creators
  const startGame = useCallback(() => {
    if (!localPlayerId) return

    const playerMetadata = buildPlayerMetadata(
      [localPlayerId],
      {},
      players,
      viewerId
    )

    // Generate random cards
    const selectedCards = generateRandomCards(serverState.cardCount)

    sendMove({
      type: 'START_GAME',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: { playerMetadata, selectedCards }
    })
  }, [localPlayerId, serverState.cardCount, sendMove])

  const placeCard = useCallback((cardId: string, position: number) => {
    if (!localPlayerId) return

    sendMove({
      type: 'PLACE_CARD',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: { cardId, position }
    })

    // Clear local selection
    setLocalUIState(prev => ({ ...prev, selectedCardId: null }))
  }, [localPlayerId, sendMove])

  const removeCard = useCallback((position: number) => {
    if (!localPlayerId) return

    sendMove({
      type: 'REMOVE_CARD',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: { position }
    })
  }, [localPlayerId, sendMove])

  const checkSolution = useCallback(() => {
    if (!localPlayerId) return

    sendMove({
      type: 'CHECK_SOLUTION',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {}
    })
  }, [localPlayerId, sendMove])

  const revealNumbers = useCallback(() => {
    if (!localPlayerId) return

    sendMove({
      type: 'REVEAL_NUMBERS',
      playerId: localPlayerId,
      userId: viewerId || '',
      data: {}
    })
  }, [localPlayerId, sendMove])

  // ... other action creators (goToSetup, setConfig, etc.)

  // Computed values
  const canCheckSolution = serverState.placedCards.every(c => c !== null)
  const placedCount = serverState.placedCards.filter(c => c !== null).length
  const elapsedTime = serverState.gameStartTime
    ? Math.floor((Date.now() - serverState.gameStartTime) / 1000)
    : 0

  const contextValue = {
    state: serverState,
    localUIState,
    setLocalUIState,

    // Actions
    startGame,
    placeCard,
    removeCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    setConfig,
    resumeGame,
    exitSession,

    // Computed
    canCheckSolution,
    placedCount,
    elapsedTime,

    // Helpers
    selectCard: (cardId: string | null) => {
      setLocalUIState(prev => ({ ...prev, selectedCardId: cardId }))
    },
  }

  return (
    <CardSortingContext.Provider value={contextValue}>
      {children}
    </CardSortingContext.Provider>
  )
}
```

### 2.5 Component Structure

#### SetupPhase.tsx

**Purpose**: Configure game before starting

**UI Elements**:

- Card count selector (5, 8, 12, 15) - button group
- Show numbers toggle - checkbox
- Time limit selector - dropdown (unlimited, 1min, 2min, 3min, 5min)
- Start Game button
- Resume Game button (if paused game exists)

**Implementation**:

```tsx
export function SetupPhase() {
  const { state, setConfig, startGame, resumeGame } = useCardSorting()
  const canResume = state.pausedGamePhase && !hasConfigChanged()

  return (
    <div className={css({ ... })}>
      <h2>Card Sorting Challenge</h2>
      <p>Arrange cards in order using only abacus patterns</p>

      <div className={css({ /* card count buttons */ })}>
        {[5, 8, 12, 15].map(count => (
          <button
            key={count}
            onClick={() => setConfig('cardCount', count)}
            className={css({ /* active if selected */ })}
          >
            {count} Cards
          </button>
        ))}
      </div>

      <label>
        <input
          type="checkbox"
          checked={state.showNumbers}
          onChange={(e) => setConfig('showNumbers', e.target.checked)}
        />
        Allow "Reveal Numbers" button
      </label>

      <div className={css({ /* button group */ })}>
        {canResume && (
          <button onClick={resumeGame}>Resume Game</button>
        )}
        <button onClick={startGame}>Start New Game</button>
      </div>
    </div>
  )
}
```

#### PlayingPhase.tsx

**Purpose**: Main game interface

**UI Sections**:

1. **Header (sticky)**:
   - Timer display (MM:SS)
   - Status message ("5/8 cards placed", etc.)
   - Action buttons: Check Solution, Reveal Numbers, End Game

2. **Two-column layout**:
   - Left: Available cards grid
   - Right: Position slots (sequential, gradient background)

3. **Card interaction**:
   - Click card → select (highlight border)
   - Click slot → place selected card
   - Click + button → insert at position
   - Click placed card → remove to available

**Implementation**:

```tsx
export function PlayingPhase() {
  const {
    state,
    localUIState,
    selectCard,
    placeCard,
    removeCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    canCheckSolution,
    placedCount,
    elapsedTime
  } = useCardSorting()

  const handleCardClick = (card: SortingCard) => {
    if (localUIState.selectedCardId === card.id) {
      selectCard(null)  // Deselect
    } else {
      selectCard(card.id)
    }
  }

  const handleSlotClick = (position: number) => {
    if (!localUIState.selectedCardId) {
      // Remove card if slot is occupied
      if (state.placedCards[position]) {
        removeCard(position)
      }
    } else {
      // Place selected card
      placeCard(localUIState.selectedCardId, position)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getGradientStyle = (position: number, total: number) => {
    const intensity = position / (total - 1)
    const lightness = 30 + (intensity * 45)
    return {
      background: `hsl(220, 8%, ${lightness}%)`,
      color: lightness > 60 ? '#2c3e50' : '#ffffff',
    }
  }

  return (
    <div>
      {/* Sticky header */}
      <div className={css({ position: 'sticky', top: 0, ... })}>
        <div>
          <span>Time: {formatTime(elapsedTime)}</span>
          <span>{placedCount}/{state.cardCount} placed</span>
        </div>
        <div>
          <button
            onClick={checkSolution}
            disabled={!canCheckSolution}
          >
            Check Solution
          </button>
          {state.showNumbers && !state.numbersRevealed && (
            <button onClick={revealNumbers}>
              Reveal Numbers
            </button>
          )}
          <button onClick={goToSetup}>End Game</button>
        </div>
      </div>

      {/* Main game area */}
      <div className={css({ display: 'flex', gap: '2rem' })}>
        {/* Available cards */}
        <div className={css({ flex: 1 })}>
          <h3>Available Cards</h3>
          <div className={css({ display: 'grid', gap: '1rem', ... })}>
            {state.availableCards.map(card => (
              <SortingCard
                key={card.id}
                card={card}
                isSelected={localUIState.selectedCardId === card.id}
                isPlaced={false}
                showNumber={state.numbersRevealed}
                onClick={() => handleCardClick(card)}
              />
            ))}
          </div>
        </div>

        {/* Position slots */}
        <div className={css({ flex: 2 })}>
          <h3>Sort Positions (Smallest → Largest)</h3>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' })}>
            {state.placedCards.map((card, index) => (
              <div key={index} className={css({ display: 'flex', alignItems: 'center' })}>
                <PositionSlot
                  position={index}
                  card={card}
                  isActive={!!localUIState.selectedCardId || !!card}
                  gradientStyle={getGradientStyle(index, state.cardCount)}
                  onClick={() => handleSlotClick(index)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### ResultsPhase.tsx

**Purpose**: Display score and feedback

**UI Elements**:

- Final score (0-100%)
- Performance message (Perfect! / Excellent! / Good! / Keep practicing!)
- Detailed breakdown:
  - Exact position matches (X/N cards)
  - Relative order score (LCS-based)
  - Organization score (inversion-based)
  - Time taken
  - Whether numbers were revealed
- Visual comparison: user order vs correct order
- Action buttons: New Game, Change Settings, Exit

**Implementation**:

```tsx
export function ResultsPhase() {
  const { state, startGame, goToSetup, exitSession } = useCardSorting()
  const { scoreBreakdown } = state

  if (!scoreBreakdown) return null

  const getMessage = (score: number) => {
    if (score === 100) return '🎉 Perfect! All cards in correct order!'
    if (score >= 80) return '👍 Excellent! Very close to perfect!'
    if (score >= 60) return '👍 Good job! You understand the pattern!'
    return '💪 Keep practicing! Focus on reading each abacus carefully.'
  }

  const getEmoji = (score: number) => {
    if (score === 100) return '🏆'
    if (score >= 80) return '⭐'
    if (score >= 60) return '👍'
    return '📈'
  }

  return (
    <div className={css({ ... })}>
      {/* Score display */}
      <div className={css({ textAlign: 'center', mb: '2rem' })}>
        <div className={css({ fontSize: '4rem' })}>
          {getEmoji(scoreBreakdown.finalScore)}
        </div>
        <h2>Your Score: {scoreBreakdown.finalScore}%</h2>
        <p>{getMessage(scoreBreakdown.finalScore)}</p>
      </div>

      {/* Detailed breakdown */}
      <div className={css({ ... })}>
        <h3>Score Breakdown</h3>

        <div>
          <label>Exact Position Matches (30%)</label>
          <progress value={scoreBreakdown.exactPositionScore} max={100} />
          <span>{scoreBreakdown.exactMatches}/{state.cardCount} cards</span>
        </div>

        <div>
          <label>Relative Order (50%)</label>
          <progress value={scoreBreakdown.relativeOrderScore} max={100} />
          <span>{scoreBreakdown.lcsLength}/{state.cardCount} in correct sequence</span>
        </div>

        <div>
          <label>Organization (20%)</label>
          <progress value={scoreBreakdown.inversionScore} max={100} />
          <span>{scoreBreakdown.inversions} out-of-order pairs</span>
        </div>

        <div>
          <label>Time Taken</label>
          <span>{scoreBreakdown.elapsedTime}s</span>
        </div>

        {scoreBreakdown.numbersRevealed && (
          <div className={css({ color: 'orange' })}>
            ⚠️ Numbers were revealed during play
          </div>
        )}
      </div>

      {/* Visual comparison */}
      <div className={css({ ... })}>
        <h3>Comparison</h3>
        <div>
          <h4>Your Answer:</h4>
          <div className={css({ display: 'flex', gap: '0.5rem' })}>
            {state.placedCards.map((card, i) => (
              <MiniCard
                key={i}
                card={card!}
                isCorrect={card!.number === state.correctOrder[i].number}
              />
            ))}
          </div>
        </div>
        <div>
          <h4>Correct Order:</h4>
          <div className={css({ display: 'flex', gap: '0.5rem' })}>
            {state.correctOrder.map((card, i) => (
              <MiniCard key={i} card={card} showNumber />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={css({ ... })}>
        <button onClick={startGame}>New Game (Same Settings)</button>
        <button onClick={goToSetup}>Change Settings</button>
        <button onClick={exitSession}>Exit to Room</button>
      </div>
    </div>
  )
}
```

---

## 3. Implementation Details

### 3.1 Card Generation

**Source**: AbacusReact components from the existing flashcard system

**Approach**:

```typescript
// utils/cardGeneration.ts

import { AbacusReact } from '@soroban/abacus-react'
import { renderToString } from 'react-dom/server'
import type { SortingCard } from '../types'

/**
 * Generate random cards for sorting game
 * @param count Number of cards to generate
 * @param minValue Minimum abacus value (default 0)
 * @param maxValue Maximum abacus value (default 99)
 */
export function generateRandomCards(
  count: number,
  minValue: number = 0,
  maxValue: number = 99
): SortingCard[] {
  // Generate pool of unique random numbers
  const numbers = new Set<number>()
  while (numbers.size < count) {
    const num = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
    numbers.add(num)
  }

  // Convert to sorted array (for answer key)
  const sortedNumbers = Array.from(numbers).sort((a, b) => a - b)

  // Create card objects with SVG content
  return sortedNumbers.map((number, index) => {
    // Render AbacusReact to SVG string
    const svgContent = renderToString(
      <AbacusReact
        value={number}
        width={200}
        height={120}
        // ... other props for consistent styling
      />
    )

    return {
      id: `card-${index}-${number}`,
      number,
      svgContent
    }
  })
}

/**
 * Shuffle array for random order
 */
export function shuffleCards(cards: SortingCard[]): SortingCard[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
```

### 3.2 Scoring Algorithms

**Port from web_generator.py** (lines 9425-9509)

```typescript
// utils/scoringAlgorithm.ts

/**
 * Calculate Longest Common Subsequence length
 * Measures how many cards are in correct relative order
 */
export function longestCommonSubsequence(
  seq1: number[],
  seq2: number[],
): number {
  const m = seq1.length;
  const n = seq2.length;
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Count inversions (out-of-order pairs)
 * Measures how scrambled the sequence is
 */
export function countInversions(
  userSeq: number[],
  correctSeq: number[],
): number {
  // Create mapping from value to correct position
  const correctPositions: Record<number, number> = {};
  correctSeq.forEach((val, idx) => {
    correctPositions[val] = idx;
  });

  // Convert user sequence to correct-position sequence
  const userCorrectPositions = userSeq.map((val) => correctPositions[val]);

  // Count inversions
  let inversions = 0;
  for (let i = 0; i < userCorrectPositions.length; i++) {
    for (let j = i + 1; j < userCorrectPositions.length; j++) {
      if (userCorrectPositions[i] > userCorrectPositions[j]) {
        inversions++;
      }
    }
  }

  return inversions;
}

/**
 * Calculate comprehensive score breakdown
 */
export function calculateScore(
  userSequence: number[],
  correctSequence: number[],
  startTime: number,
  numbersRevealed: boolean,
): ScoreBreakdown {
  // LCS-based score (relative order)
  const lcsLength = longestCommonSubsequence(userSequence, correctSequence);
  const relativeOrderScore = (lcsLength / correctSequence.length) * 100;

  // Exact position matches
  let exactMatches = 0;
  for (let i = 0; i < userSequence.length; i++) {
    if (userSequence[i] === correctSequence[i]) {
      exactMatches++;
    }
  }
  const exactPositionScore = (exactMatches / correctSequence.length) * 100;

  // Inversion-based score (organization)
  const inversions = countInversions(userSequence, correctSequence);
  const maxInversions =
    (correctSequence.length * (correctSequence.length - 1)) / 2;
  const inversionScore = Math.max(
    0,
    ((maxInversions - inversions) / maxInversions) * 100,
  );

  // Weighted final score
  // - 50% for relative order (LCS)
  // - 30% for exact positions
  // - 20% for organization (inversions)
  const finalScore = Math.round(
    relativeOrderScore * 0.5 + exactPositionScore * 0.3 + inversionScore * 0.2,
  );

  return {
    finalScore,
    exactMatches,
    lcsLength,
    inversions,
    relativeOrderScore: Math.round(relativeOrderScore),
    exactPositionScore: Math.round(exactPositionScore),
    inversionScore: Math.round(inversionScore),
    elapsedTime: Math.floor((Date.now() - startTime) / 1000),
    numbersRevealed,
  };
}
```

### 3.3 Card Placement Logic

**Challenge**: Maintaining array compaction (no gaps) when placing/removing cards

**Approach**:

```typescript
// utils/validation.ts

/**
 * Place a card at a specific position, shifting existing cards
 * Returns new placedCards array with no gaps
 */
export function placeCardAtPosition(
  placedCards: (SortingCard | null)[],
  cardToPlace: SortingCard,
  position: number,
  totalSlots: number,
): (SortingCard | null)[] {
  // Create working array
  const newPlaced = new Array(totalSlots).fill(null);

  // Copy existing cards, shifting those at/after position
  for (let i = 0; i < placedCards.length; i++) {
    if (placedCards[i] !== null) {
      if (i < position) {
        // Before insert position - stays same
        newPlaced[i] = placedCards[i];
      } else {
        // At or after position - shift right
        if (i + 1 < totalSlots) {
          newPlaced[i + 1] = placedCards[i];
        }
      }
    }
  }

  // Place new card
  newPlaced[position] = cardToPlace;

  // Compact to remove gaps (shift all cards left)
  const compacted: SortingCard[] = [];
  for (const card of newPlaced) {
    if (card !== null) {
      compacted.push(card);
    }
  }

  // Fill final array
  const result = new Array(totalSlots).fill(null);
  for (let i = 0; i < Math.min(compacted.length, totalSlots); i++) {
    result[i] = compacted[i];
  }

  // Any excess cards are returned (shouldn't happen)
  const excess = compacted.slice(totalSlots);

  return { placedCards: result, excessCards: excess };
}

/**
 * Remove card at position
 */
export function removeCardAtPosition(
  placedCards: (SortingCard | null)[],
  position: number,
): { placedCards: (SortingCard | null)[]; removedCard: SortingCard | null } {
  const removedCard = placedCards[position];

  if (!removedCard) {
    return { placedCards, removedCard: null };
  }

  // Remove card and compact
  const compacted: SortingCard[] = [];
  for (let i = 0; i < placedCards.length; i++) {
    if (i !== position && placedCards[i] !== null) {
      compacted.push(placedCards[i]!);
    }
  }

  // Fill new array
  const newPlaced = new Array(placedCards.length).fill(null);
  for (let i = 0; i < compacted.length; i++) {
    newPlaced[i] = compacted[i];
  }

  return { placedCards: newPlaced, removedCard };
}
```

### 3.4 Styling with Panda CSS

**Pattern**: Use Panda CSS `css()` function for all styling

**Key Style Patterns**:

```typescript
// Gradient for position slots
const slotGradient = (position: number, total: number) => {
  const intensity = position / (total - 1);
  const lightness = 30 + intensity * 45; // 30% to 75%

  return css({
    background: `hsl(220, 8%, ${lightness}%)`,
    color: lightness > 60 ? "#2c3e50" : "#ffffff",
    borderColor: lightness > 60 ? "#2c5f76" : "rgba(255,255,255,0.4)",
    padding: "1rem",
    borderRadius: "8px",
    border: "2px solid",
    transition: "all 0.3s ease",
    cursor: "pointer",

    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  });
};

// Card styling
const cardStyle = css({
  background: "white",
  borderRadius: "8px",
  padding: "0.5rem",
  border: "2px solid",
  borderColor: "gray.300",
  cursor: "pointer",
  transition: "all 0.2s ease",
  position: "relative",

  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
    borderColor: "blue.500",
  },

  "&.selected": {
    borderColor: "blue.600",
    background: "blue.50",
    transform: "scale(1.05)",
  },

  "&.placed": {
    opacity: 0.7,
    transform: "scale(0.95)",
  },

  "&.correct": {
    borderColor: "green.500",
    background: "green.50",
  },

  "&.incorrect": {
    borderColor: "red.500",
    background: "red.50",
    animation: "shake 0.5s ease",
  },
});

// Shake animation (for incorrect cards)
const shakeAnimation = css.raw({
  "@keyframes shake": {
    "0%, 100%": { transform: "translateX(0)" },
    "25%": { transform: "translateX(-10px)" },
    "75%": { transform: "translateX(10px)" },
  },
});
```

---

## 4. Game Registration

### 4.1 Game Definition (index.ts)

```typescript
import { defineGame } from "@/lib/arcade/game-sdk";
import type { GameManifest } from "@/lib/arcade/game-sdk";
import { GameComponent } from "./components/GameComponent";
import { CardSortingProvider } from "./Provider";
import { cardSortingValidator } from "./Validator";
import type {
  CardSortingConfig,
  CardSortingMove,
  CardSortingState,
} from "./types";

const manifest: GameManifest = {
  name: "card-sorting",
  displayName: "Card Sorting Challenge",
  icon: "🔢",
  description: "Sort abacus cards using pattern recognition",
  longDescription:
    "Challenge your abacus reading skills! Arrange cards in ascending order using only " +
    "the visual patterns - no numbers shown. Perfect for practicing number recognition and " +
    "developing mental math intuition.",
  maxPlayers: 1, // Single player only
  difficulty: "Intermediate",
  chips: ["🧠 Pattern Recognition", "🎯 Solo Challenge", "📊 Smart Scoring"],
  color: "teal",
  gradient: "linear-gradient(135deg, #99f6e4, #5eead4)",
  borderColor: "teal.200",
  available: true,
};

const defaultConfig: CardSortingConfig = {
  cardCount: 8,
  showNumbers: true,
  timeLimit: null,
};

function validateCardSortingConfig(
  config: unknown,
): config is CardSortingConfig {
  if (typeof config !== "object" || config === null) return false;

  const c = config as any;

  if (!("cardCount" in c) || ![5, 8, 12, 15].includes(c.cardCount)) {
    return false;
  }

  if (!("showNumbers" in c) || typeof c.showNumbers !== "boolean") {
    return false;
  }

  if ("timeLimit" in c) {
    if (
      c.timeLimit !== null &&
      (typeof c.timeLimit !== "number" || c.timeLimit < 30)
    ) {
      return false;
    }
  }

  return true;
}

export const cardSortingGame = defineGame<
  CardSortingConfig,
  CardSortingState,
  CardSortingMove
>({
  manifest,
  Provider: CardSortingProvider,
  GameComponent,
  validator: cardSortingValidator,
  defaultConfig,
  validateConfig: validateCardSortingConfig,
});
```

### 4.2 Registration in game-registry.ts

```typescript
// Add import
import { cardSortingGame } from "@/arcade-games/card-sorting";

// Add registration
registerGame(cardSortingGame);
```

### 4.3 Validator Registration

```typescript
// src/lib/arcade/validators.ts

import { cardSortingValidator } from "@/arcade-games/card-sorting/Validator";

export const validatorRegistry = {
  matching: matchingGameValidator,
  "memory-quiz": memoryQuizGameValidator,
  "complement-race": complementRaceValidator,
  "card-sorting": cardSortingValidator, // ADD THIS
} as const;
```

### 4.4 Config Types

```typescript
// src/lib/arcade/game-configs.ts

import type { cardSortingGame } from "@/arcade-games/card-sorting";

export type CardSortingGameConfig = InferGameConfig<typeof cardSortingGame>;

export type GameConfigByName = {
  "memory-quiz": MemoryQuizGameConfig;
  matching: MatchingGameConfig;
  "complement-race": ComplementRaceGameConfig;
  "card-sorting": CardSortingGameConfig; // ADD THIS
};

export const DEFAULT_CARD_SORTING_CONFIG: CardSortingGameConfig = {
  cardCount: 8,
  showNumbers: true,
  timeLimit: null,
};
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

**Scoring algorithms** (utils/scoringAlgorithm.test.ts):

```typescript
describe("longestCommonSubsequence", () => {
  it("should return length of identical sequences", () => {
    expect(longestCommonSubsequence([1, 2, 3], [1, 2, 3])).toBe(3);
  });

  it("should find LCS in scrambled sequence", () => {
    expect(longestCommonSubsequence([3, 1, 2], [1, 2, 3])).toBe(2); // [1,2]
  });
});

describe("countInversions", () => {
  it("should return 0 for sorted sequence", () => {
    expect(countInversions([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("should count inversions correctly", () => {
    expect(countInversions([3, 2, 1], [1, 2, 3])).toBe(3);
  });
});

describe("calculateScore", () => {
  it("should return 100% for perfect solution", () => {
    const result = calculateScore([1, 2, 3], [1, 2, 3], Date.now(), false);
    expect(result.finalScore).toBe(100);
  });

  it("should apply weighted scoring correctly", () => {
    const result = calculateScore([2, 1, 3], [1, 2, 3], Date.now(), false);
    // Should be less than 100 but greater than 0
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThan(100);
  });
});
```

**Card placement logic** (utils/validation.test.ts):

```typescript
describe("placeCardAtPosition", () => {
  it("should place card in empty slot", () => {
    const placed = [null, null, null];
    const card = { id: "1", number: 5, svgContent: "" };
    const result = placeCardAtPosition(placed, card, 0, 3);

    expect(result.placedCards[0]).toBe(card);
    expect(result.placedCards[1]).toBe(null);
  });

  it("should shift existing cards when inserting", () => {
    const card1 = { id: "1", number: 5, svgContent: "" };
    const card2 = { id: "2", number: 3, svgContent: "" };
    const placed = [card1, null, null];

    const result = placeCardAtPosition(placed, card2, 0, 3);

    expect(result.placedCards[0]).toBe(card2);
    expect(result.placedCards[1]).toBe(card1);
  });
});
```

### 5.2 Integration Tests

**Validator** (Validator.test.ts):

```typescript
describe('CardSortingValidator', () => {
  const validator = new CardSortingValidator()

  describe('validateMove', () => {
    it('should validate PLACE_CARD move', () => {
      const state = validator.getInitialState({ cardCount: 5, ... })
      // ... setup state with cards

      const move = {
        type: 'PLACE_CARD',
        data: { cardId: 'card-1', position: 0 }
      }

      const result = validator.validateMove(state, move)
      expect(result.valid).toBe(true)
    })

    it('should reject CHECK_SOLUTION when not all cards placed', () => {
      const state = validator.getInitialState({ cardCount: 5, ... })
      // ... partial placement

      const move = { type: 'CHECK_SOLUTION', ... }
      const result = validator.validateMove(state, move)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('place all cards')
    })
  })
})
```

### 5.3 E2E Tests (Playwright)

**Full game flow**:

```typescript
test("complete card sorting game flow", async ({ page }) => {
  // Navigate to arcade room
  await page.goto("/arcade/room/test-room");

  // Start card sorting game
  await page.click('[data-game="card-sorting"]');

  // Setup phase
  await page.click('[data-card-count="5"]');
  await page.click('button:has-text("Start New Game")');

  // Playing phase
  await expect(page.locator(".available-cards")).toBeVisible();
  await expect(page.locator(".position-slots")).toBeVisible();

  // Place all 5 cards (automated for test)
  for (let i = 0; i < 5; i++) {
    await page.click(".available-cards .sort-card").first();
    await page.click(`.position-slot[data-position="${i}"]`);
  }

  // Check solution
  await page.click('button:has-text("Check Solution")');

  // Results phase
  await expect(page.locator(".results-phase")).toBeVisible();
  await expect(page.locator(':text("Your Score:")')).toBeVisible();
});
```

---

## 6. Migration Checklist

### Phase 1: Setup & Types (Day 1 Morning)

- [ ] Create directory structure
- [ ] Define types.ts (Config, State, Moves)
- [ ] Create Validator.ts skeleton
- [ ] Set up unit test files
- [ ] Register game in game-registry.ts
- [ ] Add to validators.ts
- [ ] Add config types to game-configs.ts

### Phase 2: Core Logic (Day 1 Afternoon)

- [ ] Implement scoring algorithms (LCS, inversions)
- [ ] Write unit tests for scoring
- [ ] Implement card generation utilities
- [ ] Implement placement logic utilities
- [ ] Write tests for placement logic
- [ ] Complete Validator implementation
- [ ] Write validator integration tests

### Phase 3: Provider & Components (Day 2 Morning)

- [ ] Implement Provider.tsx
- [ ] Create SetupPhase.tsx
- [ ] Create PlayingPhase.tsx component structure
- [ ] Implement card selection/placement interaction
- [ ] Test with mock state

### Phase 4: UI Polish & Results (Day 2 Afternoon)

- [ ] Complete ResultsPhase.tsx
- [ ] Implement timer display
- [ ] Add gradient styling for slots
- [ ] Add animations (card placement, shake for incorrect)
- [ ] Responsive design testing
- [ ] Accessibility (keyboard navigation)

### Phase 5: Testing & Refinement (Day 2 Evening)

- [ ] Manual testing full flow
- [ ] Write E2E tests
- [ ] Test config persistence
- [ ] Test pause/resume
- [ ] Performance testing (15 cards)
- [ ] Fix any bugs
- [ ] Code review & cleanup

### Phase 6: Documentation (Bonus)

- [ ] Update README.md
- [ ] Add JSDoc comments
- [ ] Create gameplay screenshots
- [ ] Update arcade games list

---

## 7. Known Challenges & Solutions

### Challenge 1: Rendering AbacusReact to String

**Issue**: Need SVG string for serialization, but AbacusReact is a React component

**Solution**: Use `renderToString` from `react-dom/server`

```typescript
import { renderToString } from 'react-dom/server'

const svgContent = renderToString(
  <AbacusReact value={number} width={200} height={120} />
)
```

**Alternative**: Pre-generate SVG strings for common values (0-99) and cache them

### Challenge 2: Card Array Compaction

**Issue**: Complex logic for maintaining no-gap array when inserting/removing

**Solution**:

- Extract to utility function with thorough tests
- Use two-pass approach: calculate new positions, then compact
- Return excess cards separately if overflow occurs

### Challenge 3: State Synchronization (Selected Card)

**Issue**: Selected card is UI-only state, shouldn't be in server state

**Solution**:

- Keep `selectedCardId` in local state (Provider's `localUIState`)
- Don't include in moves or server state
- Clear on successful placement

### Challenge 4: Timer in Single-Player

**Issue**: Timer should run client-side, not in server state

**Solution**:

- Store only `gameStartTime` in server state
- Calculate `elapsedTime` as computed value in Provider
- Use `useEffect` + `setInterval` for live updates

### Challenge 5: Scoring Algorithm Performance

**Issue**: LCS algorithm is O(n²), might be slow for 15 cards

**Solution**:

- 15 cards = 225 operations, negligible
- Run on server-side (Validator) only when checking solution
- No real-time performance concerns

---

## 8. Future Enhancements (Out of Scope)

**Multiplayer Mode**:

- Race mode: First to complete wins
- Turn-based: Take turns placing cards
- Collaborative: Work together on same puzzle

**Advanced Features**:

- Leaderboard (best scores per difficulty)
- Daily challenge (same cards for everyone)
- Hint system (show correct position for one card)
- Undo/redo functionality
- Custom card ranges (two-digit only, three-digit, etc.)

**Accessibility**:

- Keyboard-only controls (arrow keys + space)
- Screen reader announcements
- High contrast mode
- Configurable card sizes

---

## 9. Success Criteria

**Functional Requirements**:
✅ Player can select difficulty (5, 8, 12, 15 cards)
✅ Cards display only abacus patterns (no numbers)
✅ Cards can be placed/removed via click interaction
✅ Reveal numbers button works (if enabled)
✅ Timer tracks elapsed time
✅ Scoring algorithm matches original (LCS + exact + inversions)
✅ Results show detailed breakdown
✅ Config persists to database
✅ Pause/resume works

**Technical Requirements**:
✅ Follows arcade SDK patterns (defineGame, Validator, Provider)
✅ Uses Panda CSS for styling
✅ Type-safe (no `any` types)
✅ Passes all unit tests
✅ Passes validator tests
✅ E2E test covers full flow
✅ No console errors/warnings
✅ Responsive on mobile/tablet/desktop

**UX Requirements**:
✅ Smooth animations (card placement, results)
✅ Clear visual feedback (selected card, correct/incorrect)
✅ Intuitive controls (click-to-select, click-to-place)
✅ Accessible (keyboard, screen readers)
✅ Performant (60fps animations, instant interaction)

---

## 10. Appendix

### A. File Sizes Estimate

```
index.ts                 ~80 lines
types.ts                 ~350 lines
Provider.tsx             ~500 lines
Validator.ts             ~600 lines
GameComponent.tsx        ~100 lines
SetupPhase.tsx           ~150 lines
PlayingPhase.tsx         ~400 lines
ResultsPhase.tsx         ~300 lines
SortingCard.tsx          ~100 lines
PositionSlot.tsx         ~80 lines
cardGeneration.ts        ~100 lines
scoringAlgorithm.ts      ~200 lines
validation.ts            ~150 lines
-----------------------------------
TOTAL:                   ~3,110 lines
```

### B. Dependencies

**New dependencies**: None - all required packages already in project

- `@soroban/abacus-react` (already installed)
- `react-dom/server` (already available)
- Panda CSS (already configured)

### C. Performance Benchmarks

**Expected performance**:

- Card generation (15 cards): <50ms
- LCS calculation (15 cards): <5ms
- Inversion count (15 cards): <2ms
- Full score calculation: <10ms
- Card placement validation: <1ms
- State update cycle: <16ms (60fps)

### D. Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical (cards → slots → buttons)
- [ ] Focus indicators visible
- [ ] ARIA labels for abacus SVGs
- [ ] Screen reader announcements for state changes
- [ ] Color contrast meets WCAG AA
- [ ] No reliance on color alone for feedback

---

## Summary

This plan provides a complete blueprint for porting the Card Sorting Challenge to the arcade platform. The game is well-scoped for single-player, has clear mechanics, and leverages existing patterns from matching/memory-quiz games.

**Key Simplifications vs Multiplayer Games**:

- No turn management
- No player-vs-player scoring
- Simpler state (one player, one set of cards)
- No real-time synchronization needs

**Key Complexities**:

- Sophisticated scoring algorithm (3 metrics)
- Card placement/removal logic (array compaction)
- Detailed results visualization

**Timeline**: 1-2 days for experienced developer familiar with the codebase

**Risk Level**: Low - well-defined scope, proven algorithms, existing patterns to follow
