# Soroban Abacus Education Platform - Comprehensive Roadmap

## Vision Statement

**Mission:** Fill the gap in the USA school system by providing a complete, self-directed abacus curriculum that trains students from beginner to mastery using the Japanese kyu/dan ranking system.

**Target Users:**
- Primary: Elementary school students (ages 6-12)
- Secondary: Middle school students and adult learners
- Teachers/Parents: Dashboard for monitoring progress

**Core Experience Principles:**
1. **Integrated Learning Loop:** Tutorial → Practice → Play → Assessment → Progress
2. **Self-Directed:** Simple enough for kids to fire up and start learning independently
3. **Gamified Progression:** Games reinforce lessons, feel like play but teach skills
4. **Physical + Virtual:** Support both physical abacus and AbacusReact component
5. **Mastery-Based:** Students advance through clear skill levels with certification

---

## Current State Assessment

### ✅ What We Have (Well-Built)

**1. Interactive Abacus Component (AbacusReact)**
- Highly polished, production-ready
- Excellent pedagogical features (bead highlighting, direction arrows, tooltips)
- Multiple color schemes and accessibility options
- Interactive and display-only modes
- **Rating: 95% Complete**

**2. Game System (4 Games)**
- Memory Lightning (memorization skills)
- Matching Pairs Battle (pattern recognition, complements)
- Card Sorting (visual literacy, ordering)
- Complement Race (speed calculation, friends-of-5/10)
- Type-safe architecture with game SDK
- Multiplayer and spectator modes
- **Rating: 80% Complete** (games exist but need curriculum integration)

**3. Tutorial Infrastructure**
- Tutorial player with step-based guidance
- Tutorial editor for content creation
- Bead highlighting system for instruction
- Event tracking and progress monitoring
- **Rating: 70% Complete** (infrastructure exists but lacks content)

**4. Real-time Multiplayer**
- Socket.IO integration
- Room-based architecture
- State synchronization
- **Rating: 90% Complete**

**5. Flashcard Generator**
- PDF/PNG/SVG export
- Customizable layouts and themes
- **Rating: 100% Complete**

### ⚠️ What We Have (Partially Built)

**1. Progress Tracking**
- Basic user stats (games played, wins, accuracy)
- No skill-level tracking
- No tutorial completion tracking
- No assessment history
- **Rating: 30% Complete**

**2. Tutorial Content**
- One example tutorial (GuidedAdditionTutorial)
- Type system for tutorials defined
- No comprehensive curriculum
- **Rating: 15% Complete**

**3. Assessment System**
- Per-game scoring exists
- Achievement system exists
- No formal tests or certification
- No placement tests
- **Rating: 25% Complete**

### ❌ What We're Missing (Critical Gaps)

**1. Kyu/Dan Ranking System** - 0% Complete
**2. Structured Curriculum** - 5% Complete
**3. Adaptive Learning** - 0% Complete
**4. Student Dashboard** - 0% Complete
**5. Teacher/Parent Dashboard** - 0% Complete
**6. Formal Assessment/Testing** - 0% Complete
**7. Learning Path Sequencing** - 0% Complete
**8. Content Library** - 10% Complete

---

## Kyu/Dan Level System (Japanese Abacus Standard)

### Beginner Levels (Kyu)

**10 Kyu - "First Steps"**
- Age: 6-7 years
- Skills: Basic bead manipulation, numbers 1-10
- Curriculum: Recognize and set numbers on abacus, understand place value
- Assessment: Set numbers 1-99 correctly, basic addition single digits
- Games: Card Sorting (visual recognition), Memory Lightning (basic)

**9 Kyu - "Number Explorer"**
- Skills: Addition/subtraction with no carry (1-9)
- Curriculum: Friends of 5 concept introduction
- Assessment: 20 problems, 2-digit addition/subtraction, no carry, 80% accuracy
- Games: Complement Race (practice mode), Matching Pairs (numerals)

**8 Kyu - "Complement Apprentice"**
- Skills: Friends of 5 mastery, introduction to friends of 10
- Curriculum: All combinations that make 5, carry concepts
- Assessment: 30 problems including carries using friends of 5, 85% accuracy
- Games: Complement Race (friends-5 sprint), Matching Pairs (complement pairs)

**7 Kyu - "Addition Warrior"**
- Skills: Friends of 10 mastery, 2-digit addition/subtraction with carries
- Curriculum: All combinations that make 10, mixed complement strategies
- Assessment: 40 problems, 2-3 digit calculations, mixed operations, 85% accuracy
- Games: Complement Race (friends-10 sprint), All games at medium difficulty

**6 Kyu - "Speed Calculator"**
- Skills: Multi-digit addition/subtraction (3-4 digits), speed emphasis
- Curriculum: Chain calculations, mental imagery beginning
- Assessment: 50 problems, 3-4 digits, 3 minutes time limit, 90% accuracy
- Games: Complement Race (survival mode), Memory Lightning (medium)

**5 Kyu - "Multiplication Initiate"**
- Skills: Single-digit multiplication (1-5)
- Curriculum: Multiplication tables 1-5, abacus multiplication method
- Assessment: 30 multiplication problems, 40 add/subtract problems, 90% accuracy
- Games: All games at hard difficulty

**4 Kyu - "Multiplication Master"**
- Skills: Full multiplication tables (1-9), 2-digit × 1-digit
- Curriculum: All multiplication patterns, division introduction
- Assessment: 40 multiplication, 20 division, 40 add/subtract, 90% accuracy

**3 Kyu - "Division Explorer"**
- Skills: Division mastery (2-digit ÷ 1-digit), mixed operations
- Curriculum: Division algorithm, remainders, mixed problem solving
- Assessment: 100 mixed problems in 10 minutes, 92% accuracy

**2 Kyu - "Advanced Operator"**
- Skills: Multi-digit multiplication/division, decimals introduction
- Curriculum: 3-digit × 2-digit, decimals, percentages
- Assessment: 120 mixed problems including decimals, 10 minutes, 93% accuracy

**1 Kyu - "Pre-Mastery"**
- Skills: Decimal operations, fractions, complex multi-step problems
- Curriculum: Real-world applications, word problems
- Assessment: 150 mixed problems, 10 minutes, 95% accuracy
- Mental calculation ability without physical abacus

### Master Levels (Dan)

**1 Dan - "Shodan" (First Degree)**
- Skills: Mental imagery without abacus, complex calculations
- Assessment: 200 mixed problems, 10 minutes, 96% accuracy
- Mental arithmetic certification

**2 Dan - "Nidan"**
- Skills: Advanced mental calculation, speed competitions
- Assessment: 250 problems, 10 minutes, 97% accuracy

**3 Dan - "Sandan"**
- Skills: Championship-level speed and accuracy
- Assessment: 300 problems, 10 minutes, 98% accuracy

**4-10 Dan** - Expert/Master levels with increasing complexity

---

## Integrated Learning Experience Design

### The Core Loop (Per Skill/Concept)

```
1. ASSESS → Placement test determines current level
2. LEARN → Tutorial teaches new concept
3. PRACTICE → Guided exercises with immediate feedback
4. PLAY → Games reinforce the skill in fun context
5. TEST → Formal assessment for mastery certification
6. ADVANCE → Unlock next level, update progress
```

### Example: Teaching "Friends of 5"

**1. Assessment (Placement)**
- Quick quiz: "Can you add 3 + 4 using the abacus?"
- Result: Student struggles → Assign Friends of 5 tutorial

**2. Learn (Tutorial)**
- Interactive tutorial: "Friends of 5"
- Steps:
  1. Show that 5 = 1+4, 2+3, 3+2, 4+1
  2. Demonstrate on abacus: setting 3, adding 2 to make 5
  3. Explain heaven bead (top) = 5, earth beads (bottom) = 1 each
  4. Interactive: Student sets 3, adds 2 using heaven bead
  5. Practice all combinations

**3. Practice (Structured Exercises)**
- 20 problems: Set number, add its friend
- Real-time feedback on bead movements
- Hints available: "Use the heaven bead!"
- Must achieve 90% accuracy to proceed

**4. Play (Game Reinforcement)**
- Complement Race: Friends-5 mode
- Matching Pairs: Match numbers that make 5
- Makes practice feel like play

**5. Test (Formal Assessment)**
- 30 problems mixing friends-5 with previous skills
- Timed: 5 minutes
- Must achieve 85% to certify skill
- Can retake after reviewing mistakes

**6. Advance (Progress Update)**
- Friends of 5 skill marked as "Mastered"
- Unlock: Friends of 10 tutorial
- Update skill matrix
- Award achievement badge

---

## Detailed Curriculum Structure

### Curriculum Database Schema

```typescript
// Skill taxonomy
enum SkillCategory {
  NUMBER_SENSE = 'number-sense',
  ADDITION = 'addition',
  SUBTRACTION = 'subtraction',
  MULTIPLICATION = 'multiplication',
  DIVISION = 'division',
  MENTAL_CALC = 'mental-calculation',
  COMPLEMENTS = 'complements',
  SPEED = 'speed',
  ACCURACY = 'accuracy'
}

// Individual skill (atomic unit)
interface Skill {
  id: string
  name: string
  category: SkillCategory
  kyuLevel: number // Which kyu level this skill belongs to
  prerequisiteSkills: string[] // Must master these first
  description: string
  estimatedPracticeTime: number // minutes
}

// Learning module (collection of related skills)
interface Module {
  id: string
  title: string
  kyuLevel: number
  description: string
  skills: string[] // Skill IDs
  estimatedCompletionTime: number // hours
  sequence: number // Order within kyu level
}

// Tutorial (teaches one or more skills)
interface Tutorial {
  id: string
  skillIds: string[]
  moduleId: string
  type: 'interactive' | 'video' | 'reading'
  content: TutorialStep[]
  estimatedDuration: number
}

// Practice set (reinforces skills)
interface PracticeSet {
  id: string
  skillIds: string[]
  problemCount: number
  timeLimit?: number
  passingAccuracy: number
  difficulty: 'easy' | 'medium' | 'hard'
}

// Game mapping (which games teach which skills)
interface GameSkillMapping {
  gameId: string
  skillIds: string[]
  difficulty: string
  recommendedKyuRange: [number, number]
}

// Assessment (formal test)
interface Assessment {
  id: string
  type: 'placement' | 'skill-check' | 'kyu-certification'
  kyuLevel?: number
  skillIds: string[]
  problemCount: number
  timeLimit: number
  passingAccuracy: number
}
```

### Sample Curriculum Map

**10 Kyu Module Sequence:**

1. **Module 1: "Introduction to Abacus" (Week 1)**
   - Skill: Understand abacus structure
   - Skill: Recognize place values (ones, tens, hundreds)
   - Tutorial: "What is an Abacus?"
   - Tutorial: "Parts of the Abacus"
   - Practice: Set numbers 1-10
   - Game: Card Sorting (visual recognition)

2. **Module 2: "Setting Numbers" (Week 2)**
   - Skill: Set single-digit numbers (1-9)
   - Skill: Set two-digit numbers (10-99)
   - Tutorial: "Setting Numbers on Abacus"
   - Practice: 50 number-setting exercises
   - Game: Memory Lightning (set and remember)

3. **Module 3: "Basic Addition" (Week 3-4)**
   - Skill: Add single digits without carry (1+1 through 4+4)
   - Tutorial: "Simple Addition"
   - Practice: 100 addition problems
   - Game: Complement Race (practice mode)
   - Assessment: 10 Kyu Certification Test

**9 Kyu Module Sequence:**

1. **Module 4: "Friends of 5 - Introduction" (Week 5)**
   - Skill: Recognize pairs that make 5
   - Skill: Add using heaven bead (5 bead)
   - Tutorial: "Friends of 5 - Part 1"
   - Practice: Pattern recognition exercises
   - Game: Matching Pairs (complement mode)

2. **Module 5: "Friends of 5 - Application" (Week 6-7)**
   - Skill: Add crossing 5 (e.g., 3+4, 2+5)
   - Tutorial: "Friends of 5 - Part 2"
   - Practice: 200 problems with friends of 5
   - Game: Complement Race (friends-5 mode)
   - Assessment: 9 Kyu Certification Test

... (Continue through all kyu levels)

---

## Implementation Roadmap

### Phase 1: Foundation (Months 1-3) - "MVP for 10-9 Kyu"

**Goal:** Students can learn and certify 10 Kyu and 9 Kyu levels

**Database Schema Updates:**
- [ ] Create `skills` table
- [ ] Create `modules` table
- [ ] Create `curriculum_tutorials` table (links tutorials to skills)
- [ ] Create `curriculum_practice_sets` table
- [ ] Create `curriculum_assessments` table
- [ ] Create `user_progress` table
  - Fields: userId, skillId, status (not_started, in_progress, mastered), attempts, bestScore, lastAttemptAt
- [ ] Create `user_skill_history` table (track all practice attempts)
- [ ] Create `user_assessments` table (formal test results)
- [ ] Create `user_kyu_levels` table
  - Fields: userId, currentKyu, currentDan, certifiedAt, expiresAt
- [ ] Extend `user_stats` table: add `currentKyuLevel`, `currentDanLevel`, `skillsMastered`

**Tutorial Content Creation:**
- [ ] 10 Kyu tutorials (5 tutorials):
  1. Introduction to Abacus
  2. Understanding Place Value
  3. Setting Numbers 1-99
  4. Basic Addition (single digit, no carry)
  5. Basic Subtraction (single digit, no borrow)
- [ ] 9 Kyu tutorials (3 tutorials):
  1. Friends of 5 - Concept
  2. Friends of 5 - Addition
  3. Friends of 5 - Subtraction

**Practice Sets:**
- [ ] Build practice set generator for each skill
- [ ] Implement immediate feedback system
- [ ] Add hint system for common mistakes
- [ ] Track accuracy and time per problem

**Assessment System:**
- [ ] Build placement test component (determines starting level)
- [ ] Build skill-check test component (practice test before certification)
- [ ] Build kyu certification test component (formal test)
- [ ] Implement grading engine
- [ ] Create detailed results/feedback page
- [ ] Allow test retakes with review of mistakes

**Game Integration:**
- [ ] Map existing games to skills
  - Memory Lightning → Number recognition, memory
  - Card Sorting → Visual pattern recognition, ordering
  - Matching Pairs → Complements, pattern matching
  - Complement Race → Friends-5, Friends-10, speed
- [ ] Add skill-based game recommendations
- [ ] Track game performance per skill

**Student Dashboard:**
- [ ] Create dashboard showing:
  - Current kyu level
  - Skills mastered / in progress / locked
  - Next recommended activity
  - Recent achievements
  - Progress bar toward next kyu level
- [ ] Implement simple, kid-friendly UI
- [ ] Add celebratory animations for milestones

**Core User Flow:**
- [ ] Onboarding: Placement test → Assign kyu level
- [ ] Home: Dashboard shows next recommended activity
- [ ] Click "Start Learning" → Next tutorial
- [ ] Complete tutorial → Practice exercises
- [ ] Complete practice → Game suggestion
- [ ] Master all module skills → Unlock certification test
- [ ] Pass certification → Advance to next kyu level
- [ ] Celebration and badge award

**Deliverables:**
- Students can complete 10 Kyu and 9 Kyu
- ~8 tutorials
- ~10 skills defined
- Placement test + 2 certification tests
- Student dashboard
- Progress tracking fully functional

---

### Phase 2: Core Curriculum (Months 4-8) - "8 Kyu through 5 Kyu"

**Goal:** Complete beginner curriculum through multiplication introduction

**Content Creation:**
- [ ] 8 Kyu: Friends of 10 tutorials and practice (4 weeks)
- [ ] 7 Kyu: Mixed complements, 2-digit operations (4 weeks)
- [ ] 6 Kyu: Multi-digit, speed training (6 weeks)
- [ ] 5 Kyu: Multiplication introduction, tables 1-5 (8 weeks)
- Total: ~40 tutorials, ~30 skills

**Enhanced Features:**
- [ ] Adaptive difficulty in practice sets (adjusts based on performance)
- [ ] Spaced repetition system (review mastered skills periodically)
- [ ] Daily recommended practice (10-15 min sessions)
- [ ] Streaks and habit formation
- [ ] Peer comparison (anonymous, optional)

**New Games:**
- [ ] Multiplication tables game
- [ ] Speed drill game (flash calculation)
- [ ] Mental math game (visualization without physical abacus)

**Parent/Teacher Dashboard:**
- [ ] View student progress
- [ ] See time spent learning
- [ ] Review test results
- [ ] Assign specific modules or skills
- [ ] Generate progress reports

**Gamification Enhancements:**
- [ ] Achievement badges for milestones
- [ ] Experience points (XP) system
- [ ] Level-up animations
- [ ] Customizable avatars (unlocked via achievements)
- [ ] Virtual rewards (stickers, themes)

**Deliverables:**
- Complete 8-5 Kyu curriculum
- ~50 total tutorials (cumulative)
- ~40 total skills (cumulative)
- Parent/teacher dashboard
- 2-3 new games
- Enhanced gamification

---

### Phase 3: Advanced Skills (Months 9-14) - "4 Kyu through 1 Kyu"

**Goal:** Advanced operations, real-world applications, mental calculation

**Content Creation:**
- [ ] 4 Kyu: Full multiplication, division introduction (8 weeks)
- [ ] 3 Kyu: Division mastery, mixed operations (8 weeks)
- [ ] 2 Kyu: Decimals, percentages (10 weeks)
- [ ] 1 Kyu: Fractions, word problems, mental calculation (12 weeks)
- Total: ~60 additional tutorials, ~40 additional skills

**Mental Calculation Training:**
- [ ] Visualization exercises (see abacus in mind)
- [ ] Flash anzan (rapid mental calculation)
- [ ] Mental calculation games
- [ ] Transition from physical to mental abacus

**Real-World Applications:**
- [ ] Shopping math (money, change, discounts)
- [ ] Measurement conversions
- [ ] Time calculations
- [ ] Real-world word problems

**Competition Features:**
- [ ] Speed competitions (leaderboards)
- [ ] Accuracy challenges
- [ ] Weekly tournaments
- [ ] Regional/global rankings (optional)

**AI Tutor Assistant:**
- [ ] Smart hints during practice
- [ ] Personalized learning paths
- [ ] Concept explanations on demand
- [ ] Answer specific questions ("Why do I use friends of 5 here?")

**Deliverables:**
- Complete 4-1 Kyu curriculum
- ~110 total tutorials (cumulative)
- ~80 total skills (cumulative)
- Mental calculation training
- AI assistant
- Competition system

---

### Phase 4: Mastery Levels (Months 15-18) - "Dan Levels"

**Goal:** Championship-level speed and accuracy, mental calculation mastery

**Content Creation:**
- [ ] Dan level certification tests
- [ ] Advanced mental calculation curriculum
- [ ] Championship preparation materials
- [ ] Expert-level problem sets

**Advanced Features:**
- [ ] Customized training plans for dan levels
- [ ] Video lessons from expert abacus users
- [ ] Community forum for advanced learners
- [ ] Virtual competitions
- [ ] Certification/diploma generation (printable)

**Integration with Standards:**
- [ ] Align with League of Soroban of Americas standards
- [ ] Japan Abacus Committee certification mapping
- [ ] International competition preparation

**Deliverables:**
- 1-10 Dan curriculum
- Certification system
- Community features
- Championship training

---

### Phase 5: Ecosystem (Months 18+) - "Complete Platform"

**Content Management System:**
- [ ] Tutorial builder UI (create without code)
- [ ] Content versioning
- [ ] Community-contributed content (vetted)
- [ ] Multilingual support (Spanish, Japanese, Hindi)

**Classroom Features:**
- [ ] Teacher creates classes
- [ ] Bulk student enrollment
- [ ] Class-wide assignments
- [ ] Class leaderboards
- [ ] Live teaching mode (project for class)

**Analytics & Insights:**
- [ ] Student learning velocity
- [ ] Skill gap analysis
- [ ] Predictive success modeling
- [ ] Recommendations engine
- [ ] Export data for research

**Mobile App:**
- [ ] iOS and React Native apps
- [ ] Offline mode
- [ ] Sync across devices

**Integrations:**
- [ ] Google Classroom
- [ ] Canvas LMS
- [ ] Schoology
- [ ] Export to SIS systems

**Advanced Gamification:**
- [ ] Story mode (learning quest)
- [ ] Cooperative challenges
- [ ] Guild/team system
- [ ] Seasonal events

---

## Success Metrics

### Student Engagement
- **Daily Active Users (DAU):** Target 40% of registered students
- **Weekly Active Users (WAU):** Target 70% of registered students
- **Average session time:** 20-30 minutes
- **Completion rate per module:** >80%
- **Retention (30-day):** >60%
- **Streak length:** Average 7+ days

### Learning Outcomes
- **Certification pass rate:** >70% on first attempt per kyu level
- **Skill mastery rate:** >85% accuracy on mastered skills after 30 days
- **Time to mastery:** Track average time per kyu level
- **Progression velocity:** Students advance 1 kyu level per 4-8 weeks (varies by level)

### Content Quality
- **Tutorial completion rate:** >90%
- **Practice set completion rate:** >85%
- **Game play rate:** >60% of students play games weekly
- **Assessment completion rate:** >75%

### Platform Health
- **System uptime:** >99.5%
- **Load time:** <2 seconds
- **Error rate:** <0.1%

### Business/Growth
- **Monthly signups:** Track growth month-over-month
- **Paid conversion** (if applicable): Target 10-20%
- **Teacher/school adoption:** Track institutional users
- **Net Promoter Score (NPS):** Target >50

---

## Technical Architecture Changes

### Database Changes Priority

**Immediate (Phase 1):**
```sql
-- Skills and curriculum structure
CREATE TABLE skills (...)
CREATE TABLE modules (...)
CREATE TABLE skill_prerequisites (...)

-- Tutorial and practice content
CREATE TABLE tutorial_content (...)
CREATE TABLE practice_sets (...)
CREATE TABLE assessments (...)

-- User progress tracking
CREATE TABLE user_progress (...)
CREATE TABLE user_skill_history (...)
CREATE TABLE user_assessments (...)
CREATE TABLE user_kyu_levels (...)

-- Game-skill mapping
CREATE TABLE game_skill_mappings (...)
```

**Phase 2:**
- Add spaced repetition tables
- Achievement tracking enhancements
- Peer comparison data

**Phase 3:**
- Mental calculation tracking
- Competition results
- AI tutor interaction logs

### API Endpoints Needed

**Progress & Skills:**
- `GET /api/student/progress` - Current kyu level, skills, next steps
- `GET /api/student/skills/:skillId` - Skill details and progress
- `POST /api/student/skills/:skillId/practice` - Record practice attempt
- `GET /api/student/dashboard` - Dashboard data

**Curriculum:**
- `GET /api/curriculum/kyu/:level` - All modules for kyu level
- `GET /api/curriculum/modules/:moduleId` - Module details
- `GET /api/curriculum/tutorials/:tutorialId` - Tutorial content
- `GET /api/curriculum/next` - Next recommended activity

**Assessments:**
- `POST /api/assessments/placement` - Take placement test
- `POST /api/assessments/skill-check/:skillId` - Practice test
- `POST /api/assessments/certification/:kyuLevel` - Certification test
- `POST /api/assessments/:assessmentId/submit` - Submit answers
- `GET /api/assessments/:assessmentId/results` - Get results

**Games:**
- `GET /api/games/recommended` - Games for current skills
- `POST /api/games/:gameId/result` - Log game completion
- `GET /api/games/:gameId/skills` - Which skills this game teaches

**Teacher/Parent:**
- `GET /api/teacher/students` - List of students
- `GET /api/teacher/students/:studentId/progress` - Student progress
- `POST /api/teacher/assignments` - Create assignment

### Component Architecture

**New Components Needed:**

```
/src/components/curriculum/
  - SkillCard.tsx - Display skill with progress
  - ModuleCard.tsx - Module overview with skills
  - CurriculumMap.tsx - Visual map of curriculum
  - SkillTree.tsx - Dependency graph visualization

/src/components/practice/
  - PracticeSession.tsx - Practice exercise UI
  - ProblemDisplay.tsx - Show problem to solve
  - AnswerInput.tsx - Accept answer (with abacus)
  - FeedbackDisplay.tsx - Show correctness and hints

/src/components/assessment/
  - PlacementTest.tsx - Initial assessment
  - SkillCheckTest.tsx - Practice test
  - CertificationTest.tsx - Formal kyu test
  - TestResults.tsx - Detailed results page

/src/components/dashboard/
  - StudentDashboard.tsx - Main dashboard
  - ProgressOverview.tsx - Current level and progress
  - NextActivity.tsx - Recommended next step
  - AchievementShowcase.tsx - Badges and milestones
  - ActivityFeed.tsx - Recent activity

/src/components/teacher/
  - TeacherDashboard.tsx
  - StudentRoster.tsx
  - StudentDetail.tsx
  - AssignmentCreator.tsx
```

---

## Content Creation Process

### Tutorial Creation Workflow

1. **Define Skill:** What specific skill does this teach?
2. **Outline Steps:** Break down into 5-10 learning steps
3. **Create Interactive Elements:**
   - Which beads to highlight
   - What movements to demonstrate
   - Example problems
4. **Add Explanations:** Clear, kid-friendly language
5. **Test with Students:** Iterate based on confusion points
6. **Publish:** Add to curriculum map

### Tutorial Template

```typescript
{
  id: "friends-of-5-intro",
  title: "Friends of 5 - Introduction",
  skillIds: ["friends-5-recognition"],
  kyuLevel: 9,
  estimatedDuration: 15,
  steps: [
    {
      instruction: "Let's learn about friends of 5! These are pairs of numbers that add up to 5.",
      problem: null,
      highlighting: [],
      explanation: "When you add friends together, they always make 5!"
    },
    {
      instruction: "1 and 4 are friends! See how 1 + 4 = 5?",
      problem: { operation: 'add', terms: [1, 4] },
      highlighting: [
        { column: 0, value: 1, direction: 'activate' },
        { column: 0, value: 4, direction: 'up', step: 2 }
      ],
      explanation: "We set 1 earth bead, then add 4 more by using the heaven bead (5) and removing 1."
    },
    // ... more steps
  ]
}
```

### Practice Set Template

```typescript
{
  id: "friends-5-practice-1",
  skillIds: ["friends-5-recognition", "friends-5-addition"],
  problemCount: 20,
  timeLimit: 300, // 5 minutes
  passingAccuracy: 0.85,
  problemGenerator: {
    type: 'addition',
    numberRange: [1, 9],
    requiresFriends5: true,
    maxTerms: 2
  }
}
```

---

## File Structure for Curriculum

```
/apps/web/src/curriculum/
  /schema/
    - skills.ts (skill definitions)
    - modules.ts (module definitions)
    - assessments.ts (test definitions)

  /content/
    /10-kyu/
      - module-1-intro.ts
      - module-2-setting-numbers.ts
      - module-3-basic-addition.ts
    /9-kyu/
      - module-4-friends-5-intro.ts
      - module-5-friends-5-application.ts
    /8-kyu/
      ... and so on

  /tutorials/
    /10-kyu/
      - intro-to-abacus.ts
      - place-value.ts
      - setting-numbers.ts
      - basic-addition.ts
      - basic-subtraction.ts
    /9-kyu/
      - friends-5-concept.ts
      - friends-5-addition.ts
      - friends-5-subtraction.ts
    ... and so on

  /practice/
    /10-kyu/
      - number-setting-practice.ts
      - basic-addition-practice.ts
    /9-kyu/
      - friends-5-practice.ts
    ... and so on

  /assessments/
    - placement-test.ts
    - 10-kyu-certification.ts
    - 9-kyu-certification.ts
    ... and so on

  - curriculum-map.ts (master curriculum definition)
  - game-skill-mappings.ts (which games teach which skills)
```

---

## Next Immediate Steps

### Week 1: Database Schema Design
- [ ] Design complete schema for Phase 1
- [ ] Write migration scripts
- [ ] Document schema decisions
- [ ] Review with stakeholders

### Week 2-3: Content Planning
- [ ] Write detailed 10 Kyu curriculum outline
- [ ] Write detailed 9 Kyu curriculum outline
- [ ] Define all skills for 10-9 Kyu
- [ ] Map skills to existing games

### Week 4-5: Tutorial Content Creation
- [ ] Write 5 tutorials for 10 Kyu
- [ ] Write 3 tutorials for 9 Kyu
- [ ] Create interactive steps with highlighting
- [ ] Add kid-friendly explanations

### Week 6-7: Assessment System Build
- [ ] Build assessment component UI
- [ ] Implement grading engine
- [ ] Create placement test (20 problems)
- [ ] Create 10 Kyu certification test (30 problems)
- [ ] Create 9 Kyu certification test (40 problems)

### Week 8-9: Practice System
- [ ] Build practice session component
- [ ] Implement problem generator for each skill
- [ ] Add immediate feedback system
- [ ] Create hint system

### Week 10-11: Student Dashboard
- [ ] Design dashboard UI (kid-friendly)
- [ ] Build progress visualization
- [ ] Implement "next recommended activity" logic
- [ ] Add achievement display

### Week 12: Integration & Testing
- [ ] Connect all pieces: tutorials → practice → games → assessment
- [ ] Test complete user flow
- [ ] User testing with kids
- [ ] Iterate based on feedback

---

## Questions to Resolve

1. **Certification Validity:** Should kyu certifications expire? (Traditional abacus schools: no expiration)
2. **Retake Policy:** How many times can student retake certification test? (Suggest: unlimited, but must wait 24 hours)
3. **Grading Standards:** Strict adherence to Japanese standards or adjust for USA context?
4. **Physical Abacus:** Should we require physical abacus for certain levels? (Recommend: optional but encouraged)
5. **Age Restrictions:** Any minimum age? (Suggest: 6+ with parent/teacher supervision)
6. **Teacher Accounts:** Free for teachers? (Recommend: yes, free for teachers)
7. **Pricing Model:** Free tier + premium? School licensing? (TBD)
8. **Content Licensing:** Will curriculum be open source or proprietary? (Recommend: proprietary but allow teacher customization)
9. **Accessibility:** WCAG compliance level? (Recommend: AA minimum)
10. **Data Privacy:** COPPA compliance for users under 13? (Required: yes, must be compliant)

---

## Conclusion

This roadmap provides a clear path from current state (scattered features) to target state (complete educational platform). The phased approach allows incremental delivery while maintaining focus on core learning experience.

**Estimated Timeline:**
- Phase 1 (10-9 Kyu MVP): 3 months
- Phase 2 (8-5 Kyu): 5 months
- Phase 3 (4-1 Kyu): 6 months
- Phase 4 (Dan levels): 3 months
- Phase 5 (Ecosystem): Ongoing

**Total to Complete Platform:** ~17 months for core curriculum, then continuous improvement

**Priority:** Start with Phase 1 to prove the concept, get student feedback, and validate the learning loop before building the full system.
