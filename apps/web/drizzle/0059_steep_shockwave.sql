-- Custom SQL migration file, put your code below! --

-- Add review_progress column to practice_attachments
-- Stores JSON for resumable review workflow state
ALTER TABLE `practice_attachments` ADD `review_progress` text;
