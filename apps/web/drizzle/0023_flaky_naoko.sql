-- Custom SQL migration file, put your code below! --

-- Session plans table for practice session planning and tracking
CREATE TABLE IF NOT EXISTS `session_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,

  -- Setup parameters
  `target_duration_minutes` integer NOT NULL,
  `estimated_problem_count` integer NOT NULL,
  `avg_time_per_problem_seconds` integer NOT NULL,

  -- Plan content (JSON)
  `slots` text NOT NULL,
  `summary` text NOT NULL,

  -- Session state
  `status` text NOT NULL DEFAULT 'draft',
  `current_slot_index` integer NOT NULL DEFAULT 0,
  `session_health` text,
  `adjustments` text NOT NULL DEFAULT '[]',
  `results` text NOT NULL DEFAULT '[]',

  -- Practice mode settings
  `visualization_mode` integer NOT NULL DEFAULT 0,
  `problem_format` text NOT NULL DEFAULT 'vertical',

  -- Timestamps
  `created_at` integer NOT NULL,
  `approved_at` integer,
  `started_at` integer,
  `completed_at` integer,

  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

-- Indexes for performance
CREATE INDEX IF NOT EXISTS `session_plans_player_id_idx` ON `session_plans` (`player_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `session_plans_status_idx` ON `session_plans` (`status`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `session_plans_created_at_idx` ON `session_plans` (`created_at`);
