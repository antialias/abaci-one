CREATE TABLE `number_line_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,
  `caller_number` integer NOT NULL,
  `is_culled` integer NOT NULL DEFAULT false,
  `cull_task_id` text,
  `session_summary` text,
  `moment_count` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `nl_sessions_player_caller_idx` ON `number_line_sessions` (`player_id`, `caller_number`);
--> statement-breakpoint
CREATE INDEX `nl_sessions_is_culled_idx` ON `number_line_sessions` (`is_culled`);
--> statement-breakpoint
CREATE TABLE `number_line_moments` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,
  `caller_number` integer NOT NULL,
  `session_id` text NOT NULL,
  `caption` text NOT NULL,
  `category` text NOT NULL,
  `raw_significance` integer NOT NULL,
  `long_term_significance` integer,
  `keep` integer NOT NULL DEFAULT true,
  `snapshot` text,
  `transcript_excerpt` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nl_moments_player_caller_idx` ON `number_line_moments` (`player_id`, `caller_number`);
--> statement-breakpoint
CREATE INDEX `nl_moments_session_idx` ON `number_line_moments` (`session_id`);
