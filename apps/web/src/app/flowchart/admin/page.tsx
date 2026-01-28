'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { SeedManagerPanel } from '@/components/flowchart/SeedManagerPanel'
import { TaxonomyBrowserPanel } from '@/components/flowchart/TaxonomyBrowserPanel'
import { css } from '../../../../styled-system/css'
import { hstack, vstack } from '../../../../styled-system/patterns'
import { EMBEDDING_VERSION } from '@/lib/flowcharts/embedding'

/**
 * Admin page for flowchart management.
 * Includes:
 * - Seed Manager: Seed/reset built-in flowcharts
 * - Taxonomy Browser: Browse and test topic clustering
 */
export default function FlowchartAdminPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div
      className={css({
        minHeight: '100vh',
        backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
        padding: '6',
      })}
    >
      {/* Header */}
      <div className={vstack({ gap: '4', alignItems: 'stretch', maxWidth: '1200px', marginX: 'auto' })}>
        <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
          <div>
            <h1
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: { base: 'gray.900', _dark: 'gray.100' },
              })}
            >
              Flowchart Admin
            </h1>
            <p
              className={css({
                fontSize: 'sm',
                color: { base: 'gray.600', _dark: 'gray.400' },
                marginTop: '1',
              })}
            >
              Manage flowchart seeds and topic taxonomy
            </p>
          </div>
          <Link
            href="/flowchart"
            className={css({
              paddingX: '4',
              paddingY: '2',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              textDecoration: 'none',
              _hover: {
                backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
              },
            })}
          >
            Back to Flowcharts
          </Link>
        </div>

        {/* Panels grid */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', lg: '1fr 1fr 1fr' },
            gap: '6',
            marginTop: '4',
          })}
        >
          {/* Seed Manager */}
          <div
            className={css({
              padding: '4',
              borderRadius: 'lg',
              backgroundColor: { base: 'amber.50', _dark: 'amber.950' },
              border: '2px solid',
              borderColor: { base: 'amber.300', _dark: 'amber.700' },
            })}
          >
            <h2
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: { base: 'amber.800', _dark: 'amber.200' },
                marginBottom: '3',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              })}
            >
              <span>🌱</span>
              Flowchart Seeds
            </h2>
            <SeedManagerInline key={`seed-${refreshKey}`} onSeedComplete={handleRefresh} />
          </div>

          {/* Taxonomy Browser */}
          <div
            className={css({
              padding: '4',
              borderRadius: 'lg',
              backgroundColor: { base: 'purple.50', _dark: 'purple.950' },
              border: '2px solid',
              borderColor: { base: 'purple.300', _dark: 'purple.700' },
            })}
          >
            <h2
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: { base: 'purple.800', _dark: 'purple.200' },
                marginBottom: '3',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              })}
            >
              <span>🏷️</span>
              Topic Taxonomy
            </h2>
            <TaxonomyBrowserInline key={`taxonomy-${refreshKey}`} onRegenerateComplete={handleRefresh} />
          </div>

          {/* Embeddings Manager */}
          <div
            className={css({
              padding: '4',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
              border: '2px solid',
              borderColor: { base: 'blue.300', _dark: 'blue.700' },
            })}
          >
            <h2
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: { base: 'blue.800', _dark: 'blue.200' },
                marginBottom: '3',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              })}
            >
              <span>🧠</span>
              Embeddings
            </h2>
            <EmbeddingsManagerInline key={`embeddings-${refreshKey}`} onComplete={handleRefresh} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline version of SeedManagerPanel (not fixed position)
 */
function SeedManagerInline({ onSeedComplete }: { onSeedComplete?: () => void }) {
  return (
    <div className={css({ '& > [data-component="SeedManagerPanel"]': { position: 'static', width: '100%', maxWidth: '100%', maxHeight: 'none', border: 'none', boxShadow: 'none', padding: 0, backgroundColor: 'transparent' } })}>
      <SeedManagerPanel onSeedComplete={onSeedComplete} />
    </div>
  )
}

/**
 * Inline version of TaxonomyBrowserPanel (not fixed position)
 */
function TaxonomyBrowserInline({ onRegenerateComplete }: { onRegenerateComplete?: () => void }) {
  return (
    <div className={css({ '& > [data-component="TaxonomyBrowserPanel"]': { position: 'static', width: '100%', maxWidth: '100%', maxHeight: 'none', border: 'none', boxShadow: 'none', padding: 0, backgroundColor: 'transparent' } })}>
      <TaxonomyBrowserPanel onRegenerateComplete={onRegenerateComplete} />
    </div>
  )
}

/**
 * Embeddings manager panel for regenerating flowchart embeddings
 */
function EmbeddingsManagerInline({ onComplete }: { onComplete?: () => void }) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [result, setResult] = useState<{ seeded: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRegenerate = useCallback(async () => {
    try {
      setIsRegenerating(true)
      setError(null)
      setResult(null)

      const response = await fetch('/api/flowcharts/seed-embeddings', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to regenerate embeddings')
      }

      const data = await response.json()
      setResult({ seeded: data.seeded?.length || 0, skipped: data.skipped || 0 })
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setIsRegenerating(false)
    }
  }, [onComplete])

  return (
    <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
      <p
        className={css({
          fontSize: 'sm',
          color: { base: 'blue.700', _dark: 'blue.300' },
        })}
      >
        Regenerate embeddings for all published flowcharts using the current model.
      </p>

      <div
        className={css({
          padding: '2',
          borderRadius: 'md',
          backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
          fontSize: 'xs',
          color: { base: 'blue.800', _dark: 'blue.200' },
        })}
      >
        <div>Model: <code>text-embedding-3-large</code></div>
        <div>Version: <code>{EMBEDDING_VERSION}</code></div>
      </div>

      {error && (
        <div
          className={css({
            padding: '2',
            borderRadius: 'md',
            backgroundColor: { base: 'red.100', _dark: 'red.900' },
            color: { base: 'red.700', _dark: 'red.300' },
            fontSize: 'sm',
          })}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className={css({
            padding: '2',
            borderRadius: 'md',
            backgroundColor: { base: 'green.100', _dark: 'green.900' },
            color: { base: 'green.700', _dark: 'green.300' },
            fontSize: 'sm',
          })}
        >
          Regenerated {result.seeded} embeddings, skipped {result.skipped} (already up-to-date)
        </div>
      )}

      <button
        onClick={handleRegenerate}
        disabled={isRegenerating}
        className={css({
          paddingX: '4',
          paddingY: '2',
          borderRadius: 'md',
          fontSize: 'sm',
          fontWeight: 'medium',
          backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          _hover: {
            backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
          },
          _disabled: {
            opacity: 0.5,
            cursor: 'not-allowed',
          },
        })}
      >
        {isRegenerating ? 'Regenerating...' : 'Regenerate All Embeddings'}
      </button>

      <p
        className={css({
          fontSize: 'xs',
          color: { base: 'blue.600', _dark: 'blue.400' },
        })}
      >
        This will regenerate embeddings for flowcharts with outdated or missing embeddings.
        Flowcharts already using version {EMBEDDING_VERSION} will be skipped.
      </p>
    </div>
  )
}
