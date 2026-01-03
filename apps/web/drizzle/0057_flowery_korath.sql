-- Custom SQL migration file, put your code below! --
-- Add llm_raw_response column to practice_attachments for storing raw LLM JSON responses
ALTER TABLE `practice_attachments` ADD `llm_raw_response` text;
