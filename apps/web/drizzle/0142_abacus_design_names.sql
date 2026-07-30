-- Custom SQL migration file, put your code below! --
-- Design names + "my abacuses" (Gitea #11).
--
-- `name` is what the owner calls a design; NULL means never named and the UI
-- falls back to the engraved text, then to the column count. `hidden_at` takes
-- a design out of the owner's list — the honest form of the delete #11 asked
-- for, since design rows are permanent so that a ?design= link printed on a THH
-- job card keeps resolving years later. Hiding forgets; it never destroys.
--
-- Both are METADATA, outside `content_hash` (which covers only the design
-- envelope): renaming must never fork a design, or every printed link to it
-- would be orphaned. Nullable, so SQLite needs no table rebuild, and no new
-- index — the list filters `created_by`, already covered by
-- `abacus_designs_created_by_idx`.
ALTER TABLE `abacus_designs` ADD `name` text;--> statement-breakpoint
ALTER TABLE `abacus_designs` ADD `hidden_at` integer;
