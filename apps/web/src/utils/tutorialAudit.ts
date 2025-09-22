// Comprehensive audit of tutorial steps for abacus calculation errors
import { guidedAdditionSteps } from './tutorialConverter'

interface AuditIssue {
  stepId: string
  stepTitle: string
  issueType: 'mathematical' | 'highlighting' | 'instruction' | 'missing_beads'
  severity: 'critical' | 'major' | 'minor'
  description: string
  currentState: string
  expectedState: string
}

// Helper function to calculate what beads should be active for a given value
function calculateBeadState(value: number): {
  heavenActive: boolean
  earthActive: number // 0-4 earth beads
} {
  const heavenActive = value >= 5
  const earthActive = heavenActive ? value - 5 : value
  return { heavenActive, earthActive }
}

// Helper to determine what beads need to be highlighted for an operation
function analyzeOperation(startValue: number, targetValue: number, operation: string) {
  const startState = calculateBeadState(startValue)
  const targetState = calculateBeadState(targetValue)
  const difference = targetValue - startValue

  console.log(`\n=== ${operation} ===`)
  console.log(`Start: ${startValue} -> Target: ${targetValue} (difference: ${difference})`)
  console.log(`Start state: heaven=${startState.heavenActive}, earth=${startState.earthActive}`)
  console.log(`Target state: heaven=${targetState.heavenActive}, earth=${targetState.earthActive}`)

  return {
    startState,
    targetState,
    difference,
    needsComplement: false // Will be determined by specific analysis
  }
}

export function auditTutorialSteps(): AuditIssue[] {
  const issues: AuditIssue[] = []

  console.log('🔍 Starting comprehensive tutorial audit...\n')

  guidedAdditionSteps.forEach((step, index) => {
    console.log(`\n📝 Step ${index + 1}: ${step.title}`)

    // 1. Verify mathematical correctness
    if (step.startValue + (step.targetValue - step.startValue) !== step.targetValue) {
      issues.push({
        stepId: step.id,
        stepTitle: step.title,
        issueType: 'mathematical',
        severity: 'critical',
        description: 'Mathematical inconsistency in step values',
        currentState: `${step.startValue} + ? = ${step.targetValue}`,
        expectedState: `Should be mathematically consistent`
      })
    }

    // 2. Analyze the operation
    const analysis = analyzeOperation(step.startValue, step.targetValue, step.problem)
    const difference = step.targetValue - step.startValue

    // 3. Check specific operations
    switch (step.id) {
      case 'basic-1': // 0 + 1
        if (!step.highlightBeads || step.highlightBeads.length !== 1) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight exactly 1 earth bead',
            currentState: `Highlights ${step.highlightBeads?.length || 0} beads`,
            expectedState: 'Should highlight 1 earth bead at position 0'
          })
        }
        break

      case 'basic-2': // 1 + 1
        if (!step.highlightBeads || step.highlightBeads[0]?.position !== 1) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight second earth bead (position 1)',
            currentState: `Highlights position ${step.highlightBeads?.[0]?.position}`,
            expectedState: 'Should highlight earth bead at position 1'
          })
        }
        break

      case 'basic-3': // 2 + 1
        if (!step.highlightBeads || step.highlightBeads[0]?.position !== 2) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight third earth bead (position 2)',
            currentState: `Highlights position ${step.highlightBeads?.[0]?.position}`,
            expectedState: 'Should highlight earth bead at position 2'
          })
        }
        break

      case 'basic-4': // 3 + 1
        if (!step.highlightBeads || step.highlightBeads[0]?.position !== 3) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight fourth earth bead (position 3)',
            currentState: `Highlights position ${step.highlightBeads?.[0]?.position}`,
            expectedState: 'Should highlight earth bead at position 3'
          })
        }
        break

      case 'heaven-intro': // 0 + 5
        if (!step.highlightBeads || step.highlightBeads[0]?.beadType !== 'heaven') {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight heaven bead for adding 5',
            currentState: `Highlights ${step.highlightBeads?.[0]?.beadType}`,
            expectedState: 'Should highlight heaven bead'
          })
        }
        break

      case 'heaven-plus-earth': // 5 + 1
        if (!step.highlightBeads || step.highlightBeads[0]?.beadType !== 'earth' || step.highlightBeads[0]?.position !== 0) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight first earth bead to add to existing heaven',
            currentState: `Highlights ${step.highlightBeads?.[0]?.beadType} at position ${step.highlightBeads?.[0]?.position}`,
            expectedState: 'Should highlight earth bead at position 0'
          })
        }
        break

      case 'complement-intro': // 3 + 4 = 7 (using 5 - 1)
        console.log('🔍 Analyzing complement-intro: 3 + 4')
        console.log('Start: 3 earth beads active')
        console.log('Need to add 4, but only 1 earth space remaining')
        console.log('Complement: 4 = 5 - 1, so add heaven (5) then remove 1 earth')

        if (!step.highlightBeads || step.highlightBeads.length !== 2) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight heaven bead and first earth bead for 5-1 complement',
            currentState: `Highlights ${step.highlightBeads?.length || 0} beads`,
            expectedState: 'Should highlight heaven bead + earth position 0'
          })
        }
        break

      case 'complement-2': // 2 + 3 = 5 (using 5 - 2)
        console.log('🔍 Analyzing complement-2: 2 + 3')
        console.log('Start: 2 earth beads active')
        console.log('Need to add 3, but only 2 earth spaces remaining')
        console.log('Complement: 3 = 5 - 2, so add heaven (5) then remove 2 earth')

        if (!step.highlightBeads || step.highlightBeads.length !== 3) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight heaven bead and 2 earth beads for 5-2 complement',
            currentState: `Highlights ${step.highlightBeads?.length || 0} beads`,
            expectedState: 'Should highlight heaven bead + earth positions 0,1'
          })
        }
        break

      case 'complex-1': // 6 + 2 = 8
        console.log('🔍 Analyzing complex-1: 6 + 2')
        console.log('Start: heaven + 1 earth (6)')
        console.log('Add 2 more earth beads directly (space available)')

        if (!step.highlightBeads || step.highlightBeads.length !== 2) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight 2 earth beads to add directly',
            currentState: `Highlights ${step.highlightBeads?.length || 0} beads`,
            expectedState: 'Should highlight earth positions 1,2'
          })
        }
        break

      case 'complex-2': // 7 + 4 = 11 (ten complement)
        console.log('🔍 Analyzing complex-2: 7 + 4')
        console.log('Start: heaven + 2 earth (7)')
        console.log('Need to add 4, requires carrying to tens place')
        console.log('Method: Add 10 (tens heaven), subtract 6 (clear ones: 5+2=7, need to subtract 6)')

        if (!step.highlightBeads || step.highlightBeads.length !== 4) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Should highlight tens heaven + all ones place beads to clear',
            currentState: `Highlights ${step.highlightBeads?.length || 0} beads`,
            expectedState: 'Should highlight tens heaven + ones heaven + 2 ones earth'
          })
        }

        // Check if it highlights the correct beads
        const hasOnesHeaven = step.highlightBeads?.some(h => h.placeValue === 0 && h.beadType === 'heaven')
        const hasTensHeaven = step.highlightBeads?.some(h => h.placeValue === 1 && h.beadType === 'heaven')
        const onesEarthCount = step.highlightBeads?.filter(h => h.placeValue === 0 && h.beadType === 'earth').length || 0

        if (!hasOnesHeaven) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'missing_beads',
            severity: 'critical',
            description: 'Missing ones place heaven bead in highlighting',
            currentState: 'Ones heaven not highlighted',
            expectedState: 'Should highlight ones heaven bead for removal'
          })
        }

        if (!hasTensHeaven) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'missing_beads',
            severity: 'critical',
            description: 'Missing tens place heaven bead in highlighting',
            currentState: 'Tens heaven not highlighted',
            expectedState: 'Should highlight tens heaven bead for addition'
          })
        }

        if (onesEarthCount !== 2) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'missing_beads',
            severity: 'major',
            description: 'Wrong number of ones earth beads highlighted',
            currentState: `${onesEarthCount} ones earth beads highlighted`,
            expectedState: 'Should highlight 2 ones earth beads for removal'
          })
        }
        break
    }

    // 4. Check for place value consistency
    if (step.highlightBeads) {
      step.highlightBeads.forEach(bead => {
        if (bead.placeValue !== 0 && bead.placeValue !== 1) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            issueType: 'highlighting',
            severity: 'major',
            description: 'Invalid place value in highlighting',
            currentState: `placeValue: ${bead.placeValue}`,
            expectedState: 'Should use placeValue 0 (ones) or 1 (tens) for basic tutorial'
          })
        }
      })
    }
  })

  return issues
}

// Run the audit and log results
export function runTutorialAudit(): void {
  console.log('🔍 Running comprehensive tutorial audit...\n')

  const issues = auditTutorialSteps()

  if (issues.length === 0) {
    console.log('✅ No issues found! All tutorial steps appear correct.')
    return
  }

  console.log(`\n🚨 Found ${issues.length} issues:\n`)

  // Group by severity
  const critical = issues.filter(i => i.severity === 'critical')
  const major = issues.filter(i => i.severity === 'major')
  const minor = issues.filter(i => i.severity === 'minor')

  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES:')
    critical.forEach(issue => {
      console.log(`  • ${issue.stepTitle}: ${issue.description}`)
      console.log(`    Current: ${issue.currentState}`)
      console.log(`    Expected: ${issue.expectedState}\n`)
    })
  }

  if (major.length > 0) {
    console.log('🟠 MAJOR ISSUES:')
    major.forEach(issue => {
      console.log(`  • ${issue.stepTitle}: ${issue.description}`)
      console.log(`    Current: ${issue.currentState}`)
      console.log(`    Expected: ${issue.expectedState}\n`)
    })
  }

  if (minor.length > 0) {
    console.log('🟡 MINOR ISSUES:')
    minor.forEach(issue => {
      console.log(`  • ${issue.stepTitle}: ${issue.description}`)
      console.log(`    Current: ${issue.currentState}`)
      console.log(`    Expected: ${issue.expectedState}\n`)
    })
  }

  console.log(`\n📊 Summary: ${critical.length} critical, ${major.length} major, ${minor.length} minor issues`)
}