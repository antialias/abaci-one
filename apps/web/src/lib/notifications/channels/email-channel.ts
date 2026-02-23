import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { PracticeNotificationSubscription } from '@/db/schema'
import type { NotificationChannel, SessionStartedPayload, DeliveryResult } from '../types'
import { sendEmail } from '../email'
import { escapeHtml, baseUrl } from '../email-utils'

/**
 * Resolve the email address for a subscription.
 *
 * Uses the explicit email on the subscription if present,
 * otherwise falls back to the authenticated user's account email.
 */
async function resolveEmail(sub: PracticeNotificationSubscription): Promise<string | null> {
  if (sub.email) return sub.email

  if (sub.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, sub.userId))
      .limit(1)
    return user?.email ?? null
  }

  return null
}

/**
 * Build the HTML email body for a practice-started notification.
 */
function buildEmailHtml(
  playerName: string,
  playerEmoji: string,
  observeUrl: string,
  unsubscribeUrl: string
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
              <div style="font-size:48px;line-height:1;margin-bottom:16px;">${playerEmoji}</div>
              <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;">
                ${escapeHtml(playerName)} started practicing!
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#71717a;">
                Tap the button below to watch live.
              </p>
              <a href="${escapeHtml(observeUrl)}"
                 style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                Watch Now
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid #e4e4e7;">
              <a href="${escapeHtml(unsubscribeUrl)}"
                 style="font-size:13px;color:#a1a1aa;text-decoration:underline;">
                Unsubscribe from these notifications
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

/**
 * Email notification channel implementation.
 *
 * Sends an HTML email via the shared Nodemailer transport
 * when a student starts a practice session.
 */
export const emailChannel: NotificationChannel = {
  name: 'email',

  canDeliver(sub: PracticeNotificationSubscription): boolean {
    // We can attempt delivery if the email channel is enabled and there's
    // either an explicit email or a userId to look up. The actual email
    // resolution happens in deliver() since it's async.
    return sub.channels.email === true && (sub.email != null || sub.userId != null)
  },

  async deliver(
    sub: PracticeNotificationSubscription,
    event: SessionStartedPayload
  ): Promise<DeliveryResult> {
    const email = await resolveEmail(sub)
    if (!email) {
      return {
        success: false,
        error: 'No email address available for subscription',
      }
    }

    const unsubscribeUrl = `${baseUrl()}/api/notifications/subscriptions/${sub.id}/unsubscribe`

    const html = buildEmailHtml(
      event.playerName,
      event.playerEmoji,
      event.observeUrl,
      unsubscribeUrl
    )

    try {
      await sendEmail({
        to: email,
        subject: `${event.playerName} started practicing!`,
        html,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `email: ${message}` }
    }
  },
}

