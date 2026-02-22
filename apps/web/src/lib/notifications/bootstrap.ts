import { registerChannel, getRegisteredChannels } from './dispatcher'
import { webPushChannel } from './channels/web-push-channel'
import { emailChannel } from './channels/email-channel'
import { socketIOChannel } from './channels/socketio-channel'

let bootstrapped = false

/**
 * Register all notification channels.
 *
 * Idempotent — safe to call multiple times.
 * Called lazily on first notification dispatch.
 */
export function bootstrapChannels(): void {
  if (bootstrapped) return

  registerChannel(webPushChannel)
  registerChannel(emailChannel)
  registerChannel(socketIOChannel)

  bootstrapped = true

  console.log(
    '[notifications] Bootstrapped channels:',
    getRegisteredChannels().map((c) => c.name).join(', ')
  )
}
