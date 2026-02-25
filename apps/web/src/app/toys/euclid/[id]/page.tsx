'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { useEuclidProgress, useMarkEuclidComplete } from '@/hooks/useEuclidProgress'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { usePlayerSessionPreferences } from '@/hooks/usePlayerSessionPreferences'
import {
  getProposition,
  getUnlockedBy,
  getNextProp,
} from '@/components/toys/euclid/data/propositionGraph'
import { resolveKidLanguageStyle } from '@/lib/kidLanguageStyle'

export default function EuclidPropPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const propId = Number(params.id) || 1
  const prop = getProposition(propId)
  const title = prop ? `Euclid I.${propId}` : `Euclid I.${propId}`

  // Player state — initialized from URL search param if present
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    searchParams.get('player')
  )

  const { data: players } = useUserPlayers()
  const selectedPlayer = useMemo(
    () => (selectedPlayerId ? players?.find((p) => p.id === selectedPlayerId) : null),
    [players, selectedPlayerId]
  )
  const { data: preferences } = usePlayerSessionPreferences(selectedPlayerId)
  const languageStyle = useMemo(
    () => resolveKidLanguageStyle(preferences?.kidLanguageStyle, selectedPlayer?.age),
    [preferences?.kidLanguageStyle, selectedPlayer?.age]
  )

  const { data: completedList } = useEuclidProgress(selectedPlayerId)
  const markComplete = useMarkEuclidComplete(selectedPlayerId)

  // Store mutation in a ref so handleComplete doesn't depend on it
  const markCompleteRef = useRef(markComplete)
  markCompleteRef.current = markComplete

  const completed = useMemo(() => new Set(completedList ?? []), [completedList])

  // Stable callback — uses refs to avoid depending on mutation object
  const handleComplete = useCallback(
    (completedPropId: number) => {
      markCompleteRef.current.mutate(completedPropId)
    },
    [] // stable — reads current values from refs
  )

  const afterCompletion = useMemo(() => {
    const after = new Set(completed)
    after.add(propId)
    return after
  }, [completed, propId])

  // Compute unlocked props and next prop for the overlay
  const unlocked = useMemo(() => getUnlockedBy(propId, afterCompletion), [propId, afterCompletion])

  const nextPropId = useMemo(
    () => unlocked[0] ?? getNextProp(afterCompletion),
    [unlocked, afterCompletion]
  )

  const navigateWithPlayer = useCallback(
    (path: string) => {
      const playerParam = selectedPlayerId ? `?player=${encodeURIComponent(selectedPlayerId)}` : ''
      router.push(`${path}${playerParam}`)
    },
    [selectedPlayerId, router]
  )

  return (
    <div
      data-component="euclid-page"
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#FAFAF0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppNavBar
        navSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => navigateWithPlayer('/toys/euclid')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: 'rgba(55, 65, 81, 1)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="Open Euclid map"
            >
              {title}
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: 0.5,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigateWithPlayer('/toys/euclid/foundations')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: 'rgba(55, 65, 81, 1)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="Open Euclid foundations"
            >
              Foundations
            </button>
            <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          </div>
        }
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          paddingTop: 'var(--app-nav-height)',
          touchAction: 'none',
          position: 'relative',
        }}
      >
        <EuclidCanvas
          propositionId={propId}
          onComplete={handleComplete}
          languageStyle={languageStyle}
          completionMeta={{
            unlocked,
            nextPropId,
            onNavigateNext: (id) => navigateWithPlayer(`/toys/euclid/${id}`),
            onNavigateMap: () => navigateWithPlayer('/toys/euclid'),
          }}
        />
      </div>
    </div>
  )
}
