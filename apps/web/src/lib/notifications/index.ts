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

// Channels
export { webPushChannel } from './channels/web-push-channel'

// Client-side registration (re-exported for convenience)
export {
  registerServiceWorker,
  subscribeToPush,
  pushSubscriptionToJson,
} from './register-sw'
