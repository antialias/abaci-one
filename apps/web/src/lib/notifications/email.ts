import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

let _transport: Transporter | null = null

/**
 * Lazily initialised Nodemailer transport — reuses the EMAIL_SERVER
 * connection string already configured for NextAuth magic links.
 */
function ensureTransport(): Transporter {
  if (_transport) return _transport

  const server = process.env.EMAIL_SERVER
  if (!server) {
    throw new Error('[email] EMAIL_SERVER is not set')
  }

  _transport = nodemailer.createTransport(server)
  return _transport
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

/**
 * Send an email using the shared Nodemailer transport.
 *
 * Uses EMAIL_FROM as the default sender. Callers can override
 * `from` and `replyTo` for channel-specific customisation.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transport = ensureTransport()
  const defaultFrom = process.env.EMAIL_FROM ?? 'Abaci One <hallock@gmail.com>'

  await transport.sendMail({
    from: params.from ?? defaultFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  })
}

/**
 * Reset transport (for testing).
 */
export function _resetEmailTransport(): void {
  _transport = null
}
