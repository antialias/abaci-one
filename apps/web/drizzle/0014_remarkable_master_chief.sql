-- Custom SQL migration file, put your code below! --

-- Remove foreign key constraint from worksheet_settings to allow guest users
-- SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table

-- Create new table without foreign key
CREATE TABLE `worksheet_settings_new` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL,
  `worksheet_type` TEXT NOT NULL,
  `config` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);--> statement-breakpoint

-- Copy existing data (if any)
INSERT INTO `worksheet_settings_new`
SELECT id, user_id, worksheet_type, config, created_at, updated_at
FROM `worksheet_settings`;--> statement-breakpoint

-- Drop old table
DROP TABLE `worksheet_settings`;--> statement-breakpoint

-- Rename new table to original name
ALTER TABLE `worksheet_settings_new` RENAME TO `worksheet_settings`;--> statement-breakpoint

-- Recreate index
CREATE INDEX `worksheet_settings_user_type_idx` ON `worksheet_settings` (`user_id`, `worksheet_type`);
