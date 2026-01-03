import { db } from "@/db";
import { players } from "@/db/schema";
import { BktSettingsClient } from "./BktSettingsClient";

/**
 * Admin page for configuring BKT confidence threshold.
 *
 * This setting affects how skills are classified across the entire app:
 * - Skills with confidence below threshold are classified as 'learning'
 * - Skills above threshold are classified by pKnown (struggling/learning/mastered)
 */
export default async function BktSettingsPage() {
  // Fetch all students for the preview dropdown
  const allStudents = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .orderBy(players.name);

  return <BktSettingsClient students={allStudents} />;
}
