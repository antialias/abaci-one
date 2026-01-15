-- MCP API Keys for external tool access (Claude Code, etc.)
CREATE TABLE IF NOT EXISTS `mcp_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `mcp_api_keys_user_id_idx` ON `mcp_api_keys` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `mcp_api_keys_key_idx` ON `mcp_api_keys` (`key`);
