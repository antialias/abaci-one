import { redirect } from "next/navigation";

interface SkillsPageProps {
  params: Promise<{ studentId: string }>;
}

/**
 * Skills Page - Redirects to Dashboard Skills Tab
 *
 * The skills view has been consolidated into the main dashboard
 * as a tab. This redirect ensures old URLs continue to work.
 *
 * URL: /practice/[studentId]/skills -> /practice/[studentId]/dashboard?tab=skills
 */
export default async function SkillsPage({ params }: SkillsPageProps) {
  const { studentId } = await params;
  redirect(`/practice/${studentId}/dashboard?tab=skills`);
}
