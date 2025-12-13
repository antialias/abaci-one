-- Populate is_practicing from existing mastery_level data
-- mastered or practicing -> is_practicing = 1 (true)
-- learning -> is_practicing = 0 (false)
UPDATE `player_skill_mastery` SET `is_practicing` = 1 WHERE `mastery_level` IN ('mastered', 'practicing');
