-- Custom SQL migration file, put your code below! --
-- Design sharing (Gitea #24): cross-account read as a property of the SAME row
-- and the SAME id, so a ?design=<id> link already stamped on a THH job card
-- (#22) starts resolving for everyone the moment its owner shares it — and
-- stops the moment they un-share. NULL = private (the #22 default: owner or
-- admin only); a timestamp = anyone with the link. Nullable, so SQLite needs
-- no table rebuild. No index: the read path always looks up by primary key.
ALTER TABLE `abacus_designs` ADD `shared_at` integer;
