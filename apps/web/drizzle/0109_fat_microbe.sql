CREATE TABLE `practice_notification_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text REFERENCES `users`(`id`) ON DELETE CASCADE,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE CASCADE,
  `email` text,
  `push_subscription` text,
  `channels` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `label` text,
  `created_at` integer NOT NULL,
  `expires_at` integer,
  `last_notified_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_practice_notif_subs_player` ON `practice_notification_subscriptions` (`player_id`);
--> statement-breakpoint
CREATE INDEX `idx_practice_notif_subs_user` ON `practice_notification_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_practice_notif_subs_status` ON `practice_notification_subscriptions` (`status`);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD COLUMN `notification_channels` text;
