import { redirect } from 'next/navigation'

// Disable caching - session data should be fresh
export const dynamic = 'force-dynamic'

interface ConfigurePageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Configure Practice Session Page - DEPRECATED
 *
 * This page now redirects to the dashboard. The session configuration
 * modal is accessible from the dashboard via the "Start Practice" button.
 *
 * URL: /practice/[studentId]/configure → redirects to /practice/[studentId]/dashboard
 */
export default async function ConfigurePage({ params }: ConfigurePageProps) {
  const { studentId } = await params

  // Redirect to dashboard - the StartPracticeModal is now accessible from there
  redirect(`/practice/${studentId}/dashboard`)
}
