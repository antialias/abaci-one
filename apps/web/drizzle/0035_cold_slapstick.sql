-- App-wide settings table (single row)
CREATE TABLE `app_settings` (
  `id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
  `bkt_confidence_threshold` real DEFAULT 0.3 NOT NULL
);

-- Insert the default row
INSERT INTO `app_settings` (`id`, `bkt_confidence_threshold`) VALUES ('default', 0.3);
