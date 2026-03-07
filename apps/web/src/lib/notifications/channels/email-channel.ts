import type {
  NotificationChannel,
  DeliveryTarget,
  NotificationEvent,
  DeliveryResult,
} from '../types'
import { formatNotificationContent } from '../types'
import { sendEmail } from '../email'
import { escapeHtml, baseUrl } from '../email-utils'

interface EmailHtmlOptions {
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
  /** Optional image to display above the body text */
  imageUrl?: string
}

/**
 * Build an HTML email for any notification event.
 */
function buildEmailHtml({ title, body, ctaLabel, ctaUrl, imageUrl }: EmailHtmlOptions): string {
  const imageBlock = imageUrl
    ? `<tr>
            <td style="padding:0;">
              <a href="${escapeHtml(ctaUrl)}">
                <img src="${escapeHtml(imageUrl)}" alt="Postcard" width="480"
                     style="display:block;width:100%;height:auto;border-radius:12px 12px 0 0;" />
              </a>
            </td>
          </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          ${imageBlock}
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

    // For postcard emails, optionally embed the image
    let imageUrl: string | undefined
    if (event.type === 'postcard-ready') {
      const { isEnabled } = await import('@/lib/feature-flags')
      const useFullImage = await isEnabled('postcard.full-image-in-email')
      const rawUrl = useFullImage ? event.data.imageUrl : event.data.thumbnailUrl
      if (rawUrl) {
        // Ensure absolute URL for email clients
        imageUrl = rawUrl.startsWith('http') ? rawUrl : `${baseUrl()}${rawUrl}`
      }
    }

    const html = buildEmailHtml({
      title: content.title,
      body: content.body,
      ctaLabel: ctaLabel(event),
      ctaUrl: content.url,
      imageUrl,
    })

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
