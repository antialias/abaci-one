-- Add image column to users table for Google profile photos
ALTER TABLE `users` ADD COLUMN `image` text;
--> statement-breakpoint
-- Create auth_accounts table for OAuth provider links
CREATE TABLE `auth_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `provider_account_id` text NOT NULL,
  `type` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
-- Create unique index on provider + provider_account_id
CREATE UNIQUE INDEX `auth_accounts_provider_idx` ON `auth_accounts` (`provider`, `provider_account_id`);
--> statement-breakpoint
-- Create verification_tokens table for magic link email verification
CREATE TABLE `verification_tokens` (
  `identifier` text NOT NULL,
  `token` text NOT NULL UNIQUE,
  `expires` integer NOT NULL,
  PRIMARY KEY (`identifier`, `token`)
);
