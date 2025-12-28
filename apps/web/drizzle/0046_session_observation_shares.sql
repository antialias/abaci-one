-- Session observation shares table
-- Allows time-limited shareable links for observing practice sessions
CREATE TABLE `session_observation_shares` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `session_plans`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `expires_at` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `view_count` integer NOT NULL DEFAULT 0,
  `last_viewed_at` integer
);
--> statement-breakpoint

-- Index for cleanup when session ends
CREATE INDEX `idx_session_observation_shares_session` ON `session_observation_shares`(`session_id`);
--> statement-breakpoint

-- Index for listing active shares
CREATE INDEX `idx_session_observation_shares_status` ON `session_observation_shares`(`status`);
