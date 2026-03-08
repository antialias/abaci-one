import type { NewAiUsageRecord } from '@/db/schema/ai-usage'

/**
 * Fire-and-forget DB insert for AI usage tracking.
 *
 * Never throws — logs errors to console. Returns immediately;
 * the insert runs in the background.
 *
 * Uses dynamic imports so that `@/db` (which pulls in `node:http` via
 * libsql) is NOT in the static import graph. This prevents webpack from
 * trying to bundle the DB driver into client-side code when helpers or
 * llm-middleware are transitively imported by client components.
 */
export function recordAiUsage(record: Omit<NewAiUsageRecord, 'id' | 'createdAt'>): void {
  void Promise.all([import('@/db'), import('@/db/schema/ai-usage')])
    .then(([{ db }, { aiUsage }]) => db.insert(aiUsage).values(record))
    .catch((err) => {
      console.error('[ai-usage] Failed to record usage:', err)
    })
}
