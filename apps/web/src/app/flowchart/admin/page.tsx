'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SeedManagerPanel } from '@/components/flowchart/SeedManagerPanel'
import { TaxonomyBrowserPanel } from '@/components/flowchart/TaxonomyBrowserPanel'
import { css } from '../../../../styled-system/css'
import { hstack, vstack } from '../../../../styled-system/patterns'

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
            gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
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
