import { useRef, useEffect } from 'react'
import type { AlignmentConfig } from './renderPhiExploreImage'

export interface PhiExploreImageData {
  image: HTMLImageElement
  alignment: AlignmentConfig
  subjectId: string
}

interface AlignmentEntry {
  scale?: number
  rotation?: number
  offsetX?: number
  offsetY?: number
  light?: AlignmentConfig
  dark?: AlignmentConfig
}

type AlignmentJson = Record<string, AlignmentEntry>

/**
 * Hook that loads phi-explore alignment data and preloads a random themed
 * image. Returns a ref containing the image + alignment, or null while loading.
 *
 * On theme change, picks a new random subject and preloads its themed image.
 */
export function usePhiExploreImage(
  resolvedTheme: string | undefined
): React.MutableRefObject<PhiExploreImageData | null> {
  const dataRef = useRef<PhiExploreImageData | null>(null)
  const alignmentCacheRef = useRef<AlignmentJson | null>(null)
  const loadIdRef = useRef(0)

  useEffect(() => {
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    const loadId = ++loadIdRef.current
    dataRef.current = null

    async function load() {
      // Fetch alignment data (cached after first load)
      let alignmentData = alignmentCacheRef.current
      if (!alignmentData) {
        try {
          const res = await fetch('/images/constants/phi-explore/alignment.json')
          if (!res.ok) return
          alignmentData = (await res.json()) as AlignmentJson
          alignmentCacheRef.current = alignmentData
        } catch {
          return
        }
      }
      if (loadId !== loadIdRef.current) return

      // Filter to subjects that have alignment for this theme
      const candidates = Object.entries(alignmentData).filter(
        ([, entry]) => entry[theme] != null
      )
      if (candidates.length === 0) return

      // Pick a random subject
      const [subjectId, entry] = candidates[Math.floor(Math.random() * candidates.length)]
      const alignment = entry[theme]!

      // Preload the themed image
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = `/images/constants/phi-explore/${subjectId}-${theme}.png`
      }).catch(() => {})

      if (loadId !== loadIdRef.current) return
      if (!img.naturalWidth) return // failed to load

      dataRef.current = { image: img, alignment, subjectId }
    }

    load()

    return () => {
      dataRef.current = null
    }
  }, [resolvedTheme])

  return dataRef
}
