import type { Metadata } from 'next'
import ForTeachersContent from './ForTeachersContent'

export const metadata: Metadata = {
  title: 'For Soroban Teachers & Tutors | Abaci One',
  description:
    'Teach soroban remotely without the awkwardness. Computer vision sees your student\'s abacus clearly, reads bead positions automatically, and generates adaptive problems based on each student\'s skill gaps.',
  openGraph: {
    title: 'Abaci One for Soroban Teachers — Remote Teaching That Actually Works',
    description:
      'Computer vision that sees and reads the abacus. Adaptive problems that target weak skills. BKT-based reporting that isolates exactly where each student needs work. Built for soroban teachers.',
    url: 'https://abaci.one/for-teachers',
    type: 'website',
  },
}

export default function ForTeachersPage() {
  return <ForTeachersContent />
}
