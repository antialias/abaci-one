-- Custom SQL migration file, put your code below! --
-- Soft-delete support for session_plans (teacher/parent review & repair tool, #158).
-- All three columns are nullable, so SQLite ADD COLUMN needs no table rebuild.
-- `status` stays a plain text column; the new 'deleted' value is TS-only and needs no DDL.
ALTER TABLE `session_plans` ADD `status_before_deletion` text;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `session_plans` ADD `deleted_by` text;
