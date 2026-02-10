'use client'

import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SeedStudentsSection } from '@/components/debug/SeedStudentsSection'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'

interface Preset {
  id: string
  label: string
  description: string
}

const PRESETS: Preset[] = [
  {
    id: 'game-break',
    label: 'Game Break Test',
    description: '2 parts (1 problem each) with auto-start matching game break between them',
  },
  {
    id: 'minimal',
    label: 'Minimal Session',
    description: '1 part, 1 problem, no game break — fastest possible session',
  },
]

export default function DebugPracticePage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePreset = async (presetId: string) => {
    setLoading(presetId)
    setError(null)

    try {
      const res = await fetch('/api/debug/practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: presetId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      router.push(data.redirectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debug session')
      setLoading(null)
    }
  }

  return (
    <PageWithNav>
      <main
        data-component="debug-practice"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
          <header className={css({ marginBottom: '2rem' })}>
            <Link
              href="/debug"
              data-action="back-to-debug-hub"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                textDecoration: 'none',
                marginBottom: '0.75rem',
                _hover: { color: isDark ? 'gray.200' : 'gray.700' },
              })}
            >
              <ArrowLeft size={14} />
              Debug Hub
            </Link>
            <h1
              className={css({
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Practice Debug
            </h1>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              Create debug sessions with presets. Each creates a fresh debug player with basic
              skills.
            </p>
          </header>

          {error && (
            <div
              data-element="error-banner"
              className={css({
                padding: '12px 16px',
                backgroundColor: isDark ? 'red.900/30' : 'red.50',
                color: isDark ? 'red.300' : 'red.700',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                border: '1px solid',
                borderColor: isDark ? 'red.800' : 'red.200',
              })}
            >
              {error}
            </div>
          )}

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                data-action={`preset-${preset.id}`}
                onClick={() => handlePreset(preset.id)}
                disabled={loading !== null}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: loading !== null ? 'wait' : 'pointer',
                  opacity: loading !== null && loading !== preset.id ? 0.5 : 1,
                  transition: 'all 0.2s',
                  _hover: {
                    backgroundColor: isDark ? 'gray.700' : 'gray.50',
                  },
                })}
              >
                <div className={css({ flex: 1 })}>
                  <div
                    className={css({
                      fontWeight: '600',
                      color: isDark ? 'white' : 'gray.800',
                      marginBottom: '4px',
                    })}
                  >
                    {preset.label}
                  </div>
                  <div
                    className={css({
                      fontSize: '0.875rem',
                      color: isDark ? 'gray.400' : 'gray.600',
                    })}
                  >
                    {preset.description}
                  </div>
                </div>
                {loading === preset.id && (
                  <Loader2
                    size={20}
                    className={css({
                      animation: 'spin 1s linear infinite',
                      color: isDark ? 'gray.400' : 'gray.500',
                    })}
                  />
                )}
              </button>
            ))}
          </div>

          <SeedStudentsSection isDark={isDark} />
        </div>
      </main>
    </PageWithNav>
  )
}
