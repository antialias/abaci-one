import { redirect } from 'next/navigation'

// Disable caching for this page
export const dynamic = 'force-dynamic'

interface ResumePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Resume Session Page - DEPRECATED
 *
 * This page now redirects to the main practice page. The "welcome back"
 * experience is now handled by the SessionPausedModal which shows automatically
 * when returning to an in-progress session.
 *
 * URL: /practice/[studentId]/resume → redirects to /practice/[studentId]
 */
export default async function ResumePage({ params }: ResumePageProps) {
  const { studentId } = await params

  // The main practice page now handles the "welcome back" modal
  redirect(`/practice/${studentId}`)
}
