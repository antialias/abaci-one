import type {
  NotificationChannel,
  DeliveryTarget,
  NotificationEvent,
  DeliveryResult,
} from '../types'
import { formatNotificationContent } from '../types'
import { sendEmail } from '../email'
import { escapeHtml, baseUrl } from '../email-utils'

/**
 * Build an HTML email for any notification event.
 */
function buildEmailHtml(title: string, body: string, ctaLabel: string, ctaUrl: string): string {
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
              <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#71717a;">
                ${escapeHtml(body)}
              </p>
              <a href="${escapeHtml(ctaUrl)}"
                 style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid #e4e4e7;">
              <a href="${escapeHtml(baseUrl())}/settings?tab=notifications"
                 style="font-size:13px;color:#a1a1aa;text-decoration:underline;">
                Manage notification settings
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

/** Map event type to email CTA label */
function ctaLabel(event: NotificationEvent): string {
  switch (event.type) {
    case 'session-started':
      return 'Watch Now'
    case 'postcard-ready':
      return 'View Postcard'
  }
}

/**
 * Email notification channel implementation.
 *
 * Sends an HTML email via the shared Nodemailer transport.
 * Works with any notification event type.
 */
export const emailChannel: NotificationChannel = {
  name: 'email',

  canDeliver(target: DeliveryTarget): boolean {
    return target.channels.email && target.email != null
  },

  async deliver(target: DeliveryTarget, event: NotificationEvent): Promise<DeliveryResult> {
    if (!target.email) {
      return { success: false, error: 'No email address available' }
    }

    const content = formatNotificationContent(event)
    const html = buildEmailHtml(content.title, content.body, ctaLabel(event), content.url)

    try {
      await sendEmail({
        to: target.email,
        subject: content.title,
        html,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `email: ${message}` }
    }
  },
}
