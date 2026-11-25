'use client'

import type { ImageClassStatus } from '@/lib/images/switch-images'

export type { ImageClassStatus } from '@/lib/images/switch-images'

interface ImageClassSelectProps {
  /** The `imageClasses` / `defaultImageClass` / `configured` block from an admin status route. */
  status: ImageClassStatus | null | undefined
  value: string
  onChange: (imageClass: string) => void
  disabled?: boolean
  className?: string
}

/**
 * One select for the switch proxy's image classes. The proxy decides who
 * draws each class; each option's title is the proxy's summary of that.
 * Unstyled beyond the `className` the page passes, so it takes the page's look.
 */
export function ImageClassSelect({
  status,
  value,
  onChange,
  disabled,
  className,
}: ImageClassSelectProps) {
  const classes = status?.imageClasses ?? []
  const selected = classes.find((c) => c.id === value)
  // If the class list couldn't be fetched, still offer the chosen/default class.
  const fallbackId = value || status?.defaultImageClass || ''
  const showFallback = fallbackId !== '' && !classes.some((c) => c.id === fallbackId)

  return (
    <select
      data-action="select-image-class"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !status?.configured}
      className={className}
      title={
        !status?.configured
          ? 'Image generation is not configured: set SWITCH_MEDIA_URL and SWITCH_MEDIA_LOGIN'
          : selected?.summary || undefined
      }
    >
      {!status?.configured && <option value={value}>Image generation not configured</option>}
      {status?.configured && showFallback && <option value={fallbackId}>{fallbackId}</option>}
      {status?.configured &&
        classes.map((c) => (
          <option key={c.id} value={c.id} title={c.summary}>
            {c.displayName}
          </option>
        ))}
    </select>
  )
}
