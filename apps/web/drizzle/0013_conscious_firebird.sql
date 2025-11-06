-- Custom SQL migration file, put your code below! --

-- Create worksheet_settings table for persisting user worksheet generator preferences
CREATE TABLE `worksheet_settings` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL,
  `worksheet_type` TEXT NOT NULL,
  `config` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);--> statement-breakpoint

-- Create index for efficient lookups by user and worksheet type
CREATE INDEX `worksheet_settings_user_type_idx` ON `worksheet_settings` (`user_id`, `worksheet_type`);