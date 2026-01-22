'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { css } from '../../../../styled-system/css'
import { vstack, hstack } from '../../../../styled-system/patterns'

interface FlowchartMeta {
  id: string
  title: string
  description: string | null
  emoji: string
  difficulty: string | null
  source: 'hardcoded' | 'database'
  author?: string
}

type DifficultyFilter = 'all' | 'Beginner' | 'Intermediate' | 'Advanced'

export default function BrowseFlowchartsPage() {
  const router = useRouter()
  const [flowcharts, setFlowcharts] = useState<FlowchartMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')

  // Load flowcharts
  useEffect(() => {
    async function loadFlowcharts() {
      try {
        const response = await fetch('/api/flowcharts/browse')
        if (response.ok) {
          const data = await response.json()
          setFlowcharts(data.flowcharts || [])
        }
      } catch (err) {
        console.error('Failed to load flowcharts:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadFlowcharts()
  }, [])

  const handleSelectFlowchart = useCallback(
    (id: string) => {
      router.push(`/flowchart?select=${id}`)
    },
    [router]
  )

  // Filter flowcharts
  const filteredFlowcharts = flowcharts.filter((f) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matches =
        f.title.toLowerCase().includes(query) || f.description?.toLowerCase().includes(query)
      if (!matches) return false
    }

    // Difficulty filter
    if (difficultyFilter !== 'all' && f.difficulty !== difficultyFilter) {
      return false
    }

    return true
  })

  // Group by source
  const hardcoded = filteredFlowcharts.filter((f) => f.source === 'hardcoded')
  const community = filteredFlowcharts.filter((f) => f.source === 'database')

  return (
    <div
      data-component="browse-flowcharts"
      className={vstack({ gap: '8', padding: '6', alignItems: 'center', minHeight: '100vh' })}
    >
      <header className={vstack({ gap: '2', alignItems: 'center' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        >
          Browse Flowcharts
        </h1>
        <p
          className={css({
            fontSize: 'lg',
            color: { base: 'gray.600', _dark: 'gray.400' },
            textAlign: 'center',
            maxWidth: '600px',
          })}
        >
          Discover interactive math flowcharts for step-by-step learning
        </p>
      </header>

      {/* Actions */}
      <div className={hstack({ gap: '3' })}>
        <button
          onClick={() => router.push('/flowchart/workshop')}
          className={css({
            paddingY: '3',
            paddingX: '6',
            borderRadius: 'lg',
            backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
            color: 'white',
            fontWeight: 'semibold',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
            },
          })}
        >
          + Create Your Own
        </button>
        <button
          onClick={() => router.push('/flowchart/my-flowcharts')}
          className={css({
            paddingY: '3',
            paddingX: '6',
            borderRadius: 'lg',
            backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
            color: { base: 'gray.700', _dark: 'gray.300' },
            fontWeight: 'medium',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            },
          })}
        >
          My Flowcharts
        </button>
      </div>

      {/* Filters */}
      <div
        className={css({
          width: '100%',
          maxWidth: '600px',
        })}
      >
        <div className={hstack({ gap: '3' })}>
          <input
            type="text"
            placeholder="Search flowcharts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={css({
              flex: 1,
              padding: '3',
              borderRadius: 'lg',
              border: '2px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              _focus: {
                outline: 'none',
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
              },
            })}
          />
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)}
            className={css({
              padding: '3',
              borderRadius: 'lg',
              border: '2px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              cursor: 'pointer',
              _focus: {
                outline: 'none',
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
              },
            })}
          >
            <option value="all">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>Loading...</p>
      ) : filteredFlowcharts.length === 0 ? (
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
          No flowcharts found matching your criteria.
        </p>
      ) : (
        <div className={css({ width: '100%', maxWidth: '800px' })}>
          {/* Built-in flowcharts */}
          {hardcoded.length > 0 && (
            <section data-section="built-in" className={css({ marginBottom: '8' })}>
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'semibold',
                  color: { base: 'gray.800', _dark: 'gray.200' },
                  marginBottom: '4',
                })}
              >
                Built-in Flowcharts
              </h2>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '4',
                })}
              >
                {hardcoded.map((flowchart) => (
                  <FlowchartCard
                    key={flowchart.id}
                    flowchart={flowchart}
                    onClick={() => handleSelectFlowchart(flowchart.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Community flowcharts */}
          {community.length > 0 && (
            <section data-section="community">
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'semibold',
                  color: { base: 'gray.800', _dark: 'gray.200' },
                  marginBottom: '4',
                })}
              >
                Community Flowcharts
              </h2>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '4',
                })}
              >
                {community.map((flowchart) => (
                  <FlowchartCard
                    key={flowchart.id}
                    flowchart={flowchart}
                    onClick={() => handleSelectFlowchart(flowchart.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <footer
        className={css({
          marginTop: 'auto',
          padding: '4',
          color: { base: 'gray.500', _dark: 'gray.500' },
          fontSize: 'sm',
        })}
      >
        Create your own flowchart with the Workshop!
      </footer>
    </div>
  )
}

function FlowchartCard({ flowchart, onClick }: { flowchart: FlowchartMeta; onClick: () => void }) {
  return (
    <button
      data-element="flowchart-card"
      onClick={onClick}
      className={css({
        display: 'block',
        padding: '5',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'xl',
        boxShadow: 'md',
        border: '2px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        transition: 'all 0.2s',
        textDecoration: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        _hover: {
          borderColor: { base: 'blue.400', _dark: 'blue.500' },
          transform: 'translateY(-2px)',
          boxShadow: 'lg',
        },
      })}
    >
      <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
        <span className={css({ fontSize: '2xl' })}>{flowchart.emoji || '📊'}</span>
        <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
          <h3
            className={css({
              fontSize: 'md',
              fontWeight: 'semibold',
              color: { base: 'gray.900', _dark: 'gray.100' },
            })}
          >
            {flowchart.title}
          </h3>
          {flowchart.description && (
            <p
              className={css({
                fontSize: 'sm',
                color: { base: 'gray.600', _dark: 'gray.400' },
                lineClamp: 2,
              })}
            >
              {flowchart.description}
            </p>
          )}
          <div className={hstack({ gap: '2', marginTop: '1' })}>
            {flowchart.difficulty && (
              <span
                className={css({
                  fontSize: 'xs',
                  padding: '0.5 2',
                  borderRadius: 'full',
                  backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                  color: { base: 'blue.700', _dark: 'blue.300' },
                })}
              >
                {flowchart.difficulty}
              </span>
            )}
            {flowchart.author && (
              <span
                className={css({
                  fontSize: 'xs',
                  color: { base: 'gray.500', _dark: 'gray.500' },
                })}
              >
                by {flowchart.author}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
