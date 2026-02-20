import path from 'path'
import { newEnforcer, type Enforcer } from 'casbin'
import { DrizzleCasbinAdapter } from './casbin-adapter'
import { createRedisClient } from '@/lib/redis'

const POLICIES_DIR = path.join(process.cwd(), 'src', 'lib', 'auth', 'policies')

const REDIS_CHANNEL = 'casbin:policy-changed'

// Lazy singleton enforcers
let routeEnforcerPromise: Promise<Enforcer> | null = null
let resourceEnforcerPromise: Promise<Enforcer> | null = null
let subscriberSetup = false

/**
 * Get the route-level RBAC enforcer (Layer 1).
 *
 * Loads from static files (route-model.conf + route-policy.csv).
 * Singleton — created once, reused across requests.
 */
export async function getRouteEnforcer(): Promise<Enforcer> {
  if (!routeEnforcerPromise) {
    routeEnforcerPromise = newEnforcer(
      path.join(POLICIES_DIR, 'route-model.conf'),
      path.join(POLICIES_DIR, 'route-policy.csv')
    )
  }
  return routeEnforcerPromise
}

/**
 * Get the resource-level RBAC enforcer (Layer 2).
 *
 * Loads from DB via custom adapter. Domain-scoped roles for
 * parent/teacher access to specific players/classrooms.
 * Singleton — created once, reloaded on policy changes via Redis pub/sub.
 */
export async function getResourceEnforcer(): Promise<Enforcer> {
  if (!resourceEnforcerPromise) {
    const adapter = new DrizzleCasbinAdapter()
    resourceEnforcerPromise = newEnforcer(path.join(POLICIES_DIR, 'resource-model.conf'), adapter)

    // Set up Redis subscriber for cross-replica invalidation
    if (!subscriberSetup) {
      subscriberSetup = true
      setupRedisSubscriber()
    }
  }
  return resourceEnforcerPromise
}

/**
 * Notify all replicas that resource policies have changed.
 * Call this after any mutation to casbin_rules.
 */
export async function notifyPolicyChanged(): Promise<void> {
  const subscriber = createRedisClient()
  if (!subscriber) return

  try {
    await subscriber.publish(REDIS_CHANNEL, Date.now().toString())
    subscriber.disconnect()
  } catch (err) {
    console.error('[casbin] Failed to publish policy change:', err)
    subscriber.disconnect()
  }
}

/**
 * Force-reload the resource enforcer from DB.
 * Used after bulk operations or on Redis notification.
 */
export async function reloadResourceEnforcer(): Promise<void> {
  const enforcer = await getResourceEnforcer()
  await enforcer.loadPolicy()
}

function setupRedisSubscriber(): void {
  const subscriber = createRedisClient()
  if (!subscriber) return

  subscriber.subscribe(REDIS_CHANNEL).catch((err) => {
    console.error('[casbin] Failed to subscribe to policy channel:', err)
  })

  subscriber.on('message', async (channel, _message) => {
    if (channel === REDIS_CHANNEL) {
      try {
        await reloadResourceEnforcer()
        console.log('[casbin] Reloaded resource policies from Redis notification')
      } catch (err) {
        console.error('[casbin] Failed to reload policies:', err)
      }
    }
  })
}
