-- abacus_designs (Gitea #22): persisted design snapshots behind ?design=<id>.
-- One row per (owner, design content) — content_hash is owner-scoped; permanent.
-- created_by is SET NULL on user deletion — the design outlives its creator.
CREATE TABLE `abacus_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`design` text NOT NULL,
	`provenance` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`last_accessed_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abacus_designs_content_hash_unique` ON `abacus_designs` (`content_hash`);
--> statement-breakpoint
CREATE INDEX `abacus_designs_created_by_idx` ON `abacus_designs` (`created_by`);
