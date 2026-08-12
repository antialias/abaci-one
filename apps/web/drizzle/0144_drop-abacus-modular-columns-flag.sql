-- Drop the `abacus.modular_columns` feature flag seeded by 0143.
--
-- Modular columns were never meant to be a staged rollout — mono-vs-modular is
-- a per-design choice made with a checkbox in the studio's fabrication rail, so
-- gating it globally only hid a shipped feature from everyone. FabricationRail
-- now mounts ModularSeamPanel unconditionally, which makes this row dead
-- config: with no reader left, leaving it would strand a toggle in
-- /admin/feature-flags that silently does nothing.
--
-- Overrides go first — feature_flag_overrides.flag_key is a plain text column
-- with no FK, so nothing cascades and a per-user row would outlive its flag.
DELETE FROM `feature_flag_overrides` WHERE `flag_key` = 'abacus.modular_columns';
--> statement-breakpoint
DELETE FROM `feature_flags` WHERE `key` = 'abacus.modular_columns';
