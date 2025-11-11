-- Custom SQL migration file, put your code below! --

-- Create worksheet_shares table for shareable worksheet configurations
CREATE TABLE `worksheet_shares` (
  `id` text PRIMARY KEY NOT NULL,
  `worksheet_type` text NOT NULL,
  `config` text NOT NULL,
  `created_at` integer NOT NULL,
  `views` integer DEFAULT 0 NOT NULL,
  `creator_ip` text,
  `title` text
);