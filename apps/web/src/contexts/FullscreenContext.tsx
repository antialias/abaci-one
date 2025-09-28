'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

interface FullscreenContextType {
  isFullscreen: boolean
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
  toggleFullscreen: () => Promise<void>
  setFullscreenElement: (element: HTMLElement | null) => void
  fullscreenElementRef: React.MutableRefObject<HTMLElement | null>
}

const FullscreenContext = createContext<FullscreenContextType | null>(null)

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  const setFullscreenElement = useCallback((element: HTMLElement | null) => {
    fullscreenElementRef.current = element
  }, [])

  const enterFullscreen = async () => {
    try {
      // Use the registered fullscreen element, fallback to document.documentElement
      const element = fullscreenElementRef.current || document.documentElement

      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error)
    }
  }

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen()
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error)
    }
  }

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }

  return (
    <FullscreenContext.Provider value={{
      isFullscreen,
      enterFullscreen,
      exitFullscreen,
      toggleFullscreen,
      setFullscreenElement,
      fullscreenElementRef
    }}>
      {children}
    </FullscreenContext.Provider>
  )
}

export function useFullscreen(): FullscreenContextType {
  const context = useContext(FullscreenContext)
  if (!context) {
    throw new Error('useFullscreen must be used within a FullscreenProvider')
  }
  return context
}