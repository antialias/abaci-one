CREATE INDEX `session_plans_bkt_recent_idx`
ON `session_plans` (`player_id`, `completed_at`, `id`)
WHERE `status` IN ('completed', 'recency-refresh')
  AND `completed_at` IS NOT NULL;
