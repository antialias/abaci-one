# SorobanQuiz React Implementation Specification

## Overview

This document specifies the complete conversion of the original SorobanQuiz game from the Python web_generator.py template into a React component that preserves all refinements, nuances, and advanced features while integrating with the existing ServerSorobanSVG component.

## Current State Analysis

### Original Python Template Features (MUST PRESERVE)

1. **Smart Input System**: Hidden input field with visual feedback, real-time validation, prefix conflict handling
2. **Flashcard-Based Architecture**: Uses actual soroban SVGs from DOM, not just numbers
3. **Advanced Game Phases**: Controls → Display → Input → Results with smooth transitions
4. **Sophisticated Scoring**: Guess limits, penalty system, found/missed tracking
5. **Professional UI**: Progress bars, countdown timers, animated feedback
6. **Accessibility**: Keyboard navigation, focus management, screen reader friendly

### Current React Implementation Issues

- Using fake sample SVGs instead of ServerSorobanSVG component
- Missing integration with existing React ecosystem
- Not leveraging the robust SVG generation system from guide page

## Technical Architecture

### Core Components Integration

#### 1. ServerSorobanSVG Integration

```typescript
// MUST use the existing component from guide page
import { ServerSorobanSVG } from '../../../components/ServerSorobanSVG'

// Generate cards using actual soroban SVGs
const generateQuizCards = (numbers: number[]) => {
  return numbers.map(number => ({
    number,
    svgComponent: <ServerSorobanSVG number={number} />,
    element: null // Will be populated from DOM after render
  }))
}
```

#### 2. Game State Management

```typescript
interface SorobanQuizState {
  // Core game data
  cards: QuizCard[];
  quizCards: QuizCard[];
  correctAnswers: number[];

  // Game progression
  currentCardIndex: number;
  displayTime: number;
  selectedCount: number;

  // Input system state
  foundNumbers: number[];
  guessesRemaining: number;
  currentInput: string;
  incorrectGuesses: number;

  // UI state
  gamePhase: "setup" | "display" | "input" | "results";
  prefixAcceptanceTimeout: NodeJS.Timeout | null;
  finishButtonsBound: boolean;
}

interface QuizCard {
  number: number;
  svgComponent: JSX.Element;
  element: HTMLElement | null;
}
```

#### 3. Smart Input System Architecture

```typescript
interface SmartInputSystem {
  // Visual feedback states
  displayState: "neutral" | "correct" | "incorrect";

  // Input validation
  isPrefix: (input: string, numbers: number[]) => boolean;
  handlePrefixConflict: (input: string) => void;

  // Real-time processing
  processInput: (value: string) => void;
  acceptNumber: (number: number) => void;
  rejectNumber: (number: number) => void;
}
```

### Game Flow Specification

#### Phase 1: Setup/Controls

- **UI Elements**: Count buttons (2,5,8,12,15), display time slider, start button
- **State**: User selects preferences, cards are not yet generated
- **Validation**: Must select valid count and time before starting

#### Phase 2: Card Display

- **Sequence**: Countdown (3,2,1,GO!) → Card 1 → Brief pause → Card 2 → ... → Card N
- **Visual**: Progress bar, card counter, large soroban display area
- **Timing**: Precise timing control, smooth transitions between cards
- **SVG Rendering**: Each card shows ServerSorobanSVG component content

#### Phase 3: Smart Input

- **UI Layout**:
  ```
  [Stats: Cards Shown | Guesses Left | Found]
  [Smart Input Display Area]
  [Found Numbers Badges]
  [Finish/Give Up Buttons (conditional)]
  ```
- **Input Logic**:
  - Hidden input field captures keystrokes
  - Visual display shows current typing
  - Real-time validation with prefix handling
  - Immediate feedback (green/red animations)
  - Auto-advancement on correct answers

#### Phase 4: Results

- **Score Display**: Circular percentage indicator + detailed breakdown
- **Review Section**: Show each target number with ✅/❌ status
- **Actions**: Try Again, Back to Cards

### UX/UI Specifications

#### Visual Design Principles

1. **Consistency**: Match existing guide page styling and color schemes
2. **Responsiveness**: Work on mobile, tablet, desktop
3. **Accessibility**: WCAG 2.1 AA compliance
4. **Performance**: Smooth 60fps animations, no jank

#### Key UI Elements

##### Smart Input Display

```css
.number-display {
  /* Large, monospace display area */
  font-family: "Courier New", monospace;
  font-size: 32px;
  letter-spacing: 3px;
  min-height: 60px;

  /* Feedback states */
  &.correct {
    background: linear-gradient(45deg, #d4edda, #c3e6cb);
    border: 2px solid #28a745;
    box-shadow: 0 0 20px rgba(40, 167, 69, 0.3);
  }

  &.incorrect {
    background: linear-gradient(45deg, #f8d7da, #f1b0b7);
    border: 2px solid #dc3545;
    box-shadow: 0 0 20px rgba(220, 53, 69, 0.3);
  }
}
```

##### Found Numbers Display

```css
.found-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .found-number {
    background: #28a745;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    animation: fadeInScale 0.3s ease;
  }
}
```

##### Progress System

```css
.progress-bar {
  width: 100%;
  height: 10px;
  background: #e9ecef;
  border-radius: 5px;

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #28a745, #20c997);
    transition: width 0.5s ease;
  }
}
```

#### Animation Specifications

##### Card Transitions

- **Entry**: Smooth fade-in with subtle scale effect
- **Display**: Pulse animation to draw attention
- **Exit**: Quick fade-out with red border flash warning
- **Timing**: Total display time - 300ms for animations

##### Input Feedback

- **Correct**: Green glow effect (300ms duration)
- **Incorrect**: Red shake effect (300ms duration)
- **Found Number**: Scale-in animation when added to collection

##### Phase Transitions

- **Setup → Display**: Slide up effect
- **Display → Input**: Fade transition with stats reveal
- **Input → Results**: Expanding circle transition

### Technical Implementation Details

#### Component Structure

```
MemoryQuizPage
├── Game State (useReducer)
├── Phase Management (useEffect)
├── Setup Phase
│   ├── Count Buttons
│   ├── Time Slider
│   └── Start Button
├── Display Phase
│   ├── Progress Bar
│   ├── Card Display Area (ServerSorobanSVG)
│   └── Countdown Timer
├── Input Phase
│   ├── Stats Display
│   ├── Smart Input System
│   ├── Found Numbers
│   └── Action Buttons
└── Results Phase
    ├── Score Circle
    ├── Results Breakdown
    └── Action Buttons
```

#### Key React Patterns

- **useReducer**: Complex game state management
- **useEffect**: Phase transitions, timers, cleanup
- **useCallback**: Event handler optimization
- **useMemo**: Expensive calculations (card generation)
- **useRef**: DOM manipulation for input focus

#### Performance Considerations

- **ServerSorobanSVG Caching**: Pre-generate common numbers
- **Animation Optimization**: Use CSS transforms, avoid layout thrashing
- **Memory Management**: Cleanup timers, remove event listeners
- **Bundle Size**: Import only needed utilities

### Integration Points

#### With Existing Systems

1. **ServerSorobanSVG**: Primary rendering component for cards
2. **Panda CSS**: Styling system integration
3. **Guide Page**: Shared components and patterns
4. **Games Router**: Navigation integration

#### API Surface

```typescript
interface QuizConfiguration {
  cardCount: number; // 2, 5, 8, 12, 15
  displayTime: number; // 0.5-10 seconds
  numberRange: {
    // Auto-determined from available cards
    min: number;
    max: number;
  };
}

interface QuizResults {
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  timing: {
    displayPhase: number;
    inputPhase: number;
    totalTime: number;
  };
  accuracy: {
    foundNumbers: number[];
    missedNumbers: number[];
    incorrectGuesses: number;
  };
}
```

### Testing Strategy

#### Unit Tests

- Smart input validation logic
- Prefix conflict resolution
- Score calculation
- Timer management

#### Integration Tests

- ServerSorobanSVG rendering
- Phase transitions
- Event handling
- State persistence

#### User Experience Tests

- Accessibility compliance
- Mobile responsiveness
- Performance benchmarks
- Cross-browser compatibility

### Success Criteria

#### Functional Requirements

- ✅ All original game features preserved
- ✅ ServerSorobanSVG integration working
- ✅ Smart input system fully functional
- ✅ Smooth phase transitions
- ✅ Accurate scoring and feedback

#### Performance Requirements

- 📊 Initial load: <500ms
- 📊 Phase transitions: <100ms
- 📊 Input responsiveness: <50ms
- 📊 Animation smoothness: 60fps
- 📊 Memory usage: <10MB additional

#### Quality Requirements

- 🎯 Zero regressions from original
- 🎯 Mobile-first responsive design
- 🎯 WCAG 2.1 AA accessibility
- 🎯 TypeScript strict mode compliance
- 🎯 100% test coverage for core logic

## Implementation Notes

### Critical Dependencies

- ServerSorobanSVG component (existing)
- Panda CSS system (existing)
- Next.js 14 App Router (existing)
- React 18 concurrent features

### Risk Mitigation

1. **SVG Complexity**: Use existing proven ServerSorobanSVG
2. **Timing Precision**: Leverage React's concurrent features
3. **State Complexity**: useReducer for predictable updates
4. **Memory Leaks**: Comprehensive cleanup in useEffect

### Delivery Timeline

1. **Phase 1**: Core component structure (30% complete)
2. **Phase 2**: ServerSorobanSVG integration (pending)
3. **Phase 3**: Smart input system (pending)
4. **Phase 4**: Polish and testing (pending)

## Final Notes

This specification ensures we build a React component that not only preserves the original game's sophisticated functionality but enhances it with modern React patterns and seamless integration with the existing codebase. The key is leveraging the ServerSorobanSVG component for authentic soroban rendering while maintaining all the UX refinements that make the original game effective.

---

**TODO: Reference this document during implementation to ensure all requirements are met.**
