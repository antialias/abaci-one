'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Memory Quiz redirect page
 *
 * Local mode has been deprecated. Memory Quiz is now only available
 * through the Champion Arena (arcade) in room mode.
 *
 * This page redirects users to the arcade where they can:
 * 1. Create or join a room
 * 2. Select Memory Lightning from the game selector
 * 3. Play in multiplayer or solo (single-player room)
 */
export default function MemoryQuizRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to arcade
    router.replace('/arcade')
  }, [router])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: '20px',
        }}
      >
        🧠
      </div>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: '#1f2937',
          textAlign: 'center',
        }}
      >
        Redirecting to Champion Arena...
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: '#6b7280',
          textAlign: 'center',
          maxWidth: '500px',
        }}
      >
        Memory Lightning is now part of the Champion Arena.
        <br />
        You'll be able to play solo or with friends in multiplayer mode!
      </p>
    </div>
  )
}
