'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Fallback: if someone hits /admin/tts-lab/bounce directly, redirect home. */
export default function BounceFallback() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/tts-lab')
  }, [router])
  return null
}
