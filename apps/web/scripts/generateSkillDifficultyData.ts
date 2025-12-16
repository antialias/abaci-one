#!/usr/bin/env tsx
/**
 * Generate JSON data from skill difficulty test snapshots.
 *
 * This script reads the Vitest snapshot file and extracts the data
 * into a JSON format that can be consumed by the blog post charts.
 *
 * Usage: npx tsx scripts/generateSkillDifficultyData.ts
 * Output: public/data/skill-difficulty-report.json
 */

import fs from 'fs'
import path from 'path'

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  'src/test/journey-simulator/__snapshots__/skill-difficulty.test.ts.snap'
)

const OUTPUT_PATH = path.join(process.cwd(), 'public/data/skill-difficulty-report.json')

interface SnapshotData {
  learningTrajectory: {
    exposuresToMastery: Record<string, number>
    categoryAverages: Record<string, number>
  }
  masteryCurves: {
    table: Array<{
      exposures: number
      [key: string]: string | number
    }>
  }
  fiftyPercentThresholds: {
    exposuresFor50Percent: Record<string, number>
    ratiosRelativeToBasic: Record<string, string>
  }
  abComparison: {
    withDifficulty: Record<string, number[]>
    withoutDifficulty: Record<string, number[]>
    summary: {
      withDifficulty: Record<string, { avgAt20: number }>
      withoutDifficulty: Record<string, { avgAt20: number }>
    }
  }
  learningExpectations: {
    at20Exposures: Record<string, string>
    gapBetweenEasiestAndHardest: string
  }
  exposureRatio: {
    basicExposures: number
    tenCompExposures: number
    ratio: string
    targetMastery: string
  }
}

function parseSnapshotFile(content: string): SnapshotData {
  // Extract each snapshot export using regex
  const extractSnapshot = (name: string): unknown => {
    const regex = new RegExp(
      `exports\\[\`[^\\]]*${name}[^\\]]*\`\\]\\s*=\\s*\`([\\s\\S]*?)\`;`,
      'm'
    )
    const match = content.match(regex)
    if (!match) {
      console.warn(`Warning: Could not find snapshot: ${name}`)
      return null
    }
    try {
      // The snapshot content is a JavaScript object literal, parse it
      // eslint-disable-next-line no-eval
      return eval(`(${match[1]})`)
    } catch (e) {
      console.error(`Error parsing snapshot ${name}:`, e)
      return null
    }
  }

  const learningTrajectory = extractSnapshot('learning-trajectory-by-category') as {
    exposuresToMastery: Record<string, number>
    categoryAverages: Record<string, number>
  }

  const masteryCurvesRaw = extractSnapshot('mastery-curves-table') as {
    table: Array<Record<string, string | number>>
  }

  const fiftyPercent = extractSnapshot('fifty-percent-threshold-ratios') as {
    exposuresFor50Percent: Record<string, number>
    ratiosRelativeToBasic: Record<string, string>
  }

  const abComparison = extractSnapshot('skill-difficulty-ab-comparison') as {
    withDifficulty: Record<string, number[]>
    withoutDifficulty: Record<string, number[]>
    summary: {
      withDifficulty: Record<string, { avgAt20: number }>
      withoutDifficulty: Record<string, { avgAt20: number }>
    }
  }

  const learningExpectations = extractSnapshot('learning-expectations-validation') as {
    at20Exposures: Record<string, string>
    gapBetweenEasiestAndHardest: string
  }

  const exposureRatio = extractSnapshot('exposure-ratio-for-equal-mastery') as {
    basicExposures: number
    tenCompExposures: number
    ratio: string
    targetMastery: string
  }

  return {
    learningTrajectory,
    masteryCurves: masteryCurvesRaw,
    fiftyPercentThresholds: fiftyPercent,
    abComparison,
    learningExpectations,
    exposureRatio,
  }
}

function generateReport(data: SnapshotData) {
  const exposurePoints = [5, 10, 15, 20, 25, 30, 40, 50]

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0',

    // Summary stats
    summary: {
      basicAvgExposures: data.learningTrajectory?.categoryAverages?.basic ?? 17,
      fiveCompAvgExposures: data.learningTrajectory?.categoryAverages?.fiveComplement ?? 24,
      tenCompAvgExposures: data.learningTrajectory?.categoryAverages?.tenComplement ?? 36,
      gapAt20Exposures:
        data.learningExpectations?.gapBetweenEasiestAndHardest ?? '36.2 percentage points',
      exposureRatioForEqualMastery: data.exposureRatio?.ratio ?? '1.92',
    },

    // Data for mastery curves chart
    masteryCurves: {
      exposurePoints,
      skills: [
        {
          id: 'basic.directAddition',
          label: 'Basic (0.8x)',
          category: 'basic',
          color: '#22c55e', // green
          data: data.abComparison?.withDifficulty?.['basic.directAddition']?.map(
            (v) => v * 100
          ) ?? [28, 61, 78, 86, 91, 93, 96, 98],
        },
        {
          id: 'fiveComplements.4=5-1',
          label: 'Five-Complement (1.2x)',
          category: 'fiveComplement',
          color: '#eab308', // yellow
          data: data.abComparison?.withDifficulty?.['fiveComplements.4=5-1']?.map(
            (v) => v * 100
          ) ?? [15, 41, 61, 74, 81, 86, 92, 95],
        },
        {
          id: 'tenComplements.9=10-1',
          label: 'Ten-Complement Easy (1.6x)',
          category: 'tenComplement',
          color: '#f97316', // orange
          data: data.abComparison?.withDifficulty?.['tenComplements.9=10-1']?.map(
            (v) => v * 100
          ) ?? [9, 28, 47, 61, 71, 78, 86, 91],
        },
        {
          id: 'tenComplements.1=10-9',
          label: 'Ten-Complement Hard (2.0x)',
          category: 'tenComplement',
          color: '#ef4444', // red
          data: data.abComparison?.withDifficulty?.['tenComplements.1=10-9']?.map(
            (v) => v * 100
          ) ?? [6, 20, 36, 50, 61, 69, 80, 86],
        },
      ],
    },

    // Data for A/B comparison chart
    abComparison: {
      exposurePoints,
      withDifficulty: data.abComparison?.summary?.withDifficulty ?? {},
      withoutDifficulty: data.abComparison?.summary?.withoutDifficulty ?? {},
    },

    // Data for exposures to mastery bar chart
    exposuresToMastery: {
      target: '80%',
      categories: [
        {
          name: 'Basic Skills',
          avgExposures: data.learningTrajectory?.categoryAverages?.basic ?? 17,
          color: '#22c55e',
          skills: Object.entries(data.learningTrajectory?.exposuresToMastery ?? {})
            .filter(([k]) => k.startsWith('basic.'))
            .map(([k, v]) => ({ id: k, exposures: v })),
        },
        {
          name: 'Five-Complements',
          avgExposures: data.learningTrajectory?.categoryAverages?.fiveComplement ?? 24,
          color: '#eab308',
          skills: Object.entries(data.learningTrajectory?.exposuresToMastery ?? {})
            .filter(([k]) => k.startsWith('fiveComplements.'))
            .map(([k, v]) => ({ id: k, exposures: v })),
        },
        {
          name: 'Ten-Complements',
          avgExposures: data.learningTrajectory?.categoryAverages?.tenComplement ?? 36,
          color: '#ef4444',
          skills: Object.entries(data.learningTrajectory?.exposuresToMastery ?? {})
            .filter(([k]) => k.startsWith('tenComplements.'))
            .map(([k, v]) => ({ id: k, exposures: v })),
        },
      ],
    },

    // Data for 50% threshold comparison
    fiftyPercentThresholds: data.fiftyPercentThresholds ?? {
      exposuresFor50Percent: {
        'basic.directAddition': 8,
        'fiveComplements.4=5-1': 12,
        'tenComplements.9=10-1': 16,
        'tenComplements.1=10-9': 20,
      },
      ratiosRelativeToBasic: {
        'basic.directAddition': '1.00',
        'fiveComplements.4=5-1': '1.50',
        'tenComplements.9=10-1': '2.00',
        'tenComplements.1=10-9': '2.50',
      },
    },

    // Mastery table for tabular display
    masteryTable: data.masteryCurves?.table ?? [],
  }
}

async function main() {
  console.log('Reading snapshot file...')

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot file not found: ${SNAPSHOT_PATH}`)
    console.log(
      'Run the tests first: npx vitest run src/test/journey-simulator/skill-difficulty.test.ts'
    )
    process.exit(1)
  }

  const snapshotContent = fs.readFileSync(SNAPSHOT_PATH, 'utf-8')
  console.log('Parsing snapshots...')

  const data = parseSnapshotFile(snapshotContent)
  console.log('Generating report...')

  const report = generateReport(data)

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2))
  console.log(`Report written to: ${OUTPUT_PATH}`)

  // Print summary
  console.log('\n--- Summary ---')
  console.log(`Basic skills avg: ${report.summary.basicAvgExposures} exposures to 80%`)
  console.log(`Five-complements avg: ${report.summary.fiveCompAvgExposures} exposures to 80%`)
  console.log(`Ten-complements avg: ${report.summary.tenCompAvgExposures} exposures to 80%`)
  console.log(`Gap at 20 exposures: ${report.summary.gapAt20Exposures}`)
  console.log(`Exposure ratio (ten-comp/basic): ${report.summary.exposureRatioForEqualMastery}x`)
}

main().catch(console.error)
