import { useState, useRef, useCallback, useEffect } from 'react'
import type { AlignmentConfig } from './renderPhiExploreImage'

const ALL_SUBJECTS = [
  'fiddlehead', 'galaxy', 'hurricane', 'nautilus', 'pinecone',
  'rams-horn', 'romanesco', 'sunflower', 'wave',
] as const

const DEFAULT_ALIGNMENT: AlignmentConfig = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
}

type ThemeVariant = 'light' | 'dark'

interface AlignmentEntry {
  light?: AlignmentConfig
  dark?: AlignmentConfig
  // legacy top-level fields
  scale?: number
  rotation?: number
  offsetX?: number
  offsetY?: number
}

type AlignmentJson = Record<string, AlignmentEntry>

export interface PhiCenteringMode {
  enabled: boolean
  subjectId: string
  theme: ThemeVariant
  alignment: AlignmentConfig
  image: HTMLImageElement | null
  allSubjects: readonly string[]
  dirty: boolean
  saving: boolean

  setEnabled: (v: boolean) => void
  setSubject: (id: string) => void
  setTheme: (t: ThemeVariant) => void
  updateAlignment: (partial: Partial<AlignmentConfig>) => void
  resetAlignment: () => void
  nextSubject: () => void
  prevSubject: () => void
}

export function usePhiCenteringMode(resolvedTheme: string | undefined): PhiCenteringMode {
  const [enabled, setEnabled] = useState(false)
  const [subjectId, setSubjectIdRaw] = useState<string>(ALL_SUBJECTS[0])
  const [theme, setThemeRaw] = useState<ThemeVariant>(
    resolvedTheme === 'dark' ? 'dark' : 'light'
  )
  const [alignment, setAlignment] = useState<AlignmentConfig>({ ...DEFAULT_ALIGNMENT })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const alignmentDataRef = useRef<AlignmentJson | null>(null)
  const loadIdRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestAlignmentRef = useRef(alignment)
  latestAlignmentRef.current = alignment

  // Load alignment.json once
  useEffect(() => {
    if (!enabled) return
    if (alignmentDataRef.current) return // already loaded

    let cancelled = false
    async function load() {
      try {
        const res = await fetch(
          `/images/constants/phi-explore/alignment.json?t=${Date.now()}`
        )
        if (!res.ok) return
        const data = (await res.json()) as AlignmentJson
        if (cancelled) return
        alignmentDataRef.current = data
        // Apply alignment for current subject+theme
        const entry = data[subjectId]
        if (entry?.[theme]) {
          setAlignment({ ...entry[theme]! })
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => { cancelled = true }
    // Only load once when enabled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Load image when subject or theme changes
  useEffect(() => {
    if (!enabled) return
    const id = ++loadIdRef.current
    setImage(null)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (id !== loadIdRef.current) return
      setImage(img)
    }
    img.onerror = () => {
      // ignore
    }
    img.src = `/images/constants/phi-explore/${subjectId}-${theme}.png`

    // Also update alignment from cached data
    const data = alignmentDataRef.current
    if (data) {
      const entry = data[subjectId]
      if (entry?.[theme]) {
        setAlignment({ ...entry[theme]! })
      } else {
        setAlignment({ ...DEFAULT_ALIGNMENT })
      }
    }
    setDirty(false)

    return () => { loadIdRef.current++ }
  }, [enabled, subjectId, theme])

  // Debounced auto-save
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const al = latestAlignmentRef.current
      setSaving(true)
      try {
        const res = await fetch('/api/admin/constant-images/phi-explore/alignment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId,
            theme,
            alignment: al,
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as AlignmentJson
          alignmentDataRef.current = data
          setDirty(false)
        }
      } catch {
        // ignore
      } finally {
        setSaving(false)
      }
    }, 500)
  }, [subjectId, theme])

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const updateAlignment = useCallback((partial: Partial<AlignmentConfig>) => {
    setAlignment(prev => {
      const next = { ...prev, ...partial }
      return next
    })
    setDirty(true)
    scheduleSave()
  }, [scheduleSave])

  const resetAlignment = useCallback(() => {
    setAlignment({ ...DEFAULT_ALIGNMENT })
    setDirty(true)
    scheduleSave()
  }, [scheduleSave])

  const setSubject = useCallback((id: string) => {
    setSubjectIdRaw(id)
  }, [])

  const setTheme = useCallback((t: ThemeVariant) => {
    setThemeRaw(t)
  }, [])

  const nextSubject = useCallback(() => {
    const idx = ALL_SUBJECTS.indexOf(subjectId as typeof ALL_SUBJECTS[number])
    const next = ALL_SUBJECTS[(idx + 1) % ALL_SUBJECTS.length]
    setSubjectIdRaw(next)
  }, [subjectId])

  const prevSubject = useCallback(() => {
    const idx = ALL_SUBJECTS.indexOf(subjectId as typeof ALL_SUBJECTS[number])
    const prev = ALL_SUBJECTS[(idx - 1 + ALL_SUBJECTS.length) % ALL_SUBJECTS.length]
    setSubjectIdRaw(prev)
  }, [subjectId])

  return {
    enabled,
    subjectId,
    theme,
    alignment,
    image,
    allSubjects: ALL_SUBJECTS,
    dirty,
    saving,
    setEnabled,
    setSubject,
    setTheme,
    updateAlignment,
    resetAlignment,
    nextSubject,
    prevSubject,
  }
}
