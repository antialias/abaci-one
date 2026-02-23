/**
 * Email notification when a new parent links to a child.
 *
 * Sends a transactional email to all existing parents of the child
 * who have an email address on file.
 */

import { and, eq, ne, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { parentChild, users } from '@/db/schema'
import { sendEmail } from './email'
import { escapeHtml, baseUrl } from './email-utils'

/**
 * Notify existing parents that a new parent has been linked to their child.
 *
 * This is fire-and-forget — callers should `.catch()` errors.
 */
export async function notifyParentLinked(
  childPlayerId: string,
  childName: string,
  newParentUserId: string
): Promise<void> {
  // Look up the new parent's name
  const [newParent] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, newParentUserId))
    .limit(1)

  const newParentName = newParent?.name ?? newParent?.email ?? 'Someone'

  // Find all other parents of this child who have an email
  const existingParents = await db
    .select({ email: users.email, name: users.name })
    .from(parentChild)
    .innerJoin(users, eq(parentChild.parentUserId, users.id))
    .where(
      and(
        eq(parentChild.childPlayerId, childPlayerId),
        ne(parentChild.parentUserId, newParentUserId),
        isNotNull(users.email)
      )
    )

  if (existingParents.length === 0) return

  const profileUrl = `${baseUrl()}/students/${childPlayerId}`

  const subject = `New parent linked to ${childName}`

  for (const parent of existingParents) {
    if (!parent.email) continue

    const html = buildNotificationHtml(childName, newParentName, profileUrl)

    try {
      await sendEmail({ to: parent.email, subject, html })
    } catch (err) {
      console.error(
        `[family-notify] Failed to send to ${parent.email}:`,
        err instanceof Error ? err.message : err
      )
    }
  }
}

function buildNotificationHtml(
  childName: string,
  newParentName: string,
  profileUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#18181b;">
                New parent linked to ${escapeHtml(childName)}
              </h1>
              <p style="margin:0 0 8px;font-size:16px;color:#3f3f46;">
                <strong>${escapeHtml(newParentName)}</strong> has been linked to ${escapeHtml(childName)}'s account.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
                If you don't recognize this person, you can review linked parents in your child's settings.
              </p>
              <a href="${escapeHtml(profileUrl)}"
                 style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                View Student Profile
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
