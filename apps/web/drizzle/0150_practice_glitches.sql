-- K5a-3c R1 (practice-kinds plan of record §8 A23.3): the glitch record.
-- A new table only; nothing reads or writes it but the glitch route, the
-- report's loader and MCP get_glitch. A rollback past R1 leaves it unused.
CREATE TABLE `practice_glitches` (
  `id` text PRIMARY KEY NOT NULL,
  `ref` text NOT NULL,
  `session_plan_id` text NOT NULL,
  `player_id` text NOT NULL,
  `kind` text NOT NULL,
  `detail` text NOT NULL,
  `client_build` text,
  `server_build` text,
  `user_agent` text,
  `client_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`session_plan_id`) REFERENCES `session_plans`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_glitches_session_ref_idx` ON `practice_glitches` (`session_plan_id`,`ref`);
--> statement-breakpoint
CREATE INDEX `practice_glitches_ref_idx` ON `practice_glitches` (`ref`);
--> statement-breakpoint
CREATE INDEX `practice_glitches_created_at_idx` ON `practice_glitches` (`created_at`);
