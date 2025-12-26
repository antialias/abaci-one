-- Custom SQL migration file, put your code below! --
-- Add is_paused column that was missing from migration 0043

ALTER TABLE `session_plans` ADD `is_paused` integer DEFAULT 0 NOT NULL;