import type { Metadata } from 'next'
import { createToolMetadata } from '@/lib/create-tools/createToolMetadata'

/**
 * Metadata-only layout: the page is a client component, and a `'use client'`
 * module's `metadata` export is silently ignored, so the route would otherwise
 * inherit the site-wide default title. Must NOT become a client component.
 */
export const metadata: Metadata = createToolMetadata('music-flashcards')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
