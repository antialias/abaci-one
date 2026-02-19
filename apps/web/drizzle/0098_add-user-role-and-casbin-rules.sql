ALTER TABLE `users` ADD COLUMN `role` text NOT NULL DEFAULT 'user';
--> statement-breakpoint
CREATE TABLE `casbin_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ptype` text NOT NULL,
  `v0` text NOT NULL DEFAULT '',
  `v1` text NOT NULL DEFAULT '',
  `v2` text NOT NULL DEFAULT '',
  `v3` text NOT NULL DEFAULT '',
  `v4` text NOT NULL DEFAULT '',
  `v5` text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX `idx_casbin_rules_ptype` ON `casbin_rules` (`ptype`);
