import type { Metadata } from 'next'
import { PageWithNav } from '@/components/PageWithNav'
import WorksheetParsingContent from './WorksheetParsingContent'

export const metadata: Metadata = {
  title: 'Worksheet Parsing — From Paper to Practice | Abaci One',
  description:
    'Turn paper math worksheets into structured skill data with vision AI. Snap a photo, parse problems automatically, review with confidence scoring, and feed results into adaptive practice.',
  openGraph: {
    title: 'Worksheet Parsing — From Paper to Practice | Abaci One',
    description:
      'Vision AI reads your math worksheets faithfully — no interpretation, just accurate transcription with confidence scoring. Every parsed problem feeds the adaptive skill model.',
    url: 'https://abaci.one/features/worksheet-parsing',
    type: 'website',
  },
}

export default function WorksheetParsingPage() {
  return (
    <PageWithNav>
      <WorksheetParsingContent />
    </PageWithNav>
  )
}
