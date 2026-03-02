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
import { PROP_REGISTRY, ALTERNATE_PROOFS } from '@/components/toys/euclid/propositions/registry'
import { resolveKidLanguageStyle } from '@/lib/kidLanguageStyle'
import { getAgeFromBirthday } from '@/lib/playerAge'

export default function EuclidPropPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const propId = Number(params.id) || 1
  const prop = getProposition(propId)
  const title = prop ? `Euclid I.${propId}` : `Euclid I.${propId}`

  // ── Proof variant state ──
  const [proofVariant, setProofVariant] = useState<string | undefined>(undefined)

  const canonical = PROP_REGISTRY[propId]
  const alternates = ALTERNATE_PROOFS[propId] ?? []
  const allVariants = canonical ? [canonical, ...alternates] : []
  const hasAlternates = allVariants.length > 1

  const selectedProp = useMemo(() => {
    if (!proofVariant) return canonical
    return allVariants.find((v) => v.proofVariant === proofVariant) ?? canonical
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propId, proofVariant])

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
    () =>
      resolveKidLanguageStyle(
        preferences?.kidLanguageStyle,
        getAgeFromBirthday(selectedPlayer?.birthday)
      ),
    [preferences?.kidLanguageStyle, selectedPlayer?.birthday]
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
            <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          </div>
        }
      />

      {/* Proof variant selector — shown when multiple proofs exist */}
      {hasAlternates && (
        <div
          data-element="proof-selector"
          style={{
            position: 'absolute',
            top: 'calc(var(--app-nav-height) + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            display: 'flex',
            gap: 2,
            padding: 2,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(203, 213, 225, 0.6)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {allVariants.map((variant) => {
            const variantId = variant.proofVariant
            const isActive = proofVariant === variantId || (!proofVariant && !variantId)
            const label = variant.proofLabel ?? (variantId ? variantId : 'Euclid')
            return (
              <button
                key={variantId ?? 'canonical'}
                type="button"
                onClick={() => setProofVariant(variantId)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 14,
                  border: 'none',
                  background: isActive ? '#4E79A7' : 'transparent',
                  color: isActive ? '#fff' : '#64748b',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Georgia, serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

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
          key={`${propId}-${proofVariant ?? 'canonical'}`}
          propositionId={propId}
          proposition={selectedProp}
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
