import type { Metadata } from 'next'
import WhyAbacusContent from './WhyAbacusContent'

export const metadata: Metadata = {
  title: 'Why the Abacus? | Abaci One',
  description:
    "Your kid can add 4+3. But do they understand why it's 7? Learn how the abacus builds real number sense — from physical beads to mental math.",
  openGraph: {
    title: 'Why the Abacus? How Beads Build Better Math Brains',
    description:
      'Interactive guide: how the abacus develops number sense, mental math, and deep mathematical understanding in kids.',
    url: 'https://abaci.one/why-abacus',
    type: 'article',
  },
}

export default function WhyAbacusPage() {
  return <WhyAbacusContent />
}
