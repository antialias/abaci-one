/**
 * Who may follow (`task:subscribe`) or cancel (`task:cancel`) a background
 * task over the socket, as the HTTP task routes decide it:
 * - an admin: any task (the admin task pages, `requireAdmin`'s rule: the
 *   user's database role, or an `ADMIN_EMAILS` address);
 * - the task's owner (`background_tasks.user_id`; a flowchart workshop task
 *   also names its owner in its input, as its routes check the workshop
 *   session's user);
 * - a worksheet parse or re-parse: whoever may `view` the worksheet's player
 *   may follow it, whoever may `start-session` for it (who may start one) may
 *   cancel it, as the parse routes check.
 * A task with no owner (the admin tools' tasks) is an admin's only.
 *
 * The viewer is the socket's verified one (`socket.data.viewer`). A refused
 * request is answered as for a missing task, so a task id reveals nothing.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isUserAdmin } from '@/lib/auth/roles'
import { canPerformAction } from '@/lib/classroom/access-control'
import type { SocketViewer } from '@/lib/socket-viewer'

export type TaskSocketAction = 'follow' | 'cancel'

/** Task types whose input names the workshop user who started it. */
const WORKSHOP_TASKS = new Set(['flowchart-generate', 'flowchart-refine'])
/** Task types whose input names the worksheet's player. */
const WORKSHEET_TASKS = new Set(['worksheet-parse', 'worksheet-reparse'])

/** Whether a signed-in viewer is an admin (`requireAdmin`'s rule). */
async function isAdminViewer(viewer: SocketViewer | undefined): Promise<boolean> {
  if (viewer?.kind !== 'user') return false
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, viewer.userId),
    columns: { email: true },
  })
  return isUserAdmin({ userId: viewer.userId, email: user?.email ?? null })
}

/** Whether the socket's viewer may follow or cancel the task. */
export async function mayUseTask(
  viewer: SocketViewer | undefined,
  taskId: unknown,
  action: TaskSocketAction
): Promise<boolean> {
  if (typeof taskId !== 'string' || !taskId) return false
  const viewerId = viewer && viewer.kind !== 'anonymous' ? viewer.userId : null
  if (!viewerId) return false

  const task = await db.query.backgroundTasks.findFirst({
    where: eq(schema.backgroundTasks.id, taskId),
    columns: { type: true, userId: true },
  })
  if (!task) return false
  if (task.userId === viewerId) return true

  // Only these types' inputs are read (a worksheet's carries its image)
  if (WORKSHOP_TASKS.has(task.type) || WORKSHEET_TASKS.has(task.type)) {
    const row = await db.query.backgroundTasks.findFirst({
      where: eq(schema.backgroundTasks.id, taskId),
      columns: { input: true },
    })
    const input = (row?.input ?? {}) as { userId?: unknown; playerId?: unknown }
    if (WORKSHOP_TASKS.has(task.type) && input.userId === viewerId) return true
    if (WORKSHEET_TASKS.has(task.type) && typeof input.playerId === 'string') {
      const level = action === 'follow' ? 'view' : 'start-session'
      if (await canPerformAction(viewerId, input.playerId, level)) return true
    }
  }
  return isAdminViewer(viewer)
}
