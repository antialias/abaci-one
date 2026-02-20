CREATE TABLE `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `stripe_customer_id` text NOT NULL,
  `stripe_subscription_id` text,
  `plan` text NOT NULL DEFAULT 'free',
  `status` text NOT NULL DEFAULT 'active',
  `current_period_end` integer,
  `cancel_at_period_end` integer NOT NULL DEFAULT false,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_unique` ON `subscriptions`(`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_id_unique` ON `subscriptions`(`stripe_subscription_id`);
