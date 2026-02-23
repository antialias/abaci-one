INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `description`, `created_at`, `updated_at`)
VALUES ('session-song.enabled', 0, 'AI-generated celebration songs for practice sessions (requires family tier)', strftime('%s', 'now'), strftime('%s', 'now'));
