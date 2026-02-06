#!/usr/bin/env tsx

/**
 * Tutorial System Test Runner
 *
 * This script runs the comprehensive test suite for the tutorial system
 * to ensure no regressions in the following areas:
 *
 * 1. AbacusReact controlled input pattern
 * 2. TutorialContext step initialization and navigation
 * 3. TutorialPlayer integration
 * 4. End-to-end tutorial workflow
 */

import { execSync } from 'child_process'

const TEST_CATEGORIES = [
  {
    name: 'AbacusReact Controlled Input',
    pattern: '**/AbacusReact.controlled-input.test.tsx',
    description: 'Tests the React controlled input pattern implementation in AbacusReact',
  },
  {
    name: 'TutorialContext State Management',
    pattern: '**/TutorialContext.test.tsx',
    description: 'Tests step initialization, navigation, and multi-step functionality',
  },
  {
    name: 'TutorialPlayer Integration',
    pattern: '**/TutorialPlayer.integration.test.tsx',
    description: 'Tests integration between TutorialPlayer and context state',
  },
  {
    name: 'End-to-End Workflow',
    pattern: '**/TutorialWorkflow.e2e.test.ts',
    description: 'Tests complete tutorial workflow from user perspective',
  },
]

async function runTestCategory(category: (typeof TEST_CATEGORIES)[0]) {
  console.log(`\n🧪 Running ${category.name} Tests`)
  console.log(`   ${category.description}`)
  console.log(`   ${'─'.repeat(50)}`)

  try {
    const cmd = category.pattern.endsWith('.e2e.test.ts')
      ? `npx playwright test ${category.pattern}`
      : `npx vitest run ${category.pattern}`

    execSync(cmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log(`✅ ${category.name} tests passed`)
    return true
  } catch (_error) {
    console.error(`❌ ${category.name} tests failed`)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Running Tutorial System Regression Tests')
  console.log('='.repeat(60))

  const results: boolean[] = []

  for (const category of TEST_CATEGORIES) {
    const success = await runTestCategory(category)
    results.push(success)
  }

  const passedTests = results.filter(Boolean).length
  const totalTests = results.length

  console.log('\n📊 Test Summary')
  console.log('─'.repeat(30))
  console.log(`Passed: ${passedTests}/${totalTests}`)

  if (passedTests === totalTests) {
    console.log('🎉 All tutorial tests passed! No regressions detected.')
    process.exit(0)
  } else {
    console.error('💥 Some tests failed. Please check the output above.')
    process.exit(1)
  }
}

async function runSpecificTest(testName: string) {
  const category = TEST_CATEGORIES.find((cat) =>
    cat.name.toLowerCase().includes(testName.toLowerCase())
  )

  if (!category) {
    console.error(`❌ Test category "${testName}" not found`)
    console.log('Available categories:')
    TEST_CATEGORIES.forEach((cat) => console.log(`  - ${cat.name}`))
    process.exit(1)
  }

  await runTestCategory(category)
}

// CLI handling
const args = process.argv.slice(2)

if (args.length === 0) {
  runAllTests()
} else if (args[0] === '--list') {
  console.log('Available test categories:')
  TEST_CATEGORIES.forEach((cat, index) => {
    console.log(`\n${index + 1}. ${cat.name}`)
    console.log(`   Pattern: ${cat.pattern}`)
    console.log(`   Description: ${cat.description}`)
  })
} else {
  runSpecificTest(args[0])
}
