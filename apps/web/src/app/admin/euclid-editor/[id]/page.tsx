'use client'

import { useParams } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { EuclidEditor } from '@/components/toys/euclid/editor/EuclidEditor'

export default function EuclidEditorPage() {
  const { id } = useParams<{ id: string }>()
  const propositionId = parseInt(id, 10)

  if (isNaN(propositionId) || propositionId < 1 || propositionId > 48) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc' }}>
        <AppNavBar />
        <AdminNav />
        <div style={{ padding: 40, textAlign: 'center' }}>
          Invalid proposition ID. Must be 1-48.
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="euclid-editor-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#FAFAF0',
      }}
    >
      <AppNavBar />
      <AdminNav />
      <div style={{ flex: 1, minHeight: 0 }}>
        <EuclidEditor propositionId={propositionId} />
      </div>
    </div>
  )
}
