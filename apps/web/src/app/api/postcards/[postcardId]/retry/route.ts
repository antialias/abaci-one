import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthenticatedContext } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { startPostcardGenerate } from '@/lib/tasks/postcard-generate'

/** POST /api/postcards/:postcardId/retry — retry a failed postcard generation */
export const POST = withAuth(async (_request: NextRequest, context: AuthenticatedContext) => {
  const userId = await getUserId()
  const params = await context.params
  const postcardId = params.postcardId as string

  const [postcard] = await db
    .select()
    .from(schema.numberLinePostcards)
    .where(
      and(
        eq(schema.numberLinePostcards.id, postcardId),
        eq(schema.numberLinePostcards.userId, userId)
      )
    )
    .limit(1)

  if (!postcard) {
    return NextResponse.json({ error: 'Postcard not found' }, { status: 404 })
  }

  if (postcard.status !== 'failed' && postcard.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot retry postcard with status "${postcard.status}"` },
      { status: 400 }
    )
  }

  await db
    .update(schema.numberLinePostcards)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(schema.numberLinePostcards.id, postcardId))

  const taskId = await startPostcardGenerate({ postcardId, userId })

  await db
    .update(schema.numberLinePostcards)
    .set({ taskId })
    .where(eq(schema.numberLinePostcards.id, postcardId))

  return NextResponse.json({ postcardId, taskId })
})
