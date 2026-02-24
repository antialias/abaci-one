ALTER TABLE `session_plans` ADD COLUMN `flow_state` text NOT NULL DEFAULT 'practicing';
ALTER TABLE `session_plans` ADD COLUMN `flow_updated_at` integer NOT NULL DEFAULT 0;
ALTER TABLE `session_plans` ADD COLUMN `break_started_at` integer;
ALTER TABLE `session_plans` ADD COLUMN `break_reason` text;
UPDATE `session_plans`
SET `flow_updated_at` = CAST(strftime('%s','now') AS INTEGER)
WHERE `flow_updated_at` = 0;
