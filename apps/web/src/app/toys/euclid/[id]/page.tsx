'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'
import { EuclidCompletionOverlay } from '@/components/toys/euclid/EuclidCompletionOverlay'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { useEuclidProgress, useMarkEuclidComplete } from '@/hooks/useEuclidProgress'
import { getProposition, getUnlockedBy, getNextProp } from '@/components/toys/euclid/data/propositionGraph'

export default function EuclidPropPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const propId = Number(params.id) || 1
  const prop = getProposition(propId)
  const title = prop ? `Euclid I.${propId}` : `Euclid I.${propId}`

  // Player state — initialized from URL search param if present
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    searchParams.get('player'),
  )

  const { data: completedList } = useEuclidProgress(selectedPlayerId)
  const markComplete = useMarkEuclidComplete(selectedPlayerId)

  // Store mutation in a ref so handleComplete doesn't depend on it
  const markCompleteRef = useRef(markComplete)
  markCompleteRef.current = markComplete

  const completed = useMemo(
    () => new Set(completedList ?? []),
    [completedList],
  )

  // Completion overlay state
  const [showOverlay, setShowOverlay] = useState(false)

  // Stable callback — uses refs to avoid depending on mutation object
  const handleComplete = useCallback(
    (completedPropId: number) => {
      markCompleteRef.current.mutate(completedPropId)
      setTimeout(() => setShowOverlay(true), 1500)
    },
    [], // stable — reads current values from refs
  )

  // Compute unlocked props and next prop for the overlay
  const unlocked = useMemo(
    () => getUnlockedBy(propId, completed),
    [propId, completed],
  )

  const afterCompletion = useMemo(
    () => {
      const after = new Set(completed)
      after.add(propId)
      return after
    },
    [completed, propId],
  )

  const nextPropId = useMemo(
    () => unlocked[0] ?? getNextProp(afterCompletion),
    [unlocked, afterCompletion],
  )

  const navigateWithPlayer = useCallback(
    (path: string) => {
      const playerParam = selectedPlayerId
        ? `?player=${encodeURIComponent(selectedPlayerId)}`
        : ''
      router.push(`${path}${playerParam}`)
    },
    [selectedPlayerId, router],
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
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(55, 65, 81, 1)',
              }}
            >
              {title}
            </span>
            <PlayerPicker
              selectedPlayerId={selectedPlayerId}
              onSelect={setSelectedPlayerId}
            />
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
        />

        {/* Completion overlay */}
        {showOverlay && (
          <EuclidCompletionOverlay
            propositionId={propId}
            unlocked={unlocked}
            nextPropId={nextPropId}
            onNavigateNext={(id) => navigateWithPlayer(`/toys/euclid/${id}`)}
            onNavigateMap={() => navigateWithPlayer('/toys/euclid')}
          />
        )}
      </div>
    </div>
  )
}
