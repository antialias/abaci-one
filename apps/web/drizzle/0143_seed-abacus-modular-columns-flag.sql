INSERT OR IGNORE INTO `feature_flags` (`key`, `enabled`, `description`, `created_at`, `updated_at`)
VALUES ('abacus.modular_columns', 0, 'Abacus Studio modular columns (Gitea #30): per-column snap-together modules with a seam-fit panel, coupon download and per-module print kit export', strftime('%s', 'now'), strftime('%s', 'now'));
