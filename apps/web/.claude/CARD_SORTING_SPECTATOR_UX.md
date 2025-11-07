# Card Sorting Challenge - Spectator Mode UX Enhancements

**Date**: 2025-10-18
**Status**: Specification
**Priority**: Optional Enhancement (game is production-ready without these)

## Overview

The Card Sorting Challenge correctly implements spectator mode functionally - spectators cannot make moves. However, the UI doesn't provide visual feedback to indicate spectator status. This spec adds clear visual indicators and disabled states.

## Goals

1. **Clarity**: Users immediately understand if they're playing or spectating
2. **Visual Feedback**: Disabled controls clearly indicate non-interactive state
3. **Engagement**: Spectators feel connected to the game even while watching
4. **Testing**: Verify spectator mode works as designed

## Current Behavior

**Functional (Correct)**:

- ✅ Actions check `if (!localPlayerId) return` before sending moves
- ✅ Spectators cannot start game, place cards, or check solution
- ✅ Spectators receive real-time state updates

**Missing (UX Gap)**:

- ❌ No visual indicator that user is spectating
- ❌ Buttons appear clickable but don't respond
- ❌ No context about whose game is being watched
- ❌ `localPlayerId` not exposed in context (needed for UI decisions)

---

## Enhancement 1: Expose `localPlayerId` in Context

### Location

`/src/arcade-games/card-sorting/Provider.tsx`

### Changes

**Add to `CardSortingContextValue` interface** (line 14):

```typescript
interface CardSortingContextValue {
  state: CardSortingState;
  // Actions
  startGame: () => void;
  placeCard: (cardId: string, position: number) => void;
  insertCard: (cardId: string, insertPosition: number) => void;
  removeCard: (position: number) => void;
  checkSolution: () => void;
  revealNumbers: () => void;
  goToSetup: () => void;
  resumeGame: () => void;
  setConfig: (
    field: "cardCount" | "showNumbers" | "timeLimit",
    value: unknown,
  ) => void;
  exitSession: () => void;
  // Computed
  canCheckSolution: boolean;
  placedCount: number;
  elapsedTime: number;
  hasConfigChanged: boolean;
  canResumeGame: boolean;
  // UI state
  selectedCardId: string | null;
  selectCard: (cardId: string | null) => void;
  localPlayerId: string | undefined; // ✨ NEW: Expose for spectator checks
  isSpectating: boolean; // ✨ NEW: Derived flag for convenience
}
```

**Update context value** (line 527):

```typescript
const contextValue: CardSortingContextValue = {
  state,
  // Actions
  startGame,
  placeCard,
  insertCard,
  removeCard,
  checkSolution,
  revealNumbers,
  goToSetup,
  resumeGame,
  setConfig,
  exitSession,
  // Computed
  canCheckSolution,
  placedCount,
  elapsedTime,
  hasConfigChanged,
  canResumeGame,
  // UI state
  selectedCardId,
  selectCard: setSelectedCardId,
  localPlayerId, // ✨ NEW
  isSpectating: !localPlayerId, // ✨ NEW: Convenience flag
};
```

### Rationale

- Components need `localPlayerId` to determine spectator vs player state
- `isSpectating` is a convenience flag to avoid `!localPlayerId` checks everywhere
- Makes spectator mode a first-class concept in the API

---

## Enhancement 2: Spectator Indicator Banner

### Location

`/src/arcade-games/card-sorting/components/GameComponent.tsx`

### Visual Design

**Banner Appearance**:

```
┌─────────────────────────────────────────────────────┐
│ 👀 Spectating Alice 👧's game                       │
│ You're watching this game. Add a player to join!   │
└─────────────────────────────────────────────────────┘
```

**Styling**:

- Background: `rgba(59, 130, 246, 0.1)` (soft blue, semi-transparent)
- Border: `1px solid rgba(59, 130, 246, 0.3)` (blue.500 with opacity)
- Border radius: `8px`
- Padding: `12px 16px`
- Margin bottom: `16px`
- Font size: `14px` (base), `16px` (md+)
- Color: `blue.700` (dark blue for readability)
- Icon: 👀 (eyes emoji)
- Position: Top of game area, before phase content

### Implementation

**Add banner component**:

```typescript
// Add after existing imports
import { useCardSorting } from '../Provider'

export function GameComponent() {
  const router = useRouter()
  const {
    state,
    exitSession,
    startGame,
    goToSetup,
    localPlayerId,    // ✨ NEW
    isSpectating      // ✨ NEW
  } = useCardSorting()
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)

  // ... existing useEffect

  return (
    <PageWithNav
      navTitle="Card Sorting"
      navEmoji="🔢"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
      onSetup={
        goToSetup
          ? () => {
              goToSetup()
            }
          : undefined
      }
      onNewGame={() => {
        startGame()
      }}
    >
      <StandardGameLayout>
        <div
          ref={gameRef}
          className={css({
            flex: 1,
            padding: { base: '12px', sm: '16px', md: '20px' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'auto',
          })}
        >
          <main
            className={css({
              width: '100%',
              maxWidth: '1200px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: { base: '12px', md: '20px' },
              padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            })}
          >
            {/* ✨ NEW: Spectator Banner */}
            {isSpectating && state.gamePhase !== 'setup' && (
              <div
                className={css({
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: { base: '12px 16px', md: '16px 20px' },
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                })}
              >
                <div
                  className={css({
                    fontSize: { base: '14px', md: '16px' },
                    fontWeight: 600,
                    color: 'blue.700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  })}
                >
                  <span>👀</span>
                  <span>
                    Spectating {state.playerMetadata.name || 'player'} {state.playerMetadata.emoji}'s game
                  </span>
                </div>
                <div
                  className={css({
                    fontSize: { base: '12px', md: '14px' },
                    color: 'blue.600',
                  })}
                >
                  You're watching this game. Add a player to join!
                </div>
              </div>
            )}

            {state.gamePhase === 'setup' && <SetupPhase />}
            {state.gamePhase === 'playing' && <PlayingPhase />}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>
    </PageWithNav>
  )
}
```

### Behavior

**Show Banner When**:

- ✅ `isSpectating === true` (no local player)
- ✅ `state.gamePhase === 'playing'` OR `state.gamePhase === 'results'`
- ❌ NOT during setup phase (handled separately below)

**Hide Banner When**:

- User has an active local player
- Game is in setup phase (use setup phase spectator prompt instead)

### Setup Phase Spectator Handling

During setup, spectators should see a different message encouraging them to add a player:

**Location**: `/src/arcade-games/card-sorting/components/SetupPhase.tsx`

```typescript
export function SetupPhase() {
  const { isSpectating } = useCardSorting()

  return (
    <div>
      {/* ✨ NEW: Setup phase spectator prompt */}
      {isSpectating && (
        <div
          className={css({
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: { base: '12px 16px', md: '16px 20px' },
            marginBottom: '16px',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: { base: '14px', md: '16px' },
              fontWeight: 600,
              color: 'blue.700',
              marginBottom: '8px',
            })}
          >
            👤 Add a Player to Start
          </div>
          <div
            className={css({
              fontSize: { base: '12px', md: '14px' },
              color: 'blue.600',
            })}
          >
            Click "Add Player" in the top-right to join the game
          </div>
        </div>
      )}

      {/* Existing setup content */}
      {/* ... */}
    </div>
  )
}
```

---

## Enhancement 3: Visual Disabled States

### Location

All interactive components in:

- `/src/arcade-games/card-sorting/components/SetupPhase.tsx`
- `/src/arcade-games/card-sorting/components/PlayingPhase.tsx`
- `/src/arcade-games/card-sorting/components/ResultsPhase.tsx`

### Visual Design

**Disabled Button Styling**:

```typescript
const disabledStyles = {
  opacity: 0.5,
  cursor: "not-allowed",
  pointerEvents: "none", // Prevent all interactions
};
```

**Disabled Card Styling**:

```typescript
const disabledCardStyles = {
  opacity: 0.6,
  cursor: "default",
  pointerEvents: "none",
};
```

### Implementation by Phase

#### A. Setup Phase

**File**: `/src/arcade-games/card-sorting/components/SetupPhase.tsx`

**Changes**:

```typescript
export function SetupPhase() {
  const {
    state,
    setConfig,
    startGame,
    resumeGame,
    canResumeGame,
    isSpectating  // ✨ NEW
  } = useCardSorting()

  return (
    <div>
      {/* Spectator prompt (see Enhancement 2) */}
      {/* ... */}

      {/* Configuration Controls */}
      <div className={css({ /* ... */ })}>
        {/* Card Count Selector */}
        <button
          onClick={() => setConfig('cardCount', 6)}
          disabled={isSpectating}  // ✨ NEW
          className={css({
            /* existing styles */
            ...(isSpectating ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          6 Cards
        </button>

        {/* Show Numbers Toggle */}
        <button
          onClick={() => setConfig('showNumbers', !state.showNumbers)}
          disabled={isSpectating}  // ✨ NEW
          className={css({
            /* existing styles */
            ...(isSpectating ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          {state.showNumbers ? '👁️ Hide Numbers' : '🙈 Show Numbers'}
        </button>

        {/* Start Game Button */}
        <button
          onClick={startGame}
          disabled={isSpectating}  // ✨ NEW
          className={css({
            /* existing styles */
            ...(isSpectating ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          Start Game
        </button>

        {/* Resume Game Button */}
        {canResumeGame && (
          <button
            onClick={resumeGame}
            disabled={isSpectating}  // ✨ NEW
            className={css({
              /* existing styles */
              ...(isSpectating ? {
                opacity: 0.5,
                cursor: 'not-allowed',
                pointerEvents: 'none',
              } : {}),
            })}
          >
            Resume Paused Game
          </button>
        )}
      </div>
    </div>
  )
}
```

#### B. Playing Phase

**File**: `/src/arcade-games/card-sorting/components/PlayingPhase.tsx`

**Changes**:

```typescript
export function PlayingPhase() {
  const {
    state,
    placeCard,
    insertCard,
    removeCard,
    revealNumbers,
    checkSolution,
    canCheckSolution,
    selectedCardId,
    selectCard,
    isSpectating  // ✨ NEW
  } = useCardSorting()

  return (
    <div>
      {/* Available Cards */}
      <div className={css({ /* card grid */ })}>
        {state.availableCards.map((card) => (
          <button
            key={card.id}
            onClick={() => !isSpectating && selectCard(card.id)}  // ✨ NEW
            disabled={isSpectating}  // ✨ NEW
            className={css({
              /* existing card styles */
              ...(isSpectating ? {
                opacity: 0.6,
                cursor: 'default',
                pointerEvents: 'none',
              } : {
                cursor: 'pointer',
              }),
              ...(selectedCardId === card.id ? {
                /* selected styles */
              } : {}),
            })}
          >
            {/* Card content */}
          </button>
        ))}
      </div>

      {/* Placement Slots */}
      <div className={css({ /* slot grid */ })}>
        {state.placedCards.map((card, position) => (
          <div
            key={position}
            onClick={() => {
              if (isSpectating) return  // ✨ NEW
              if (selectedCardId) {
                placeCard(selectedCardId, position)
              } else if (card) {
                removeCard(position)
              }
            }}
            className={css({
              /* existing slot styles */
              ...(isSpectating ? {
                cursor: 'default',
                opacity: 0.8,
              } : {
                cursor: card ? 'pointer' : 'copy',
              }),
            })}
          >
            {card ? (
              <div>{/* Placed card content */}</div>
            ) : (
              <div
                className={css({
                  color: isSpectating ? 'gray.300' : 'gray.400',  // ✨ NEW
                })}
              >
                {position + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className={css({ /* button row */ })}>
        {!state.numbersRevealed && (
          <button
            onClick={revealNumbers}
            disabled={isSpectating}  // ✨ NEW
            className={css({
              /* existing styles */
              ...(isSpectating ? {
                opacity: 0.5,
                cursor: 'not-allowed',
                pointerEvents: 'none',
              } : {}),
            })}
          >
            👁️ Reveal Numbers
          </button>
        )}

        <button
          onClick={checkSolution}
          disabled={isSpectating || !canCheckSolution}  // ✨ UPDATED
          className={css({
            /* existing styles */
            ...((isSpectating || !canCheckSolution) ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          ✓ Check Solution
        </button>
      </div>
    </div>
  )
}
```

#### C. Results Phase

**File**: `/src/arcade-games/card-sorting/components/ResultsPhase.tsx`

**Changes**:

```typescript
export function ResultsPhase() {
  const {
    state,
    startGame,
    goToSetup,
    isSpectating  // ✨ NEW
  } = useCardSorting()

  return (
    <div>
      {/* Results Display */}
      {/* ... score, time, etc. ... */}

      {/* Action Buttons */}
      <div className={css({ /* button row */ })}>
        <button
          onClick={startGame}
          disabled={isSpectating}  // ✨ NEW
          className={css({
            /* existing styles */
            ...(isSpectating ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          Play Again
        </button>

        <button
          onClick={goToSetup}
          disabled={isSpectating}  // ✨ NEW
          className={css({
            /* existing styles */
            ...(isSpectating ? {
              opacity: 0.5,
              cursor: 'not-allowed',
              pointerEvents: 'none',
            } : {}),
          })}
        >
          Change Settings
        </button>
      </div>
    </div>
  )
}
```

---

## Enhancement 4: Spectator Mode Tests

### Location

Create new file: `/src/arcade-games/card-sorting/__tests__/spectator-mode.test.tsx`

### Test Suite

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardSortingProvider } from '../Provider'
import { GameComponent } from '../components/GameComponent'

// Mock hooks
vi.mock('@/hooks/useViewerId', () => ({
  useViewerId: () => ({ data: 'user_123' }),
}))

vi.mock('@/hooks/useRoomData', () => ({
  useRoomData: () => ({
    roomData: {
      id: 'room_abc',
      gameConfig: {},
    }
  }),
  useUpdateGameConfig: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/contexts/GameModeContext', () => ({
  useGameMode: () => ({
    activePlayers: new Set(),  // No active players = spectating
    players: new Map(),
  }),
}))

vi.mock('@/hooks/useArcadeSession', () => ({
  useArcadeSession: () => ({
    state: {
      gamePhase: 'playing',
      playerId: 'player_456',
      playerMetadata: {
        id: 'player_456',
        name: 'Alice',
        emoji: '👧',
        userId: 'user_456',
      },
      cardCount: 8,
      showNumbers: true,
      timeLimit: null,
      gameStartTime: Date.now() - 30000,
      gameEndTime: null,
      selectedCards: [],
      correctOrder: [],
      availableCards: [],
      placedCards: new Array(8).fill(null),
      selectedCardId: null,
      numbersRevealed: false,
      scoreBreakdown: null,
    },
    sendMove: vi.fn(),
    exitSession: vi.fn(),
  }),
}))

describe('Card Sorting - Spectator Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Spectator Indicator Banner', () => {
    it('should show spectator banner when no local player', () => {
      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      expect(screen.getByText(/Spectating Alice 👧's game/i)).toBeInTheDocument()
      expect(screen.getByText(/You're watching this game/i)).toBeInTheDocument()
    })

    it('should not show spectator banner when user has active player', () => {
      // Override mock to have active player
      vi.mocked(useGameMode).mockReturnValue({
        activePlayers: new Set(['player_123']),
        players: new Map([
          ['player_123', { id: 'player_123', isLocal: true }],
        ]),
      })

      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      expect(screen.queryByText(/Spectating/i)).not.toBeInTheDocument()
    })

    it('should show setup phase spectator prompt during setup', () => {
      // Override to setup phase
      vi.mocked(useArcadeSession).mockReturnValue({
        state: { gamePhase: 'setup', /* ... */ },
        sendMove: vi.fn(),
        exitSession: vi.fn(),
      })

      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      expect(screen.getByText(/Add a Player to Start/i)).toBeInTheDocument()
      expect(screen.getByText(/Click "Add Player"/i)).toBeInTheDocument()
    })
  })

  describe('Disabled Controls', () => {
    it('should disable all buttons when spectating', () => {
      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      const buttons = screen.getAllByRole('button')
      const gameActionButtons = buttons.filter(
        (btn) => !btn.closest('[data-nav="true"]') // Exclude nav buttons
      )

      gameActionButtons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('should not allow card placement when spectating', async () => {
      const sendMove = vi.fn()
      vi.mocked(useArcadeSession).mockReturnValue({
        state: {
          gamePhase: 'playing',
          availableCards: [{ id: 'card_1', number: 5, abacus: null }],
          placedCards: new Array(8).fill(null),
          /* ... */
        },
        sendMove,
        exitSession: vi.fn(),
      })

      const user = userEvent.setup()

      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      // Try to click a card
      const card = screen.getByText('5')
      await user.click(card)

      // sendMove should NOT be called
      expect(sendMove).not.toHaveBeenCalled()
    })

    it('should not allow checking solution when spectating', async () => {
      const sendMove = vi.fn()
      vi.mocked(useArcadeSession).mockReturnValue({
        state: {
          gamePhase: 'playing',
          placedCards: new Array(8).fill({ id: 'card', number: 1 }), // All filled
          /* ... */
        },
        sendMove,
        exitSession: vi.fn(),
      })

      const user = userEvent.setup()

      render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      const checkButton = screen.getByText(/Check Solution/i)
      expect(checkButton).toBeDisabled()

      await user.click(checkButton)
      expect(sendMove).not.toHaveBeenCalled()
    })
  })

  describe('State Synchronization', () => {
    it('should receive real-time updates as spectator', async () => {
      const { rerender } = render(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      // Simulate state update from active player
      vi.mocked(useArcadeSession).mockReturnValue({
        state: {
          gamePhase: 'playing',
          placedCards: [
            { id: 'card_1', number: 5, abacus: null },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          /* ... */
        },
        sendMove: vi.fn(),
        exitSession: vi.fn(),
      })

      rerender(
        <CardSortingProvider>
          <GameComponent />
        </CardSortingProvider>
      )

      // Should see the placed card
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })
  })

  describe('Context Exposure', () => {
    it('should expose localPlayerId in context', () => {
      const TestComponent = () => {
        const { localPlayerId } = useCardSorting()
        return <div data-testid="player-id">{localPlayerId || 'none'}</div>
      }

      render(
        <CardSortingProvider>
          <TestComponent />
        </CardSortingProvider>
      )

      expect(screen.getByTestId('player-id')).toHaveTextContent('none')
    })

    it('should expose isSpectating flag in context', () => {
      const TestComponent = () => {
        const { isSpectating } = useCardSorting()
        return <div data-testid="spectating">{String(isSpectating)}</div>
      }

      render(
        <CardSortingProvider>
          <TestComponent />
        </CardSortingProvider>
      )

      expect(screen.getByTestId('spectating')).toHaveTextContent('true')
    })
  })
})
```

---

## Enhancement 5: Player Ownership Tests

### Location

Create new file: `/src/arcade-games/card-sorting/__tests__/player-ownership.test.tsx`

### Test Suite

```typescript
import { describe, it, expect } from "vitest";
import { CardSortingValidator } from "../Validator";
import type { CardSortingState, CardSortingMove } from "../types";

const validator = new CardSortingValidator();

describe("Card Sorting - Player Ownership Validation", () => {
  const createMockState = (): CardSortingState => ({
    gamePhase: "playing",
    playerId: "player_alice",
    playerMetadata: {
      id: "player_alice",
      name: "Alice",
      emoji: "👧",
      userId: "user_123",
    },
    cardCount: 8,
    showNumbers: true,
    timeLimit: null,
    gameStartTime: Date.now(),
    gameEndTime: null,
    selectedCards: [
      { id: "card_1", number: 1, abacus: null },
      { id: "card_2", number: 2, abacus: null },
    ],
    correctOrder: [
      { id: "card_1", number: 1, abacus: null },
      { id: "card_2", number: 2, abacus: null },
    ],
    availableCards: [
      { id: "card_1", number: 1, abacus: null },
      { id: "card_2", number: 2, abacus: null },
    ],
    placedCards: new Array(8).fill(null),
    selectedCardId: null,
    numbersRevealed: false,
    scoreBreakdown: null,
  });

  describe("Player ID Validation", () => {
    it("should accept move from correct player", () => {
      const state = createMockState();
      const move: CardSortingMove = {
        type: "PLACE_CARD",
        playerId: "player_alice",
        userId: "user_123",
        data: { cardId: "card_1", position: 0 },
      };

      const result = validator.validateMove(state, move, {
        activePlayers: ["player_alice"],
        playerOwnership: { player_alice: "user_123" },
      });

      expect(result.valid).toBe(true);
    });

    it("should reject move from player not in active players", () => {
      const state = createMockState();
      const move: CardSortingMove = {
        type: "PLACE_CARD",
        playerId: "player_bob", // Not in activePlayers
        userId: "user_456",
        data: { cardId: "card_1", position: 0 },
      };

      const result = validator.validateMove(state, move, {
        activePlayers: ["player_alice"], // Only Alice is active
        playerOwnership: {
          player_alice: "user_123",
          player_bob: "user_456",
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("PLAYER not in game");
    });

    it("should reject move when user does not own player", () => {
      const state = createMockState();
      const move: CardSortingMove = {
        type: "PLACE_CARD",
        playerId: "player_alice",
        userId: "user_456", // Wrong user ID
        data: { cardId: "card_1", position: 0 },
      };

      const result = validator.validateMove(state, move, {
        activePlayers: ["player_alice"],
        playerOwnership: { player_alice: "user_123" }, // Alice owned by user_123
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("USER does not own this PLAYER");
    });

    it("should reject move from spectator (no player ownership)", () => {
      const state = createMockState();
      const move: CardSortingMove = {
        type: "START_GAME",
        playerId: "player_spectator",
        userId: "user_999",
        data: {
          playerMetadata: {
            id: "player_spectator",
            name: "Spectator",
            emoji: "👀",
            userId: "user_999",
          },
          selectedCards: [],
        },
      };

      const result = validator.validateMove(state, move, {
        activePlayers: ["player_alice"], // Spectator not in active players
        playerOwnership: {
          player_alice: "user_123",
          player_spectator: "user_999",
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("PLAYER not in game");
    });
  });

  describe("Single Player Game Constraints", () => {
    it("should allow only one active player in the game", () => {
      const state = createMockState();

      // Card Sorting is single-player (maxPlayers: 1)
      // If somehow multiple players try to join, validator should reject

      const move: CardSortingMove = {
        type: "START_GAME",
        playerId: "player_bob",
        userId: "user_456",
        data: {
          playerMetadata: {
            id: "player_bob",
            name: "Bob",
            emoji: "👦",
            userId: "user_456",
          },
          selectedCards: [],
        },
      };

      // State already has player_alice playing
      const result = validator.validateMove(state, move, {
        activePlayers: ["player_alice", "player_bob"], // Two active players
        playerOwnership: {
          player_alice: "user_123",
          player_bob: "user_456",
        },
      });

      // Should reject if game is single-player only
      // (This depends on validator implementation)
      expect(result.valid).toBe(false);
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: Context Updates

- [ ] Add `localPlayerId` to `CardSortingContextValue` interface
- [ ] Add `isSpectating` to `CardSortingContextValue` interface
- [ ] Expose both in context value object
- [ ] Verify hook exports work correctly

### Phase 2: Spectator Indicators

- [ ] Add spectator banner to `GameComponent.tsx`
- [ ] Add setup phase spectator prompt to `SetupPhase.tsx`
- [ ] Test banner appears for spectators
- [ ] Test banner hidden for active players
- [ ] Test player name/emoji displayed correctly

### Phase 3: Disabled States

- [ ] Update `SetupPhase.tsx` buttons with disabled state
- [ ] Update `PlayingPhase.tsx` cards and buttons with disabled state
- [ ] Update `ResultsPhase.tsx` buttons with disabled state
- [ ] Test visual disabled styling appears
- [ ] Test interactions actually blocked

### Phase 4: Testing

- [ ] Create spectator mode test file
- [ ] Write spectator indicator tests
- [ ] Write disabled controls tests
- [ ] Write state synchronization tests
- [ ] Write context exposure tests
- [ ] Create player ownership test file
- [ ] Write player validation tests
- [ ] Write single-player constraint tests
- [ ] All tests pass

### Phase 5: Quality & Deploy

- [ ] Run `npm run pre-commit` (format, lint, type-check)
- [ ] Manual testing: Join room as spectator
- [ ] Manual testing: Verify banner appears
- [ ] Manual testing: Verify controls disabled
- [ ] Manual testing: Watch another player's game
- [ ] Manual testing: Add player and verify banner disappears
- [ ] Commit changes
- [ ] Push to remote

---

## Visual Examples

### Spectating During Playing Phase

```
┌───────────────────────────────────────────────────────┐
│ 👀 Spectating Alice 👧's game                         │
│ You're watching this game. Add a player to join!     │
└───────────────────────────────────────────────────────┘

        Available Cards (greyed out, not clickable)
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │  3  │  │  7  │  │  1  │  │  9  │  │  4  │
    └─────┘  └─────┘  └─────┘  └─────┘  └─────┘

            Placement Slots (not clickable)
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │  2  │  │  5  │  │  ─  │  │  ─  │  │  ─  │
    └─────┘  └─────┘  └─────┘  └─────┘  └─────┘

    [👁️ Reveal Numbers] [✓ Check Solution] (both disabled)
```

### Spectating During Setup Phase

```
┌───────────────────────────────────────────────────────┐
│            👤 Add a Player to Start                   │
│   Click "Add Player" in the top-right to join the    │
│                      game                             │
└───────────────────────────────────────────────────────┘

             Card Count (all disabled)
    [ 6 Cards ]  [ 8 Cards ]  [ 10 Cards ]

          Show Numbers Toggle (disabled)
            [ 👁️ Hide Numbers ]

              [ Start Game ] (disabled)
```

---

## Success Criteria

✅ **User Experience**:

- Spectators immediately know they're watching, not playing
- All interactive controls clearly disabled
- Spectators can see whose game they're watching
- Clear call-to-action to add a player to join

✅ **Functional**:

- No moves sent from spectators (existing behavior maintained)
- Real-time state updates visible to spectators
- Context correctly exposes spectator state

✅ **Code Quality**:

- All tests pass
- TypeScript types correct
- Pre-commit checks pass
- No regressions in player functionality

✅ **Accessibility**:

- Disabled buttons use `disabled` attribute (not just styling)
- Screen readers announce disabled state
- Color contrast meets WCAG AA standards

---

## Future Enhancements (Out of Scope)

These are NOT part of this spec but could be added later:

- Spectator count badge ("👁️ 2 watching")
- Spectator list sidebar
- Spectator chat/reactions
- "Join as Next Player" queue system
- Spectator replay controls (rewind/fast-forward)
- Multiple concurrent games in same room with spectator switching

---

## Questions for User

Before implementation:

1. **Banner Placement**: Top of game area (as spec'd) or floating overlay?
2. **Setup Phase**: Should spectators see config options (disabled) or hide them entirely?
3. **Results Phase**: Should spectators see full score breakdown or just summary?
4. **Mobile**: Any special considerations for mobile spectator experience?
5. **Testing Priority**: Implement spectator tests first, or player ownership tests first?

---

**End of Specification**
