-- Add llm_json_schema column to practice_attachments for storing the JSON Schema sent to the LLM
ALTER TABLE `practice_attachments` ADD `llm_json_schema` text;
