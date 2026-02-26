ALTER TABLE `players` ADD COLUMN `birthday` text;
--> statement-breakpoint
UPDATE `players` SET `age` = NULL;
