'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'

// Dynamic import echarts to reduce bundle size
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Loading chart...
    </div>
  ),
})
import { css } from '../../../styled-system/css'

interface SkillData {
  id: string
  label: string
  category: string
  color: string
  data: number[]
}

interface ReportData {
  generatedAt: string
  summary: {
    basicAvgExposures: number
    fiveCompAvgExposures: number
    tenCompAvgExposures: number
    gapAt20Exposures: string
    exposureRatioForEqualMastery: string
  }
  masteryCurves: {
    exposurePoints: number[]
    skills: SkillData[]
  }
  exposuresToMastery: {
    target: string
    categories: Array<{
      name: string
      avgExposures: number
      color: string
    }>
  }
  fiftyPercentThresholds: {
    exposuresFor50Percent: Record<string, number>
    ratiosRelativeToBasic: Record<string, string>
  }
  masteryTable: Array<Record<string, string | number>>
}

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

const chartContainerStyles = css({
  bg: 'bg.surface',
  borderRadius: '0.5rem',
  p: { base: '0.5rem', md: '1rem' },
  border: '1px solid',
  borderColor: 'border.muted',
})

const summaryCardStyles = css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
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

export function SkillDifficultyCharts() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/skill-difficulty-report.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load skill difficulty data:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div
        className={css({
          textAlign: 'center',
          py: '3rem',
          color: 'text.muted',
        })}
      >
        Loading skill difficulty data...
      </div>
    )
  }

  if (!data) {
    return (
      <div
        className={css({
          textAlign: 'center',
          py: '3rem',
          color: 'text.muted',
        })}
      >
        Failed to load data. Run: <code>npx tsx scripts/generateSkillDifficultyData.ts</code>
      </div>
    )
  }

  return (
    <div data-component="skill-difficulty-charts" className={css({ my: '2rem' })}>
      {/* Summary Cards */}
      <div className={summaryCardStyles}>
        <div className={statCardStyles}>
          <div className={statValueStyles}>{Math.round(data.summary.basicAvgExposures)}</div>
          <div className={statLabelStyles}>Basic skills (exposures to 80%)</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>{data.summary.fiveCompAvgExposures}</div>
          <div className={statLabelStyles}>Five-complements (exposures to 80%)</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>{data.summary.tenCompAvgExposures}</div>
          <div className={statLabelStyles}>Ten-complements (exposures to 80%)</div>
        </div>
        <div className={statCardStyles}>
          <div className={statValueStyles}>{data.summary.exposureRatioForEqualMastery}x</div>
          <div className={statLabelStyles}>Ten-comp vs basic ratio</div>
        </div>
      </div>

      {/* Tabbed Charts */}
      <Tabs.Root defaultValue="curves" className={tabStyles}>
        <Tabs.List className={tabListStyles}>
          <Tabs.Trigger value="curves" className={tabTriggerStyles}>
            Learning Curves
          </Tabs.Trigger>
          <Tabs.Trigger value="bars" className={tabTriggerStyles}>
            Time to Mastery
          </Tabs.Trigger>
          <Tabs.Trigger value="thresholds" className={tabTriggerStyles}>
            50% Thresholds
          </Tabs.Trigger>
          <Tabs.Trigger value="table" className={tabTriggerStyles}>
            Data Table
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="curves" className={tabContentStyles}>
          <MasteryCurvesChart data={data} />
        </Tabs.Content>

        <Tabs.Content value="bars" className={tabContentStyles}>
          <ExposuresToMasteryChart data={data} />
        </Tabs.Content>

        <Tabs.Content value="thresholds" className={tabContentStyles}>
          <ThresholdsChart data={data} />
        </Tabs.Content>

        <Tabs.Content value="table" className={tabContentStyles}>
          <MasteryTable data={data} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function MasteryCurvesChart({ data }: { data: ReportData }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number; axisValue: number }>) => {
        const exposure = params[0]?.axisValue
        let html = `<strong>${exposure} exposures</strong><br/>`
        for (const p of params) {
          html += `<span style="color:${p.seriesName === 'Basic (0.8x)' ? '#22c55e' : p.seriesName.includes('Five') ? '#eab308' : p.seriesName.includes('Easy') ? '#f97316' : '#ef4444'}">${p.seriesName}</span>: ${p.value.toFixed(0)}%<br/>`
        }
        return html
      },
    },
    legend: {
      data: data.masteryCurves.skills.map((s) => s.label),
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
      data: data.masteryCurves.exposurePoints,
      name: 'Exposures',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'P(correct) %',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: data.masteryCurves.skills.map((skill) => ({
      name: skill.label,
      type: 'line',
      data: skill.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: skill.color, width: 2 },
      itemStyle: { color: skill.color },
    })),
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
        Mastery Curves by Skill Category
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Harder skills (higher difficulty multiplier) require more exposures to reach the same
        mastery level.
      </p>
      <ReactECharts option={option} style={{ height: '350px' }} />
    </div>
  )
}

function ExposuresToMasteryChart({ data }: { data: ReportData }) {
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
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.exposuresToMastery.categories.map((c) => c.name),
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Exposures to 80%',
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: data.exposuresToMastery.categories.map((c) => ({
          value: Math.round(c.avgExposures),
          itemStyle: { color: c.color },
        })),
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          formatter: '{c}',
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
        Average Exposures to Reach 80% Mastery
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        Ten-complements require roughly 2x the practice of basic skills to reach the same mastery
        level.
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

function ThresholdsChart({ data }: { data: ReportData }) {
  const skills = Object.entries(data.fiftyPercentThresholds.exposuresFor50Percent)
  const labels = skills.map(([id]) => {
    if (id.includes('basic')) return 'Basic'
    if (id.includes('fiveComp')) return 'Five-Comp'
    if (id.includes('9=10-1')) return 'Ten-Comp (Easy)'
    return 'Ten-Comp (Hard)'
  })
  const values = skills.map(([, v]) => v)
  const colors = skills.map(([id]) => {
    if (id.includes('basic')) return '#22c55e'
    if (id.includes('fiveComp')) return '#eab308'
    if (id.includes('9=10-1')) return '#f97316'
    return '#ef4444'
  })

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
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      name: 'Exposures for 50%',
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i] },
        })),
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          formatter: '{c}',
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
        Exposures to Reach 50% Mastery (K Value)
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        The K value in the Hill function determines where P(correct) = 50%. Higher K = harder skill.
      </p>
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  )
}

function MasteryTable({ data }: { data: ReportData }) {
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

  if (!data.masteryTable || data.masteryTable.length === 0) {
    return <div>No table data available</div>
  }

  const headers = Object.keys(data.masteryTable[0])

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
        Mastery by Exposure Level
      </h4>
      <p
        className={css({
          fontSize: '0.875rem',
          color: 'text.muted',
          mb: '1rem',
        })}
      >
        P(correct) for each skill category at various exposure counts.
      </p>
      <div className={css({ overflowX: 'auto' })}>
        <table className={tableStyles}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.masteryTable.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
