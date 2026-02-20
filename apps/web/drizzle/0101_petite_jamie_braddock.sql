-- Add allowed_roles column for role-based feature flag gating
ALTER TABLE `feature_flags` ADD COLUMN `allowed_roles` text;