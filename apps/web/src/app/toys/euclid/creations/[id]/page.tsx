import { notFound } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { TrackSeen } from './TrackSeen'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CreationPage({ params }: Props) {
  const { id } = await params
  const creation = await db
    .select()
    .from(schema.euclidCreations)
    .where(eq(schema.euclidCreations.id, id))
    .get()

  if (!creation) notFound()

  const { givenPoints, actions } = creation.data

  return (
    <div
      data-component="euclid-creation-page"
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
          <a
            href="/toys/euclid/playground"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(55, 65, 81, 1)',
              textDecoration: 'none',
            }}
          >
            ← Playground
          </a>
        }
      />
      {/* Tracks this ID in localStorage under euclid_seen_ids */}
      <TrackSeen id={id} ownerId={creation.userId} />
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
          propositionId={0}
          playgroundMode
          initialActions={actions}
          initialGivenPoints={givenPoints}
        />
      </div>
    </div>
  )
}
