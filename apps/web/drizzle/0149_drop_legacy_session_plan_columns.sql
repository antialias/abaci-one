-- Session architecture Phase 6b-2 (plan of record §7 Phase 6, §10 P6b-1, P6b2-1):
-- contract. Phase 6b-0 stopped reading these six columns and 6b-1 stopped
-- writing them (both live on prod before this ships), and 6b-2a's
-- post-migration check stopped naming them. 6b-2a (6b-1's code) names none of
-- them, so its pods serve this table during the rollout and after a rollback;
-- the Argo PreSync Job applies this before any 6b-2 pod starts (§10 P6b2a-1).
-- No index, trigger, view, CHECK, FK or UNIQUE names them (checked against
-- the migrated schema), which `DROP COLUMN` requires. drizzle's migrator runs
-- every pending statement in one transaction, so a refused drop undoes the rest.
ALTER TABLE `session_plans` DROP COLUMN `current_slot_index`;
--> statement-breakpoint
ALTER TABLE `session_plans` DROP COLUMN `retry_state`;
--> statement-breakpoint
ALTER TABLE `session_plans` DROP COLUMN `break_started_at`;
--> statement-breakpoint
ALTER TABLE `session_plans` DROP COLUMN `break_reason`;
--> statement-breakpoint
ALTER TABLE `session_plans` DROP COLUMN `break_selected_game`;
--> statement-breakpoint
ALTER TABLE `session_plans` DROP COLUMN `break_results`;
