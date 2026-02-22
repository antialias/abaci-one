CREATE TABLE `households` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `household_members` (
  `id` text PRIMARY KEY NOT NULL,
  `household_id` text NOT NULL REFERENCES `households`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL DEFAULT 'member',
  `joined_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_members_household_user_idx` ON `household_members`(`household_id`, `user_id`);
