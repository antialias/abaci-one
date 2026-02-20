/**
 * Server-side feature flags library
 *
 * Provides global on/off toggles with optional JSON config.
 * Uses in-memory cache with 30s TTL and Redis pub/sub for
 * cross-replica invalidation.
 *
 * Supports per-user overrides: when a userId is provided,
 * the override value takes precedence over the global flag.
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createRedisClient } from '@/lib/redis'

const REDIS_CHANNEL = 'featureflags:changed'
const CACHE_TTL_MS = 30_000

// In-memory cache
interface CachedFlag {
  enabled: boolean
  config: string | null
  allowedRoles: string | null // raw JSON string, parsed at evaluation time
}

let flagCache: Map<string, CachedFlag> | null = null
let cacheTimestamp = 0
let subscriberSetup = false

function isCacheValid(): boolean {
  return flagCache !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS
}

async function loadAllFlags(): Promise<Map<string, CachedFlag>> {
  const rows = await db.select().from(schema.featureFlags)
  const map = new Map<string, CachedFlag>()
  for (const row of rows) {
    map.set(row.key, { enabled: row.enabled, config: row.config, allowedRoles: row.allowedRoles })
  }
  return map
}

async function getCache(): Promise<Map<string, CachedFlag>> {
  if (isCacheValid()) return flagCache!

  flagCache = await loadAllFlags()
  cacheTimestamp = Date.now()

  // Set up Redis subscriber on first cache load
  if (!subscriberSetup) {
    subscriberSetup = true
    setupRedisSubscriber()
  }

  return flagCache
}

function invalidateCache(): void {
  flagCache = null
  cacheTimestamp = 0
}

/**
 * Notify all replicas that feature flags have changed.
 * Call this after any mutation to feature_flags.
 */
export async function notifyFlagsChanged(): Promise<void> {
  const publisher = createRedisClient()
  if (!publisher) return

  try {
    await publisher.publish(REDIS_CHANNEL, Date.now().toString())
    publisher.disconnect()
  } catch (err) {
    console.error('[feature-flags] Failed to publish change:', err)
    publisher.disconnect()
  }
}

function setupRedisSubscriber(): void {
  const subscriber = createRedisClient()
  if (!subscriber) return

  subscriber.subscribe(REDIS_CHANNEL).catch((err) => {
    console.error('[feature-flags] Failed to subscribe to channel:', err)
  })

  subscriber.on('message', (channel) => {
    if (channel === REDIS_CHANNEL) {
      invalidateCache()
      console.log('[feature-flags] Cache invalidated from Redis notification')
    }
  })
}

// ---------------------------------------------------------------------------
// Override helpers (per-user)
// ---------------------------------------------------------------------------

/**
 * Load all overrides for a specific user. Returns a map of flagKey -> override.
 * Queries the DB directly (no cache) since overrides are low-volume.
 */
async function loadUserOverrides(
  userId: string
): Promise<Map<string, { enabled: boolean; config: string | null }>> {
  const rows = await db
    .select()
    .from(schema.featureFlagOverrides)
    .where(eq(schema.featureFlagOverrides.userId, userId))

  const map = new Map<string, { enabled: boolean; config: string | null }>()
  for (const row of rows) {
    map.set(row.flagKey, { enabled: row.enabled, config: row.config })
  }
  return map
}

function parseConfig(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * Check if a user role is allowed by a flag's allowedRoles setting.
 * Returns true if allowedRoles is null (all roles allowed) or if the role is in the list.
 */
function isRoleAllowed(userRole: string | undefined, allowedRoles: string | null): boolean {
  if (!allowedRoles) return true // null = all roles
  try {
    const roles = JSON.parse(allowedRoles) as string[]
    return roles.includes(userRole ?? 'guest')
  } catch {
    return true // malformed = permissive
  }
}

// ---------------------------------------------------------------------------
// Public evaluation API
// ---------------------------------------------------------------------------

/**
 * Check if a flag is enabled.
 * If userId is provided, checks for a per-user override first.
 * If userRole is provided, checks role allowlist before evaluating.
 * Returns defaultValue if the flag doesn't exist (defaults to false).
 */
export async function isEnabled(
  key: string,
  opts?: boolean | { userId?: string; userRole?: string; defaultValue?: boolean }
): Promise<boolean> {
  // Support legacy signature: isEnabled(key, defaultValue)
  const defaultValue = typeof opts === 'boolean' ? opts : (opts?.defaultValue ?? false)
  const userId = typeof opts === 'object' ? opts?.userId : undefined
  const userRole = typeof opts === 'object' ? opts?.userRole : undefined

  const cache = await getCache()
  const flag = cache.get(key)

  if (!flag) return defaultValue

  // Check role allowlist — if role is not allowed, return default
  if (!isRoleAllowed(userRole, flag.allowedRoles)) return defaultValue

  // If userId is provided, check for override
  if (userId) {
    const override = await db
      .select()
      .from(schema.featureFlagOverrides)
      .where(
        and(
          eq(schema.featureFlagOverrides.flagKey, key),
          eq(schema.featureFlagOverrides.userId, userId)
        )
      )
      .limit(1)

    if (override.length > 0) {
      return override[0].enabled
    }
  }

  return flag.enabled
}

/**
 * Get full flag data (enabled + parsed config).
 * If userId is provided, checks for a per-user override first.
 * If userRole is provided, checks role allowlist before evaluating.
 * Returns null if the flag doesn't exist or role is not allowed.
 */
export async function getFlag(
  key: string,
  opts?: { userId?: string; userRole?: string }
): Promise<{ enabled: boolean; config: unknown } | null> {
  const cache = await getCache()
  const flag = cache.get(key)
  if (!flag) return null

  // Check role allowlist — if role is not allowed, return null
  if (!isRoleAllowed(opts?.userRole, flag.allowedRoles)) return null

  const userId = opts?.userId

  // Check for user override
  if (userId) {
    const override = await db
      .select()
      .from(schema.featureFlagOverrides)
      .where(
        and(
          eq(schema.featureFlagOverrides.flagKey, key),
          eq(schema.featureFlagOverrides.userId, userId)
        )
      )
      .limit(1)

    if (override.length > 0) {
      // Override config takes precedence; fall back to global config if null
      const config = override[0].config ?? flag.config
      return { enabled: override[0].enabled, config: parseConfig(config) }
    }
  }

  return { enabled: flag.enabled, config: parseConfig(flag.config) }
}

/**
 * Get typed config from a flag.
 * Returns defaultValue if the flag is missing or config is null.
 */
export async function getFlagConfig<T>(key: string, defaultValue: T): Promise<T> {
  const result = await getFlag(key)
  if (!result || result.config === null) return defaultValue
  return result.config as T
}

/**
 * Get all flags (for API routes).
 * If userId is provided, merges per-user overrides into the result.
 * If userRole is provided, excludes flags where the role is not in the allowlist.
 */
export async function getAllFlags(
  userId?: string,
  userRole?: string
): Promise<Record<string, { enabled: boolean; config: unknown }>> {
  const cache = await getCache()
  const result: Record<string, { enabled: boolean; config: unknown }> = {}

  for (const [key, flag] of cache) {
    // Skip flags where the user's role is not in the allowlist
    if (!isRoleAllowed(userRole, flag.allowedRoles)) continue
    result[key] = { enabled: flag.enabled, config: parseConfig(flag.config) }
  }

  // Merge user overrides if userId provided
  if (userId) {
    const overrides = await loadUserOverrides(userId)
    for (const [key, override] of overrides) {
      const globalFlag = cache.get(key)
      // Only apply override if the user's role is in the allowlist
      if (globalFlag && !isRoleAllowed(userRole, globalFlag.allowedRoles)) continue
      // Override config takes precedence; fall back to global config if null
      const config = override.config ?? globalFlag?.config ?? null
      result[key] = { enabled: override.enabled, config: parseConfig(config) }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Global flag CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new feature flag.
 */
export async function createFlag(data: {
  key: string
  enabled?: boolean
  config?: string | null
  description?: string | null
  allowedRoles?: string | null
}): Promise<void> {
  const now = new Date()
  await db.insert(schema.featureFlags).values({
    key: data.key,
    enabled: data.enabled ?? false,
    config: data.config ?? null,
    description: data.description ?? null,
    allowedRoles: data.allowedRoles ?? null,
    createdAt: now,
    updatedAt: now,
  })
  invalidateCache()
  await notifyFlagsChanged()
}

/**
 * Update an existing feature flag.
 */
export async function updateFlag(
  key: string,
  data: {
    enabled?: boolean
    config?: string | null
    description?: string | null
    allowedRoles?: string | null
  }
): Promise<boolean> {
  const result = await db
    .update(schema.featureFlags)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schema.featureFlags.key, key))

  if (result.rowsAffected === 0) return false

  invalidateCache()
  await notifyFlagsChanged()
  return true
}

/**
 * Delete a feature flag.
 */
export async function deleteFlag(key: string): Promise<boolean> {
  const result = await db.delete(schema.featureFlags).where(eq(schema.featureFlags.key, key))

  if (result.rowsAffected === 0) return false

  invalidateCache()
  await notifyFlagsChanged()
  return true
}

/**
 * Get all flags with full metadata (for admin API).
 */
export async function getAllFlagsAdmin() {
  return db.select().from(schema.featureFlags)
}

// ---------------------------------------------------------------------------
// Override CRUD (admin operations)
// ---------------------------------------------------------------------------

/**
 * Get all overrides for a given flag key.
 */
export async function getOverridesForFlag(flagKey: string) {
  return db
    .select()
    .from(schema.featureFlagOverrides)
    .where(eq(schema.featureFlagOverrides.flagKey, flagKey))
}

/**
 * Set (upsert) an override for a specific user on a specific flag.
 */
export async function setOverride(
  flagKey: string,
  userId: string,
  data: { enabled: boolean; config?: string | null }
): Promise<void> {
  const now = new Date()
  await db
    .insert(schema.featureFlagOverrides)
    .values({
      flagKey,
      userId,
      enabled: data.enabled,
      config: data.config ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.featureFlagOverrides.flagKey, schema.featureFlagOverrides.userId],
      set: {
        enabled: data.enabled,
        config: data.config ?? null,
        updatedAt: now,
      },
    })
  await notifyFlagsChanged()
}

/**
 * Delete a specific override.
 */
export async function deleteOverride(flagKey: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(schema.featureFlagOverrides)
    .where(
      and(
        eq(schema.featureFlagOverrides.flagKey, flagKey),
        eq(schema.featureFlagOverrides.userId, userId)
      )
    )

  if (result.rowsAffected === 0) return false

  await notifyFlagsChanged()
  return true
}
