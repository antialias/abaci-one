// Types
export type {
  NotificationChannel,
  SessionStartedPayload,
  DeliveryResult,
  NotifyResult,
} from './types'

// Subscription Manager
export {
  type CreateSubscriptionParams,
  type CreateSubscriptionResult,
  createSubscription,
  getActiveSubscriptionsForPlayer,
  markSubscriptionExpired,
  updatePushSubscription,
  deleteSubscription,
} from './subscription-manager'

// Dispatcher
export {
  registerChannel,
  getRegisteredChannels,
  _resetChannels,
  notifySubscribers,
} from './dispatcher'

// Web Push
export { sendWebPush, type WebPushResult, _resetWebPushConfig } from './web-push'

// Email
export { sendEmail, type SendEmailParams, _resetEmailTransport } from './email'

// Channels
export { webPushChannel } from './channels/web-push-channel'
export { emailChannel } from './channels/email-channel'
export { socketIOChannel } from './channels/socketio-channel'

// Client-side registration (re-exported for convenience)
export {
  registerServiceWorker,
  subscribeToPush,
  pushSubscriptionToJson,
} from './register-sw'
