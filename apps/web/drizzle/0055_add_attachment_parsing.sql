-- Add LLM-powered worksheet parsing columns to practice_attachments
-- These columns support the workflow: parse → review → approve → create session

-- Parsing workflow status
ALTER TABLE `practice_attachments` ADD COLUMN `parsing_status` text;
--> statement-breakpoint

-- When parsing completed (ISO timestamp)
ALTER TABLE `practice_attachments` ADD COLUMN `parsed_at` text;
--> statement-breakpoint

-- Error message if parsing failed
ALTER TABLE `practice_attachments` ADD COLUMN `parsing_error` text;
--> statement-breakpoint

-- Raw LLM parsing result (JSON) - before user corrections
ALTER TABLE `practice_attachments` ADD COLUMN `raw_parsing_result` text;
--> statement-breakpoint

-- Approved result (JSON) - after user corrections
ALTER TABLE `practice_attachments` ADD COLUMN `approved_result` text;
--> statement-breakpoint

-- Overall confidence score from LLM (0-1)
ALTER TABLE `practice_attachments` ADD COLUMN `confidence_score` real;
--> statement-breakpoint

-- True if any problems need manual review
ALTER TABLE `practice_attachments` ADD COLUMN `needs_review` integer;
--> statement-breakpoint

-- True if a session was created from this parsed worksheet
ALTER TABLE `practice_attachments` ADD COLUMN `session_created` integer;
--> statement-breakpoint

-- Reference to the session created from this parsing
ALTER TABLE `practice_attachments` ADD COLUMN `created_session_id` text REFERENCES session_plans(id) ON DELETE SET NULL;
