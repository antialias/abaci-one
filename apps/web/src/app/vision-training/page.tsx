'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TrainingImageViewer,
  type TrainingImageMeta,
  type GroupBy,
} from '../../components/vision/TrainingImageViewer'
import { BulkDeleteModal, type BulkDeleteFilters } from '../../components/vision/BulkDeleteModal'
import { DeleteToastContainer, type PendingDeletion } from '../../components/vision/DeleteToast'

export default function VisionTrainingPage() {
  const [images, setImages] = useState<TrainingImageMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Pending deletions for undo functionality
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])
  const deletionIdCounter = useRef(0)

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

  // Schedule a deletion (with undo capability)
  const scheduleDeletion = useCallback((imagesToDelete: TrainingImageMeta[], message: string) => {
    const id = `deletion-${++deletionIdCounter.current}`
    const deletion: PendingDeletion = {
      id,
      images: imagesToDelete.map((img) => ({ digit: img.digit, filename: img.filename })),
      message,
      createdAt: Date.now(),
    }

    // Optimistically remove from UI
    const deletedFilenames = new Set(imagesToDelete.map((img) => img.filename))
    setImages((prev) => prev.filter((img) => !deletedFilenames.has(img.filename)))

    // Add to pending deletions
    setPendingDeletions((prev) => [...prev, deletion])
  }, [])

  // Undo a pending deletion
  const handleUndoDeletion = useCallback(
    (deletion: PendingDeletion) => {
      // Remove from pending
      setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

      // Reload images to restore
      loadImages()
    },
    [loadImages]
  )

  // Confirm (finalize) a deletion
  const handleConfirmDeletion = useCallback(async (deletion: PendingDeletion) => {
    // Remove from pending
    setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

    // Actually delete from server
    try {
      const response = await fetch('/api/vision-training/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames: deletion.images,
          confirm: true,
        }),
      })

      if (!response.ok) {
        console.error('Failed to delete images')
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }, [])

  // Dismiss toast (same as confirm)
  const handleDismissDeletion = useCallback(
    (deletion: PendingDeletion) => {
      handleConfirmDeletion(deletion)
    },
    [handleConfirmDeletion]
  )

  // Delete a single image
  const handleDeleteImage = useCallback(
    async (image: TrainingImageMeta) => {
      scheduleDeletion([image], `Deleted image of digit ${image.digit}`)
    },
    [scheduleDeletion]
  )

  // Bulk delete selected images
  const handleBulkDelete = useCallback(
    async (imagesToDelete: TrainingImageMeta[]) => {
      scheduleDeletion(imagesToDelete, `Deleted ${imagesToDelete.length} images`)
    },
    [scheduleDeletion]
  )

  // Preview bulk delete count
  const handleBulkDeletePreview = useCallback(
    async (filters: BulkDeleteFilters): Promise<number> => {
      const response = await fetch('/api/vision-training/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filters,
          confirm: false, // Preview mode
        }),
      })

      if (!response.ok) throw new Error('Failed to preview delete')

      const result = await response.json()
      return result.count
    },
    []
  )

  // Execute bulk delete from modal (uses undo system)
  const handleBulkDeleteExecute = useCallback(
    async (filters: BulkDeleteFilters) => {
      // First get the count of images that will be deleted
      const previewResponse = await fetch('/api/vision-training/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filters,
          confirm: false,
        }),
      })

      if (!previewResponse.ok) throw new Error('Failed to preview delete')

      const previewResult = await previewResponse.json()
      const count = previewResult.count

      if (count === 0) return

      // Get the actual images that match the filters to track for undo
      // We need to reload with filters to get the matching images
      const params = new URLSearchParams()
      if (filters.digit) params.set('digit', filters.digit)
      if (filters.playerId) params.set('playerId', filters.playerId)
      if (filters.sessionId) params.set('sessionId', filters.sessionId)

      const listResponse = await fetch(`/api/vision-training/images?${params}`)
      if (!listResponse.ok) throw new Error('Failed to list images')

      const listResult = await listResponse.json()
      let imagesToDelete = listResult.images as TrainingImageMeta[]

      // Apply date filters client-side since API doesn't support them for GET
      if (filters.beforeTimestamp) {
        imagesToDelete = imagesToDelete.filter((img) => img.timestamp < filters.beforeTimestamp!)
      }
      if (filters.afterTimestamp) {
        imagesToDelete = imagesToDelete.filter((img) => img.timestamp > filters.afterTimestamp!)
      }

      // Use the undo system
      scheduleDeletion(imagesToDelete, `Deleted ${imagesToDelete.length} images`)
    },
    [scheduleDeletion]
  )

  // Reclassify a single image
  const handleReclassifyImage = useCallback(async (image: TrainingImageMeta, newDigit: number) => {
    setReclassifying(true)
    try {
      const response = await fetch(`/api/vision-training/images/${image.digit}/${image.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDigit }),
      })

      if (!response.ok) {
        throw new Error('Failed to reclassify image')
      }

      const result = await response.json()
      if (result.reclassified) {
        // Update the image in state with new digit
        setImages((prev) =>
          prev.map((img) =>
            img.filename === image.filename
              ? {
                  ...img,
                  digit: newDigit,
                  imageUrl: `/api/vision-training/images/${newDigit}/${img.filename}`,
                }
              : img
          )
        )
      }
    } catch (err) {
      console.error('Reclassify failed:', err)
    } finally {
      setReclassifying(false)
    }
  }, [])

  // Bulk reclassify selected images
  const handleBulkReclassify = useCallback(
    async (imagesToReclassify: TrainingImageMeta[], newDigit: number) => {
      setReclassifying(true)
      try {
        const response = await fetch('/api/vision-training/images', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: imagesToReclassify.map((img) => ({
              digit: img.digit,
              filename: img.filename,
            })),
            newDigit,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to reclassify images')
        }

        const result = await response.json()
        if (result.reclassified > 0) {
          // Update the images in state with new digit
          const reclassifiedFilenames = new Set(
            imagesToReclassify.filter((img) => img.digit !== newDigit).map((img) => img.filename)
          )
          setImages((prev) =>
            prev.map((img) =>
              reclassifiedFilenames.has(img.filename)
                ? {
                    ...img,
                    digit: newDigit,
                    imageUrl: `/api/vision-training/images/${newDigit}/${img.filename}`,
                  }
                : img
            )
          )
        }
      } catch (err) {
        console.error('Bulk reclassify failed:', err)
      } finally {
        setReclassifying(false)
      }
    },
    []
  )

  return (
    <>
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
        onDeleteImage={handleDeleteImage}
        onBulkDelete={handleBulkDelete}
        onOpenBulkDeleteModal={() => setBulkDeleteModalOpen(true)}
        deleting={deleting}
        onReclassifyImage={handleReclassifyImage}
        onBulkReclassify={handleBulkReclassify}
        reclassifying={reclassifying}
      />
      <BulkDeleteModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        images={images}
        onPreview={handleBulkDeletePreview}
        onDelete={handleBulkDeleteExecute}
      />
      <DeleteToastContainer
        deletions={pendingDeletions}
        onUndo={handleUndoDeletion}
        onConfirm={handleConfirmDeletion}
        onDismiss={handleDismissDeletion}
      />
    </>
  )
}
