# Speed Complement Race - Port to Next.js Technical Plan

**Date Created**: 2025-09-30
**Source**: `packages/core/src/web_generator.py` (lines 10956-15113)
**Target**: `apps/web/src/app/games/complement-race/`
**Status**: Planning Complete, Ready to Implement

---

## 📋 **Project Overview**

**Goal**: Port the Speed Complement Race game from `packages/core/src/web_generator.py` (standalone HTML) to `apps/web/src/app/games/complement-race` (Next.js + React + TypeScript)

**Critical Requirement**: Preserve ALL gameplay mechanics, AI personalities, adaptive systems, and visual polish from the original

**Original Game Features**:
- 3 game modes: Endurance Race (20 answers), Lightning Sprint (60 seconds), Survival Mode (infinite)
- 2 AI opponents with distinct personalities: Swift AI (competitive), Math Bot (analytical)
- Adaptive difficulty system that tracks per-pair performance
- 3 distinct visualizations: Linear track, Circular track, Steam train journey
- Speech bubble commentary system (266 lines per AI personality)
- Momentum-based steam train system with pressure gauge
- Dynamic day/night cycle visualization
- Lap tracking and celebration system
- Rubber-banding AI catchup mechanics
- Complex scoring with medals and speed ratings

---

## **Phase 1: Architecture & Setup** ⚙️

### **1.1 Directory Structure**
```
apps/web/src/app/games/complement-race/
├── page.tsx                           # Main page wrapper
├── context/
│   └── ComplementRaceContext.tsx      # Game state management
├── components/
│   ├── ComplementRaceGame.tsx         # Main game orchestrator
│   ├── GameIntro.tsx                  # Welcome screen with instructions
│   ├── GameControls.tsx               # Mode/timeout/style selection
│   ├── GameCountdown.tsx              # 3-2-1-GO countdown
│   ├── GameDisplay.tsx                # Question display area
│   ├── GameTimer.tsx                  # Timer bar component
│   ├── GameHeader.tsx                 # Sticky header with stats
│   ├── RaceTrack/
│   │   ├── LinearTrack.tsx            # Endurance mode visualization
│   │   ├── CircularTrack.tsx          # Survival mode visualization
│   │   └── SteamTrainJourney.tsx      # Sprint mode visualization
│   ├── AISystem/
│   │   ├── AIRacer.tsx                # Individual AI racer component
│   │   ├── SpeechBubble.tsx           # AI commentary display
│   │   └── aiCommentary.ts            # Commentary logic & messages
│   ├── ScoreModal.tsx                 # End game results
│   └── VisualFeedback.tsx             # Correct/incorrect animations
├── hooks/
│   ├── useGameLoop.ts                 # Core game loop logic
│   ├── useAIRacers.ts                 # AI movement & adaptation
│   ├── useAdaptiveDifficulty.ts       # Per-pair performance tracking
│   ├── useSteamJourney.ts             # Steam train momentum system
│   └── useKeyboardInput.ts            # Keyboard capture
├── lib/
│   ├── gameTypes.ts                   # TypeScript interfaces
│   ├── aiPersonalities.ts             # AI personality definitions
│   ├── scoringSystem.ts               # Scoring & medal calculations
│   └── circularMath.ts                # Trigonometry for circular track
└── sounds/
    └── (audio files for sound effects)
```

### **1.2 Core Types** (gameTypes.ts)
```typescript
export type GameMode = 'friends5' | 'friends10' | 'mixed'
export type GameStyle = 'practice' | 'sprint' | 'survival'
export type TimeoutSetting = 'preschool' | 'kindergarten' | 'relaxed' | 'slow' | 'normal' | 'fast' | 'expert'

export interface ComplementQuestion {
  number: number
  targetSum: number
  correctAnswer: number
}

export interface AIRacer {
  id: string
  position: number
  speed: number
  name: string
  personality: 'competitive' | 'analytical'
  icon: string
  lastComment: number
  commentCooldown: number
  previousPosition: number
}

export interface DifficultyTracker {
  pairPerformance: Map<string, PairPerformance>
  baseTimeLimit: number
  currentTimeLimit: number
  difficultyLevel: number
  consecutiveCorrect: number
  consecutiveIncorrect: number
  learningMode: boolean
  adaptationRate: number
}

export interface PairPerformance {
  attempts: number
  correct: number
  avgTime: number
  difficulty: number
}

export interface GameState {
  // Game configuration
  mode: GameMode
  style: GameStyle
  timeoutSetting: TimeoutSetting

  // Current question
  currentQuestion: ComplementQuestion | null
  previousQuestion: ComplementQuestion | null

  // Game progress
  score: number
  streak: number
  bestStreak: number
  totalQuestions: number
  correctAnswers: number

  // Game status
  isGameActive: boolean
  isPaused: boolean
  gamePhase: 'intro' | 'controls' | 'countdown' | 'playing' | 'results'

  // Timing
  gameStartTime: number | null
  questionStartTime: number

  // Race mechanics
  raceGoal: number
  timeLimit: number | null
  speedMultiplier: number
  aiRacers: AIRacer[]

  // Adaptive difficulty
  difficultyTracker: DifficultyTracker

  // Survival mode specific
  playerLap: number
  aiLaps: Map<string, number>
  survivalMultiplier: number

  // Sprint mode specific
  momentum: number
  trainPosition: number
  lastCorrectAnswerTime: number

  // Input
  currentInput: string

  // UI state
  showScoreModal: boolean
}
```

---

## **Phase 2: State Management** 🔄

### **2.1 Context Pattern**
Follow existing pattern from memory-quiz:
- Use `useReducer` for complex game state
- Create ComplementRaceContext with provider
- Export custom hooks for game actions

### **2.2 Game Actions**
```typescript
type GameAction =
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'SET_STYLE'; style: GameStyle }
  | { type: 'SET_TIMEOUT'; timeout: TimeoutSetting }
  | { type: 'START_RACE' }
  | { type: 'START_COUNTDOWN' }
  | { type: 'BEGIN_GAME' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'SUBMIT_ANSWER'; answer: number }
  | { type: 'UPDATE_INPUT'; input: string }
  | { type: 'UPDATE_AI_POSITIONS'; positions: Array<{id: string, position: number}> }
  | { type: 'TRIGGER_AI_COMMENTARY'; racerId: string; message: string; context: string }
  | { type: 'UPDATE_MOMENTUM'; momentum: number }
  | { type: 'UPDATE_TRAIN_POSITION'; position: number }
  | { type: 'COMPLETE_LAP'; racerId: string }
  | { type: 'PAUSE_RACE' }
  | { type: 'RESUME_RACE' }
  | { type: 'END_RACE' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_GAME' }
```

---

## **Phase 3: Core Game Logic** 🎯

### **3.1 Game Loop Hook** (useGameLoop.ts)
```typescript
export function useGameLoop() {
  // Manages:
  // - Question generation (with repeat avoidance)
  // - Timer management
  // - Answer validation
  // - Score calculation
  // - Streak tracking
  // - Race completion detection

  // Returns:
  // - nextQuestion()
  // - submitAnswer()
  // - pauseGame()
  // - resumeGame()
  // - endGame()
}
```

**Critical Details to Preserve**:
- Avoid repeating same question consecutively
- Safety limit of 10 attempts when generating questions
- Exact timer calculations based on timeout setting
- Streak bonus system
- Score formula: `correctAnswers * 100 + streak * 50 + speedBonus`
- Speed bonus: `max(0, 300 - (avgTime * 10))`

### **3.2 AI Racers Hook** (useAIRacers.ts)
```typescript
export function useAIRacers() {
  // Manages:
  // - AI position updates (200ms intervals)
  // - Rubber-banding catchup system
  // - Passing event detection
  // - Commentary trigger logic
  // - Speed adaptation

  // Returns:
  // - aiRacers state
  // - updateAIPositions()
  // - triggerCommentary()
  // - checkForPassingEvents()
}
```

**Critical Details to Preserve**:
- Swift AI: speed = 0.25 * multiplier
- Math Bot: speed = 0.15 * multiplier
- AI updates every 200ms
- Random variance in AI progress (0.6-1.4 range via `Math.random() * 0.8 + 0.6`)
- Rubber-banding: AI speeds up 2x when >10 units behind
- Passing detection with tolerance = 0.1 for floating point
- Commentary cooldown (2-6 seconds random via `Math.random() * 4000 + 2000`)

### **3.3 Adaptive Difficulty Hook** (useAdaptiveDifficulty.ts)
```typescript
export function useAdaptiveDifficulty() {
  // Manages:
  // - Per-pair performance tracking
  // - Time limit adaptation
  // - Difficulty level calculation
  // - Learning mode detection
  // - Adaptive feedback messages

  // Returns:
  // - currentTimeLimit
  // - updatePairPerformance()
  // - getAdaptiveFeedback()
  // - calculateDifficulty()
}
```

**Critical Details to Preserve**:
- Pair key format: `"${number}_${complement}_${targetSum}"`
- Base time limit: 3000ms
- Difficulty scale: 1-5
- Learning mode: first 10-15 questions
- Adaptation rate: 0.1 (gradual changes)
- Success rate thresholds:
  - >85% → adaptiveMultiplier = 1.6x
  - >75% → 1.3x
  - >60% → 1.0x
  - >45% → 0.75x
  - <45% → 0.5x
- Response time factors:
  - <1500ms → 1.2x
  - <2500ms → 1.1x
  - >4000ms → 0.9x
- Streak bonuses:
  - 8+ streak → 1.3x
  - 5+ streak → 1.15x
- Bounds: min 0.3x, max 2.0x

---

## **Phase 4: Visualization Components** 🎨

### **4.1 Linear Track** (LinearTrack.tsx)
```typescript
export function LinearTrack({
  playerProgress,
  aiRacers,
  raceGoal,
  showFinishLine
}) {
  // Renders:
  // - Horizontal track with background
  // - Player racer at left% position
  // - AI racers at left% positions
  // - Finish line (conditional)
  // - Speech bubbles attached to racers
}
```

**Position Calculation**:
```typescript
const leftPercent = Math.min(98, (progress / raceGoal) * 96 + 2)
// 2% minimum (start), 98% maximum (near finish), 96% range for race
```

### **4.2 Circular Track** (CircularTrack.tsx)
```typescript
export function CircularTrack({
  playerProgress,
  playerLap,
  aiRacers,
  aiLaps
}) {
  // Renders:
  // - Circular SVG track
  // - Racers positioned using trigonometry
  // - Lap counter display
  // - Celebration effects on lap completion

  // Math:
  // progressPerLap = 50
  // currentLap = Math.floor(progress / 50)
  // angle = (progress / 50) * 360
  // angleRad = (angle * Math.PI) / 180
  // x = radius * cos(angleRad - π/2)
  // y = radius * sin(angleRad - π/2)
  // rotation = angle degrees
}
```

**Critical Details**:
- Track radius: (trackWidth / 2) - 20
- Start at top of circle (offset by -π/2)
- Counter-rotate speech bubbles: `--counter-rotation: ${-angle}deg`
- Lap detection: `Math.floor(progress / 50)`
- Celebration on lap completion with cooldown to prevent duplicates
- Track lap counts per racer in Map

### **4.3 Steam Train Journey** (SteamTrainJourney.tsx)
```typescript
export function SteamTrainJourney({
  momentum,
  trainPosition,
  timeElapsed,
  correctAnswers
}) {
  // Renders:
  // - Dynamic sky gradient (6 time periods)
  // - SVG curved railroad track
  // - Animated steam locomotive
  // - Steam puff effects
  // - Coal shoveler animation
  // - Station markers
  // - Pressure gauge with PSI
  // - Momentum bar

  // Systems:
  // - Momentum decay (1% per second base)
  // - Accelerated decay if no answers (>5s)
  // - Train movement (momentum * 0.4 per 200ms)
  // - Time of day progression (60s = full cycle)
}
```

**Time of Day Gradients** (from web_generator.py lines 4344-4351):
```typescript
const timeOfDayGradients = {
  dawn: 'linear-gradient(135deg, #ffb347 0%, #ffcc5c 30%, #87ceeb 70%, #98d8e8 100%)',
  morning: 'linear-gradient(135deg, #87ceeb 0%, #98d8e8 30%, #b6e2ff 70%, #cce7ff 100%)',
  midday: 'linear-gradient(135deg, #87ceeb 0%, #a8d8ea 30%, #c7e2f7 70%, #e3f2fd 100%)',
  afternoon: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 30%, #ff8a65 70%, #ff7043 100%)',
  dusk: 'linear-gradient(135deg, #ff8a65 0%, #ff7043 30%, #8e44ad 70%, #5b2c87 100%)',
  night: 'linear-gradient(135deg, #2c3e50 0%, #34495e 30%, #1a252f 70%, #0f1419 100%)'
}

// Time progression (from line 13064-13088):
if (gameProgress < 0.17) return 'dawn'
else if (gameProgress < 0.33) return 'morning'
else if (gameProgress < 0.67) return 'midday'
else if (gameProgress < 0.83) return 'afternoon'
else if (gameProgress < 0.92) return 'dusk'
else return 'night'
```

**Momentum Decay Config by Skill Level** (calibrated for different ages):
```typescript
const momentumConfigs = {
  preschool: {
    baseDecay: 0.3,           // Very gentle decay
    highSpeedDecay: 0.5,      // >75% momentum
    mediumSpeedDecay: 0.4,    // >50% momentum
    starvationThreshold: 10,  // Seconds before extra decay
    starvationRate: 2,        // Divisor for extra decay calculation
    maxExtraDecay: 2.0,       // Maximum extra decay per second
    warningThreshold: 8       // When to log warnings
  },
  kindergarten: {
    baseDecay: 0.4,
    highSpeedDecay: 0.6,
    mediumSpeedDecay: 0.5,
    starvationThreshold: 8,
    starvationRate: 2,
    maxExtraDecay: 2.5,
    warningThreshold: 6
  },
  relaxed: {
    baseDecay: 0.6,
    highSpeedDecay: 0.9,
    mediumSpeedDecay: 0.7,
    starvationThreshold: 6,
    starvationRate: 1.8,
    maxExtraDecay: 3.0,
    warningThreshold: 5
  },
  slow: {
    baseDecay: 0.8,
    highSpeedDecay: 1.2,
    mediumSpeedDecay: 1.0,
    starvationThreshold: 5,
    starvationRate: 1.5,
    maxExtraDecay: 3.5,
    warningThreshold: 4
  },
  normal: {
    baseDecay: 1.0,
    highSpeedDecay: 1.5,
    mediumSpeedDecay: 1.2,
    starvationThreshold: 5,
    starvationRate: 1.5,
    maxExtraDecay: 4.0,
    warningThreshold: 4
  },
  fast: {
    baseDecay: 1.2,
    highSpeedDecay: 1.8,
    mediumSpeedDecay: 1.5,
    starvationThreshold: 4,
    starvationRate: 1.2,
    maxExtraDecay: 5.0,
    warningThreshold: 3
  },
  expert: {
    baseDecay: 1.5,
    highSpeedDecay: 2.5,
    mediumSpeedDecay: 2.0,
    starvationThreshold: 3,
    starvationRate: 1.0,
    maxExtraDecay: 6.0,
    warningThreshold: 2
  }
}

// Decay calculation (from line 13036-13046):
let decayRate = momentum > 75 ? config.highSpeedDecay :
                momentum > 50 ? config.mediumSpeedDecay :
                config.baseDecay

if (timeSinceLastCoal > config.starvationThreshold) {
  const extraDecay = Math.min(config.maxExtraDecay, timeSinceLastCoal / config.starvationRate)
  decayRate += extraDecay
}

momentum = Math.max(0, momentum - decayRate)
```

**Pressure Gauge Calculation** (lines 13118-13146):
```typescript
const pressure = Math.round(momentum) // 0-100
const psi = Math.round(pressure * 1.5) // Scale to 0-150 PSI

// Arc progress (circumference = 251.2 pixels)
const circumference = 251.2
const offset = circumference - (pressure / 100) * circumference

// Needle rotation (-90 to +90 degrees for half-circle)
const rotation = -90 + (pressure / 100) * 180

// Gauge color
let gaugeColor = '#ff6b6b' // Coral red for low pressure
if (pressure > 70) gaugeColor = '#4ecdc4' // Turquoise for high pressure
else if (pressure > 40) gaugeColor = '#feca57' // Sunny yellow for medium pressure
```

**Train Movement** (line 13057-13058):
```typescript
// Updates 5x per second (200ms intervals)
trainPosition += (momentum * 0.4) // Continuous movement rate
```

---

## **Phase 5: AI Personality System** 🤖

### **5.1 Commentary System** (aiCommentary.ts)

**IMPORTANT**: Lines 11768-11909 contain ALL commentary messages. Must port exactly.

```typescript
export const swiftAICommentary = {
  ahead: [
    "💨 Eat my dust!",
    "🔥 Too slow for me!",
    "⚡ You can't catch me!",
    "🚀 I'm built for speed!",
    "🏃‍♂️ This is way too easy!"
  ],
  behind: [
    "😤 Not over yet!",
    "💪 I'm just getting started!",
    "🔥 Watch me catch up to you!",
    "⚡ I'm coming for you!",
    "🏃‍♂️ This is my comeback!"
  ],
  adaptive_struggle: [
    "😏 You struggling much?",
    "🤖 Math is easy for me!",
    "⚡ You need to think faster!",
    "🔥 Need me to slow down?"
  ],
  adaptive_mastery: [
    "😮 You're actually impressive!",
    "🤔 You're getting faster...",
    "😤 Time for me to step it up!",
    "⚡ Not bad for a human!"
  ],
  player_passed: [
    "😠 No way you just passed me!",
    "🔥 This isn't over!",
    "💨 I'm just getting warmed up!",
    "😤 Your lucky streak won't last!",
    "⚡ I'll be back in front of you soon!"
  ],
  ai_passed: [
    "💨 See ya later, slowpoke!",
    "😎 Thanks for the warm-up!",
    "🔥 This is how it's done!",
    "⚡ I'll see you at the finish line!",
    "💪 Try to keep up with me!"
  ],
  lapped: [
    "😡 You just lapped me?! No way!",
    "🤬 This is embarrassing for me!",
    "😤 I'm not going down without a fight!",
    "💢 How did you get so far ahead?!",
    "🔥 Time to show you my real speed!",
    "😠 You won't stay ahead for long!"
  ],
  desperate_catchup: [
    "🚨 TURBO MODE ACTIVATED! I'm coming for you!",
    "💥 You forced me to unleash my true power!",
    "🔥 NO MORE MR. NICE AI! Time to go all out!",
    "⚡ I'm switching to MAXIMUM OVERDRIVE!",
    "😤 You made me angry - now you'll see what I can do!",
    "🚀 AFTERBURNERS ENGAGED! This isn't over!"
  ]
}

export const mathBotCommentary = {
  ahead: [
    "📊 My performance is optimal!",
    "🤖 My logic beats your speed!",
    "📈 I have 87% win probability!",
    "⚙️ I'm perfectly calibrated!",
    "🔬 Science prevails over you!"
  ],
  behind: [
    "🤔 Recalculating my strategy...",
    "📊 You're exceeding my projections!",
    "⚙️ Adjusting my parameters!",
    "🔬 I'm analyzing your technique!",
    "📈 You're a statistical anomaly!"
  ],
  adaptive_struggle: [
    "📊 I detect inefficiencies in you!",
    "🔬 You should focus on patterns!",
    "⚙️ Use that extra time wisely!",
    "📈 You have room for improvement!"
  ],
  adaptive_mastery: [
    "🤖 Your optimization is excellent!",
    "📊 Your metrics are impressive!",
    "⚙️ I'm updating my models because of you!",
    "🔬 You have near-AI efficiency!"
  ],
  player_passed: [
    "🤖 Your strategy is fascinating!",
    "📊 You're an unexpected variable!",
    "⚙️ I'm adjusting my algorithms...",
    "🔬 Your execution is impressive!",
    "📈 I'm recalculating the odds!"
  ],
  ai_passed: [
    "🤖 My efficiency is optimized!",
    "📊 Just as I calculated!",
    "⚙️ All my systems nominal!",
    "🔬 My logic prevails over you!",
    "📈 I'm at 96% confidence level!"
  ],
  lapped: [
    "🤖 Error: You have exceeded my projections!",
    "📊 This outcome has 0.3% probability!",
    "⚙️ I need to recalibrate my systems!",
    "🔬 Your performance is... statistically improbable!",
    "📈 My confidence level just dropped to 12%!",
    "🤔 I must analyze your methodology!"
  ],
  desperate_catchup: [
    "🤖 EMERGENCY PROTOCOL ACTIVATED! Initiating maximum speed!",
    "🚨 CRITICAL GAP DETECTED! Engaging catchup algorithms!",
    "⚙️ OVERCLOCKING MY PROCESSORS! Prepare for rapid acceleration!",
    "📊 PROBABILITY OF FAILURE: UNACCEPTABLE! Switching to turbo mode!",
    "🔬 HYPOTHESIS: You're about to see my true potential!",
    "📈 CONFIDENCE LEVEL: RISING! My comeback protocol is online!"
  ]
}

export function getAICommentary(
  racer: AIRacer,
  context: CommentaryContext,
  playerProgress: number,
  aiProgress: number
): string | null {
  // Check cooldown (line 11759-11761)
  const now = Date.now()
  if (now - racer.lastComment < racer.commentCooldown) {
    return null
  }

  // Select message set based on personality and context
  const messages = racer.personality === 'competitive'
    ? swiftAICommentary[context]
    : mathBotCommentary[context]

  if (!messages || messages.length === 0) return null

  // Return random message
  return messages[Math.floor(Math.random() * messages.length)]
}
```

**Commentary Contexts** (8 total):
1. `ahead` - AI is winning (AI progress > player progress)
2. `behind` - AI is losing (AI progress < player progress)
3. `adaptive_struggle` - Player struggling (success rate < 60%, triggered periodically)
4. `adaptive_mastery` - Player dominating (success rate > 85%, triggered periodically)
5. `player_passed` - Player just overtook AI (position change detected)
6. `ai_passed` - AI just overtook player (position change detected)
7. `lapped` - Player lapped AI in circular mode (lap difference >= 1)
8. `desperate_catchup` - AI is >30 units behind (emergency catchup mode)

**Commentary Trigger Logic** (line 11911-11942):
```typescript
// Triggers every 4 questions
if (totalQuestions % 4 !== 0) return

// Check each AI racer
aiRacers.forEach(racer => {
  const playerProgress = correctAnswers
  const aiProgress = Math.floor(racer.position)

  let context = ''

  // Determine context based on positions
  if (aiProgress > playerProgress + 5) {
    context = 'ahead'
  } else if (playerProgress > aiProgress + 5) {
    context = 'behind'
  }

  // Trigger commentary
  const message = getAICommentary(racer, context, playerProgress, aiProgress)
  if (message) {
    showAICommentary(racer, message, context)
  }
})
```

### **5.2 Speech Bubble Component** (SpeechBubble.tsx)

```typescript
export function SpeechBubble({
  racerId,
  message,
  isVisible,
  position,
  counterRotation
}) {
  // Renders:
  // - Bubble with content
  // - Tail pointing to racer
  // - Fade in/out animation
  // - Auto-hide after 3.5s (line 11752)
  // - Position near racer
  // - Counter-rotation for circular track

  // Auto-hide implementation (line 11749-11752):
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // Cooldown setting (line 11746-11747):
  // racer.lastComment = Date.now()
  // racer.commentCooldown = Math.random() * 4000 + 2000 // 2-6 seconds
}
```

**CSS Styles** (lines 5864-5977):
```css
.speech-bubble {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 15px;
  padding: 10px 15px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  font-size: 14px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
  pointer-events: none;
}

.speech-bubble.visible {
  opacity: 1;
}

/* Circular track counter-rotation */
.race-track.circular .racer .speech-bubble {
  transform: translateX(-50%) rotate(var(--counter-rotation));
}
```

---

## **Phase 6: Sound & Polish** 🎵

### **6.1 Sound System**
```typescript
export function useSoundEffects() {
  const sounds = useMemo(() => ({
    correct: new Audio('/sounds/correct.mp3'),
    incorrect: new Audio('/sounds/incorrect.mp3'),
    countdown: new Audio('/sounds/countdown.mp3'),
    raceStart: new Audio('/sounds/race_start.mp3'),
    victory: new Audio('/sounds/victory.mp3'),
    defeat: new Audio('/sounds/defeat.mp3')
  }), [])

  return {
    playSound: useCallback((type: keyof typeof sounds, volume = 0.5) => {
      sounds[type].volume = volume
      sounds[type].currentTime = 0 // Reset to start
      sounds[type].play().catch(err => {
        console.warn('Sound play failed:', err)
      })
    }, [sounds])
  }
}
```

**Sound Triggers** (from original):
- Countdown: 0.4 volume (line 11186)
- Race start: 0.6 volume (line 11196)
- Correct answer: full volume
- Incorrect answer: full volume
- Victory: when player wins race
- Defeat: when AI wins race

### **6.2 Animation Classes** (Panda CSS)

**Correct Answer Animation**:
```typescript
const correctAnimation = css({
  background: 'linear-gradient(45deg, #d4edda, #c3e6cb)',
  border: '2px solid #28a745',
  boxShadow: '0 0 20px rgba(40, 167, 69, 0.3)',
  animation: 'correctPulse 0.3s ease',

  '@keyframes correctPulse': {
    '0%': { transform: 'scale(1)', backgroundColor: 'white' },
    '50%': { transform: 'scale(1.05)', backgroundColor: '#d4edda' },
    '100%': { transform: 'scale(1)', backgroundColor: 'white' }
  }
})
```

**Incorrect Answer Animation**:
```typescript
const incorrectAnimation = css({
  background: 'linear-gradient(45deg, #f8d7da, #f1b0b7)',
  border: '2px solid #dc3545',
  boxShadow: '0 0 20px rgba(220, 53, 69, 0.3)',
  animation: 'incorrectShake 0.3s ease',

  '@keyframes incorrectShake': {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-10px)' },
    '75%': { transform: 'translateX(10px)' }
  }
})
```

**Racer Bounce Animation** (lines 5596-5612):
```typescript
const racerBounce = css({
  animation: 'racerBounce 0.3s ease-out',

  '@keyframes racerBounce': {
    '0%': { transform: 'translateY(0) scale(1)' },
    '30%': { transform: 'translateY(-8px) scale(1.1)' },
    '50%': { transform: 'translateY(-12px) scale(1.15)' },
    '70%': { transform: 'translateY(-8px) scale(1.1)' },
    '100%': { transform: 'translateY(0) scale(1)' }
  }
})

// Special bounce for circular track (preserves rotation)
const circularBounce = css({
  '@keyframes circularBounce': {
    '0%': { transform: 'rotate(var(--racer-rotation)) translateY(0) scale(1)' },
    '30%': { transform: 'rotate(var(--racer-rotation)) translateY(-8px) scale(1.1)' },
    '50%': { transform: 'rotate(var(--racer-rotation)) translateY(-12px) scale(1.15)' },
    '70%': { transform: 'rotate(var(--racer-rotation)) translateY(-8px) scale(1.1)' },
    '100%': { transform: 'rotate(var(--racer-rotation)) translateY(0) scale(1)' }
  }
})
```

---

## **Phase 7: Testing Strategy** ✅

### **7.1 Unit Tests**
- [ ] Question generation (no repeats, 10 attempt safety)
- [ ] Score calculation formulas (base + streak + speed bonus)
- [ ] AI speed adaptation logic (all threshold values)
- [ ] Difficulty tracking per pair (Map operations)
- [ ] Circular position calculations (trigonometry)
- [ ] Momentum decay system (all skill levels)
- [ ] Commentary selection logic (cooldowns, context matching)
- [ ] Passing event detection (tolerance for floating point)
- [ ] Lap tracking and celebration cooldown

### **7.2 Integration Tests**
- [ ] Game flow: intro → controls → countdown → playing → results
- [ ] AI movement synchronized with game timer (200ms updates)
- [ ] Speech bubbles appear/disappear correctly (3.5s auto-hide)
- [ ] Mode switching (practice/sprint/survival)
- [ ] Adaptive difficulty adjusts properly (learning mode → adaptive)
- [ ] Lap tracking in circular mode (50 progress per lap)
- [ ] Momentum system in sprint mode (decay + gain)
- [ ] Time of day progression (6 periods over 60s)

### **7.3 Manual Testing Checklist**
- [ ] All 3 game modes work correctly
- [ ] Both AI personalities have distinct commentary
- [ ] All 8 commentary contexts trigger appropriately
- [ ] Adaptive difficulty responds to performance
- [ ] Steam train visualization smooth (5 updates/second)
- [ ] Circular track positioning correct (racers follow circle)
- [ ] Speech bubbles positioned properly on both tracks
- [ ] Speech bubbles counter-rotate on circular track
- [ ] Medals awarded correctly (Gold/Silver/Bronze)
- [ ] Speed ratings calculate correctly
- [ ] Sound effects play at right times
- [ ] Responsive on mobile/tablet/desktop
- [ ] Keyboard input captures properly
- [ ] No memory leaks (intervals cleaned up)
- [ ] Timer accuracy (countdown, question timer, game timer)
- [ ] Pause/resume functionality
- [ ] Modal animations smooth
- [ ] Racer bounce animations work
- [ ] Progress bar updates smoothly
- [ ] Pressure gauge animates correctly

---

## **Phase 8: Migration Checklist** 📋

### **Must Preserve - Exact Values**:
- ✅ Swift AI speed: 0.25x base multiplier
- ✅ Math Bot speed: 0.15x base multiplier
- ✅ AI update interval: 200ms
- ✅ AI variance: `Math.random() * 0.8 + 0.6` (0.6-1.4 range)
- ✅ AI rubber-banding: 2x speed when >10 units behind
- ✅ AI passing tolerance: 0.1
- ✅ Commentary cooldown: 2-6s (`Math.random() * 4000 + 2000`)
- ✅ Speech bubble duration: 3.5s
- ✅ Countdown timing: 1s per number
- ✅ Race goal (practice): 20 answers
- ✅ Time limit (sprint): 60 seconds
- ✅ Circular lap length: 50 progress units
- ✅ Base time limit: 3000ms
- ✅ Difficulty scale: 1-5
- ✅ Adaptation rate: 0.1
- ✅ Success rate thresholds: 85%, 75%, 60%, 45%
- ✅ Response time thresholds: 1500ms, 2500ms, 4000ms
- ✅ Streak bonus thresholds: 8, 5
- ✅ Adaptive multiplier bounds: 0.3-2.0
- ✅ Score formula: `correctAnswers * 100 + streak * 50 + speedBonus`
- ✅ Speed bonus: `max(0, 300 - (avgTime * 10))`
- ✅ Train movement rate: `momentum * 0.4` per 200ms
- ✅ Momentum decay base: skill-level dependent (see config)
- ✅ Pressure gauge PSI: `momentum * 1.5` (0-150 range)
- ✅ Time of day thresholds: 0.17, 0.33, 0.67, 0.83, 0.92
- ✅ Question repeat safety: 10 attempts max

### **Must Preserve - All Commentary**:
- ✅ All 41 Swift AI messages across 8 contexts
- ✅ All 41 Math Bot messages across 8 contexts
- ✅ Exact emoji and wording for each message
- ✅ Message randomization (no patterns)
- ✅ Context-appropriate triggering

### **Must Preserve - Visual Polish**:
- ✅ All time of day gradients (6 periods)
- ✅ Momentum gauge colors (red/yellow/turquoise thresholds)
- ✅ Racer bounce animation (with circular variant)
- ✅ Speech bubble styling and positioning
- ✅ Correct/incorrect feedback animations
- ✅ Countdown animation (scale + color)
- ✅ Modal entrance/exit animations
- ✅ Progress bar smooth transitions

---

## **Implementation Order**

### **Week 1: Core Infrastructure**
1. Create directory structure
2. Set up TypeScript types (gameTypes.ts)
3. Create ComplementRaceContext with useReducer
4. Implement page.tsx wrapper with PageWithNav
5. Basic GameIntro component
6. Basic GameControls component (mode/timeout/style buttons)

### **Week 2: Game Mechanics**
1. Implement useGameLoop hook
   - Question generation with repeat avoidance
   - Timer management
   - Answer validation
   - Score calculation
2. Implement GameDisplay component
3. Implement GameTimer component
4. Implement GameHeader component
5. Implement keyboard input capture
6. Wire up game flow: intro → controls → countdown → playing

### **Week 3: AI System**
1. Implement useAIRacers hook
   - Position updates (200ms interval)
   - Rubber-banding logic
   - Passing detection
2. Port all commentary messages to aiCommentary.ts
3. Implement SpeechBubble component
4. Implement AIRacer component
5. Wire up commentary triggering
6. Test all 8 commentary contexts

### **Week 4: Adaptive Difficulty**
1. Implement useAdaptiveDifficulty hook
   - Per-pair performance tracking
   - Learning mode detection
   - Time limit calculation
2. Implement AI speed adaptation
3. Wire up adaptive feedback messages
4. Test difficulty scaling

### **Week 5: Visualizations Part 1 (Linear & Circular)**
1. Implement LinearTrack component
   - Horizontal track layout
   - Position calculations
   - Finish line
2. Implement CircularTrack component
   - SVG circle
   - Trigonometry positioning
   - Lap tracking
   - Celebration effects
3. Test both visualizations with AI movement

### **Week 6: Visualizations Part 2 (Steam Train)**
1. Implement useSteamJourney hook
   - Momentum system
   - Decay calculations
   - Train position updates
2. Implement SteamTrainJourney component
   - Dynamic sky gradients
   - SVG railroad track
   - Locomotive animation
   - Pressure gauge
   - Momentum bar
3. Test time of day progression
4. Test momentum decay at all skill levels

### **Week 7: Scoring & Results**
1. Implement scoring system (scoringSystem.ts)
   - Score calculation
   - Medal determination
   - Speed rating
2. Implement ScoreModal component
3. Implement end game flow
4. Test all scoring scenarios

### **Week 8: Polish & Testing**
1. Implement sound effects system
2. Add all animations (Panda CSS)
3. Unit tests for critical functions
4. Integration tests for game flow
5. Manual testing (full checklist)
6. Performance optimization
7. Bug fixes
8. Final verification against original

---

## **Critical Reference Points in Original Code**

### **Source File**: `packages/core/src/web_generator.py`

**Key Line Ranges**:
- Class definition: 10956-10957
- Constructor & state: 10957-11030
- Game configuration: 11098-11161 (startRace)
- Question generation: 11214-11284 (nextQuestion)
- Timer system: 11286-11364 (startQuestionTimer, getTimerDuration)
- Answer handling: 11366-11500+ (handleKeydown, submitAnswer)
- AI initialization: 11001-11024 (aiRacers array)
- AI commentary system: 11723-11909 (showAICommentary, getAICommentary)
- AI movement: 12603-12850+ (updateAIRacers, startAIRacers)
- Circular track: 12715-12752 (updateCircularPosition)
- Lap tracking: 12754-12782 (checkForLappingCelebration)
- Passing detection: 12678-12713 (checkForPassingEvents)
- Race initialization: 12251-12349 (initializeRace)
- Steam journey init: 13006-13062 (initializeSteamJourney)
- Momentum system: 13029-13053 (momentum decay interval)
- Time of day: 13064-13095 (updateTimeOfDay)
- Pressure gauge: 13118-13146 (updatePressureGauge)
- Train movement: 13465-13572 (updateTrainPosition)
- Adaptive difficulty: 14607-14738 (adaptAISpeeds, showAIAdaptationFeedback)
- Difficulty tracking: 14740-14934 (getAdaptiveTimeLimit, updatePairDifficulty)
- Scoring system: 12140-12238 (calculateResults)

---

## **Risk Mitigation Strategies**

1. **Timing Precision**:
   - Use `useRef` for all intervals/timeouts
   - Clear all timers in cleanup functions
   - Test with React.StrictMode enabled

2. **State Complexity**:
   - Thoroughly test reducer with all action types
   - Add logging for state transitions in development
   - Consider using Immer for complex state updates

3. **Animation Performance**:
   - Use CSS transforms instead of position properties
   - Avoid layout thrashing (batch DOM reads/writes)
   - Use `requestAnimationFrame` for smooth animations

4. **Speech Bubble Positioning**:
   - Test on various screen sizes (mobile, tablet, desktop)
   - Use viewport-relative units where appropriate
   - Handle edge cases (bubbles near screen edges)

5. **Circular Track Math**:
   - Write unit tests for position calculations
   - Verify with multiple progress values
   - Test lap detection edge cases

6. **Memory Leaks**:
   - Ensure all intervals are cleared on unmount
   - Remove event listeners properly
   - Test for memory leaks with React DevTools Profiler

7. **AI Behavior Consistency**:
   - Compare AI speeds between original and port
   - Verify rubber-banding triggers correctly
   - Test commentary triggers in all contexts

---

## **Success Criteria**

### **Functional**:
- ✅ All 3 game modes (practice/sprint/survival) working
- ✅ All 8 commentary contexts triggering appropriately
- ✅ Adaptive difficulty responding to player performance
- ✅ Circular track lap tracking accurate
- ✅ Steam train momentum system working
- ✅ Scoring and medals calculating correctly

### **Quality**:
- ✅ No regressions from original gameplay
- ✅ Smooth animations (60fps target)
- ✅ Responsive on all screen sizes
- ✅ No memory leaks or performance issues
- ✅ TypeScript strict mode compliance
- ✅ Unit test coverage for critical logic

### **Preservation**:
- ✅ All 82 commentary messages preserved exactly
- ✅ All numerical values match original
- ✅ All formulas calculate identically
- ✅ All timing behaviors match original
- ✅ Visual polish matches or exceeds original

---

## **Notes for Implementation**

1. **Start Simple**: Begin with practice mode (linear track) before tackling sprint/survival modes
2. **Test Incrementally**: Test each feature as you build it, don't wait until the end
3. **Reference Original Often**: Keep web_generator.py open and cross-reference constantly
4. **Preserve Comments**: Port over helpful comments from original code
5. **Document Deviations**: If you must deviate from original, document why
6. **Performance First**: Profile early and often, don't wait for performance issues
7. **Mobile Matters**: Test on actual mobile devices, not just browser DevTools
8. **Accessibility**: Add ARIA labels and keyboard navigation support

---

## **Where to Resume After Disconnection**

1. Check this file: `apps/web/COMPLEMENT_RACE_PORT_PLAN.md`
2. Check todo list in Claude Code session
3. Check git status for what's been created
4. Look for work-in-progress files in `apps/web/src/app/games/complement-race/`
5. Review recent commits to see what phase was being worked on

**Key Context**:
- Original source: `packages/core/src/web_generator.py` (lines 10956-15113)
- Generated output example: `packages/core/src/flashcards_en.html`
- Implementation follows pattern from existing games: `memory-quiz/` and `matching/`
- Using: Next.js 14, React 18, TypeScript, Panda CSS, @soroban/abacus-react

---

**Last Updated**: 2025-09-30 by Claude Code
**Original Python Code**: 4,157 lines (class + commentary + systems)
**Estimated TypeScript**: ~5,000 lines (with proper separation of concerns)
**Complexity**: ⭐⭐⭐⭐⭐ (5/5 - Very Complex, Many Nuances)