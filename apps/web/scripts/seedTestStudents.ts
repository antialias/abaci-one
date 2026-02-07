#!/usr/bin/env npx tsx
/**
 * Seed script to create multiple test students with different BKT scenarios.
 *
 * Uses the REAL problem generator to create realistic problems with proper
 * skill tagging. Each profile declares its INTENTION, and after generation
 * the ACTUAL outcomes are appended to the student notes.
 *
 * Usage:
 *   npm run seed:test-students [options]
 *
 * Options:
 *   --help, -h              Show this help message
 *   --list, -l              List all available students and categories
 *   --name, -n <name>       Seed specific student(s) by name (can use multiple times)
 *   --category, -c <cat>    Seed all students in a category (can use multiple times)
 *   --dry-run               Show what would be seeded without creating students
 */

import { parseArgs } from 'node:util'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../src/db'
import { createClassroom, getTeacherClassroom } from '../src/lib/classroom/classroom-manager'
import {
  TEST_PROFILES,
  filterProfiles,
  createTestStudentWithTuning,
  type ProfileCategory,
  type TestStudentProfile,
} from '../src/lib/seed'

// =============================================================================
// CLI Argument Parsing
// =============================================================================

const { values: cliArgs } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    list: { type: 'boolean', short: 'l', default: false },
    name: { type: 'string', short: 'n', multiple: true, default: [] },
    category: { type: 'string', short: 'c', multiple: true, default: [] },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
})

function showHelp(): void {
  console.log(`
Usage:
  npm run seed:test-students [options]

Options:
  --help, -h              Show this help message
  --list, -l              List all available students and categories
  --name, -n <name>       Seed specific student(s) by name (can use multiple times)
  --category, -c <cat>    Seed all students in a category (can use multiple times)
  --dry-run               Show what would be seeded without creating students

Categories:
  bkt          Core BKT scenarios (deficient, blocker, progressing, etc.)
  session      Session mode tests (remediation, progression, maintenance)
  edge         Edge cases (empty, single skill, high volume, NaN stress test)

Examples:
  npm run seed:test-students                     # Seed all students
  npm run seed:test-students -- --list           # List available options
  npm run seed:test-students -- -n "💥 NaN Stress Test"
  npm run seed:test-students -- -c edge          # Seed all edge case students
  npm run seed:test-students -- -c bkt -c session
  npm run seed:test-students -- -n "🔴 Multi-Skill Deficient" -n "🟢 Progressing Nicely"
`)
}

function listProfiles(): void {
  console.log('\n📋 Available Test Students:\n')

  const categories: Record<ProfileCategory, TestStudentProfile[]> = {
    bkt: [],
    session: [],
    edge: [],
  }

  for (const profile of TEST_PROFILES) {
    categories[profile.category].push(profile)
  }

  console.log('BKT Scenarios (--category bkt):')
  for (const p of categories.bkt) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log('\nSession Mode Tests (--category session):')
  for (const p of categories.session) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log('\nEdge Cases (--category edge):')
  for (const p of categories.edge) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log(`\nTotal: ${TEST_PROFILES.length} students\n`)
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  if (cliArgs.help) {
    showHelp()
    process.exit(0)
  }

  if (cliArgs.list) {
    listProfiles()
    process.exit(0)
  }

  // Filter profiles based on CLI args
  const profilesToSeed = filterProfiles(TEST_PROFILES, {
    names: cliArgs.name as string[],
    categories: cliArgs.category as ProfileCategory[],
  })

  if (profilesToSeed.length === 0) {
    console.log('❌ No students match the specified filters.')
    console.log('   Use --list to see available students.')
    process.exit(1)
  }

  if (cliArgs['dry-run']) {
    console.log('🧪 DRY RUN - Would seed the following students:\n')
    for (const profile of profilesToSeed) {
      console.log(`   ${profile.name} [${profile.category}]`)
      console.log(`      ${profile.description}`)
    }
    console.log(`\nTotal: ${profilesToSeed.length} students`)
    process.exit(0)
  }

  console.log('🧪 Seeding Test Students for BKT Testing...\n')

  const names = cliArgs.name as string[]
  const categories = cliArgs.category as string[]
  if (names.length > 0 || categories.length > 0) {
    console.log(`   Filtering: ${profilesToSeed.length} of ${TEST_PROFILES.length} students`)
    if (names.length > 0) console.log(`   Names: ${names.join(', ')}`)
    if (categories.length > 0) console.log(`   Categories: ${categories.join(', ')}`)
    console.log('')
  }

  // Find the most recent browser session
  console.log('1. Finding most recent browser session...')

  const recentSession = await db.query.sessionPlans.findFirst({
    orderBy: [desc(schema.sessionPlans.createdAt)],
  })

  let userId: string | null = null
  let foundVia = ''

  if (recentSession) {
    const sessionPlayer = await db.query.players.findFirst({
      where: eq(schema.players.id, recentSession.playerId),
    })

    if (sessionPlayer && !sessionPlayer.userId.startsWith('test-user')) {
      userId = sessionPlayer.userId
      foundVia = `session activity from player: ${sessionPlayer.name}`
    }
  }

  if (!userId) {
    const testEmojiPatterns = [
      '🔴',
      '🟡',
      '🟢',
      '⭐',
      '🚀',
      '🎯',
      '📚',
      '🏆',
      '🆕',
      '🔢',
      '📊',
      '⚖️',
      '🕰️',
    ]

    const realPlayer = await db.query.players.findFirst({
      where: (players, { not, like, and, notLike }) =>
        and(
          not(like(players.name, '%Test%')),
          notLike(players.userId, 'test-user%'),
          ...testEmojiPatterns.map((emoji) => notLike(players.name, `${emoji}%`))
        ),
      orderBy: [desc(schema.players.createdAt)],
    })

    if (realPlayer) {
      userId = realPlayer.userId
      foundVia = `player: ${realPlayer.name}`
    }
  }

  if (!userId) {
    console.error('❌ No real users found! Create a student at /practice first.')
    console.error('   (Make sure you have a non-test player in your browser session)')
    process.exit(1)
  }

  console.log(`   Found user via ${foundVia}`)

  // Set up teacher classroom
  console.log('\n2. Setting up teacher classroom...')

  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, userId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: userId }).returning()
    user = newUser
    console.log(`   Created user record for ${userId}`)
  }

  let classroom = await getTeacherClassroom(user.id)

  if (!classroom) {
    const result = await createClassroom({
      teacherId: user.id,
      name: 'Test Classroom',
    })
    if (result.success && result.classroom) {
      classroom = result.classroom
      console.log(`   Created classroom: ${classroom.name} (code: ${classroom.code})`)
    } else {
      console.error(`   ❌ Failed to create classroom: ${result.error}`)
      process.exit(1)
    }
  } else {
    console.log(`   Using existing classroom: ${classroom.name} (code: ${classroom.code})`)
  }

  if (!classroom) {
    throw new Error('No classroom available')
  }

  // Create each test profile with iterative tuning
  console.log('\n3. Creating test students (with up to 2 tuning rounds if needed)...\n')

  for (const profile of profilesToSeed) {
    const { playerId, classifications, tuningHistory } = await createTestStudentWithTuning(
      profile,
      userId,
      classroom.id,
      3, // maxRounds: initial + 2 tuning rounds
      (msg) => console.log(`      ${msg}`)
    )
    const { weak, developing, strong } = classifications

    console.log(`   ${profile.name}`)
    console.log(`      ${profile.description}`)
    console.log(`      Phase: ${profile.currentPhaseId}`)
    console.log(`      Practicing: ${profile.practicingSkills.length} skills`)
    console.log(
      `      Classifications: 🔴 ${weak} weak, 📚 ${developing} developing, ✅ ${strong} strong`
    )
    if (profile.expectedSessionMode) {
      console.log(`      Expected Mode: ${profile.expectedSessionMode.toUpperCase()}`)
    }
    if (profile.tutorialCompletedSkills) {
      console.log(`      Tutorials Completed: ${profile.tutorialCompletedSkills.length} skills`)
    }
    if (tuningHistory.length > 1) {
      const finalRound = tuningHistory[tuningHistory.length - 1]
      console.log(
        `      Tuning: ${tuningHistory.length} rounds, final: ${finalRound.success ? '✅ success' : '⚠️ best effort'}`
      )
    }
    console.log(`      Player ID: ${playerId}`)
    console.log('')
  }

  console.log('✅ All test students created and enrolled!')
  console.log(`\n   Classroom: ${classroom.name} (code: ${classroom.code})`)
  console.log(`   Students enrolled: ${profilesToSeed.length}`)
  console.log('\n   Visit http://localhost:3000/practice to see them.')
}

main().catch((err) => {
  console.error('Error seeding test students:', err)
  process.exit(1)
})
