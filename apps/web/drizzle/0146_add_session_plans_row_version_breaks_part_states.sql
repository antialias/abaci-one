-- Session architecture Phase 3a (plan of record §5): expand only.
-- Old images ignore these columns and keep writing the legacy ones.
ALTER TABLE `session_plans` ADD COLUMN `row_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `breaks` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `part_states` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `pauses` text DEFAULT '[]' NOT NULL;
