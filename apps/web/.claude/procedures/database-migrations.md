# Database Migrations (Drizzle)

## Quick Rules

1. **Never modify schema directly** - Always use migrations
2. **Never modify deployed migrations** - Create new ones instead
3. **Never manually create migration files** - Use `npx drizzle-kit generate --custom`
4. **Never manually edit `drizzle/meta/_journal.json`** - Let drizzle-kit manage it
5. **Never run raw SQL against the database** - Use migrations for ALL schema changes
6. **Always add statement breakpoints** - Between multiple SQL statements
7. **Always verify timestamp ordering** - After generating a migration

## The Workflow

```bash
# 1. Modify schema file in src/db/schema/

# 2. Generate migration (NEVER manually create files!)
npx drizzle-kit generate --custom

# 3. Edit the generated SQL file with actual statements
# 4. Verify timestamp ordering (see below)

# 5. Run migration WITHOUT restarting dev server
pnpm db:migrate

# 6. Verify with MCP tool
mcp__sqlite__describe_table table_name

# 7. Commit both schema and migration
git add src/db/schema/ drizzle/
git commit -m "feat: add new column"
```

## CRITICAL: Run Migrations via `pnpm db:migrate`

**Do NOT rely on dev server restart to apply migrations during development.**

Running `pnpm db:migrate` applies migrations cleanly without corrupting drizzle state.

**What happens if you skip this:**
- Running raw SQL (`sqlite3 ...`) bypasses the journal → production won't have the change
- Manually creating migration files creates invalid journal entries
- Dev server restart may fail silently if journal is corrupted

---

## Rule 1: Never Modify Schema Directly

**NEVER do this:**
```bash
sqlite3 data/sqlite.db "ALTER TABLE foo ADD COLUMN bar INTEGER;"
```

**Why:** Production runs migrations on startup. If you modify the DB directly, the migration system doesn't know about it. When you create a migration for the "same" change, it becomes a no-op locally (column exists) but fails in production (column missing).

**Production outage (Dec 2025):** Migration 0043 was `SELECT 1;` because "column already exists locally." Production never got the column, crashed with "no such column: is_paused".

---

## Rule 2: Never Modify Deployed Migrations

**NEVER edit a migration file that's been committed/deployed.**

Drizzle tracks migrations by name, not content. Once recorded in `__drizzle_migrations`, it will NEVER re-run even if content changes.

**The failure pattern:**
```
1. Create empty/stub migration → deploy → recorded as "applied"
2. Edit migration with real SQL → deploy → SKIPPED (already "applied")
3. Production crashes → missing tables/columns
```

**This caused THREE production outages in December 2025.**

**Fix for deployed migrations:** Create a NEW migration:
```bash
npx drizzle-kit generate --custom
# Name: 0050_fix_missing_foo.sql
# Content: CREATE TABLE IF NOT EXISTS `foo` (...);
```

---

## Rule 3: Never Manually Create Migration Files

**NEVER use Write tool to create files in `drizzle/`.**
**NEVER manually edit `drizzle/meta/_journal.json`.**

Always run:
```bash
npx drizzle-kit generate --custom
```

This ensures correct:
- File naming
- Journal entry with proper `idx`
- Timestamp ordering
- Snapshot files

---

## Rule 4: Statement Breakpoints

**Multiple SQL statements require `--> statement-breakpoint` between them.**

```sql
-- CORRECT
CREATE TABLE `foo` (...);
--> statement-breakpoint
INSERT INTO `foo` VALUES (...);

-- WRONG (causes RangeError)
CREATE TABLE `foo` (...);
INSERT INTO `foo` VALUES (...);
```

**Applies to:**
- CREATE TABLE + INSERT (seeding)
- CREATE TABLE + CREATE INDEX
- Any migration with 2+ statements

**Production outage (Dec 2025):** Migration 0035 crash-looped because CREATE TABLE + INSERT had no breakpoint.

---

## Rule 5: Verify Timestamp Ordering

**After `npx drizzle-kit generate --custom`, check timestamps:**

```bash
tail -20 drizzle/meta/_journal.json | grep -E '"when"|"tag"'
```

**Problem:** New migration timestamp less than previous ones:
```json
{ "idx": 74, "when": 1769000000000, "tag": "0074_..." },
{ "idx": 75, "when": 1769100000000, "tag": "0075_..." },
{ "idx": 76, "when": 1768919764694, "tag": "0076_..." }  // WRONG! Before 0075!
```

**Fix:** Edit `_journal.json`, set new timestamp greater than all previous:
```json
{ "idx": 76, "when": 1769200000000, "tag": "0076_..." }
```

Then run `npm run db:migrate` again.

---

## Diagnosing "no such column" After Migration

**Symptom:** `SqliteError: no such column` even though migration exists and `db:migrate` says complete.

**Diagnosis:**
1. Check if column exists:
   ```sql
   SELECT * FROM pragma_table_info('table_name') WHERE name = 'column_name';
   ```
2. Check journal timestamps (Rule 5 above)
3. If timestamp ordering is wrong, fix it

---

## Emergency Production Fix

If production is down due to missing schema:

```bash
# 1. Generate emergency migration
npx drizzle-kit generate --custom

# 2. Add missing SQL with safety checks
# For tables:
CREATE TABLE IF NOT EXISTS `entry_prompts` (...);

# For columns (will error if exists, but migration still records):
ALTER TABLE `classrooms` ADD COLUMN `foo` integer;

# 3. Commit and deploy immediately
git add drizzle/
git commit -m "fix: emergency migration for missing schema"
git push
```

---

## Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Direct DB modification | Production missing schema | Always use migrations |
| Editing deployed migration | Migration skipped | Create NEW migration |
| Manual file creation | Wrong timestamps | Use `drizzle-kit generate` |
| Missing statement breakpoint | RangeError crash | Add `--> statement-breakpoint` |
| Unchecked timestamp order | Migration skipped | Verify after generate |
