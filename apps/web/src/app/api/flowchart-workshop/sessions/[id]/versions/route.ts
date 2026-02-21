/**
 * Version History API for Flowchart Workshop
 *
 * GET /api/flowchart-workshop/sessions/[id]/versions
 * - Returns all versions for the session, ordered by version number DESC
 *
 * POST /api/flowchart-workshop/sessions/[id]/versions
 * - Restore a specific version by copying its data into the current draft
 * - Body: { versionNumber: number }
 */

import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/flowchart-workshop/sessions/[id]/versions
 * List all versions for the session
 *
 * Returns: { versions: FlowchartVersionHistory[], currentVersion: number }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    // Verify session ownership
    const session = await db.query.workshopSessions.findFirst({
      where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get all versions for this session
    const versions = await db.query.flowchartVersionHistory.findMany({
      where: eq(schema.flowchartVersionHistory.sessionId, id),
      orderBy: [desc(schema.flowchartVersionHistory.versionNumber)],
    })

    // Add isCurrent flag to each version
    const currentVersion = session.currentVersionNumber ?? 0
    const versionsWithCurrent = versions.map((v) => ({
      ...v,
      isCurrent: v.versionNumber === currentVersion,
    }))

    return NextResponse.json({
      versions: versionsWithCurrent,
      currentVersion,
    })
  } catch (error) {
    console.error('Failed to fetch version history:', error)
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }
})

/**
 * POST /api/flowchart-workshop/sessions/[id]/versions
 * Restore a specific version
 *
 * Body: { versionNumber: number }
 * Returns: { success: true, session: WorkshopSession }
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()
    const body = await request.json()

    const { versionNumber } = body
    if (typeof versionNumber !== 'number') {
      return NextResponse.json({ error: 'versionNumber is required' }, { status: 400 })
    }

    // Verify session ownership
    const session = await db.query.workshopSessions.findFirst({
      where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Find the version to restore
    const version = await db.query.flowchartVersionHistory.findFirst({
      where: and(
        eq(schema.flowchartVersionHistory.sessionId, id),
        eq(schema.flowchartVersionHistory.versionNumber, versionNumber)
      ),
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Restore the version by copying its data into the session draft
    const [updatedSession] = await db
      .update(schema.workshopSessions)
      .set({
        draftDefinitionJson: version.definitionJson,
        draftMermaidContent: version.mermaidContent,
        draftTitle: version.title,
        draftDescription: version.description,
        draftEmoji: version.emoji,
        draftDifficulty: version.difficulty as 'Beginner' | 'Intermediate' | 'Advanced' | null,
        draftNotes: version.notes,
        currentVersionNumber: version.versionNumber,
        state: 'refining',
        updatedAt: new Date(),
      })
      .where(eq(schema.workshopSessions.id, id))
      .returning()

    console.log(`[versions] Restored version ${versionNumber} for session ${id}`)

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })
  } catch (error) {
    console.error('Failed to restore version:', error)
    return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 })
  }
})
