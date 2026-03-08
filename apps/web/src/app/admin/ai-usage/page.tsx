'use client'

/**
 * Admin AI Usage Dashboard
 *
 * Shows aggregated AI/ML API usage by feature, model, and user
 * with estimated cost breakdowns.
 */

import { useState, useEffect } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'

interface FeatureRow {
  feature: string
  provider: string
  model: string
  apiType: string
  count: number
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens: number
  totalImageCount: number
  totalInputCharacters: number
  totalAudioDuration: number
  estimatedCost: number | null
}

interface UserRow {
  userId: string
  email: string | null
  name: string | null
  count: number
  totalInputTokens: number
  totalOutputTokens: number
  totalImageCount: number
  totalInputCharacters: number
  totalAudioDuration: number
}

interface UsageData {
  days: number
  totalCalls: number
  totalEstimatedCost: number
  byFeature: FeatureRow[]
  byUser: UserRow[]
}

function formatCost(cost: number | null): string {
  if (cost === null) return '—'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

function formatNumber(n: number): string {
  if (n === 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function AiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/ai-usage?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days])

  return (
    <>
      <AppNavBar />
      <div className={css({ paddingTop: 'var(--app-nav-height)', padding: '1rem' })}>
        <AdminNav />
        <h1 className={css({ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' })}>
          AI Usage Dashboard
        </h1>

        <div className={css({ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' })}>
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={css({
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: days === d ? '#333' : '#fff',
                color: days === d ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '0.875rem',
              })}
            >
              {d}d
            </button>
          ))}
        </div>

        {loading && <p>Loading...</p>}

        {data && !loading && (
          <>
            <div
              className={css({
                display: 'flex',
                gap: '2rem',
                marginBottom: '2rem',
                flexWrap: 'wrap',
              })}
            >
              <div>
                <div className={css({ fontSize: '0.75rem', color: '#666' })}>Total Calls</div>
                <div className={css({ fontSize: '1.5rem', fontWeight: 'bold' })}>
                  {data.totalCalls.toLocaleString()}
                </div>
              </div>
              <div>
                <div className={css({ fontSize: '0.75rem', color: '#666' })}>Estimated Cost</div>
                <div className={css({ fontSize: '1.5rem', fontWeight: 'bold' })}>
                  {formatCost(data.totalEstimatedCost)}
                </div>
              </div>
              <div>
                <div className={css({ fontSize: '0.75rem', color: '#666' })}>Period</div>
                <div className={css({ fontSize: '1.5rem', fontWeight: 'bold' })}>
                  {data.days} days
                </div>
              </div>
            </div>

            <h2
              className={css({
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
              })}
            >
              By Feature &amp; Model
            </h2>
            <div className={css({ overflowX: 'auto', marginBottom: '2rem' })}>
              <table
                className={css({
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.8rem',
                })}
              >
                <thead>
                  <tr
                    className={css({
                      borderBottom: '2px solid #ddd',
                      textAlign: 'left',
                    })}
                  >
                    <th className={css({ padding: '0.5rem' })}>Feature</th>
                    <th className={css({ padding: '0.5rem' })}>Provider/Model</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Calls</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>In Tokens</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Out Tokens</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Images</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Characters</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Audio (s)</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFeature.map((row, i) => (
                    <tr
                      key={i}
                      className={css({
                        borderBottom: '1px solid #eee',
                        '&:hover': { background: '#f9f9f9' },
                      })}
                    >
                      <td className={css({ padding: '0.5rem', fontFamily: 'monospace' })}>
                        {row.feature}
                      </td>
                      <td className={css({ padding: '0.5rem' })}>
                        {row.provider}/{row.model}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {row.count}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalInputTokens)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalOutputTokens)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalImageCount)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalInputCharacters)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {row.totalAudioDuration ? row.totalAudioDuration.toFixed(1) : '—'}
                      </td>
                      <td
                        className={css({
                          padding: '0.5rem',
                          textAlign: 'right',
                          fontWeight: 'bold',
                        })}
                      >
                        {formatCost(row.estimatedCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2
              className={css({
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
              })}
            >
              By User
            </h2>
            <div className={css({ overflowX: 'auto' })}>
              <table
                className={css({
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.8rem',
                })}
              >
                <thead>
                  <tr
                    className={css({
                      borderBottom: '2px solid #ddd',
                      textAlign: 'left',
                    })}
                  >
                    <th className={css({ padding: '0.5rem' })}>User</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Calls</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>In Tokens</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Out Tokens</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Images</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Characters</th>
                    <th className={css({ padding: '0.5rem', textAlign: 'right' })}>Audio (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byUser.map((row, i) => (
                    <tr
                      key={i}
                      className={css({
                        borderBottom: '1px solid #eee',
                        '&:hover': { background: '#f9f9f9' },
                      })}
                    >
                      <td className={css({ padding: '0.5rem' })}>
                        {row.name || row.email || row.userId.slice(0, 8)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {row.count}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalInputTokens)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalOutputTokens)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalImageCount)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {formatNumber(row.totalInputCharacters)}
                      </td>
                      <td className={css({ padding: '0.5rem', textAlign: 'right' })}>
                        {row.totalAudioDuration ? row.totalAudioDuration.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
