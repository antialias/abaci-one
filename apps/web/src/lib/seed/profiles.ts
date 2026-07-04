import { MAX_RESPONSE_TIME_CAP_MS } from '../curriculum/timing/constants'
import type { ProfileCategory, ProfileInfo, TestStudentProfile } from './types'

// =============================================================================
// Realistic Curriculum Skill Progressions
// =============================================================================

/** Early Level 1 - just learning basics */
const EARLY_L1_SKILLS = ['basic.directAddition', 'basic.heavenBead']

/** Mid Level 1 - basics strong, learning five complements */
const MID_L1_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
]

/** Late Level 1 Addition - all addition skills */
const LATE_L1_ADD_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
]

/** Complete Level 1 - includes subtraction basics */
const COMPLETE_L1_SKILLS = [
  ...LATE_L1_ADD_SKILLS,
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
  'fiveComplementsSub.-4=-5+1',
  'fiveComplementsSub.-3=-5+2',
  'fiveComplementsSub.-2=-5+3',
  'fiveComplementsSub.-1=-5+4',
]

/** Level 2 skills (ten complements for addition) */
const L2_ADD_SKILLS = [
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
]

// =============================================================================
// All test student profiles
// =============================================================================

export const TEST_PROFILES: TestStudentProfile[] = [
  {
    name: '🔴 Multi-Skill Deficient',
    emoji: '😰',
    color: '#ef4444',
    category: 'bkt',
    description: 'Struggling with many skills - needs intervention',
    currentPhaseId: 'L1.add.+3.direct',
    practicingSkills: EARLY_L1_SKILLS,
    intentionNotes: `INTENTION: Multi-Skill Deficient

This student is in early Level 1 and struggling with basic bead movements. Their BKT estimates show multiple weak skills in the foundational "basic" category.

Curriculum position: Early L1 (L1.add.+3.direct)
Practicing skills: basic.directAddition, basic.heavenBead

This profile represents a student who:
- Is struggling with the very basics of abacus operation
- May need hands-on teacher guidance
- Could benefit from slower progression and more scaffolding
- Might have difficulty with fine motor skills or conceptual understanding

Use this student to test how the UI handles intervention alerts for foundational skill deficits.

TERM COUNT SCALING: Tests low comfort level with weak mastery data.
Expected comfort ~0.2 → abacus 2-4 terms, visualization 2, linear 2-4.
Tooltip should show low avg mastery and short problem lengths.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'weak', problems: 15 },
      { skillId: 'basic.heavenBead', targetClassification: 'weak', problems: 12 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 35,
        gameCount: 3,
        spreadDays: 14,
      },
    ],
    successCriteria: { minWeak: 2 },
    tuningAdjustments: [{ skillId: 'all', problemsAdd: 10 }],
  },
  {
    name: '🟡 Single-Skill Blocker',
    emoji: '🤔',
    color: '#f59e0b',
    category: 'bkt',
    description: 'One weak skill blocking progress, others are fine',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Single-Skill Blocker

This student is progressing well through Level 1 but has ONE specific five-complement skill that's blocking advancement. Most skills are strong, but fiveComplements.3=5-2 is weak.

Curriculum position: Mid L1 (L1.add.+2.five)
Practicing skills: basics + first two five complements

The blocking skill is: fiveComplements.3=5-2 (adding 3 via +5-2)

This profile represents a student who:
- Understands the general concepts well
- Has a specific gap that needs targeted practice
- Should NOT be held back on other skills
- May benefit from focused tutoring on the specific technique

Use this student to test targeted intervention recommendations.

TERM COUNT SCALING: Tests mixed mastery with one weak blocker.
Expected comfort ~0.5 (high avgMastery dragged down by one weak skill).
Good for verifying mid-range term counts (abacus 3-6).`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 15 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 16 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 65,
        gameCount: 5,
        spreadDays: 21,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 70,
        gameCount: 4,
        spreadDays: 21,
      },
    ],
  },
  {
    name: '🟢 Progressing Nicely',
    emoji: '😊',
    color: '#22c55e',
    category: 'bkt',
    description: 'Healthy progression - mostly strong with one skill in progress',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Progressing Nicely

This student shows a healthy learning trajectory - most skills are mastered, with one newer skill still being learned (weak).

Curriculum position: Mid L1 (L1.add.+3.five)
Practicing skills: basics + first two five complements

Expected outcome:
• Most skills strong (mastered basics and early five-complements)
• One weak skill (newest in curriculum, still learning)

This is what a "healthy" student looks like - no intervention flags, steady progress.

Use this student to verify:
• Normal dashboard display without intervention alerts
• Mixed skill states that don't trigger remediation
• Typical student who is making good progress`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'developing', problems: 12 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 10 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 8 },
    ],
    successCriteria: { minDeveloping: 1 },
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 75,
        gameCount: 8,
        spreadDays: 30,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 72,
        gameCount: 6,
        spreadDays: 30,
      },
    ],
  },
  {
    name: '⭐ Ready to Level Up',
    emoji: '🌟',
    color: '#8b5cf6',
    category: 'bkt',
    description: 'All skills strong - ready for next curriculum phase',
    currentPhaseId: 'L1.add.+1.five',
    practicingSkills: LATE_L1_ADD_SKILLS,
    intentionNotes: `INTENTION: Ready to Level Up

This student has mastered ALL Level 1 addition skills and is ready to move to subtraction or Level 2.

Curriculum position: End of L1 Addition (L1.add.+1.five - last addition phase)
Practicing skills: All Level 1 addition skills

All skills at strong mastery (85%+):
• basic.directAddition, heavenBead, simpleCombinations
• All four fiveComplements

This student should be promoted to L1 subtraction or could start L2 addition with carrying.

Use this student to test:
- "Ready to advance" indicators
- Promotion recommendations
- Session planning when all skills are strong

TERM COUNT SCALING: Tests high comfort with all-strong skills.
Expected comfort ~0.85-0.95 → abacus 4-7, visualization 3-5, linear 4-7.
Tooltip should show high avg mastery and longer problem lengths.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 18 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 18 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 88,
        gameCount: 12,
        spreadDays: 45,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 85,
        gameCount: 10,
        spreadDays: 45,
      },
      {
        gameName: 'complement-race',
        displayName: 'Complement Race',
        icon: '🏁',
        category: 'speed',
        targetScore: 82,
        gameCount: 8,
        spreadDays: 45,
      },
    ],
  },
  {
    name: '🚀 Overdue for Promotion',
    emoji: '🏆',
    color: '#06b6d4',
    category: 'bkt',
    description: 'All skills mastered long ago - should have leveled up already',
    currentPhaseId: 'L2.add.+9.ten',
    practicingSkills: [...COMPLETE_L1_SKILLS, ...L2_ADD_SKILLS],
    intentionNotes: `INTENTION: Overdue for Promotion

This student has MASSIVELY exceeded mastery requirements. They've mastered ALL of Level 1 (addition AND subtraction) plus several Level 2 skills!

Curriculum position: Should be deep in L2 (L2.add.+9.ten)
Practicing skills: Complete L1 + early L2

All skills at very high mastery (88-98%):
• ALL basic skills (addition and subtraction)
• ALL four fiveComplements (addition)
• ALL four fiveComplementsSub (subtraction)
• Four tenComplements (L2 addition with carrying)

This is a "red flag" scenario - the system should have advanced this student long ago.

Use this student to test:
- Urgent promotion alerts
- Detection of stale curriculum placement
- Over-mastery warnings

TERM COUNT SCALING: Tests maximum comfort level with 18 strong skills.
Expected comfort ~0.95-1.0 → ceiling ranges: abacus 4-8, visualization 3-6, linear 4-8.
Also tests large skillCountBonus (log(19)/20 ≈ 0.147).`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 30 },
      { skillId: 'basic.directSubtraction', targetClassification: 'strong', problems: 30 },
      { skillId: 'basic.heavenBeadSubtraction', targetClassification: 'strong', problems: 28 },
      { skillId: 'basic.simpleCombinationsSub', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplementsSub.-4=-5+1', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplementsSub.-3=-5+2', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplementsSub.-2=-5+3', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplementsSub.-1=-5+4', targetClassification: 'strong', problems: 22 },
      { skillId: 'tenComplements.9=10-1', targetClassification: 'strong', problems: 20 },
      { skillId: 'tenComplements.8=10-2', targetClassification: 'strong', problems: 20 },
      { skillId: 'tenComplements.7=10-3', targetClassification: 'strong', problems: 18 },
      { skillId: 'tenComplements.6=10-4', targetClassification: 'strong', problems: 18 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 95,
        gameCount: 25,
        spreadDays: 90,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 92,
        gameCount: 20,
        spreadDays: 90,
      },
      {
        gameName: 'complement-race',
        displayName: 'Complement Race',
        icon: '🏁',
        category: 'speed',
        targetScore: 90,
        gameCount: 18,
        spreadDays: 90,
      },
      {
        gameName: 'memory-quiz',
        displayName: 'Memory Quiz',
        icon: '🧠',
        category: 'memory',
        targetScore: 88,
        gameCount: 15,
        spreadDays: 90,
      },
    ],
  },

  // =============================================================================
  // Session Mode Test Profiles
  // =============================================================================

  {
    name: '🎯 Remediation Test',
    emoji: '🎯',
    color: '#dc2626',
    category: 'session',
    description: 'REMEDIATION MODE - Weak skills blocking promotion',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    expectedSessionMode: 'remediation',
    intentionNotes: `INTENTION: Remediation Mode

This student is specifically configured to trigger REMEDIATION mode.

Session Mode: REMEDIATION (with blocked promotion)

What you should see:
• SessionModeBanner shows "Skills need practice" with weak skills listed
• Banner shows blocked promotion: "Ready for +3 (five-complement) once skills are strong"
• StartPracticeModal shows remediation-focused CTA

How it works:
• Has 4 skills practicing: basic.directAddition, heavenBead, simpleCombinations, fiveComplements.4=5-1
• Two skills have low accuracy (< 50%) with enough problems to be confident
• The next skill (fiveComplements.3=5-2) is available but blocked by weak skills

Use this to test the remediation UI in dashboard and modal.

TERM COUNT SCALING: Primary test for remediation mode multiplier (×0.6).
Expected comfort ~0.2 (low avgMastery × 0.6 remediation multiplier).
Problems should be noticeably shorter than maintenance students.
Tooltip should show "Remediation (shorter)" session mode.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'weak', problems: 15 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 18 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 40,
        gameCount: 3,
        spreadDays: 14,
      },
    ],
  },
  {
    name: '📚 Progression Tutorial Test',
    emoji: '📚',
    color: '#7c3aed',
    category: 'session',
    description: 'PROGRESSION MODE - Ready for new skill, tutorial required',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    ensureAllPracticingHaveHistory: true,
    expectedSessionMode: 'progression',
    intentionNotes: `INTENTION: Progression Mode (Tutorial Required)

This student is specifically configured to trigger PROGRESSION mode with tutorial gate.

Session Mode: PROGRESSION (tutorialRequired: true)

What you should see:
• SessionModeBanner shows "New Skill Available" with next skill name
• Banner has "Start Tutorial" button (not "Start Practice")
• StartPracticeModal shows tutorial CTA with skill description

How it works:
• Has 4 skills practicing, ALL are strong (>= 80% accuracy)
• The next skill in curriculum (fiveComplements.3=5-2) is available
• Tutorial for that skill has NOT been completed

Use this to test the progression UI and tutorial gate flow.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 78,
        gameCount: 6,
        spreadDays: 21,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 75,
        gameCount: 5,
        spreadDays: 21,
      },
    ],
  },
  {
    name: '🚀 Progression Ready Test',
    emoji: '🚀',
    color: '#059669',
    category: 'session',
    description: 'PROGRESSION MODE - Tutorial done, ready to practice',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    ensureAllPracticingHaveHistory: true,
    expectedSessionMode: 'progression',
    intentionNotes: `INTENTION: Progression Mode (Tutorial Already Done)

This student is specifically configured to trigger PROGRESSION mode with tutorial satisfied.

Session Mode: PROGRESSION (tutorialRequired: false)

What you should see:
• SessionModeBanner shows "New Skill Available" with next skill name
• Banner has "Start Practice" button (tutorial already done)
• StartPracticeModal shows practice CTA (may show skip count if any)

How it works:
• Has 4 skills practicing, ALL are strong (>= 80% accuracy)
• The next skill in curriculum (fiveComplements.3=5-2) is available
• Tutorial for that skill HAS been completed (tutorialCompleted: true)

Use this to test the progression UI when tutorial is already satisfied.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
    ],
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 80,
        gameCount: 7,
        spreadDays: 28,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 78,
        gameCount: 5,
        spreadDays: 28,
      },
    ],
  },
  {
    name: '🏆 Maintenance Test',
    emoji: '🏆',
    color: '#0891b2',
    category: 'session',
    description: 'MAINTENANCE MODE - All skills strong, mixed practice',
    currentPhaseId: 'L1.add.+4.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
    ],
    ensureAllPracticingHaveHistory: true,
    expectedSessionMode: 'maintenance',
    intentionNotes: `INTENTION: Maintenance Mode

This student is specifically configured to trigger MAINTENANCE mode.

Session Mode: MAINTENANCE

What you should see:
• SessionModeBanner shows "Mixed Practice" or similar
• Banner indicates all skills are strong
• StartPracticeModal shows general practice CTA

How it works:
• Has 7 skills practicing (all L1 addition), ALL are strong (>= 80%)
• All practicing skills have enough history to be confident
• There IS a next skill available but this student is at a natural "pause" point

NOTE: True maintenance mode is rare in practice - usually there's always a next skill.
This profile demonstrates the maintenance case.

Use this to test the maintenance mode UI in dashboard and modal.

TERM COUNT SCALING: Primary test for high comfort in maintenance mode (×1.0).
Expected comfort ~0.9+ (all strong × 1.0 maintenance + skillCountBonus for 7 skills).
Problems should be at the longer end: abacus 4-7, visualization 3-5, linear 4-7.
Compare with 🎯 Remediation Test to see the full comfort range in action.
Also test "Steps per problem" override: set to 4, verify no slot exceeds 4 terms.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
    ],
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 30 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 28 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 20 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 90,
        gameCount: 15,
        spreadDays: 60,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 88,
        gameCount: 12,
        spreadDays: 60,
      },
      {
        gameName: 'complement-race',
        displayName: 'Complement Race',
        icon: '🏁',
        category: 'speed',
        targetScore: 85,
        gameCount: 10,
        spreadDays: 60,
      },
    ],
  },

  // =============================================================================
  // Edge Case Test Profiles
  // =============================================================================

  {
    name: '🆕 Brand New Student',
    emoji: '🌱',
    color: '#84cc16',
    category: 'edge',
    description: 'EDGE CASE - Zero practicing skills, empty state',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: [],
    intentionNotes: `INTENTION: Brand New Student (Edge Case)

This student has NO skills practicing yet - they just created their account.

What you should see:
• Dashboard shows empty state or prompts to start placement test
• SkillHealth may be undefined or have zero counts
• Session mode determination may fall back to progression

This tests the empty state handling in the dashboard.

Use this to verify the dashboard handles zero practicing skills gracefully.

TERM COUNT SCALING: Tests the no-BKT-data fallback path.
Expected comfort = 0.3 (conservative default when no mastery data exists).
Abacus should get ~3-5 terms. Tooltip should show "Avg mastery: N/A".`,
    skillHistory: [],
  },
  {
    name: '🔢 Single Skill Only',
    emoji: '1️⃣',
    color: '#a855f7',
    category: 'edge',
    description: 'EDGE CASE - Only one skill practicing',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: ['basic.directAddition'],
    tutorialCompletedSkills: ['basic.directAddition'],
    intentionNotes: `INTENTION: Single Skill Only (Edge Case)

This student is practicing exactly ONE skill. This is the minimum case.

What you should see:
• Dashboard shows counts with total: 1
• Skill badges show correctly with single count
• Progress calculations work with minimal data

Use this to verify the dashboard handles single-skill students correctly.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'developing', problems: 12 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 55,
        gameCount: 2,
        spreadDays: 7,
      },
    ],
  },
  {
    name: '📊 High Volume Learner',
    emoji: '📈',
    color: '#3b82f6',
    category: 'edge',
    description: 'EDGE CASE - Many skills with lots of practice history',
    currentPhaseId: 'L1.sub.-3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
    ],
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
    ],
    intentionNotes: `INTENTION: High Volume Learner

This student has practiced MANY skills with extensive history - tests dashboard with lots of data.

Curriculum position: Mid L1 Subtraction (L1.sub.-3.five)
Practicing skills: All L1 addition + early subtraction (9 skills total)

Use this to verify:
• Dashboard handles many skills gracefully
• Skill list scrolling/pagination works
• Performance with larger skill counts
• Progress calculations with extensive history

TERM COUNT SCALING: Tests skillCountBonus with 9 practicing skills.
skillCountBonus = min(0.15, log(10)/20) ≈ 0.115 — noticeably higher than
students with fewer skills. Compare comfort level with 🔢 Single Skill Only.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 40 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 22 },
      { skillId: 'basic.directSubtraction', targetClassification: 'developing', problems: 15 },
      { skillId: 'basic.heavenBeadSubtraction', targetClassification: 'developing', problems: 12 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 82,
        gameCount: 30,
        spreadDays: 90,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 80,
        gameCount: 25,
        spreadDays: 90,
      },
      {
        gameName: 'complement-race',
        displayName: 'Complement Race',
        icon: '🏁',
        category: 'speed',
        targetScore: 78,
        gameCount: 20,
        spreadDays: 90,
      },
      {
        gameName: 'memory-quiz',
        displayName: 'Memory Quiz',
        icon: '🧠',
        category: 'memory',
        targetScore: 75,
        gameCount: 15,
        spreadDays: 90,
      },
    ],
  },
  {
    name: '⚖️ Multi-Weak Remediation',
    emoji: '⚖️',
    color: '#f97316',
    category: 'edge',
    description: 'EDGE CASE - Many weak skills needing remediation',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Multi-Weak Remediation (Edge Case)

Originally intended as "balanced mix" with 2 strong + 2 developing + 2 weak,
but BKT's binary nature pushes skills to extremes. Actual output:
• 2 Strong (basic.directAddition, basic.heavenBead)
• 4 Weak (simpleCombinations, fiveComplements.4/3/2=5-...)

REFRAMED PURPOSE - Tests important app features:
• Remediation mode with MANY weak skills (4+)
• Dashboard weak skills display with overflow
• Session mode banner showing multiple skills to strengthen
• Skill list with many red/weak indicators

Use this to verify UI handles many weak skills gracefully.
Complements 🔴 Multi-Skill Deficient (which has only 2 weak).`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'developing', problems: 15 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 14 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'weak', problems: 16 },
    ],
    successCriteria: { minWeak: 2 },
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 42,
        gameCount: 5,
        spreadDays: 30,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 38,
        gameCount: 4,
        spreadDays: 30,
      },
    ],
  },
  {
    name: '🕰️ Stale Skills Test',
    emoji: '⏰',
    color: '#6b7280',
    category: 'edge',
    description: 'EDGE CASE - Skills at various staleness levels',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Stale Skills Test

This student has skills at various staleness levels to test the Stale Skills Section in the Skills tab.

Session Mode: Will depend on BKT state after decay is applied.

Staleness levels:
• 2 skills practiced recently (1 day ago) - should NOT appear in stale section
• 2 skills practiced 10 days ago - "Not practiced recently"
• 1 skill practiced 20 days ago - "Getting rusty"
• 1 skill practiced 45 days ago - "Very stale"

Use this to test:
• StaleSkillsSection component rendering
• "Mark Current" refresh functionality
• Different staleness warning messages
• BKT decay effects on old skills`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20, ageDays: 1 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18, ageDays: 1 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 15,
        ageDays: 10,
      },
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'strong',
        problems: 16,
        ageDays: 10,
      },
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'strong',
        problems: 18,
        ageDays: 20,
      },
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'strong',
        problems: 16,
        ageDays: 45,
      },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 70,
        gameCount: 8,
        spreadDays: 60,
      },
    ],
  },
  {
    name: '💥 NaN Stress Test',
    emoji: '💥',
    color: '#dc2626',
    category: 'edge',
    description: 'EDGE CASE - Stress tests BKT NaN handling with extreme data',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: NaN Stress Test

This student is specifically designed to stress test the BKT NaN handling code.

ROOT CAUSE TESTED: The production NaN bug was caused by legacy data missing
the 'hadHelp' field. The helpWeight() function had no default case,
returning undefined, which caused 'undefined * rtWeight = NaN' to propagate.

The profile includes:
• LEGACY DATA: Skills missing 'hadHelp' (tests the actual root cause)
• Skills with EXTREME accuracy values (0.01 and 0.99)
• Very high problem counts (100+ per skill)
• Mixed recent and very old practice dates
• Boundary conditions that could trigger floating point edge cases

The BKT calculation should handle all of these gracefully:
• No NaN values in the output
• Legacy data should be processed with weight 1.0 (neutral)
• UI should display valid percentages for all skills

If you see "⚠️ Data Error" or NaN values in the dashboard:
1. Check browser console for [BKT] warnings
2. Investigate the specific skill that failed
3. Check the problem history for that skill

Use this profile to verify:
• Legacy data without hadHelp is handled (weight defaults to 1.0)
• BKT core calculations handle extreme pKnown values
• Conjunctive BKT blame attribution works with edge cases
• Evidence quality weights don't produce NaN
• UI gracefully shows errors for any corrupted data`,
    skillHistory: [
      {
        skillId: 'basic.directAddition',
        targetClassification: 'strong',
        problems: 30,
        simulateLegacyData: true,
      },
      {
        skillId: 'basic.heavenBead',
        targetClassification: 'developing',
        problems: 25,
        simulateLegacyData: true,
      },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 100 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 100 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'developing', problems: 50 },
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'strong',
        problems: 40,
        ageDays: 90,
        simulateLegacyData: true,
      },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 60,
        gameCount: 6,
        spreadDays: 45,
      },
    ],
  },
  {
    name: '🧊 Forgotten Weaknesses',
    emoji: '🧊',
    color: '#3b82f6',
    category: 'edge',
    description: 'EDGE CASE - Weak skills that are also stale (urgent remediation needed)',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Forgotten Weaknesses

This student has a realistic mix of weak and stale skills - NOT the same set.

Session Mode: Should trigger REMEDIATION.

Skill breakdown:
• 1 skill STRONG + recent (healthy baseline)
• 1 skill STRONG + stale 20 days (stale-only, should refresh easily)
• 1 skill WEAK + recent (weak-only, actively struggling)
• 1 skill WEAK + stale 14 days (overlap: weak AND stale)
• 1 skill WEAK + stale 35 days (overlap: urgent forgotten weakness)
• 1 skill DEVELOPING + stale 25 days (borderline, needs attention)

This tests:
• Different combinations of weak/stale indicators
• UI distinguishing "stale but strong" from "stale AND weak"
• Session planning prioritizing weak+stale over strong+stale
• BKT decay effects on skills at different mastery levels

Real-world scenario: Student has been practicing inconsistently. Some skills
are rusty from neglect (stale), others they just can't get (weak), and some
are both - the forgotten weaknesses that need urgent attention.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20, ageDays: 1 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18, ageDays: 20 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'weak',
        problems: 15,
        ageDays: 2,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 14, ageDays: 14 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18, ageDays: 35 },
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'developing',
        problems: 16,
        ageDays: 25,
      },
    ],
    successCriteria: { minWeak: 3 },
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 45,
        gameCount: 4,
        spreadDays: 45,
      },
    ],
  },

  // =============================================================================
  // Chart Edge Case Profiles
  // =============================================================================

  {
    name: '📉 Chart: 1 Session Only',
    emoji: '📉',
    color: '#64748b',
    category: 'edge',
    description: 'CHART EDGE - Only 1 session, chart shows legend only (no area chart)',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    minSessions: 1,
    sessionSpreadDays: 1,
    tutorialCompletedSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Chart Edge Case - 1 Session Only

This student has exactly ONE completed practice session.

What you should see:
• SkillProgressChart shows legend cards ONLY (no stacked area chart)
• Legend cards show current skill distribution
• Filter functionality still works
• Motivational message prompts for more practice

Use this to verify the chart gracefully handles the minimum history case.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 8 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 6 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'developing', problems: 5 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 4 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 3 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 50,
        gameCount: 1,
        spreadDays: 1,
      },
    ],
  },
  {
    name: '📊 Chart: 2 Sessions (Min)',
    emoji: '📊',
    color: '#0ea5e9',
    category: 'edge',
    description: 'CHART EDGE - Exactly 2 sessions, minimum to show stacked area chart',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    minSessions: 2,
    sessionSpreadDays: 7,
    tutorialCompletedSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Chart Edge Case - 2 Sessions (Minimum for Chart)

This student has exactly TWO completed practice sessions.

What you should see:
• SkillProgressChart shows stacked area chart with 2 data points
• Chart shows progression from session 1 to session 2
• Legend cards show current skill distribution
• Filter functionality works on both chart and skill lists

Use this to verify the chart renders correctly at the minimum viable history.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 12 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 10 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'developing', problems: 8 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 6 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 5 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 55,
        gameCount: 2,
        spreadDays: 7,
      },
    ],
  },
  {
    name: '📈 Chart: 25 Sessions',
    emoji: '📈',
    color: '#10b981',
    category: 'edge',
    description: 'CHART EDGE - 25 sessions, tests the 20-session display limit',
    currentPhaseId: 'L1.add.+1.five',
    practicingSkills: LATE_L1_ADD_SKILLS,
    minSessions: 25,
    sessionSpreadDays: 60,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: LATE_L1_ADD_SKILLS,
    intentionNotes: `INTENTION: Chart Edge Case - 25 Sessions (Tests 20-Limit)

This student has 25 completed practice sessions over 60 days.
The chart only shows the LAST 20 sessions.

What you should see:
• SkillProgressChart shows stacked area chart with 20 data points (not 25)
• Chart shows smooth progression over 2 months
• Skills transition from weak → developing → strong over time
• Legend cards accurately reflect current state
• X-axis dates span ~40 days (the last 20 sessions)

Use this to verify:
• The 20-session limit is enforced correctly
• Chart handles medium-length histories well
• Date labels are readable and not overcrowded`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 50 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 45 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 40 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 35 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'developing', problems: 25 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'developing', problems: 20 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 75,
        gameCount: 15,
        spreadDays: 60,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 72,
        gameCount: 10,
        spreadDays: 60,
      },
    ],
  },
  {
    name: '🏋️ Chart: 150 Sessions',
    emoji: '🏋️',
    color: '#8b5cf6',
    category: 'edge',
    description: 'CHART EDGE - 150 sessions, stress test for high-volume history',
    currentPhaseId: 'L2.add.+9.ten',
    practicingSkills: [...COMPLETE_L1_SKILLS, ...L2_ADD_SKILLS],
    minSessions: 150,
    sessionSpreadDays: 180,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: [...COMPLETE_L1_SKILLS, ...L2_ADD_SKILLS],
    intentionNotes: `INTENTION: Chart Edge Case - 150 Sessions (Stress Test)

This student has 150 completed practice sessions over 6 months.
This is a STRESS TEST for database queries and chart performance.

What you should see:
• SkillProgressChart shows stacked area chart with exactly 20 data points
• Chart only shows most recent 20 sessions (not all 150)
• Page loads without noticeable delay
• All skills are mastered (strong) after this much practice
• Motivational message reflects the extensive progress

Use this to verify:
• Database query performance with large history
• Chart rendering doesn't slow down with lots of data
• The 20-session limit keeps the UI responsive
• Memory usage stays reasonable`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 150 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 140 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 130 },
      { skillId: 'basic.directSubtraction', targetClassification: 'strong', problems: 120 },
      { skillId: 'basic.heavenBeadSubtraction', targetClassification: 'strong', problems: 110 },
      { skillId: 'basic.simpleCombinationsSub', targetClassification: 'strong', problems: 100 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 90 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 85 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 80 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 75 },
      { skillId: 'fiveComplementsSub.-4=-5+1', targetClassification: 'strong', problems: 70 },
      { skillId: 'fiveComplementsSub.-3=-5+2', targetClassification: 'strong', problems: 65 },
      { skillId: 'fiveComplementsSub.-2=-5+3', targetClassification: 'strong', problems: 60 },
      { skillId: 'fiveComplementsSub.-1=-5+4', targetClassification: 'strong', problems: 55 },
      { skillId: 'tenComplements.9=10-1', targetClassification: 'strong', problems: 50 },
      { skillId: 'tenComplements.8=10-2', targetClassification: 'strong', problems: 45 },
      { skillId: 'tenComplements.7=10-3', targetClassification: 'strong', problems: 40 },
      { skillId: 'tenComplements.6=10-4', targetClassification: 'strong', problems: 35 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 88,
        gameCount: 75,
        spreadDays: 180,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 85,
        gameCount: 50,
        spreadDays: 180,
      },
      {
        gameName: 'complement-race',
        displayName: 'Complement Race',
        icon: '🏁',
        category: 'speed',
        targetScore: 82,
        gameCount: 40,
        spreadDays: 180,
      },
      {
        gameName: 'memory-quiz',
        displayName: 'Memory Quiz',
        icon: '🧠',
        category: 'memory',
        targetScore: 80,
        gameCount: 30,
        spreadDays: 180,
      },
    ],
  },
  {
    name: '🌈 Chart: Dramatic Progress',
    emoji: '🌈',
    color: '#f43f5e',
    category: 'edge',
    description: 'CHART EDGE - Shows dramatic improvement trajectory for motivational display',
    currentPhaseId: 'L1.add.+1.five',
    practicingSkills: LATE_L1_ADD_SKILLS,
    minSessions: 15,
    sessionSpreadDays: 45,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: LATE_L1_ADD_SKILLS,
    intentionNotes: `INTENTION: Chart Edge Case - Dramatic Progress

This student shows a clear learning trajectory where skills go from
mostly weak → developing → mostly strong over 15 sessions.

What you should see:
• SkillProgressChart shows beautiful upward progress
• Early sessions: lots of red (weak) and blue (developing)
• Middle sessions: transition happening
• Recent sessions: mostly green (strong)
• Motivational message celebrates the progress

Use this to verify:
• Chart visually shows the learning journey
• Color transitions are smooth and readable
• Motivational message correctly detects improvement`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 32 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'developing', problems: 18 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'developing', problems: 15 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'weak', problems: 10 },
    ],
    gameHistory: [
      {
        gameName: 'matching',
        displayName: 'Matching Pairs',
        icon: '⚔️',
        category: 'memory',
        targetScore: 78,
        gameCount: 12,
        spreadDays: 45,
      },
      {
        gameName: 'card-sorting',
        displayName: 'Card Sorting',
        icon: '🔢',
        category: 'puzzle',
        targetScore: 75,
        gameCount: 8,
        spreadDays: 45,
      },
    ],
  },

  // =============================================================================
  // Progressive Assistance Test Profiles
  // =============================================================================

  {
    name: '🐢 Slow Struggling Student',
    emoji: '🐢',
    color: '#b45309',
    category: 'edge',
    description: 'PROGRESSIVE ASSISTANCE - Slow responses, thresholds in mid-range (not clamped)',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: MID_L1_SKILLS,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Slow Struggling Student (Progressive Assistance Test)

This student has SLOW response times (15-30s per problem) that produce
progressive assistance thresholds in the mid-range, avoiding min/max clamps.

Response time range: 15,000 - 30,000ms
Expected statistics (with ~40+ problems):
  mean ≈ 22.5s, σ ≈ 4.3s

Expected progressive thresholds:
  encouragement: clamp(22.5s, 8s, 45s) = 22.5s  ← mid-range, not clamped
  helpOffer:     clamp(26.8s, 15s, 90s) = 26.8s  ← mid-range, not clamped
  autoPause:     clamp(31.1s, 30s, 300s) = 31.1s ← just above minimum

Skills are mixed (some weak, some developing) so the student will actually
struggle and trigger the assistance system during practice.

Use this to test:
  • Timer-driven escalation: idle → encouraging → offeringHelp → autoPaused
  • Thresholds computed from actual response time statistics
  • Debug panel showing statistical threshold calculation
  • The full assistance lifecycle with realistic pacing`,
    skillHistory: [
      {
        skillId: 'basic.directAddition',
        targetClassification: 'strong',
        problems: 20,
        responseTimeMsRange: { min: 15000, max: 30000 },
      },
      {
        skillId: 'basic.heavenBead',
        targetClassification: 'developing',
        problems: 18,
        responseTimeMsRange: { min: 15000, max: 30000 },
      },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'weak',
        problems: 15,
        responseTimeMsRange: { min: 15000, max: 30000 },
      },
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'weak',
        problems: 12,
        responseTimeMsRange: { min: 15000, max: 30000 },
      },
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'weak',
        problems: 10,
        responseTimeMsRange: { min: 15000, max: 30000 },
      },
    ],
  },
  {
    name: '🎲 High Variance Student',
    emoji: '🎲',
    color: '#7c3aed',
    category: 'edge',
    description:
      'PROGRESSIVE ASSISTANCE - Wide response time spread, large gaps between thresholds',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: High Variance Student (Progressive Assistance Test)

This student has HIGHLY VARIABLE response times (5-45s per problem).
Some problems are answered quickly, others take very long.
This produces WIDE gaps between progressive assistance thresholds.

Response time range: 5,000 - 45,000ms
Expected statistics (with ~50+ problems):
  mean ≈ 25s, σ ≈ 11.5s

Expected progressive thresholds:
  encouragement: clamp(25s, 8s, 45s)   = 25s    ← mid-range
  helpOffer:     clamp(36.5s, 15s, 90s) = 36.5s  ← mid-range, wide gap from encouragement
  autoPause:     clamp(48s, 30s, 300s)  = 48s    ← well above minimum

The wide σ means there's a BIG gap between encouragement (25s) and
auto-pause (48s), giving the student plenty of time to get help.

Skills are developing (mid-range accuracy) — typical of a student
who sometimes "gets it" and sometimes doesn't.

Use this to test:
  • Large gaps between threshold levels
  • Debug panel threshold progress bar with wide segments
  • Student has time to interact with help offer before auto-pause
  • Statistical calculation handles high variance correctly`,
    skillHistory: [
      {
        skillId: 'basic.directAddition',
        targetClassification: 'strong',
        problems: 22,
        responseTimeMsRange: { min: 5000, max: 45000 },
      },
      {
        skillId: 'basic.heavenBead',
        targetClassification: 'developing',
        problems: 20,
        responseTimeMsRange: { min: 5000, max: 45000 },
      },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'developing',
        problems: 18,
        responseTimeMsRange: { min: 5000, max: 45000 },
      },
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'developing',
        problems: 15,
        responseTimeMsRange: { min: 5000, max: 45000 },
      },
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'weak',
        problems: 12,
        responseTimeMsRange: { min: 5000, max: 45000 },
      },
    ],
  },
  {
    name: '⚡ Fast Responder',
    emoji: '⚡',
    color: '#eab308',
    category: 'edge',
    description: 'PROGRESSIVE ASSISTANCE - Very fast responses, all thresholds at minimum clamps',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: MID_L1_SKILLS,
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Fast Responder (Progressive Assistance Test)

This student has VERY FAST response times (1.5-4s per problem).
All progressive assistance thresholds will hit their MINIMUM clamps.

Response time range: 1,500 - 4,000ms
Expected statistics (with ~50+ problems):
  mean ≈ 2.75s, σ ≈ 0.72s

Expected progressive thresholds (all clamped to minimums):
  encouragement: clamp(2.75s, 8s, 45s)  = 8s   ← minimum clamp
  helpOffer:     clamp(3.47s, 15s, 90s)  = 15s  ← minimum clamp
  autoPause:     clamp(4.19s, 30s, 300s) = 30s  ← minimum clamp

This is the BASELINE case — tests that the min clamps work correctly
and that the assistance system still functions with fast responders.
Most real students answering basic addition will be in this range.

Skills are mostly strong (fast student = proficient student), with
one weak skill to provide a realistic struggle point.

Use this to test:
  • Min clamp behavior (thresholds = 8s, 15s, 30s)
  • Escalation still works at minimum thresholds
  • Compare with 🐢 Slow Struggling to see full threshold range
  • Debug panel showing clamped vs. computed values`,
    skillHistory: [
      {
        skillId: 'basic.directAddition',
        targetClassification: 'strong',
        problems: 25,
        responseTimeMsRange: { min: 1500, max: 4000 },
      },
      {
        skillId: 'basic.heavenBead',
        targetClassification: 'strong',
        problems: 22,
        responseTimeMsRange: { min: 1500, max: 4000 },
      },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 20,
        responseTimeMsRange: { min: 1500, max: 4000 },
      },
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'developing',
        problems: 15,
        responseTimeMsRange: { min: 1500, max: 4000 },
      },
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'weak',
        problems: 10,
        responseTimeMsRange: { min: 1500, max: 4000 },
      },
    ],
  },
  {
    name: '🕰️ Poisoned Timing (idle outlier)',
    emoji: '🕰️',
    color: '#0891b2',
    category: 'edge',
    description:
      'TIMING REVIEW — clean ~5s baseline poisoned by an 8h idle answer + idle-capped + unusual samples',
    currentPhaseId: 'L1.add.+3.five',
    // Exactly the five skills we give explicit history to — no auto-fill, so the
    // anomaly sessions stay deterministic (ensureAll would add ageDays:1 skills
    // that collide with the poison session).
    practicingSkills: MID_L1_SKILLS,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
    ],
    // One session per distinct ageDays (minSessions:1 collapses each age group
    // to a single session), so each anomaly lands in its own recent session.
    minSessions: 1,
    intentionNotes: `INTENTION: Poisoned Timing / Idle Outlier (Timing Review Tool Test — #156/#157/#158)

Reproduces the data shape that broke Fern's plans: a solid clean baseline of
~5s answers, poisoned by a single idle "8-hour" response time — plus one
post-#156 idle-capped attempt and a few genuinely-unusual (Tier-2) samples so
every /review-timings affordance lights up.

Layout (each skill has a UNIQUE ageDays, minSessions:1 → one session each):
  • ageDays 4/5/6 — clean baseline (~5s, default 4-6s range), 42 samples → the
    ≥10 clean samples Tier-2 detection needs.
  • ageDays 1 — fiveComplements.4=5-1: attempt #1 = 28,894,000ms (~8h) with NO
    guard flags  → Tier-1 "legacy-implausible" (Fern's exact shape). Excluded
    from the estimate at READ time; surfaces as "set aside automatically".
  • ageDays 2 — fiveComplements.3=5-2: attempt #1 idle-capped (raw ~8h, stored
    300,000ms, wasIdleCapped)  → Tier-1 "idle-capped" (what post-#156 capture
    looks like).
  • ageDays 3 — basic.directAddition: attempts #1/#3/#5 = 95,000ms each  →
    Tier-2 "unusual-for-child" (winsorized, NOT dropped).

Expected result AFTER the fix (this branch):
  • The estimate stays HEALTHY (~5-6s/problem) despite the 8h poison — proof the
    read-time classifier works; the old 2+2-per-part collapse does NOT recur.
  • Start-Practice shows the "N unusual timings — review" notice (unresolvedCount>0).
  • The two Tier-1 sessions show ⚠️ badges in the history list.
  • /review-timings lists all ~5 flagged attempts with omit / set-time /
    omit-from-mastery / delete-session / confirm-as-real / restore actions.
  • The recovery header shows a visible current(~6s) vs excluding-flagged(~5s)
    delta from the 3 Tier-2 samples; resolving them closes it.

Use this to test:
  • Tier-1 auto-quarantine + surfacing (legacy vs idle-capped reasons)
  • Tier-2 flag-don't-drop + winsorized estimate
  • Every FlaggedAttemptCard action and that counts are resolution-aware
  • That a normal parent is nudged to the tool via the Start-Practice notice`,
    skillHistory: [
      // ---- Clean baseline: ~5s answers across three recent sessions ----------
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 14, ageDays: 4 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 14, ageDays: 5 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 14,
        ageDays: 6,
      },
      // ---- Tier-1b: legacy idle poison (no guard flags, ~8h) -----------------
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'developing',
        problems: 4,
        ageDays: 1,
        timingAnomalies: [{ atIndex: 1, responseTimeMs: 28_894_000 }],
      },
      // ---- Tier-1a: post-#156 idle-capped (raw ~8h, stored 300k) -------------
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'developing',
        problems: 4,
        ageDays: 2,
        timingAnomalies: [
          {
            atIndex: 1,
            responseTimeMs: MAX_RESPONSE_TIME_CAP_MS,
            idleCapped: {
              rawResponseTimeMs: 28_894_000,
              capReason: 'idle-exceeded',
              capThresholdMs: MAX_RESPONSE_TIME_CAP_MS,
              capSource: 'client',
            },
          },
        ],
      },
      // ---- Tier-2: genuinely-unusual-for-this-child (~95s, winsorized) -------
      {
        skillId: 'basic.directAddition',
        targetClassification: 'developing',
        problems: 6,
        ageDays: 3,
        timingAnomalies: [
          { atIndex: 1, responseTimeMs: 95_000 },
          { atIndex: 3, responseTimeMs: 95_000 },
          { atIndex: 5, responseTimeMs: 95_000 },
        ],
      },
    ],
  },
]

// =============================================================================
// Profile filtering and tag utilities
// =============================================================================

/**
 * Automatically derive filter tags from profile properties
 */
export function deriveTags(profile: TestStudentProfile): string[] {
  const tags: string[] = []

  // Category tag
  tags.push(profile.category)

  // Session mode tags
  if (profile.expectedSessionMode) {
    tags.push(profile.expectedSessionMode)
  }

  // Special property tags
  if (profile.skillHistory.some((s) => s.ageDays && s.ageDays > 7)) {
    tags.push('stale-skills')
  }
  if (profile.skillHistory.some((s) => s.simulateLegacyData)) {
    tags.push('legacy-data')
  }
  if (profile.name.toLowerCase().includes('chart')) {
    tags.push('chart-test')
  }
  if (profile.practicingSkills.length === 0) {
    tags.push('empty-state')
  }
  if (profile.intentionNotes.includes('TERM COUNT SCALING')) {
    tags.push('term-count-scaling')
  }
  if (profile.skillHistory.some((s) => s.responseTimeMsRange)) {
    tags.push('progressive-assistance')
  }
  if (profile.skillHistory.some((s) => s.timingAnomalies && s.timingAnomalies.length > 0)) {
    tags.push('timing-anomaly')
  }

  return tags
}

/**
 * Filter profiles by category and/or names
 */
export function filterProfiles(
  profiles: TestStudentProfile[],
  options: { names?: string[]; categories?: ProfileCategory[] }
): TestStudentProfile[] {
  const { names = [], categories = [] } = options

  if (names.length === 0 && categories.length === 0) {
    return profiles
  }

  return profiles.filter((profile) => {
    const matchesName =
      names.length === 0 ||
      names.some(
        (n) =>
          profile.name.toLowerCase().includes(n.toLowerCase()) ||
          n.toLowerCase().includes(profile.name.toLowerCase())
      )

    const matchesCategory = categories.length === 0 || categories.includes(profile.category)

    if (names.length > 0 && categories.length > 0) {
      return matchesName || matchesCategory
    }

    return matchesName && matchesCategory
  })
}

/**
 * Get lightweight profile info for the UI (avoids shipping full profile data to client)
 */
export function getProfileInfoList(): ProfileInfo[] {
  return TEST_PROFILES.map((profile) => ({
    name: profile.name,
    emoji: profile.emoji,
    description: profile.description,
    category: profile.category,
    intentionNotes: profile.intentionNotes,
    tags: deriveTags(profile),
    expectedSessionMode: profile.expectedSessionMode,
    practicingSkillCount: profile.practicingSkills.length,
    skillHistoryCount: profile.skillHistory.length,
  }))
}
