-- Add LLM call metadata columns to practice_attachments
-- These provide transparency/debugging info about the parsing request

-- Which LLM provider was used (e.g., "openai", "anthropic")
ALTER TABLE `practice_attachments` ADD COLUMN `llm_provider` text;
--> statement-breakpoint

-- Which model was used (e.g., "gpt-4o", "claude-sonnet-4")
ALTER TABLE `practice_attachments` ADD COLUMN `llm_model` text;
--> statement-breakpoint

-- The full prompt sent to the LLM (for debugging)
ALTER TABLE `practice_attachments` ADD COLUMN `llm_prompt_used` text;
--> statement-breakpoint

-- Which image was sent: "cropped" or "original"
ALTER TABLE `practice_attachments` ADD COLUMN `llm_image_source` text;
--> statement-breakpoint

-- How many LLM call attempts were needed (retries on validation failure)
ALTER TABLE `practice_attachments` ADD COLUMN `llm_attempts` integer;
--> statement-breakpoint

-- Token usage for cost tracking
ALTER TABLE `practice_attachments` ADD COLUMN `llm_prompt_tokens` integer;
--> statement-breakpoint

ALTER TABLE `practice_attachments` ADD COLUMN `llm_completion_tokens` integer;
--> statement-breakpoint

ALTER TABLE `practice_attachments` ADD COLUMN `llm_total_tokens` integer;
