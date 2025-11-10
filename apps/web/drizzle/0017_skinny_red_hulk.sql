-- Custom SQL migration file, put your code below! --

-- Add sessionId column for grouping batch uploads (QR code workflow)
ALTER TABLE `worksheet_attempts` ADD `session_id` text;--> statement-breakpoint

-- Create index for finding attempts by session
CREATE INDEX `worksheet_attempts_session_idx` ON `worksheet_attempts` (`session_id`);