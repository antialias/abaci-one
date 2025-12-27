'use client'

import * as Tabs from '@radix-ui/react-tabs'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Dynamic import echarts to reduce bundle size
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading chart...</div>,
})
import { css } from '../../../styled-system/css'

const chartContainerStyles = css({
  bg: 'bg.surface',
  borderRadius: '0.5rem',
  p: { base: '0.5rem', md: '1rem' },
  border: '1px solid',
  borderColor: 'border.muted',
  my: '1.5rem',
})

const tabStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
})

const tabListStyles = css({
  display: 'flex',
  gap: '0.25rem',
  borderBottom: '1px solid',
  borderColor: 'border.muted',
  pb: '0',
  overflowX: 'auto',
  flexWrap: 'nowrap',
})

const tabTriggerStyles = css({
  px: { base: '0.75rem', md: '1rem' },
  py: '0.75rem',
  fontSize: { base: '0.75rem', md: '0.875rem' },
  fontWeight: 500,
  color: 'text.muted',
  bg: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s',
  _hover: {
    color: 'text.primary',
    bg: 'accent.subtle',
  },
  '&[data-state="active"]': {
    color: 'accent.emphasis',
    borderBottomColor: 'accent.emphasis',
  },
})

const tabContentStyles = css({
  pt: '1.5rem',
  outline: 'none',
})

const summaryCardStyles = css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
  },
  gap: '1rem',
  mb: '1.5rem',
})

const statCardStyles = css({
  bg: 'bg.surface',
  borderRadius: '0.5rem',
  p: '1rem',
  border: '1px solid',
  borderColor: 'border.muted',
  textAlign: 'center',
})

const statValueStyles = css({
  fontSize: { base: '1.5rem', md: '2rem' },
  fontWeight: 'bold',
  color: 'accent.emphasis',
})

const statLabelStyles = css({
  fontSize: '0.75rem',
  color: 'text.muted',
  mt: '0.25rem',
})

// Type definitions for multi-skill trajectory data
interface TrajectorySkillData {
  id: string
  label: string
  category: 'fiveComplement' | 'tenComplement' | 'basic'
  color: string
  adaptive: {
    data: number[]
    sessionsTo50: number | null
    sessionsTo80: number | null
  }
  classic: {
    data: number[]
    sessionsTo50: number | null
    sessionsTo80: number | null
  }
}

interface TrajectoryData {
  generatedAt: string
  config: {
    seed: number
    sessionCount: number
    sessionDurationMinutes: number
  }
  summary: {
    totalSkills: number
    adaptiveWins50: number
    classicWins50: number
    ties50: number
    adaptiveWins80: number
    classicWins80: number
    ties80: number
  }
  sessions: number[]
  skills: TrajectorySkillData[]
  comparisonTable: Array<{
    skill: string
    category: string
    adaptiveTo80: number | null
    classicTo80: number | null
    advantage: string | null
  }>
}

const skillButtonStyles = css({
  px: '0.75rem',
  py: '0.5rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'text.muted',
  bg: 'bg.surface',
  border: '1px solid',
  borderColor: 'border.muted',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  transition: 'all 0.2s',
  whiteSpace: 'nowrap',
  _hover: {
    bg: 'accent.subtle',
    borderColor: 'accent.default',
  },
  '&[data-selected="true"]': {
    bg: 'accent.muted',
    color: 'accent.emphasis',
    borderColor: 'accent.default',
  },
})

/**
 * Example Trajectory Chart - Shows mastery progression over sessions
 * for adaptive vs classic modes
 */
export function ExampleTrajectoryChart() {
  // Data from blog post validation results
  const sessions = [0, 2, 3, 4, 5, 6, 9, 12]
  const adaptiveMastery = [0, 34, 64, 72, 77, 83, 91, 94]
  const classicMastery = [0, 9, 21, 39, 54, 61, 83, 91]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: number }>) => {
        const session = params[0]?.axisValue
        let html = `<strong>Session ${session}</strong><br/>`
        for (const p of params) {
          const color = p.seriesName === 'Adaptive' ? '#22c55e' : '#6b7280'
          html += `<span style="color:${color}">${p.seriesName}</span>: ${p.value}%<br/>`
        }
        return html
      },
    },
    legend: {
      data: ['Adaptive', 'Classic'],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sessions,
      name: 'Session',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Mastery %',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Adaptive',
        type: 'line',
        data: adaptiveMastery,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#22c55e', width: 3 },
        itemStyle: { color: '#22c55e' },
        markLine: {
          silent: true,
          lineStyle: { color: '#374151', type: 'dashed' },
          data: [
            { yAxis: 50, label: { formatter: '50%', color: '#9ca3af' } },
            { yAxis: 80, label: { formatter: '80%', color: '#9ca3af' } },
          ],
        },
      },
      {
        name: 'Classic',
        type: 'line',
        data: classicMastery,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#6b7280', width: 3 },
        itemStyle: { color: '#6b7280' },
      },
    ],
  }

  return (
    <div data-component="example-trajectory-chart" className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Mastery Progression: Adaptive vs Classic
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Fast learner deficient in <code>fiveComplements.3=5-2</code>. Adaptive reaches 80% mastery
        by session 6; classic takes until session 9.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/**
 * Convergence Speed Chart - Shows sessions to reach 50% and 80% mastery
 * across different skills for adaptive vs classic modes
 * @deprecated Use ValidationResultsCharts instead
 */
export function ConvergenceSpeedChart() {
  // Summarized data from blog post - focusing on key comparisons
  const skills = [
    'fiveComp\n3=5-2',
    'fiveCompSub\n-3=-5+2',
    'tenComp\n9=10-1',
    'tenComp\n5=10-5',
    'tenCompSub\n-9=+1-10',
  ]

  // null represents "never reached 80%"
  const adaptiveTo80: (number | null)[] = [6, 6, 5, 10, 7]
  const classicTo80: (number | null)[] = [9, 8, 6, null, 12]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (
        params: Array<{
          seriesName: string
          value: number | null
          name: string
        }>
      ) => {
        const skill = params[0]?.name.replace('\n', ' ')
        let html = `<strong>${skill}</strong><br/>`
        for (const p of params) {
          const value = p.value === null ? 'Never (>12 sessions)' : `${p.value} sessions`
          html += `${p.seriesName}: ${value}<br/>`
        }
        return html
      },
    },
    legend: {
      data: [
        { name: 'Adaptive', itemStyle: { color: '#22c55e' } },
        { name: 'Classic', itemStyle: { color: '#6b7280' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: skills,
      axisLabel: {
        color: '#9ca3af',
        interval: 0,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Sessions to 80%',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 14,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Adaptive',
        type: 'bar',
        data: adaptiveTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#22c55e' },
        })),
        barWidth: '35%',
        itemStyle: { color: '#22c55e' },
        label: {
          show: true,
          position: 'top',
          formatter: (params: { value: number | null }) =>
            params.value === null ? '—' : params.value,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
      {
        name: 'Classic',
        type: 'bar',
        data: classicTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#6b7280' },
        })),
        barWidth: '35%',
        itemStyle: { color: '#6b7280' },
        label: {
          show: true,
          position: 'top',
          formatter: (params: { value: number | null }) =>
            params.value === null ? 'Never' : params.value,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div data-component="convergence-speed-chart" className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Sessions to Reach 80% Mastery (Fast Learner)
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Adaptive mode consistently reaches mastery faster. "Never" indicates the mode did not reach
        80% within 12 sessions.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/**
 * Automaticity Multiplier Chart - Shows the non-linear curve
 * from P(known) to cost multiplier
 */
export function AutomaticityMultiplierChart() {
  // Generate smooth curve data
  // Formula: multiplier = 4 - 3 * pKnown^2 (non-linear squared mapping)
  const dataPoints: Array<[number, number]> = []
  for (let p = 0; p <= 1; p += 0.02) {
    const multiplier = 4 - 3 * p * p
    dataPoints.push([Math.round(p * 100), Number(multiplier.toFixed(2))])
  }

  // Key reference points from the blog post
  const referencePoints = [
    { pKnown: 100, multiplier: 1.0 },
    { pKnown: 95, multiplier: 1.3 },
    { pKnown: 90, multiplier: 1.6 },
    { pKnown: 80, multiplier: 2.1 },
    { pKnown: 50, multiplier: 3.3 },
    { pKnown: 0, multiplier: 4.0 },
  ]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ value: [number, number] }>) => {
        const [pKnown, multiplier] = params[0]?.value || [0, 0]
        return `P(known): ${pKnown}%<br/>Multiplier: ${multiplier}×`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'P(known) %',
      nameLocation: 'middle',
      nameGap: 30,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Cost Multiplier',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 5,
      axisLabel: { color: '#9ca3af', formatter: '{value}×' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Multiplier Curve',
        type: 'line',
        data: dataPoints,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: '#8b5cf6',
          width: 3,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
            ],
          },
        },
      },
      {
        name: 'Reference Points',
        type: 'scatter',
        data: referencePoints.map((p) => [p.pKnown, p.multiplier]),
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: '#8b5cf6', borderColor: '#fff', borderWidth: 2 },
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value: [number, number] }) => `${params.value[1]}×`,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div data-component="automaticity-multiplier-chart" className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Non-Linear Cost Multiplier Curve
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        The squared mapping provides better differentiation at high mastery levels. A skill at 50%
        P(known) costs 3.3× more than a fully automated skill.
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

/**
 * Combined Validation Results with Tabbed Interface
 * Shows mastery progression, convergence comparison, and data table
 */
export function ValidationResultsCharts() {
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryData | null>(null)

  useEffect(() => {
    fetch('/data/ab-mastery-trajectories.json')
      .then((res) => res.json())
      .then((data) => setTrajectoryData(data))
      .catch((err) => console.error('Failed to load trajectory data:', err))
  }, [])

  // Use data from JSON if available, otherwise fallback to hardcoded values
  const summaryStats = trajectoryData?.summary ?? {
    adaptiveWins50: 4,
    classicWins50: 0,
    adaptiveWins80: 6,
    classicWins80: 0,
  }

  return (
    <div data-component="validation-results-charts" className={css({ my: '2rem' })}>
      {/* Summary Cards */}
      <div className={summaryCardStyles}>
        <div className={statCardStyles}>
          <div className={statValueStyles}>
            {summaryStats.adaptiveWins50}-{summaryStats.classicWins50}
          </div>
          <div className={statLabelStyles}>Adaptive wins to 50% mastery</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>
            {summaryStats.adaptiveWins80}-{summaryStats.classicWins80}
          </div>
          <div className={statLabelStyles}>Adaptive wins to 80% mastery</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>25-100%</div>
          <div className={statLabelStyles}>Faster mastery with adaptive</div>
        </div>
      </div>

      {/* Tabbed Charts */}
      <Tabs.Root defaultValue="multi-skill" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="multi-skill" className={tabTriggerStyles}>
            All Skills
          </Tabs.Trigger>
          <Tabs.Trigger value="trajectory" className={tabTriggerStyles}>
            Single Skill
          </Tabs.Trigger>
          <Tabs.Trigger value="convergence" className={tabTriggerStyles}>
            Convergence
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="multi-skill" className={tabContentStyles}>
          <MultiSkillTrajectoryChart data={trajectoryData} />
        </Tabs.Content>

        <Tabs.Content value="trajectory" className={tabContentStyles}>
          <InteractiveTrajectoryChart data={trajectoryData} />
        </Tabs.Content>

        <Tabs.Content value="convergence" className={tabContentStyles}>
          <ConvergenceChart data={trajectoryData} />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <ValidationDataTable data={trajectoryData} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

/** Get skill difficulty tier for line thickness */
function getSkillTier(skillId: string): 'basic' | 'fiveComp' | 'tenComp' | 'cascading' {
  if (skillId.includes('cascading') || skillId.includes('advanced')) {
    return 'cascading'
  }
  if (skillId.startsWith('tenComplements') || skillId.startsWith('tenComplementsSub')) {
    return 'tenComp'
  }
  if (skillId.startsWith('fiveComplements') || skillId.startsWith('fiveComplementsSub')) {
    return 'fiveComp'
  }
  return 'basic'
}

/** Get line width based on skill tier */
function getLineWidth(tier: 'basic' | 'fiveComp' | 'tenComp' | 'cascading'): number {
  switch (tier) {
    case 'basic':
      return 1
    case 'fiveComp':
      return 1.5
    case 'tenComp':
      return 2
    case 'cascading':
      return 2.5
  }
}

/** Get pedagogical order for color spectrum (0 = easiest, 1 = hardest) */
function getPedagogicalOrder(skillId: string): number {
  // Order based on typical learning progression
  if (skillId.includes('basic')) return 0
  if (skillId.includes('fiveComplements.4')) return 0.15
  if (skillId.includes('fiveComplements.3')) return 0.2
  if (skillId.includes('fiveComplements.2')) return 0.25
  if (skillId.includes('fiveComplements.1')) return 0.3
  if (skillId.includes('fiveComplementsSub.-4')) return 0.35
  if (skillId.includes('fiveComplementsSub.-3')) return 0.4
  if (skillId.includes('fiveComplementsSub.-2')) return 0.45
  if (skillId.includes('fiveComplementsSub.-1')) return 0.5
  if (skillId.includes('tenComplements.9')) return 0.55
  if (skillId.includes('tenComplements.8')) return 0.6
  if (skillId.includes('tenComplements.7')) return 0.65
  if (skillId.includes('tenComplements.6')) return 0.7
  if (skillId.includes('tenComplements.5')) return 0.72
  if (skillId.includes('tenComplements.4')) return 0.74
  if (skillId.includes('tenComplements.3')) return 0.76
  if (skillId.includes('tenComplements.2')) return 0.78
  if (skillId.includes('tenComplements.1')) return 0.8
  if (skillId.includes('tenComplementsSub.-9')) return 0.82
  if (skillId.includes('tenComplementsSub.-5')) return 0.88
  if (skillId.includes('tenComplementsSub.-1')) return 0.95
  if (skillId.includes('cascading')) return 1.0
  return 0.5
}

/** Interpolate color along a spectrum */
function interpolateColor(t: number, colors: Array<{ r: number; g: number; b: number }>): string {
  const idx = t * (colors.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.min(lower + 1, colors.length - 1)
  const blend = idx - lower

  const r = Math.round(colors[lower].r + (colors[upper].r - colors[lower].r) * blend)
  const g = Math.round(colors[lower].g + (colors[upper].g - colors[lower].g) * blend)
  const b = Math.round(colors[lower].b + (colors[upper].b - colors[lower].b) * blend)

  return `rgb(${r}, ${g}, ${b})`
}

// Color spectrums for each mode
const ADAPTIVE_SPECTRUM = [
  { r: 187, g: 247, b: 208 }, // light green
  { r: 74, g: 222, b: 128 }, // green
  { r: 22, g: 163, b: 74 }, // darker green
]

const CLASSIC_SPECTRUM = [
  { r: 209, g: 213, b: 219 }, // light gray
  { r: 156, g: 163, b: 175 }, // gray
  { r: 75, g: 85, b: 99 }, // dark gray
]

/** Average mastery trajectory chart comparing adaptive vs classic */
function MultiSkillTrajectoryChart({ data }: { data: TrajectoryData | null }) {
  if (!data) {
    return (
      <div className={chartContainerStyles}>
        <p
          className={css({
            color: 'text.muted',
            textAlign: 'center',
            py: '2rem',
          })}
        >
          Loading trajectory data...
        </p>
      </div>
    )
  }

  // Add session 0 to show initial mastery state
  const sessions = [0, ...data.sessions]
  const numSkills = data.skills.length

  // Calculate average mastery across all skills for each session (including session 0)
  const adaptiveAvg = sessions.map((_, sessionIdx) => {
    if (sessionIdx === 0) {
      // Session 0: use initial estimate (30% of first session value)
      const sum = data.skills.reduce((acc, skill) => acc + skill.adaptive.data[0] * 0.3, 0)
      return Math.round(sum / numSkills)
    }
    const sum = data.skills.reduce((acc, skill) => acc + skill.adaptive.data[sessionIdx - 1], 0)
    return Math.round(sum / numSkills)
  })

  const classicAvg = sessions.map((_, sessionIdx) => {
    if (sessionIdx === 0) {
      // Session 0: use initial estimate (30% of first session value)
      const sum = data.skills.reduce((acc, skill) => acc + skill.classic.data[0] * 0.3, 0)
      return Math.round(sum / numSkills)
    }
    const sum = data.skills.reduce((acc, skill) => acc + skill.classic.data[sessionIdx - 1], 0)
    return Math.round(sum / numSkills)
  })

  // Build ghost lines for individual skills
  const ghostSeries: Array<{
    name: string
    type: 'line'
    data: number[]
    smooth: boolean
    symbol: string
    symbolSize: number
    lineStyle: { color: string; width: number; opacity: number }
    itemStyle: { color: string; opacity: number }
    emphasis: { disabled: boolean }
    z: number
  }> = []

  // Sort skills by pedagogical order for consistent layering
  const sortedSkills = [...data.skills].sort(
    (a, b) => getPedagogicalOrder(a.id) - getPedagogicalOrder(b.id)
  )

  for (const skill of sortedSkills) {
    const order = getPedagogicalOrder(skill.id)
    const tier = getSkillTier(skill.id)
    const width = getLineWidth(tier)

    const adaptiveColor = interpolateColor(order, ADAPTIVE_SPECTRUM)
    const classicColor = interpolateColor(order, CLASSIC_SPECTRUM)

    // Prepend session 0 data (initial estimate)
    const adaptiveWithZero = [skill.adaptive.data[0] * 0.3, ...skill.adaptive.data]
    const classicWithZero = [skill.classic.data[0] * 0.3, ...skill.classic.data]

    // Adaptive ghost line
    ghostSeries.push({
      name: `${skill.label} (A)`,
      type: 'line',
      data: adaptiveWithZero,
      smooth: true,
      symbol: 'none',
      symbolSize: 0,
      lineStyle: { color: adaptiveColor, width, opacity: 0.4 },
      itemStyle: { color: adaptiveColor, opacity: 0.4 },
      emphasis: { disabled: true },
      z: 1,
    })

    // Classic ghost line
    ghostSeries.push({
      name: `${skill.label} (C)`,
      type: 'line',
      data: classicWithZero,
      smooth: true,
      symbol: 'none',
      symbolSize: 0,
      lineStyle: { color: classicColor, width, opacity: 0.4 },
      itemStyle: { color: classicColor, opacity: 0.4 },
      emphasis: { disabled: true },
      z: 1,
    })
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number; marker: string }>) => {
        const session = (params[0] as unknown as { axisValue: number })?.axisValue
        // Only show averages in tooltip (not ghost lines)
        const adaptiveParam = params.find((p) => p.seriesName === 'Adaptive (avg)')
        const classicParam = params.find((p) => p.seriesName === 'Classic (avg)')
        if (!adaptiveParam || !classicParam) return ''

        const diff = adaptiveParam.value - classicParam.value
        const diffStr =
          diff > 0
            ? `<span style="color:#22c55e">+${diff}pp</span>`
            : diff < 0
              ? `<span style="color:#ef4444">${diff}pp</span>`
              : '0pp'

        return `<strong>Session ${session}</strong><br/>
          ${adaptiveParam.marker} Adaptive: ${adaptiveParam.value}%<br/>
          ${classicParam.marker} Classic: ${classicParam.value}%<br/>
          Advantage: ${diffStr}`
      },
    },
    legend: {
      data: [
        { name: 'Adaptive (avg)', itemStyle: { color: '#22c55e' } },
        { name: 'Classic (avg)', itemStyle: { color: '#6b7280' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sessions,
      name: 'Session',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Mastery %',
      nameLocation: 'middle',
      nameGap: 45,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      // Ghost lines first (lower z-index)
      ...ghostSeries,
      // Average lines on top (higher z-index, full opacity, thicker)
      {
        name: 'Adaptive (avg)',
        type: 'line',
        data: adaptiveAvg,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#22c55e', width: 4 },
        itemStyle: { color: '#22c55e' },
        z: 10,
        markLine: {
          silent: true,
          lineStyle: { color: '#374151', type: 'dashed' },
          data: [
            { yAxis: 50, label: { formatter: '50%', color: '#9ca3af' } },
            { yAxis: 80, label: { formatter: '80%', color: '#9ca3af' } },
          ],
        },
      },
      {
        name: 'Classic (avg)',
        type: 'line',
        data: classicAvg,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#6b7280', width: 4 },
        itemStyle: { color: '#6b7280' },
        z: 10,
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Mastery Progression: Adaptive vs Classic
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Bold lines show average across {numSkills} skills. Ghost lines show individual skills
        (greens = adaptive, grays = classic). Thicker lines = harder skills (ten-complements).
        Darker shades = later in pedagogical sequence.
      </p>
      <ReactECharts option={option} style={{ height: '400px' }} />
    </div>
  )
}

/** Category types for average toggles */
type SkillCategory = 'basic' | 'fiveComp' | 'tenComp' | 'cascading'

/** Get category from skill ID */
function getSkillCategory(skillId: string): SkillCategory {
  if (skillId.includes('cascading') || skillId.includes('advanced')) {
    return 'cascading'
  }
  if (skillId.startsWith('tenComplements') || skillId.startsWith('tenComplementsSub')) {
    return 'tenComp'
  }
  if (skillId.startsWith('fiveComplements') || skillId.startsWith('fiveComplementsSub')) {
    return 'fiveComp'
  }
  return 'basic'
}

/** Category display names */
const CATEGORY_LABELS: Record<SkillCategory, string> = {
  basic: 'Basic',
  fiveComp: 'Friends of 5',
  tenComp: 'Friends of 10',
  cascading: 'Regrouping',
}

/** Category colors */
const CATEGORY_COLORS: Record<SkillCategory, { adaptive: string; classic: string }> = {
  basic: { adaptive: '#86efac', classic: '#d1d5db' },
  fiveComp: { adaptive: '#4ade80', classic: '#9ca3af' },
  tenComp: { adaptive: '#22c55e', classic: '#6b7280' },
  cascading: { adaptive: '#16a34a', classic: '#4b5563' },
}

const categoryToggleStyles = css({
  px: '0.5rem',
  py: '0.25rem',
  fontSize: '0.7rem',
  fontWeight: 500,
  color: 'text.muted',
  bg: 'bg.surface',
  border: '1px solid',
  borderColor: 'border.muted',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  transition: 'all 0.2s',
  _hover: {
    bg: 'accent.subtle',
    borderColor: 'accent.default',
  },
  '&[data-active="true"]': {
    bg: 'accent.muted',
    color: 'accent.emphasis',
    borderColor: 'accent.default',
  },
})

/** Interactive single-skill trajectory chart with skill selector and category averages */
function InteractiveTrajectoryChart({ data }: { data: TrajectoryData | null }) {
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  const [showCategoryAverages, setShowCategoryAverages] = useState<Set<SkillCategory>>(new Set())

  if (!data) {
    return (
      <div className={chartContainerStyles}>
        <p
          className={css({
            color: 'text.muted',
            textAlign: 'center',
            py: '2rem',
          })}
        >
          Loading trajectory data...
        </p>
      </div>
    )
  }

  const selectedSkill = data.skills[selectedSkillIndex]
  // Add session 0 to show initial mastery state
  const sessions = [0, ...data.sessions]

  // Get line width based on selected skill's tier
  const selectedTier = getSkillTier(selectedSkill.id)
  const selectedLineWidth = getLineWidth(selectedTier)

  // Prepend initial mastery (assume low starting point for weak skills)
  const adaptiveData = [selectedSkill.adaptive.data[0] * 0.3, ...selectedSkill.adaptive.data]
  const classicData = [selectedSkill.classic.data[0] * 0.3, ...selectedSkill.classic.data]

  // Calculate category averages
  const categoryAverages: Record<SkillCategory, { adaptive: number[]; classic: number[] }> = {
    basic: { adaptive: [], classic: [] },
    fiveComp: { adaptive: [], classic: [] },
    tenComp: { adaptive: [], classic: [] },
    cascading: { adaptive: [], classic: [] },
  }

  // Group skills by category
  const skillsByCategory: Record<SkillCategory, TrajectorySkillData[]> = {
    basic: [],
    fiveComp: [],
    tenComp: [],
    cascading: [],
  }

  for (const skill of data.skills) {
    const cat = getSkillCategory(skill.id)
    skillsByCategory[cat].push(skill)
  }

  // Calculate averages for each category
  for (const cat of ['basic', 'fiveComp', 'tenComp', 'cascading'] as SkillCategory[]) {
    const skills = skillsByCategory[cat]
    if (skills.length === 0) continue

    for (let i = 0; i < sessions.length; i++) {
      if (i === 0) {
        // Session 0: use initial estimate
        const adaptiveSum = skills.reduce((acc, s) => acc + s.adaptive.data[0] * 0.3, 0)
        const classicSum = skills.reduce((acc, s) => acc + s.classic.data[0] * 0.3, 0)
        categoryAverages[cat].adaptive.push(Math.round(adaptiveSum / skills.length))
        categoryAverages[cat].classic.push(Math.round(classicSum / skills.length))
      } else {
        const adaptiveSum = skills.reduce((acc, s) => acc + s.adaptive.data[i - 1], 0)
        const classicSum = skills.reduce((acc, s) => acc + s.classic.data[i - 1], 0)
        categoryAverages[cat].adaptive.push(Math.round(adaptiveSum / skills.length))
        categoryAverages[cat].classic.push(Math.round(classicSum / skills.length))
      }
    }
  }

  // Build series
  const series: Array<{
    name: string
    type: 'line'
    data: number[]
    smooth: boolean
    symbol: string
    symbolSize: number
    lineStyle: {
      color: string
      width: number
      type?: string
      opacity?: number
    }
    itemStyle: { color: string; opacity?: number }
    z?: number
    markLine?: unknown
  }> = []

  // Add category averages first (as ghost lines behind main skill)
  for (const cat of ['basic', 'fiveComp', 'tenComp', 'cascading'] as SkillCategory[]) {
    if (!showCategoryAverages.has(cat)) continue
    if (skillsByCategory[cat].length === 0) continue

    const catLineWidth = getLineWidth(cat)
    const colors = CATEGORY_COLORS[cat]

    series.push({
      name: `${CATEGORY_LABELS[cat]} Avg (A)`,
      type: 'line',
      data: categoryAverages[cat].adaptive,
      smooth: true,
      symbol: 'none',
      symbolSize: 0,
      lineStyle: { color: colors.adaptive, width: catLineWidth, opacity: 0.5 },
      itemStyle: { color: colors.adaptive, opacity: 0.5 },
      z: 1,
    })

    series.push({
      name: `${CATEGORY_LABELS[cat]} Avg (C)`,
      type: 'line',
      data: categoryAverages[cat].classic,
      smooth: true,
      symbol: 'none',
      symbolSize: 0,
      lineStyle: {
        color: colors.classic,
        width: catLineWidth,
        type: 'dashed',
        opacity: 0.5,
      },
      itemStyle: { color: colors.classic, opacity: 0.5 },
      z: 1,
    })
  }

  // Add main skill lines on top
  series.push({
    name: 'Adaptive',
    type: 'line',
    data: adaptiveData,
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: {
      color: '#22c55e',
      width: Math.max(selectedLineWidth * 1.5, 3),
    },
    itemStyle: { color: '#22c55e' },
    z: 10,
    markLine: {
      silent: true,
      lineStyle: { color: '#374151', type: 'dashed' },
      data: [
        { yAxis: 50, label: { formatter: '50%', color: '#9ca3af' } },
        { yAxis: 80, label: { formatter: '80%', color: '#9ca3af' } },
      ],
    },
  })

  series.push({
    name: 'Classic',
    type: 'line',
    data: classicData,
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: {
      color: '#6b7280',
      width: Math.max(selectedLineWidth * 1.5, 3),
    },
    itemStyle: { color: '#6b7280' },
    z: 10,
  })

  // Build legend data
  const legendData: Array<{ name: string; itemStyle: { color: string } }> = [
    { name: 'Adaptive', itemStyle: { color: '#22c55e' } },
    { name: 'Classic', itemStyle: { color: '#6b7280' } },
  ]

  for (const cat of ['basic', 'fiveComp', 'tenComp', 'cascading'] as SkillCategory[]) {
    if (showCategoryAverages.has(cat) && skillsByCategory[cat].length > 0) {
      legendData.push({
        name: `${CATEGORY_LABELS[cat]} Avg (A)`,
        itemStyle: { color: CATEGORY_COLORS[cat].adaptive },
      })
    }
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: number }>) => {
        const session = params[0]?.axisValue
        let html = `<strong>Session ${session}</strong><br/>`
        for (const p of params) {
          if (p.seriesName.includes('(C)')) continue // Skip classic avg in tooltip to reduce clutter
          const color =
            p.seriesName.includes('Adaptive') || p.seriesName.includes('(A)')
              ? '#22c55e'
              : '#6b7280'
          const label = p.seriesName.replace(' (A)', '')
          html += `<span style="color:${color}">${label}</span>: ${p.value}%<br/>`
        }
        return html
      },
    },
    legend: {
      data: legendData,
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sessions,
      name: 'Session',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Mastery %',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series,
  }

  // Calculate advantage for selected skill
  const adaptiveTo80 = selectedSkill.adaptive.sessionsTo80
  const classicTo80 = selectedSkill.classic.sessionsTo80
  let advantageText = ''
  if (adaptiveTo80 !== null && classicTo80 !== null) {
    const diff = classicTo80 - adaptiveTo80
    advantageText = diff > 0 ? `Adaptive ${diff} sessions faster` : 'Same speed'
  } else if (adaptiveTo80 !== null && classicTo80 === null) {
    advantageText = 'Classic never reached 80%'
  }

  // Toggle category average
  const toggleCategory = (cat: SkillCategory) => {
    const newSet = new Set(showCategoryAverages)
    if (newSet.has(cat)) {
      newSet.delete(cat)
    } else {
      newSet.add(cat)
    }
    setShowCategoryAverages(newSet)
  }

  // Get available categories (those with skills in the data)
  const availableCategories = (
    ['basic', 'fiveComp', 'tenComp', 'cascading'] as SkillCategory[]
  ).filter((cat) => skillsByCategory[cat].length > 0)

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Mastery Progression: {selectedSkill.label}
      </h4>

      {/* Skill selector */}
      <div
        className={css({
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          mb: '0.75rem',
        })}
      >
        {data.skills.map((skill, index) => {
          const tier = getSkillTier(skill.id)
          const width = getLineWidth(tier)
          return (
            <button
              type="button"
              key={skill.id}
              className={skillButtonStyles}
              data-selected={index === selectedSkillIndex}
              onClick={() => setSelectedSkillIndex(index)}
              style={{
                borderColor: skill.color,
                borderWidth: `${width}px`,
              }}
            >
              {skill.label}
            </button>
          )
        })}
      </div>

      {/* Category average toggles */}
      {availableCategories.length > 0 && (
        <div
          className={css({
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            mb: '0.75rem',
            alignItems: 'center',
          })}
        >
          <span className={css({ fontSize: '0.75rem', color: 'text.muted' })}>Show averages:</span>
          {availableCategories.map((cat) => (
            <button
              type="button"
              key={cat}
              className={categoryToggleStyles}
              data-active={showCategoryAverages.has(cat)}
              onClick={() => toggleCategory(cat)}
              style={{
                borderWidth: `${getLineWidth(cat)}px`,
                borderColor: showCategoryAverages.has(cat)
                  ? CATEGORY_COLORS[cat].adaptive
                  : undefined,
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        <strong>Adaptive:</strong> 80% by session {adaptiveTo80 ?? 'never'} |{' '}
        <strong>Classic:</strong> 80% by session {classicTo80 ?? 'never'}
        {advantageText && (
          <span className={css({ color: 'green.400', ml: '0.5rem' })}>({advantageText})</span>
        )}
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/** Internal: Convergence bar chart for tabs - updated to use data prop */
function ConvergenceChart({ data }: { data: TrajectoryData | null }) {
  // Build data from trajectoryData if available, otherwise use fallback
  const skills = data?.skills.map((s) => s.label.replace(': ', '\n')) ?? [
    'fiveComp\n3=5-2',
    'fiveCompSub\n-3=-5+2',
    'tenComp\n9=10-1',
    'tenComp\n5=10-5',
    'tenCompSub\n-9=+1-10',
  ]

  const adaptiveTo80 = data?.skills.map((s) => s.adaptive.sessionsTo80) ?? [6, 6, 5, 10, 7]

  const classicTo80 = data?.skills.map((s) => s.classic.sessionsTo80) ?? [9, 8, 6, null, 12]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (
        params: Array<{
          seriesName: string
          value: number | null
          name: string
        }>
      ) => {
        const skill = params[0]?.name.replace('\n', ' ')
        let html = `<strong>${skill}</strong><br/>`
        for (const p of params) {
          const value = p.value === null ? 'Never (>12 sessions)' : `${p.value} sessions`
          html += `${p.seriesName}: ${value}<br/>`
        }
        return html
      },
    },
    legend: {
      data: [
        { name: 'Adaptive', itemStyle: { color: '#22c55e' } },
        { name: 'Classic', itemStyle: { color: '#6b7280' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: skills,
      axisLabel: { color: '#9ca3af', interval: 0, fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Sessions to 80%',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 14,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Adaptive',
        type: 'bar',
        data: adaptiveTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#22c55e' },
        })),
        barWidth: '35%',
        itemStyle: { color: '#22c55e' },
        label: {
          show: true,
          position: 'top',
          formatter: (params: { value: number | null }) =>
            params.value === null ? '—' : params.value,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
      {
        name: 'Classic',
        type: 'bar',
        data: classicTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#6b7280' },
          label:
            v === null
              ? {
                  show: true,
                  position: 'inside',
                  formatter: 'Never',
                  color: '#ef4444',
                }
              : undefined,
        })),
        barWidth: '35%',
        itemStyle: { color: '#6b7280' },
        label: {
          show: true,
          position: 'top',
          formatter: (params: { value: number | null }) =>
            params.value === null ? 'Never' : params.value,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Sessions to Reach 80% Mastery by Skill
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Adaptive mode consistently reaches mastery faster across all tested skills. "—" or "Never"
        indicates the mode did not reach 80% within 12 sessions.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/** Internal: Data table for validation results tabs - updated to use data prop */
function ValidationDataTable({ data }: { data: TrajectoryData | null }) {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
    },
    '& tr:hover td': {
      bg: 'accent.subtle',
    },
  })

  // Use comparison table from data if available
  const comparisonData = data?.comparisonTable ?? [
    {
      skill: 'fiveComp 3=5-2',
      adaptiveTo80: 6,
      classicTo80: 9,
      advantage: 'Adaptive +3 sessions',
    },
  ]

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        A/B Comparison Summary
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Sessions to reach 80% mastery for each skill, comparing adaptive vs classic modes.
      </p>
      <div className={css({ overflowX: 'auto' })}>
        <table className={tableStyles}>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Adaptive → 80%</th>
              <th>Classic → 80%</th>
              <th>Advantage</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row) => (
              <tr key={row.skill}>
                <td
                  className={css({
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  })}
                >
                  {row.skill}
                </td>
                <td className={css({ color: 'green.400', fontWeight: 600 })}>
                  {row.adaptiveTo80 ?? 'never'}
                </td>
                <td className={css({ color: 'text.muted' })}>{row.classicTo80 ?? 'never'}</td>
                <td
                  className={css({
                    color: row.advantage?.includes('Adaptive') ? 'green.400' : 'text.muted',
                    fontWeight: 500,
                  })}
                >
                  {row.advantage ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * 3-Way Comparison Charts with Tabbed Interface
 * Compares Classic, Adaptive (fluency), and Adaptive (full BKT)
 */
export function ThreeWayComparisonCharts() {
  return (
    <div data-component="three-way-comparison-charts" className={css({ my: '2rem' })}>
      {/* Summary insight */}
      <div className={summaryCardStyles}>
        <div className={statCardStyles}>
          <div className={statValueStyles}>Same</div>
          <div className={statLabelStyles}>Learning rate: fluency vs BKT</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>Simpler</div>
          <div className={statLabelStyles}>Using BKT for both concerns</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>Targeting</div>
          <div className={statLabelStyles}>Where the benefit comes from</div>
        </div>
      </div>

      {/* Tabbed Charts */}
      <Tabs.Root defaultValue="comparison" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="comparison" className={tabTriggerStyles}>
            Mode Comparison
          </Tabs.Trigger>
          <Tabs.Trigger value="fatigue" className={tabTriggerStyles}>
            Cognitive Fatigue
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="comparison" className={tabContentStyles}>
          <ThreeWayComparisonChart />
        </Tabs.Content>

        <Tabs.Content value="fatigue" className={tabContentStyles}>
          <FatigueComparisonChart />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <ThreeWayDataTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

/** Internal: 3-way comparison bar chart */
function ThreeWayComparisonChart() {
  const skills = ['fiveComp\n3=5-2', 'fiveCompSub\n-3=-5+2']

  // Sessions to reach thresholds
  const classicTo50 = [5, 4]
  const classicTo80 = [9, 8]
  const adaptiveFluencyTo50 = [3, 3]
  const adaptiveFluencyTo80 = [6, 6]
  const adaptiveBktTo50 = [3, 3]
  const adaptiveBktTo80 = [6, 6]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: [
        { name: 'Classic', itemStyle: { color: '#6b7280' } },
        { name: 'Adaptive (fluency)', itemStyle: { color: '#22c55e' } },
        { name: 'Adaptive (BKT)', itemStyle: { color: '#3b82f6' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: skills,
      axisLabel: { color: '#9ca3af', interval: 0, fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Sessions to 80%',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 12,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Classic',
        type: 'bar',
        data: classicTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#6b7280' },
        })),
        label: { show: true, position: 'top', color: '#9ca3af', fontSize: 11 },
      },
      {
        name: 'Adaptive (fluency)',
        type: 'bar',
        data: adaptiveFluencyTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#22c55e' },
        })),
        label: { show: true, position: 'top', color: '#9ca3af', fontSize: 11 },
      },
      {
        name: 'Adaptive (BKT)',
        type: 'bar',
        data: adaptiveBktTo80.map((v) => ({
          value: v,
          itemStyle: { color: '#3b82f6' },
        })),
        label: { show: true, position: 'top', color: '#9ca3af', fontSize: 11 },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Sessions to 80% Mastery: 3-Way Comparison
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Both adaptive modes perform identically—the benefit comes from BKT <em>targeting</em>, not
        from BKT-based cost calculation.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/** Internal: Fatigue comparison chart */
function FatigueComparisonChart() {
  const skills = ['fiveComp 3=5-2', 'fiveCompSub -3=-5+2']

  const classicFatigue = [120.3, 131.9]
  const adaptiveFluencyFatigue = [122.8, 133.6]
  const adaptiveBktFatigue = [122.8, 133.0]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
        let html = `<strong>${params[0]?.name}</strong><br/>`
        for (const p of params) {
          html += `${p.seriesName}: ${p.value.toFixed(1)}<br/>`
        }
        return html
      },
    },
    legend: {
      data: [
        { name: 'Classic', itemStyle: { color: '#6b7280' } },
        { name: 'Adaptive (fluency)', itemStyle: { color: '#22c55e' } },
        { name: 'Adaptive (BKT)', itemStyle: { color: '#3b82f6' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: skills,
      axisLabel: { color: '#9ca3af', interval: 0, fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Fatigue/Session',
      nameLocation: 'middle',
      nameGap: 50,
      min: 100,
      max: 150,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Classic',
        type: 'bar',
        data: classicFatigue.map((v) => ({
          value: v,
          itemStyle: { color: '#6b7280' },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => p.value.toFixed(1),
          color: '#9ca3af',
          fontSize: 10,
        },
      },
      {
        name: 'Adaptive (fluency)',
        type: 'bar',
        data: adaptiveFluencyFatigue.map((v) => ({
          value: v,
          itemStyle: { color: '#22c55e' },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => p.value.toFixed(1),
          color: '#9ca3af',
          fontSize: 10,
        },
      },
      {
        name: 'Adaptive (BKT)',
        type: 'bar',
        data: adaptiveBktFatigue.map((v) => ({
          value: v,
          itemStyle: { color: '#3b82f6' },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => p.value.toFixed(1),
          color: '#9ca3af',
          fontSize: 10,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Cognitive Fatigue Per Session
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        All modes have similar cognitive load. Adaptive modes are slightly higher because they
        include more challenging (weak skill) problems.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

/** Internal: 3-way comparison data table */
function ThreeWayDataTable() {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.5rem',
      py: '0.5rem',
      textAlign: 'center',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
      fontSize: '0.75rem',
    },
    '& td': {
      px: '0.5rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
      textAlign: 'center',
    },
    '& tr:hover td': {
      bg: 'accent.subtle',
    },
  })

  const data = [
    {
      skill: 'fiveComplements.3=5-2',
      classicTo50: 5,
      classicTo80: 9,
      classicFatigue: 120.3,
      fluencyTo50: 3,
      fluencyTo80: 6,
      fluencyFatigue: 122.8,
      bktTo50: 3,
      bktTo80: 6,
      bktFatigue: 122.8,
    },
    {
      skill: 'fiveCompSub.-3=-5+2',
      classicTo50: 4,
      classicTo80: 8,
      classicFatigue: 131.9,
      fluencyTo50: 3,
      fluencyTo80: 6,
      fluencyFatigue: 133.6,
      bktTo50: 3,
      bktTo80: 6,
      bktFatigue: 133.0,
    },
  ]

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        3-Way Comparison Data
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Sessions to reach mastery thresholds and cognitive fatigue per session.
      </p>
      <div className={css({ overflowX: 'auto' })}>
        <table className={tableStyles}>
          <thead>
            <tr>
              <th rowSpan={2}>Skill</th>
              <th colSpan={3} className={css({ bg: 'gray.700' })}>
                Classic
              </th>
              <th colSpan={3} className={css({ bg: 'green.900' })}>
                Adaptive (fluency)
              </th>
              <th colSpan={3} className={css({ bg: 'blue.900' })}>
                Adaptive (BKT)
              </th>
            </tr>
            <tr>
              <th>→50%</th>
              <th>→80%</th>
              <th>Fatigue</th>
              <th>→50%</th>
              <th>→80%</th>
              <th>Fatigue</th>
              <th>→50%</th>
              <th>→80%</th>
              <th>Fatigue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.skill}>
                <td
                  className={css({
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  })}
                >
                  {row.skill}
                </td>
                <td>{row.classicTo50}</td>
                <td>{row.classicTo80}</td>
                <td>{row.classicFatigue}</td>
                <td className={css({ color: 'green.400' })}>{row.fluencyTo50}</td>
                <td className={css({ color: 'green.400' })}>{row.fluencyTo80}</td>
                <td>{row.fluencyFatigue}</td>
                <td className={css({ color: 'blue.400' })}>{row.bktTo50}</td>
                <td className={css({ color: 'blue.400' })}>{row.bktTo80}</td>
                <td>{row.bktFatigue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Evidence Quality Charts with Tabbed Interface
 * Shows Help Level weights and Response Time weights
 */
export function EvidenceQualityCharts() {
  return (
    <div data-component="evidence-quality-charts" className={css({ my: '2rem' })}>
      <Tabs.Root defaultValue="help" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="help" className={tabTriggerStyles}>
            Help Level Weights
          </Tabs.Trigger>
          <Tabs.Trigger value="response" className={tabTriggerStyles}>
            Response Time Weights
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="help" className={tabContentStyles}>
          <HelpLevelChart />
        </Tabs.Content>

        <Tabs.Content value="response" className={tabContentStyles}>
          <ResponseTimeChart />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <EvidenceQualityTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function HelpLevelChart() {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '12%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: ['No help', 'Minor hint', 'Significant help', 'Full solution'],
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Evidence Weight',
      nameLocation: 'middle',
      nameGap: 50,
      min: 0,
      max: 1.2,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: 1.0, itemStyle: { color: '#22c55e' } },
          { value: 0.8, itemStyle: { color: '#84cc16' } },
          { value: 0.5, itemStyle: { color: '#eab308' } },
          { value: 0.5, itemStyle: { color: '#f97316' } },
        ],
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => `${p.value}×`,
          color: '#9ca3af',
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Evidence Weight by Help Level
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Using hints or scaffolding reduces evidence strength. A correct answer with full solution
        shown provides only 50% of the evidence weight.
      </p>
      <ReactECharts option={option} style={{ height: '280px' }} />
    </div>
  )
}

function ResponseTimeChart() {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: [
        { name: 'Correct', itemStyle: { color: '#22c55e' } },
        { name: 'Incorrect', itemStyle: { color: '#ef4444' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '12%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: ['Very fast', 'Normal', 'Slow'],
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Evidence Weight',
      nameLocation: 'middle',
      nameGap: 50,
      min: 0,
      max: 1.4,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Correct',
        type: 'bar',
        data: [1.2, 1.0, 0.8],
        itemStyle: { color: '#22c55e' },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => `${p.value}×`,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
      {
        name: 'Incorrect',
        type: 'bar',
        data: [0.5, 1.0, 1.2],
        itemStyle: { color: '#ef4444' },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => `${p.value}×`,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Evidence Weight by Response Time
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Fast correct answers suggest automaticity (1.2×). Slow incorrect answers suggest genuine
        confusion (1.2×). Very fast incorrect answers are likely careless slips (0.5×).
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

function EvidenceQualityTable() {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
    },
    '& tr:hover td': { bg: 'accent.subtle' },
  })

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '1rem',
          color: 'text.primary',
        })}
      >
        Evidence Quality Data
      </h4>
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        })}
      >
        <div>
          <h5
            className={css({
              fontSize: '0.875rem',
              fontWeight: 600,
              mb: '0.5rem',
              color: 'text.secondary',
            })}
          >
            Help Level Weights
          </h5>
          <table className={tableStyles}>
            <thead>
              <tr>
                <th>Help Level</th>
                <th>Weight</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>0 (none)</td>
                <td>1.0</td>
                <td>Full evidence</td>
              </tr>
              <tr>
                <td>1 (minor hint)</td>
                <td>0.8</td>
                <td>Slight reduction</td>
              </tr>
              <tr>
                <td>2 (significant help)</td>
                <td>0.5</td>
                <td>Halved evidence</td>
              </tr>
              <tr>
                <td>3 (full solution)</td>
                <td>0.5</td>
                <td>Halved evidence</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h5
            className={css({
              fontSize: '0.875rem',
              fontWeight: 600,
              mb: '0.5rem',
              color: 'text.secondary',
            })}
          >
            Response Time Weights
          </h5>
          <table className={tableStyles}>
            <thead>
              <tr>
                <th>Condition</th>
                <th>Weight</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Very fast correct</td>
                <td>1.2</td>
                <td>Strong automaticity signal</td>
              </tr>
              <tr>
                <td>Normal correct</td>
                <td>1.0</td>
                <td>Standard evidence</td>
              </tr>
              <tr>
                <td>Slow correct</td>
                <td>0.8</td>
                <td>Might have struggled</td>
              </tr>
              <tr>
                <td>Very fast incorrect</td>
                <td>0.5</td>
                <td>Careless slip</td>
              </tr>
              <tr>
                <td>Slow incorrect</td>
                <td>1.2</td>
                <td>Genuine confusion</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/**
 * Automaticity Multiplier Charts with Tabbed Interface
 * Shows the non-linear curve and data table
 */
export function AutomaticityMultiplierCharts() {
  return (
    <div data-component="automaticity-multiplier-charts" className={css({ my: '2rem' })}>
      <Tabs.Root defaultValue="curve" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="curve" className={tabTriggerStyles}>
            Multiplier Curve
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="curve" className={tabContentStyles}>
          <MultiplierCurveChart />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <MultiplierDataTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function MultiplierCurveChart() {
  const dataPoints: Array<[number, number]> = []
  for (let p = 0; p <= 1; p += 0.02) {
    const multiplier = 4 - 3 * p * p
    dataPoints.push([Math.round(p * 100), Number(multiplier.toFixed(2))])
  }

  const referencePoints = [
    { pKnown: 100, multiplier: 1.0 },
    { pKnown: 95, multiplier: 1.3 },
    { pKnown: 90, multiplier: 1.6 },
    { pKnown: 80, multiplier: 2.1 },
    { pKnown: 50, multiplier: 3.3 },
    { pKnown: 0, multiplier: 4.0 },
  ]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ value: [number, number] }>) => {
        const [pKnown, multiplier] = params[0]?.value || [0, 0]
        return `P(known): ${pKnown}%<br/>Multiplier: ${multiplier}×`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'P(known) %',
      nameLocation: 'middle',
      nameGap: 30,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Cost Multiplier',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 5,
      axisLabel: { color: '#9ca3af', formatter: '{value}×' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Multiplier Curve',
        type: 'line',
        data: dataPoints,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#8b5cf6', width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
            ],
          },
        },
      },
      {
        name: 'Reference Points',
        type: 'scatter',
        data: referencePoints.map((p) => [p.pKnown, p.multiplier]),
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: '#8b5cf6', borderColor: '#fff', borderWidth: 2 },
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value: [number, number] }) => `${params.value[1]}×`,
          color: '#9ca3af',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Non-Linear Cost Multiplier Curve
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        The squared mapping provides better differentiation at high mastery levels. A skill at 50%
        P(known) costs 3.3× more than a fully automated skill.
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

function MultiplierDataTable() {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
    },
    '& tr:hover td': { bg: 'accent.subtle' },
  })

  const data = [
    { pKnown: '100%', multiplier: '1.0×', meaning: 'Fully automated' },
    { pKnown: '95%', multiplier: '1.3×', meaning: 'Nearly automated' },
    { pKnown: '90%', multiplier: '1.6×', meaning: 'Solid' },
    { pKnown: '80%', multiplier: '2.1×', meaning: 'Good but not automatic' },
    { pKnown: '50%', multiplier: '3.3×', meaning: 'Halfway there' },
    { pKnown: '0%', multiplier: '4.0×', meaning: 'Just starting' },
  ]

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Automaticity Multiplier Data
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Reference points showing how P(known) maps to cost multiplier.
      </p>
      <table className={tableStyles}>
        <thead>
          <tr>
            <th>P(known)</th>
            <th>Multiplier</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.pKnown}>
              <td>{row.pKnown}</td>
              <td className={css({ color: 'purple.400', fontWeight: 500 })}>{row.multiplier}</td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Staleness Indicators Chart with Tabbed Interface
 */
export function StalenessIndicatorsCharts() {
  return (
    <div data-component="staleness-indicators-charts" className={css({ my: '2rem' })}>
      <Tabs.Root defaultValue="visual" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="visual" className={tabTriggerStyles}>
            Visual Timeline
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="visual" className={tabContentStyles}>
          <StalenessVisual />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <StalenessDataTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function StalenessVisual() {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: ['< 7 days', '7-14 days', '14-30 days', '> 30 days'],
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Concern Level',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 4,
      axisLabel: {
        color: '#9ca3af',
        formatter: (v: number) => ['', 'Low', 'Medium', 'High', 'Critical'][v] || '',
      },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: 0, itemStyle: { color: '#22c55e' } },
          { value: 1, itemStyle: { color: '#84cc16' } },
          { value: 2, itemStyle: { color: '#eab308' } },
          { value: 3, itemStyle: { color: '#ef4444' } },
        ],
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          formatter: (p: { dataIndex: number }) =>
            ['(none)', 'Not practiced\nrecently', 'Getting\nrusty', 'Very stale'][p.dataIndex],
          color: '#9ca3af',
          fontSize: 10,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Staleness Warning Levels
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Skills are flagged based on days since last practice. Staleness is shown as a separate
        indicator, not by decaying P(known).
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

function StalenessDataTable() {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
    },
    '& tr:hover td': { bg: 'accent.subtle' },
  })

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Staleness Indicator Data
      </h4>
      <table className={tableStyles}>
        <thead>
          <tr>
            <th>Days Since Practice</th>
            <th>Warning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>&lt; 7</td>
            <td className={css({ color: 'green.400' })}>(none)</td>
          </tr>
          <tr>
            <td>7-14</td>
            <td className={css({ color: 'yellow.400' })}>"Not practiced recently"</td>
          </tr>
          <tr>
            <td>14-30</td>
            <td className={css({ color: 'orange.400' })}>"Getting rusty"</td>
          </tr>
          <tr>
            <td>&gt; 30</td>
            <td className={css({ color: 'red.400' })}>"Very stale — may need review"</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Classification Chart with Tabbed Interface
 */
export function ClassificationCharts() {
  return (
    <div data-component="classification-charts" className={css({ my: '2rem' })}>
      <Tabs.Root defaultValue="visual" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="visual" className={tabTriggerStyles}>
            Classification Zones
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="visual" className={tabContentStyles}>
          <ClassificationVisual />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <ClassificationDataTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function ClassificationVisual() {
  // Horizontal stacked bar showing P(known) zones from 0-100%
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: number; seriesName: string }) => {
        const descriptions: Record<string, string> = {
          Struggling: 'P(known) < 50%: Student has not yet internalized this pattern',
          Learning: 'P(known) 50-80%: Making progress but not yet automatic',
          Automated: 'P(known) ≥ 80%: Pattern is reliably automatic',
        }
        return `<strong>${p.seriesName}</strong><br/>${descriptions[p.seriesName] || ''}`
      },
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '10%',
      top: '10%',
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      show: false,
    },
    yAxis: {
      type: 'category',
      data: ['Classification'],
      show: false,
    },
    series: [
      {
        name: 'Struggling',
        type: 'bar',
        stack: 'total',
        data: [50],
        itemStyle: { color: '#ef4444' },
        label: {
          show: true,
          position: 'inside',
          formatter: 'Struggling\n<50%',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 11,
        },
        barWidth: 40,
      },
      {
        name: 'Learning',
        type: 'bar',
        stack: 'total',
        data: [30],
        itemStyle: { color: '#eab308' },
        label: {
          show: true,
          position: 'inside',
          formatter: 'Learning\n50-80%',
          color: '#000',
          fontWeight: 'bold',
          fontSize: 11,
        },
      },
      {
        name: 'Automated',
        type: 'bar',
        stack: 'total',
        data: [20],
        itemStyle: { color: '#22c55e' },
        label: {
          show: true,
          position: 'inside',
          formatter: 'Automated\n≥80%',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        P(known) Classification Zones
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Skills are classified into zones based on their P(known) value when confidence meets
        threshold. Low-confidence estimates default to "Learning" regardless of P(known).
      </p>
      <ReactECharts option={option} style={{ height: '100px' }} />
      <p
        className={css({
          fontSize: '0.75rem',
          color: 'text.muted',
          mt: '0.5rem',
          fontStyle: 'italic',
        })}
      >
        Note: Classification requires confidence ≥ threshold (default 50%). Skills with insufficient
        data are always classified as "Learning" until more evidence accumulates.
      </p>
    </div>
  )
}

function ClassificationDataTable() {
  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
    },
    '& tr:hover td': { bg: 'accent.subtle' },
  })

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Classification Criteria
      </h4>
      <table className={tableStyles}>
        <thead>
          <tr>
            <th>Classification</th>
            <th>Criteria</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={css({ color: 'green.400', fontWeight: 600 })}>Automated</td>
            <td>P(known) ≥ 80% AND confidence ≥ threshold</td>
          </tr>
          <tr>
            <td className={css({ color: 'red.400', fontWeight: 600 })}>Struggling</td>
            <td>P(known) &lt; 50% AND confidence ≥ threshold</td>
          </tr>
          <tr>
            <td className={css({ color: 'yellow.400', fontWeight: 600 })}>Learning</td>
            <td>Everything else (including low-confidence estimates)</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Blame Attribution Comparison Charts
 * Compares heuristic vs true Bayesian blame attribution across multiple seeds
 */
export function BlameAttributionCharts() {
  return (
    <div data-component="blame-attribution-charts" className={css({ my: '2rem' })}>
      {/* Summary insight */}
      <div className={summaryCardStyles}>
        <div className={statCardStyles}>
          <div className={statValueStyles}>p &gt; 0.05</div>
          <div className={statLabelStyles}>No significant difference</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>3/5</div>
          <div className={statLabelStyles}>Heuristic wins</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>t = -0.41</div>
          <div className={statLabelStyles}>t-statistic (5 seeds)</div>
        </div>
      </div>

      {/* Tabbed Charts */}
      <Tabs.Root defaultValue="comparison" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="comparison" className={tabTriggerStyles}>
            Seed Comparison
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="comparison" className={tabContentStyles}>
          <BlameComparisonChart />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <BlameDataTable />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

/** Internal: Bar chart comparing heuristic vs bayesian across seeds */
function BlameComparisonChart() {
  const seeds = ['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4', 'Seed 5']
  const heuristicCorr = [0.245, 0.751, 0.636, 0.166, 0.172]
  const bayesianCorr = [0.401, 0.627, 0.254, 0.345, 0.154]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
        let html = `<strong>${params[0]?.name}</strong><br/>`
        for (const p of params) {
          html += `${p.seriesName}: ${p.value.toFixed(3)}<br/>`
        }
        const heur = params.find((p) => p.seriesName === 'Heuristic')?.value ?? 0
        const baye = params.find((p) => p.seriesName === 'Bayesian')?.value ?? 0
        const winner = heur > baye ? 'Heuristic' : baye > heur ? 'Bayesian' : 'Tie'
        html += `<em>Winner: ${winner}</em>`
        return html
      },
    },
    legend: {
      data: [
        { name: 'Heuristic', itemStyle: { color: '#22c55e' } },
        { name: 'Bayesian', itemStyle: { color: '#3b82f6' } },
      ],
      bottom: 0,
      textStyle: { color: '#9ca3af' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: seeds,
      axisLabel: { color: '#9ca3af', interval: 0, fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'BKT-Truth Correlation',
      nameLocation: 'middle',
      nameGap: 50,
      min: 0,
      max: 1,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        name: 'Heuristic',
        type: 'bar',
        data: heuristicCorr.map((v) => ({
          value: v,
          itemStyle: { color: '#22c55e' },
        })),
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: '{c}',
        },
      },
      {
        name: 'Bayesian',
        type: 'bar',
        data: bayesianCorr.map((v) => ({
          value: v,
          itemStyle: { color: '#3b82f6' },
        })),
        label: {
          show: true,
          position: 'top',
          color: '#9ca3af',
          fontSize: 10,
          formatter: '{c}',
        },
      },
    ],
  }

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        BKT-Truth Correlation: Heuristic vs Bayesian Blame Attribution
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Fast learner profiles across 5 random seeds. Higher correlation = BKT estimates track true
        mastery more accurately.
      </p>
      <ReactECharts option={option} style={{ height: '320px' }} />
    </div>
  )
}

/** Internal: Data table for blame attribution validation */
function BlameDataTable() {
  const data = [
    {
      seed: 42424,
      heuristic: 0.245,
      bayesian: 0.401,
      diff: 0.156,
      winner: 'Bayesian',
    },
    {
      seed: 12345,
      heuristic: 0.751,
      bayesian: 0.627,
      diff: -0.124,
      winner: 'Heuristic',
    },
    {
      seed: 99999,
      heuristic: 0.636,
      bayesian: 0.254,
      diff: -0.382,
      winner: 'Heuristic',
    },
    {
      seed: 77777,
      heuristic: 0.166,
      bayesian: 0.345,
      diff: 0.178,
      winner: 'Bayesian',
    },
    {
      seed: 55555,
      heuristic: 0.172,
      bayesian: 0.154,
      diff: -0.018,
      winner: 'Heuristic',
    },
  ]

  const tableStyles = css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    '& th': {
      bg: 'accent.muted',
      px: '0.75rem',
      py: '0.5rem',
      textAlign: 'center',
      fontWeight: 600,
      borderBottom: '2px solid',
      borderColor: 'accent.default',
      color: 'accent.emphasis',
    },
    '& td': {
      px: '0.75rem',
      py: '0.5rem',
      borderBottom: '1px solid',
      borderColor: 'border.muted',
      color: 'text.secondary',
      textAlign: 'center',
    },
    '& tr:hover td': { bg: 'accent.subtle' },
  })

  return (
    <div className={chartContainerStyles}>
      <h4
        className={css({
          fontSize: '1rem',
          fontWeight: 600,
          mb: '0.5rem',
          color: 'text.primary',
        })}
      >
        Multi-Seed Validation Results
      </h4>
      <table className={tableStyles}>
        <thead>
          <tr>
            <th>Seed</th>
            <th>Heuristic r</th>
            <th>Bayesian r</th>
            <th>Difference</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.seed}>
              <td>{row.seed}</td>
              <td>{row.heuristic.toFixed(3)}</td>
              <td>{row.bayesian.toFixed(3)}</td>
              <td
                className={css({
                  color: row.diff > 0 ? 'blue.400' : row.diff < 0 ? 'green.400' : 'text.muted',
                })}
              >
                {row.diff > 0 ? '+' : ''}
                {row.diff.toFixed(3)}
              </td>
              <td
                className={css({
                  color: row.winner === 'Heuristic' ? 'green.400' : 'blue.400',
                  fontWeight: 600,
                })}
              >
                {row.winner}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr
            className={css({
              fontWeight: 600,
              borderTop: '2px solid',
              borderColor: 'gray.600',
            })}
          >
            <td>Mean</td>
            <td>0.394</td>
            <td>0.356</td>
            <td>-0.038</td>
            <td className={css({ color: 'green.400' })}>Heuristic</td>
          </tr>
        </tfoot>
      </table>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mt: '1rem',
        })}
      >
        t = -0.41, p &gt; 0.05 (df=4). The difference is not statistically significant.
      </p>
    </div>
  )
}
