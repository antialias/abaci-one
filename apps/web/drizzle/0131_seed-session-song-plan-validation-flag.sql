INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `config`, `description`, `created_at`, `updated_at`)
VALUES (
  'session-song.plan-validation',
  0,
  '{"mode":"observe","maxRepairAttempts":1,"fallbackOnFailedRepair":true,"logPassingPlans":false}',
  'Validate session-song composition plans before ElevenLabs; observe mode logs issues without blocking.',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
