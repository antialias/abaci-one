import { useState, useRef, useEffect, useCallback } from 'react'

interface UseCitationPopoverOptions {
  isMobile: boolean
}

export function useCitationPopover({ isMobile }: UseCitationPopoverOptions) {
  const [activeCitation, setActiveCitation] = useState<{ key: string; rect: DOMRect } | null>(null)
  const citationShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const citationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popoverHoveredRef = useRef(false)

  const handleCitationPointerEnter = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (isMobile) return
      if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      citationShowTimerRef.current = setTimeout(() => {
        setActiveCitation({ key, rect })
      }, 200)
    },
    [isMobile]
  )

  const handleCitationPointerLeave = useCallback(() => {
    if (isMobile) return
    if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
    citationHideTimerRef.current = setTimeout(() => {
      if (!popoverHoveredRef.current) setActiveCitation(null)
    }, 300)
  }, [isMobile])

  const handleCitationPointerDown = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (!isMobile) return
      e.preventDefault()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setActiveCitation({ key, rect })
    },
    [isMobile]
  )

  // Mobile: dismiss popover when press ends anywhere
  useEffect(() => {
    if (!isMobile) return
    const dismiss = () => setActiveCitation(null)
    window.addEventListener('pointerup', dismiss)
    window.addEventListener('pointercancel', dismiss)
    return () => {
      window.removeEventListener('pointerup', dismiss)
      window.removeEventListener('pointercancel', dismiss)
    }
  }, [isMobile])

  return {
    activeCitation,
    setActiveCitation,
    popoverHoveredRef,
    citationShowTimerRef,
    citationHideTimerRef,
    handleCitationPointerEnter,
    handleCitationPointerLeave,
    handleCitationPointerDown,
  }
}
