-- Step 1: Clean up any duplicate room memberships
-- Keep only the most recent membership for each user (by last_seen timestamp)
DELETE FROM `room_members`
WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `user_id`
      ORDER BY `last_seen` DESC, `joined_at` DESC
    ) as rn
    FROM `room_members`
  ) WHERE rn = 1
);--> statement-breakpoint

-- Step 2: Add unique constraint to enforce one room per user
CREATE UNIQUE INDEX `idx_room_members_user_id_unique` ON `room_members` (`user_id`);