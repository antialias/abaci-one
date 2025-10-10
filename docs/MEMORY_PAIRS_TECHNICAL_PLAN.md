# 🧩 **Memory Pairs Challenge - Technical Implementation Plan**

## **📋 Executive Summary**

Port the sophisticated Matching Pairs Challenge from the static HTML games website to a modern React implementation in `apps/web`, following the established patterns from the existing Speed Memory Quiz implementation while maintaining all features and improving UX with TypeScript safety, comprehensive testing, and the existing `@soroban/abacus-react` component system.

## **🔍 Architecture Analysis - Improved Component Composition**

After analyzing the existing Speed Memory Quiz implementation and identifying areas for improvement, I've designed a proper component composition approach that prioritizes maintainability, testability, and reusability:

### **Modern Architecture Patterns**

- **Component composition**: Small, focused, testable components
- **Context-based state management**: Centralized state with clean separation
- **useReducer pattern**: Complex state management with typed actions and reducer
- **Phase-based UI**: Setup → Playing → Results with conditional rendering
- **Panda CSS**: Using `css()` function for styling with design tokens
- **AbacusDisplayContext**: Integration with existing abacus configuration system
- **Proper separation of concerns**: Logic, UI, and state clearly separated
- **Testable components**: Each component focused on single responsibility

## **🏗️ Component Architecture**

### **File Structure** (Component Composition Approach)

```
src/app/games/matching/
├── page.tsx                          # Main page entry point (minimal)
├── components/
│   ├── MemoryPairsGame.tsx          # Main game orchestrator
│   ├── SetupPhase.tsx               # Game configuration UI
│   ├── GamePhase.tsx                # Active gameplay UI
│   ├── ResultsPhase.tsx             # Game results and statistics
│   ├── GameCard.tsx                 # Individual card component
│   ├── MemoryGrid.tsx               # Grid layout manager
│   ├── PlayerIndicator.tsx          # Player status display
│   └── GameControls.tsx             # Game action buttons
├── context/
│   ├── MemoryPairsContext.tsx       # Game state management
│   └── types.ts                     # TypeScript interfaces
├── hooks/
│   ├── useMemoryPairsGame.tsx       # Custom game logic hook
│   ├── useCardMatching.tsx          # Card matching logic
│   └── useGameTimer.tsx             # Timer functionality
└── utils/
    ├── cardGeneration.ts            # Card generation utilities
    ├── matchValidation.ts           # Match validation logic
    └── gameScoring.ts               # Scoring calculations

src/lib/
├── memory-pairs-utils.ts            # Shared game utilities
├── memory-pairs-utils.test.ts       # Unit tests for utilities
└── [existing] memory-quiz-utils.ts  # Reference implementation
```

### **State Management** (Following memory-quiz reducer pattern)

```typescript
interface MemoryPairsState {
  // Core game data
  cards: GameCard[];
  gameCards: GameCard[];
  flippedCards: GameCard[];

  // Game configuration
  gameMode: "single" | "two-player";
  gameType: "abacus-numeral" | "complement-pairs";
  difficulty: 6 | 8 | 12 | 15; // Number of pairs
  turnTimer: number; // For two-player mode

  // Game progression
  currentPlayer: 1 | 2;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  scores: { player1: number; player2: number };

  // UI state
  gamePhase: "setup" | "playing" | "results";
  gameStartTime: number | null;
  timerInterval: NodeJS.Timeout | null;
  celebrationAnimations: CelebrationAnimation[];
}

type MemoryPairsAction =
  | { type: "SET_GAME_MODE"; mode: "single" | "two-player" }
  | { type: "SET_GAME_TYPE"; gameType: "abacus-numeral" | "complement-pairs" }
  | { type: "SET_DIFFICULTY"; difficulty: 6 | 8 | 12 | 15 }
  | { type: "START_GAME"; cards: GameCard[] }
  | { type: "FLIP_CARD"; cardId: string }
  | { type: "MATCH_FOUND"; cardIds: [string, string] }
  | { type: "MATCH_FAILED"; cardIds: [string, string] }
  | { type: "SWITCH_PLAYER" }
  | { type: "ADD_CELEBRATION"; animation: CelebrationAnimation }
  | { type: "SHOW_RESULTS" }
  | { type: "RESET_GAME" };
```

## **🎮 Core Features Implementation**

### **1. Card System Integration**

#### **GameCard Interface** (Following memory-quiz QuizCard pattern)

```typescript
interface GameCard {
  id: string;
  type: "abacus" | "number" | "complement";
  number: number;
  complement?: number; // For complement pairs
  targetSum?: 5 | 10; // For complement pairs
  matched: boolean;
  matchedBy?: 1 | 2; // For two-player mode
  element?: HTMLElement | null; // Following memory-quiz pattern
}
```

#### **AbacusReact Integration** (Following memory-quiz pattern)

```typescript
// In card rendering - following memory-quiz AbacusReact usage
<AbacusReact
  value={card.number}
  columns="auto"
  beadShape={appConfig.beadShape}
  colorScheme={appConfig.colorScheme}
  hideInactiveBeads={appConfig.hideInactiveBeads}
  scaleFactor={1.2} // Optimized for cards
  interactive={false}
  showNumbers={false}
  animated={false}
/>
```

### **2. Game Generation Logic**

#### **Abacus-Numeral Mode** (Similar to memory-quiz generateQuizCards)

```typescript
const generateAbacusNumeralCards = (
  pairs: number,
  appConfig: AbacusDisplayConfig,
): GameCard[] => {
  // Generate unique numbers based on difficulty
  const numbers = generateUniqueNumbers(pairs, { min: 1, max: 999 });

  const cards: GameCard[] = [];
  numbers.forEach((number) => {
    // Abacus card
    cards.push({
      id: `abacus_${number}`,
      type: "abacus",
      number,
      matched: false,
    });

    // Number card
    cards.push({
      id: `number_${number}`,
      type: "number",
      number,
      matched: false,
    });
  });

  return shuffleArray(cards);
};
```

#### **Complement Pairs Mode**

```typescript
const generateComplementCards = (pairs: number): GameCard[] => {
  const complementPairs = [
    [0, 5],
    [1, 4],
    [2, 3], // Friends of 5
    [0, 10],
    [1, 9],
    [2, 8],
    [3, 7],
    [4, 6],
    [5, 5], // Friends of 10
  ];

  const selectedPairs = complementPairs.slice(0, pairs);
  const cards: GameCard[] = [];

  selectedPairs.forEach(([num1, num2]) => {
    const targetSum = num1 + num2;
    cards.push(
      {
        id: `comp1_${num1}_${num2}`,
        type: "complement",
        number: num1,
        complement: num2,
        targetSum: targetSum as 5 | 10,
        matched: false,
      },
      {
        id: `comp2_${num1}_${num2}`,
        type: "complement",
        number: num2,
        complement: num1,
        targetSum: targetSum as 5 | 10,
        matched: false,
      },
    );
  });

  return shuffleArray(cards);
};
```

### **3. Match Validation Logic**

#### **Validation Utilities** (Following memory-quiz-utils pattern)

```typescript
// lib/memory-pairs-utils.ts
export function validateAbacusNumeralMatch(
  card1: GameCard,
  card2: GameCard,
): boolean {
  return (
    card1.number === card2.number &&
    card1.type !== card2.type &&
    card1.type !== "complement" &&
    card2.type !== "complement"
  );
}

export function validateComplementMatch(
  card1: GameCard,
  card2: GameCard,
): boolean {
  return (
    card1.type === "complement" &&
    card2.type === "complement" &&
    card1.number === card2.complement &&
    card2.number === card1.complement &&
    card1.targetSum === card2.targetSum
  );
}

export function isValidMatch(card1: GameCard, card2: GameCard): boolean {
  if (card1.type === "complement" || card2.type === "complement") {
    return validateComplementMatch(card1, card2);
  }
  return validateAbacusNumeralMatch(card1, card2);
}
```

## **🎨 Visual Design & UX** (Following memory-quiz patterns)

### **Component Implementation Examples**

#### **Context Provider** (Centralized state management)

```typescript
// context/MemoryPairsContext.tsx
export function MemoryPairsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(memoryPairsReducer, initialState)

  const contextValue = {
    state,
    dispatch,
    // Derived state
    isGameActive: state.gamePhase === 'playing',
    canFlipCard: (cardId: string) => canPlayerFlipCard(state, cardId),
    // Actions
    startGame: () => dispatch({ type: 'START_GAME' }),
    flipCard: (cardId: string) => dispatch({ type: 'FLIP_CARD', cardId }),
    resetGame: () => dispatch({ type: 'RESET_GAME' })
  }

  return (
    <MemoryPairsContext.Provider value={contextValue}>
      {children}
    </MemoryPairsContext.Provider>
  )
}
```

#### **Setup Phase Component** (Clean separation of concerns)

```typescript
// components/SetupPhase.tsx
export function SetupPhase() {
  const { state, dispatch } = useMemoryPairs()
  return (
    <div className={css({
      textAlign: 'center',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto'
    })}>
      {/* Game mode selection */}
      <div className={css({ margin: '20px 0' })}>
        <label className={css({
          display: 'block',
          fontWeight: 'bold',
          marginBottom: '10px',
          color: 'gray.600'
        })}>
          Game Mode:
        </label>
        <div className={css({
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        })}>
          {['single', 'two-player'].map(mode => (
            <button
              key={mode}
              className={css({
                background: state.gameMode === mode ? 'blue.500' : 'white',
                color: state.gameMode === mode ? 'white' : 'gray.800',
                border: '2px solid',
                borderColor: state.gameMode === mode ? 'blue.500' : 'gray.300',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                _hover: {
                  background: state.gameMode === mode ? 'blue.600' : 'gray.50',
                  borderColor: 'blue.400'
                }
              })}
              onClick={() => dispatch({ type: 'SET_GAME_MODE', mode })}
            >
              {mode === 'single' ? 'Single Player' : 'Two Players'}
            </button>
          ))}
        </div>
      </div>

      {/* Additional setup controls... */}
    </div>
  )
}
```

### **Card Flip Animation** (Following memory-quiz 3D card patterns)

````typescript
#### **Game Card Component** (Focused single responsibility)
```typescript
// components/GameCard.tsx
export function GameCard({ card, isFlipped, isMatched, onClick }: GameCardProps) {
  const appConfig = useAbacusConfig()

  return (
    <div
      className={css({
        perspective: '1000px',
        cursor: isMatched ? 'default' : 'pointer'
      })}
      onClick={onClick}
    >
      <div className={css({
        position: 'relative',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        transition: 'transform 0.6s',
        transformStyle: 'preserve-3d',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
      })}>
        {/* Card back */}
        <div className={css({
          position: 'absolute',
          width: '100%',
          height: '100%',
          backfaceVisibility: 'hidden',
          borderRadius: '12px',
          background: card.type === 'abacus'
            ? 'linear-gradient(135deg, #7b4397, #dc2430)'
            : card.type === 'number'
            ? 'linear-gradient(135deg, #2E86AB, #A23B72)'
            : 'linear-gradient(135deg, #F18F01, #6A994E)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '24px'
        })}>
          {card.type === 'abacus' ? '🧮' : card.type === 'number' ? '🔢' : '🤝'}
        </div>

        {/* Card front */}
        <div className={css({
          position: 'absolute',
          width: '100%',
          height: '100%',
          backfaceVisibility: 'hidden',
          borderRadius: '12px',
          background: 'white',
          border: '3px solid',
          borderColor: isMatched ? 'green.500' : 'blue.500',
          transform: 'rotateY(180deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px'
        })}>
          {card.type === 'abacus' ? (
            <AbacusReact
              value={card.number}
              columns="auto"
              beadShape={appConfig.beadShape}
              colorScheme={appConfig.colorScheme}
              hideInactiveBeads={appConfig.hideInactiveBeads}
              scaleFactor={1.2}
              interactive={false}
              showNumbers={false}
              animated={false}
            />
          ) : card.type === 'number' ? (
            <div className={css({ fontSize: '32px', fontWeight: 'bold' })}>
              {card.number}
            </div>
          ) : (
            <div className={css({ textAlign: 'center' })}>
              <div className={css({ fontSize: '24px', fontWeight: 'bold' })}>{card.number}</div>
              <div className={css({ fontSize: '16px' })}>
                {card.targetSum === 5 ? '✋' : '🔟'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
````

### **Responsive Grid System** (Following memory-quiz adaptive grid patterns)

````typescript
#### **Memory Grid Component** (Layout management)
```typescript
// components/MemoryGrid.tsx
export function MemoryGrid() {
  const { state, flipCard } = useMemoryPairs()
  const getGridClass = (pairs: number) => {
    if (pairs <= 6) return 'repeat(4, 1fr)' // 3x4 grid
    if (pairs <= 8) return 'repeat(4, 1fr)' // 4x4 grid
    if (pairs <= 12) return 'repeat(6, 1fr)' // 4x6 grid
    return 'repeat(6, 1fr)' // 5x6 grid
  }

  const getCardSize = (pairs: number) => {
    if (pairs <= 6) return { width: '140px', height: '180px' }
    if (pairs <= 8) return { width: '120px', height: '160px' }
    if (pairs <= 12) return { width: '100px', height: '140px' }
    return { width: '90px', height: '120px' }
  }

  const gridClass = getGridClass(state.totalPairs)
  const cardSize = getCardSize(state.totalPairs)

  return (
    <div
      className={css({
        display: 'grid',
        gap: '12px',
        padding: '20px',
        justifyContent: 'center',
        maxWidth: '100%',
        margin: '0 auto'
      })}
      style={{ gridTemplateColumns: gridClass }}
    >
      {state.gameCards.map(card => (
        <div
          key={card.id}
          style={cardSize}
          className={css({ aspectRatio: '3/4' })}
        >
          <GameCard
            card={card}
            isFlipped={state.flippedCards.some(c => c.id === card.id) || card.matched}
            isMatched={card.matched}
            onClick={() => onCardClick(card.id)}
          />
        </div>
      ))}
    </div>
  )
}
````

## **🎉 Advanced Features**

### **Two-Player System** (Enhanced from original)

```typescript
// Two-player logic in reducer
case 'MATCH_FOUND': {
  const [card1Id, card2Id] = action.cardIds
  const updatedCards = state.gameCards.map(card => {
    if (card.id === card1Id || card.id === card2Id) {
      return {
        ...card,
        matched: true,
        matchedBy: state.currentPlayer
      }
    }
    return card
  })

  // Player keeps turn after successful match
  const newScores = {
    ...state.scores,
    [`player${state.currentPlayer}`]: state.scores[`player${state.currentPlayer}`] + 1
  }

  return {
    ...state,
    gameCards: updatedCards,
    matchedPairs: state.matchedPairs + 1,
    scores: newScores,
    flippedCards: []
  }
}

case 'MATCH_FAILED': {
  // Switch players after failed match in two-player mode
  return {
    ...state,
    flippedCards: [],
    currentPlayer: state.gameMode === 'two-player'
      ? (state.currentPlayer === 1 ? 2 : 1)
      : state.currentPlayer,
    moves: state.moves + 1
  }
}
```

### **Celebration Effects** (Following memory-quiz animation patterns)

```typescript
// Global animations (following memory-quiz global animations pattern)
const globalAnimations = `
@keyframes cardFlip {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}

@keyframes matchSuccess {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes celebrationBurst {
  0% {
    opacity: 1;
    transform: scale(0.5) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.2) rotate(180deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.5) rotate(360deg);
  }
}

@keyframes invalidMove {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
`;
```

## **🧪 Testing Strategy** (Following memory-quiz test patterns)

### **1. Utility Function Tests**

```typescript
// lib/memory-pairs-utils.test.ts (following memory-quiz-utils.test.ts patterns)
describe("memory-pairs-utils", () => {
  describe("validateAbacusNumeralMatch", () => {
    it("should match same numbers with different types", () => {
      const abacusCard: GameCard = {
        id: "1",
        type: "abacus",
        number: 5,
        matched: false,
      };
      const numberCard: GameCard = {
        id: "2",
        type: "number",
        number: 5,
        matched: false,
      };

      expect(validateAbacusNumeralMatch(abacusCard, numberCard)).toBe(true);
    });

    it("should reject same types", () => {
      const card1: GameCard = {
        id: "1",
        type: "abacus",
        number: 5,
        matched: false,
      };
      const card2: GameCard = {
        id: "2",
        type: "abacus",
        number: 5,
        matched: false,
      };

      expect(validateAbacusNumeralMatch(card1, card2)).toBe(false);
    });
  });

  describe("validateComplementMatch", () => {
    it("should match friends of 5", () => {
      const card1: GameCard = {
        id: "1",
        type: "complement",
        number: 2,
        complement: 3,
        targetSum: 5,
        matched: false,
      };
      const card2: GameCard = {
        id: "2",
        type: "complement",
        number: 3,
        complement: 2,
        targetSum: 5,
        matched: false,
      };

      expect(validateComplementMatch(card1, card2)).toBe(true);
    });

    it("should reject different target sums", () => {
      const card1: GameCard = {
        id: "1",
        type: "complement",
        number: 2,
        complement: 3,
        targetSum: 5,
        matched: false,
      };
      const card2: GameCard = {
        id: "2",
        type: "complement",
        number: 4,
        complement: 6,
        targetSum: 10,
        matched: false,
      };

      expect(validateComplementMatch(card1, card2)).toBe(false);
    });
  });
});
```

### **2. Component Integration Tests**

```typescript
// __tests__/memory-pairs.integration.test.tsx
describe('Memory Pairs Game Integration', () => {
  it('should complete a single-player abacus-numeral game', async () => {
    render(<MemoryPairsPage />)

    // Setup game
    await user.click(screen.getByText('Abacus-Numeral'))
    await user.click(screen.getByText('6 pairs'))
    await user.click(screen.getByText('Start Game'))

    // Verify game board
    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(12) // 6 pairs = 12 cards
    })

    // Play game logic...
  })

  it('should handle two-player mode correctly', async () => {
    render(<MemoryPairsPage />)

    // Setup two-player game
    await user.click(screen.getByText('Two Players'))
    await user.click(screen.getByText('Start Game'))

    // Verify player indicators
    expect(screen.getByText('Player 1')).toBeInTheDocument()
    expect(screen.getByText('Score: 0')).toBeInTheDocument()
  })
})
```

### **3. E2E Tests** (Following Playwright patterns)

```typescript
// e2e/memory-pairs.spec.ts
test.describe("Memory Pairs Game E2E", () => {
  test("should complete full game flow", async ({ page }) => {
    await page.goto("/games/matching");

    // Game setup
    await page.click('[data-testid="game-type-abacus"]');
    await page.click('[data-testid="difficulty-6"]');
    await page.click('[data-testid="start-game"]');

    // Game interaction
    const cards = page.locator(".memory-card");
    await expect(cards).toHaveCount(12);

    // Test card interactions...
  });
});
```

## **📚 Documentation & Storybook**

### **Storybook Stories** (Following memory-quiz patterns)

```typescript
// stories/MemoryPairs.stories.tsx
export default {
  title: 'Games/Memory Pairs',
  component: MemoryPairsPage
} as Meta

export const SinglePlayerAbacus: Story = {
  args: {
    initialState: {
      gameMode: 'single',
      gameType: 'abacus-numeral',
      difficulty: 6
    }
  }
}

export const TwoPlayerComplements: Story = {
  args: {
    initialState: {
      gameMode: 'two-player',
      gameType: 'complement-pairs',
      difficulty: 8
    }
  }
}

export const CardStates: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4">
      <GameCard card={hiddenCard} isFlipped={false} isMatched={false} />
      <GameCard card={abacusCard} isFlipped={true} isMatched={false} />
      <GameCard card={numberCard} isFlipped={true} isMatched={true} />
      <GameCard card={complementCard} isFlipped={true} isMatched={false} />
    </div>
  )
}
```

## **🚀 Implementation Phases**

### **Phase 1: Core Architecture (Week 1)**

- [ ] Create minimal `apps/web/src/app/games/matching/page.tsx` entry point
- [ ] Implement `MemoryPairsContext` with useReducer state management
- [ ] Create `types.ts` with comprehensive TypeScript interfaces
- [ ] Build `SetupPhase` component with game configuration UI
- [ ] Add utility functions in `utils/` directory with proper separation

### **Phase 2: Core Components (Week 2)**

- [ ] Implement `GameCard` component with flip animations
- [ ] Create `MemoryGrid` component with responsive layout
- [ ] Build `GamePhase` component orchestrating active gameplay
- [ ] Add `useCardMatching` hook for match validation logic
- [ ] Implement card generation utilities in `utils/cardGeneration.ts`

### **Phase 3: Game Logic & Polish (Week 3)**

- [ ] Create `ResultsPhase` component with game statistics
- [ ] Implement `PlayerIndicator` component for two-player mode
- [ ] Add `GameControls` component for game actions
- [ ] Build `useGameTimer` hook for timed gameplay features
- [ ] Add celebration effects and visual feedback

### **Phase 4: Advanced Features (Week 4)**

- [ ] Implement two-player turn-based gameplay logic
- [ ] Add scoring system in `utils/gameScoring.ts`
- [ ] Create `useMemoryPairsGame` hook for complex game orchestration
- [ ] Add AbacusReact integration with proper theming
- [ ] Implement complement pairs game mode

### **Phase 5: Testing & Documentation (Week 5)**

- [ ] Write comprehensive utility tests following memory-quiz test patterns
- [ ] Add component integration tests
- [ ] Create E2E test scenarios
- [ ] Write Storybook stories for all components

### **Phase 6: Final Polish & Integration (Week 6)**

- [ ] Performance optimization and code review
- [ ] Accessibility audit and improvements
- [ ] Cross-browser and mobile testing
- [ ] Integration with games directory

## **📝 Key Technical Decisions**

### **Improved Architecture Patterns**

1. **Component Composition**: Small, focused, testable components with single responsibilities
2. **Context-Based State**: Centralized state management with clean separation of concerns
3. **Custom Hooks**: Encapsulated logic in reusable, testable hooks
4. **Utility Modules**: Pure functions in focused utility files
5. **TypeScript Interfaces**: Comprehensive type safety with proper separation
6. **Panda CSS**: Use `css()` function with design tokens for consistent styling

### **Quality Standards**

- **TypeScript**: Strict mode with comprehensive type coverage
- **Testing**: Unit, integration, and E2E following memory-quiz test patterns
- **Performance**: React.memo, useMemo, useCallback for optimization
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Code Quality**: ESLint + Prettier with existing project configuration

This plan ensures seamless integration with the existing codebase while delivering a sophisticated, well-tested implementation that maintains the quality and patterns established by the Speed Memory Quiz.
