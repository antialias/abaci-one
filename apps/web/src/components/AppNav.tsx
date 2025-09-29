import React from 'react'
import { headers } from 'next/headers'
import { AppNavBar } from './AppNavBar'

interface AppNavProps {
  children: React.ReactNode
}

function getNavContentForPath(pathname: string): React.ReactNode {
  // Route-based nav content - no lazy loading needed
  if (pathname === '/games/matching' || pathname.startsWith('/arcade') && pathname.includes('matching')) {
    return (
      <h1 style={{
        fontSize: '18px',
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
        backgroundClip: 'text',
        color: 'transparent',
        margin: 0
      }}>
        🧩 Memory Pairs
      </h1>
    )
  }

  if (pathname === '/games/memory-quiz' || pathname.startsWith('/arcade') && pathname.includes('memory-quiz')) {
    return (
      <h1 style={{
        fontSize: '18px',
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
        backgroundClip: 'text',
        color: 'transparent',
        margin: 0
      }}>
        🧠 Memory Lightning
      </h1>
    )
  }

  return null
}

export function AppNav({ children }: AppNavProps) {
  const headersList = headers()
  const pathname = headersList.get('x-pathname') || ''

  // Use @nav slot content if available, otherwise fall back to route-based detection
  const navContent = children || getNavContentForPath(pathname)

  return <AppNavBar navSlot={navContent} />
}