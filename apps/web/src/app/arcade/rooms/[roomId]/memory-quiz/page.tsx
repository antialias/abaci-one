'use client'

import { useParams } from 'next/navigation'

// Temporarily redirect to solo arcade version
// TODO Phase 4: Implement room-aware memory quiz with multiplayer sync
export default function RoomMemoryQuizPage() {
  const params = useParams()
  const roomId = params.roomId as string

  // Import and use the arcade version for now
  // This prevents 404s while we work on full multiplayer integration
  const MemoryQuizGame = require('@/app/arcade/memory-quiz/page').default

  return <MemoryQuizGame />
}
