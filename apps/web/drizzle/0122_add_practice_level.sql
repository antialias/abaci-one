ALTER TABLE `player_skill_mastery` ADD COLUMN `practice_level` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
UPDATE `player_skill_mastery` SET `practice_level` = CASE WHEN `is_practicing` = 1 THEN 'visual' ELSE 'none' END;
