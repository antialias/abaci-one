-- Add embedding columns to teacher_flowcharts table
ALTER TABLE `teacher_flowcharts` ADD `embedding` blob;
--> statement-breakpoint
ALTER TABLE `teacher_flowcharts` ADD `embedding_version` text;
--> statement-breakpoint

-- Create flowchart_embeddings table for hardcoded flowcharts
CREATE TABLE `flowchart_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`embedding` blob NOT NULL,
	`embedding_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
