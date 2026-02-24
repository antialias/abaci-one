ALTER TABLE `session_plans` ADD COLUMN `flow_state` text NOT NULL DEFAULT 'practicing';
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `flow_updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `break_started_at` integer;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD COLUMN `break_reason` text;
--> statement-breakpoint
UPDATE `session_plans`
SET `flow_updated_at` = CAST(strftime('%s','now') AS INTEGER)
WHERE `flow_updated_at` = 0;
