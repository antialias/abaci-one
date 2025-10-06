'use client'

import { useEffect, useState } from 'react'

interface SpeechBubbleProps {
  message: string
  onHide: () => void
}

export function SpeechBubble({ message, onHide }: SpeechBubbleProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-hide after 3.5s (line 11749-11752)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onHide, 300) // Wait for fade-out animation
    }, 3500)

    return () => clearTimeout(timer)
  }, [onHide])

  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'white',
      borderRadius: '15px',
      padding: '10px 15px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      fontSize: '14px',
      whiteSpace: 'nowrap',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      zIndex: 10,
      pointerEvents: 'none',
      maxWidth: '250px',
      textAlign: 'center'
    }}>
      {message}
      {/* Tail pointing down */}
      <div style={{
        position: 'absolute',
        bottom: '-8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '8px solid white',
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))'
      }} />
    </div>
  )
}