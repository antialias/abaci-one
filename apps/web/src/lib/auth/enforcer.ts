import { type Enforcer, newEnforcer, newModelFromString, StringAdapter } from 'casbin'
import { createRedisClient } from '@/lib/redis'
import { DrizzleCasbinAdapter } from './casbin-adapter'

/**
 * Inline model/policy definitions.
 *
 * These were previously loaded from .conf/.csv files on disk, but Next.js
 * production builds don't bundle non-JS source files, so the filesystem
 * paths (src/lib/auth/policies/*) don't exist at runtime in Docker.
 */

const ROUTE_MODEL = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && (r.act == p.act || p.act == "*")
`

const RESOURCE_MODEL = `
[request_definition]
r = sub, dom, obj, act

[policy_definition]
p = sub, dom, obj, act

[role_definition]
g = _, _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub, r.dom) && (r.dom == p.dom || p.dom == "*") && r.obj == p.obj && (r.act == p.act || p.act == "*")
`

const ROUTE_POLICY = `
# Role hierarchy
g, user, guest
g, admin, user

# Guest-accessible (public endpoints)
p, guest, /api/health, *
p, guest, /api/heartbeat, *
p, guest, /api/build-info, *
p, guest, /api/auth/*, *
p, guest, /api/blog/*, GET
p, guest, /api/images/*, GET
p, guest, /api/observe/*, GET
p, guest, /api/flowcharts/browse, GET
p, guest, /api/flowcharts/suggest, GET
p, guest, /api/flowcharts/seeds, GET
p, guest, /api/flowcharts/pdf, *
p, guest, /api/flowcharts/:id, GET
p, guest, /api/flowcharts/:id/related, GET
p, guest, /api/flowcharts/:id/worksheet, GET
p, guest, /api/identity, GET
p, guest, /api/smoke-test-status, GET
p, guest, /api/smoke-test-results, GET
# POST is the in-cluster smoke CronJob reporting results. The route handler 404s
# any request whose host isn't the cluster service FQDN (i.e. arrived via the
# public ingress), so this only opens the endpoint to direct in-cluster calls.
p, guest, /api/smoke-test-results, POST
p, guest, /api/metrics, GET
p, guest, /api/coverage-results, GET
p, guest, /api/worksheets/share/*, GET
p, guest, /api/worksheets/preview, *
p, guest, /api/worksheets/download/*, GET
p, guest, /api/download/*, GET
p, guest, /api/audio/clips/*, GET
p, guest, /api/audio/collected-clips, GET
p, guest, /api/audio/collected-clips/manifest, GET
p, guest, /api/create/*, *
p, guest, /api/feature-flags, GET

# Guest-accessible practice & app routes
p, guest, /api/players, *
p, guest, /api/players/*, *
p, guest, /api/family/*, *
p, guest, /api/curriculum/*, *
p, guest, /api/game-results, *
p, guest, /api/game-results/*, *
p, guest, /api/player-stats, *
p, guest, /api/player-stats/*, *
p, guest, /api/settings/*, *
p, guest, /api/worksheets/*, *
p, guest, /api/sessions/*, *
p, guest, /api/enrollment-requests/*, *
p, guest, /api/entry-prompts/*, *
p, guest, /api/flowcharts/*, *
p, guest, /api/flowchart-workshop/*, *
p, guest, /api/abacus-settings, *
p, guest, /api/scanner-settings, *
# Abacus Studio print proxy — pairing, discovery, jobs, print settings (gh#160).
# Guest-first like the rest of the studio: an anonymous account can pair, and
# the guest→user merge carries its print rows along on sign-in. The doorbell
# ring route is unaffected (no withAuth — it authenticates by ring secret).
p, guest, /api/abacus/print/*, *
# Abacus design snapshots (#22) — save is guest-first (a guest can print, so a
# guest can snapshot); read is shared-or-owner-or-admin, enforced IN the handler
# (the route layer admits the request, the handler 404s everyone else — with the
# same body an unknown id gets, so nothing is leaked).
p, guest, /api/abacus/designs, POST
# GET on the collection is the caller's design list — #24's shared ledger grown
# into "my abacuses" (#11). It is also the only way back to a design you shared
# and then edited past. Identity-scoped in the handler, so a guest reading it
# sees exactly their own (usually none).
p, guest, /api/abacus/designs, GET
p, guest, /api/abacus/designs/*, GET
# PATCH renames a design or takes it out of your list (#11). Its OWN line
# because the GET above is verb-scoped: without this, renaming 401s in prod and
# never in a unit test, since handler tests mock withAuth away. Ownership is
# enforced in the handler, which answers the same 404 the read gives.
p, guest, /api/abacus/designs/*, PATCH
# Design sharing (#24) — the owner flips cross-account read on the SAME design
# id. Guest subject on purpose (unlike song/observation shares): the studio is
# guest-first, and because the flag rides the design row, the guest→user merge
# carries the share with no extra code. Ownership is enforced in the handler.
p, guest, /api/abacus/designs/*/share, *
p, guest, /api/arcade/*, *
p, guest, /api/arcade-session, *
p, guest, /api/realtime/*, *
p, guest, /api/chat/*, *
p, guest, /api/euclid/*, *
p, guest, /api/audio/*, *
p, guest, /api/generate, *
p, guest, /api/user-stats, *
p, guest, /api/vision/*, *
p, guest, /api/remote-camera, *
p, guest, /api/demo/*, *
p, guest, /api/gameplay/*, *
p, guest, /api/notifications/*, *

# Postcards — authenticated users only (keepsakes from voice calls)
p, user, /api/postcards, *
p, user, /api/postcards/*, *

# Song shares — owner routes authenticated only; public read by share code is guest
p, user, /api/songs/*, *
p, guest, /api/song-shares/*, GET

# Guest classroom access (student-side participation only)
# Guests can view a classroom and participate, but cannot create or manage classrooms
p, guest, /api/classrooms/:id, GET
p, guest, /api/classrooms/:id/*, *
p, guest, /api/classrooms/code/:code, GET
p, guest, /api/classroom/*, *

# Billing — tier info + webhook are guest-accessible
p, guest, /api/billing/tier, GET
p, guest, /api/billing/webhook, POST

# Authenticated user routes — classroom creation/management, teacher features, billing
# (user inherits all guest permissions via role hierarchy)
p, user, /api/classrooms, *
p, user, /api/classrooms/*, *
p, user, /api/teacher-flowcharts/*, *
p, user, /api/mcp, *
p, user, /api/billing/checkout, POST
p, user, /api/billing/portal, POST
p, user, /api/households, *
p, user, /api/households/*, *

# Admin-only routes
p, admin, /api/admin/*, *
p, admin, /api/debug/*, *
p, admin, /api/vision-training/*, *
p, admin, /api/dev/*, *
`

const REDIS_CHANNEL = 'casbin:policy-changed'

// Lazy singleton enforcers
let routeEnforcerPromise: Promise<Enforcer> | null = null
let resourceEnforcerPromise: Promise<Enforcer> | null = null
let subscriberSetup = false

/**
 * Get the route-level RBAC enforcer (Layer 1).
 *
 * Uses inline model + policy strings (no filesystem access needed).
 * Singleton — created once, reused across requests.
 */
export async function getRouteEnforcer(): Promise<Enforcer> {
  if (!routeEnforcerPromise) {
    const model = newModelFromString(ROUTE_MODEL)
    const adapter = new StringAdapter(ROUTE_POLICY)
    routeEnforcerPromise = newEnforcer(model, adapter)
  }
  return routeEnforcerPromise
}

/**
 * Get the resource-level RBAC enforcer (Layer 2).
 *
 * Uses inline model string + DB adapter. Domain-scoped roles for
 * parent/teacher access to specific players/classrooms.
 * Singleton — created once, reloaded on policy changes via Redis pub/sub.
 */
export async function getResourceEnforcer(): Promise<Enforcer> {
  if (!resourceEnforcerPromise) {
    const model = newModelFromString(RESOURCE_MODEL)
    const adapter = new DrizzleCasbinAdapter()
    resourceEnforcerPromise = newEnforcer(model, adapter)

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
