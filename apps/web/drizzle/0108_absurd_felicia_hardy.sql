ALTER TABLE `players` ADD COLUMN `family_code_generated_at` integer;
--> statement-breakpoint
UPDATE `players` SET `family_code_generated_at` = `created_at` WHERE `family_code` IS NOT NULL;
