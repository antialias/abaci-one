import { db } from '@/db'
import { aiUsage, type NewAiUsageRecord } from '@/db/schema/ai-usage'

/**
 * Fire-and-forget DB insert for AI usage tracking.
 *
 * Never throws — logs errors to console. Returns immediately;
 * the insert runs in the background.
 */
export function recordAiUsage(record: Omit<NewAiUsageRecord, 'id' | 'createdAt'>): void {
  void db
    .insert(aiUsage)
    .values(record)
    .catch((err) => {
      console.error('[ai-usage] Failed to record usage:', err)
    })
}
