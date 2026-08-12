import type { Metadata } from 'next'
import { CreateHubContent } from './CreateHubContent'

/**
 * Server shell so the hub can export metadata; all the interactive/i18n work
 * lives in the client component (same split as `why-abacus`).
 */
export const metadata: Metadata = {
  title: 'Create — Printable Abacus Tools',
  description:
    'Design a real abacus, generate addition worksheets, print flashcards, or fill a calendar with beads. Every tool here makes something you can hold.',
  // Relative: the root layout's `metadataBase` supplies the host, and the
  // per-tool metadata resolves the same way.
  alternates: { canonical: '/create' },
  openGraph: {
    title: 'Create — Printable Abacus Tools',
    description:
      'Design a real abacus, generate addition worksheets, print flashcards, or fill a calendar with beads.',
    url: '/create',
    type: 'website',
  },
}

export default function CreateHubPage() {
  return <CreateHubContent />
}
