-- Add reasoning text field for reconnection to in-progress generation
ALTER TABLE `workshop_sessions` ADD `current_reasoning_text` text;
