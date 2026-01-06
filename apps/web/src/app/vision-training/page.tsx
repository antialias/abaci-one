'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  TrainingImageViewer,
  type TrainingImageMeta,
  type GroupBy,
} from '../../components/vision/TrainingImageViewer'

export default function VisionTrainingPage() {
  const [images, setImages] = useState<TrainingImageMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterDigit, setFilterDigit] = useState<string>('')
  const [filterPlayer, setFilterPlayer] = useState<string>('')
  const [filterSession, setFilterSession] = useState<string>('')
  const [groupBy, setGroupBy] = useState<GroupBy>('digit')

  // Load images
  const loadImages = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filterDigit) params.set('digit', filterDigit)
      if (filterPlayer) params.set('playerId', filterPlayer)
      if (filterSession) params.set('sessionId', filterSession)

      const response = await fetch(`/api/vision-training/images?${params}`)
      if (!response.ok) throw new Error('Failed to load images')

      const data = await response.json()
      setImages(data.images)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filterDigit, filterPlayer, filterSession])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  return (
    <TrainingImageViewer
      images={images}
      loading={loading}
      error={error}
      filterDigit={filterDigit}
      filterPlayer={filterPlayer}
      filterSession={filterSession}
      groupBy={groupBy}
      onFilterDigitChange={setFilterDigit}
      onFilterPlayerChange={setFilterPlayer}
      onFilterSessionChange={setFilterSession}
      onGroupByChange={setGroupBy}
      onRefresh={loadImages}
    />
  )
}
