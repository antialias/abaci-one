-- Custom SQL migration for skill_tutorial_progress table
-- Tracks tutorial completion status for each skill per player

CREATE TABLE `skill_tutorial_progress` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `tutorial_completed` integer DEFAULT 0 NOT NULL,
  `completed_at` integer,
  `teacher_override` integer DEFAULT 0 NOT NULL,
  `override_at` integer,
  `override_reason` text,
  `skip_count` integer DEFAULT 0 NOT NULL,
  `last_skipped_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Index for fast lookups by player
CREATE INDEX `skill_tutorial_progress_player_id_idx` ON `skill_tutorial_progress` (`player_id`);
--> statement-breakpoint

-- Unique constraint: one record per player per skill
CREATE UNIQUE INDEX `skill_tutorial_progress_player_skill_unique` ON `skill_tutorial_progress` (`player_id`, `skill_id`);
