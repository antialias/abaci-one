-- Linear-readiness ramp gate — ensure the `linear_readiness.enabled` flag exists in
-- every environment and carries the tunable ramp-gate thresholds in its JSON config.
--
-- This flag gates BOTH the L3 derived linear-readiness (which categories graduate onto
-- number sentences) AND, via `config.gate`, the "abacus-off" ramp gate: how much
-- first-attempt linear correctness a category needs before the working abacus is taken
-- away. Defaults mirror READINESS_THRESHOLDS (minAccuracy 0.85 / window 15 / floor 20)
-- and are editable live at /admin/feature-flags with no redeploy.
--
-- INSERT OR IGNORE creates the flag (enabled) where it is missing (e.g. local/dev). The
-- follow-up UPDATE backfills `config` ONLY when it is currently null, so a hand-tuned
-- config is never clobbered — on prod the flag already exists (enabled, null config),
-- so the INSERT is ignored and the UPDATE simply seeds the discoverable default knobs.
INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `config`, `description`, `created_at`, `updated_at`)
VALUES (
  'linear_readiness.enabled',
  1,
  '{"gate":{"minAccuracy":0.85,"accuracyWindowSize":15,"minOpportunities":20}}',
  'Derived linear-readiness (number sentences) + the linear-with-abacus ramp gate. config.gate tunes when the abacus comes off: minAccuracy, accuracyWindowSize, minOpportunities.',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
--> statement-breakpoint
UPDATE `feature_flags`
SET `config` = '{"gate":{"minAccuracy":0.85,"accuracyWindowSize":15,"minOpportunities":20}}',
    `updated_at` = strftime('%s', 'now')
WHERE `key` = 'linear_readiness.enabled' AND `config` IS NULL;
