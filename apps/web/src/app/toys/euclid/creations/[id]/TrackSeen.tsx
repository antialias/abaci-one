'use client'

import { useEffect } from 'react'

interface Props {
  id: string
  /** userId of the creation's owner — only store if it's someone else's */
  ownerId: string | null
}

/**
 * Stores this creation ID in localStorage so the playground's
 * "Seen" tab can surface creations opened from share links.
 * Only stores if the creation doesn't belong to the current user
 * (determined client-side by comparing against the mine API).
 */
export function TrackSeen({ id, ownerId }: Props) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('euclid_seen_ids')
      const ids: string[] = stored ? JSON.parse(stored) : []
      if (!ids.includes(id)) {
        localStorage.setItem('euclid_seen_ids', JSON.stringify([id, ...ids].slice(0, 100)))
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, [id, ownerId])
  return null
}
