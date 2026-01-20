# Drizzle Migration Timestamp Ordering Fix

## Root Cause: Claude Creating Migrations Manually

**IMPORTANT:** This bug often happens because Claude (me) creates migration files manually instead of using `drizzle-kit generate --custom` properly.

### What I Do Wrong

1. **Manually create SQL files** in `drizzle/` directory
2. **Manually edit `_journal.json`** to add entries
3. **Use arbitrary or calculated timestamps** that don't follow the existing sequence
4. **Copy/paste from previous migrations** without updating timestamps correctly

### What I Should Do Instead

**ALWAYS run the actual command:**
```bash
npx drizzle-kit generate --custom
```

This command:
- Creates the SQL file with proper naming
- Adds the journal entry with correct `idx`
- Uses `Date.now()` for the timestamp (usually correct, but verify!)
- Updates the snapshot files

**NEVER:**
- Manually create files in `drizzle/`
- Manually edit `drizzle/meta/_journal.json` (except to fix timestamps)
- Skip running the generate command "to save time"

## The Secondary Problem

Even when using `drizzle-kit generate --custom` correctly, timestamps can still get out of order if previous migrations were manually given future timestamps (like round numbers `1769000000000`). The generator uses `Date.now()` which might be earlier than those artificial timestamps.

## Symptoms

**Error message:**
```
SqliteError: no such column: "column_name" - should this be a string literal in single-quotes?
```

**What happened:**
1. Schema file has a column defined
2. Migration file exists with the ALTER TABLE statement
3. `npm run db:migrate` says "✅ Migrations complete"
4. But the column doesn't actually exist in the database

## How to Diagnose

### Step 1: Check if the column actually exists
```sql
-- Using MCP sqlite tool
SELECT * FROM pragma_table_info('table_name') WHERE name = 'column_name';
```

### Step 2: Check the journal timestamps
Look at `drizzle/meta/_journal.json` and find the problematic migration. Check if its `when` timestamp is **less than** the previous migrations:

```json
{
  "idx": 74,
  "when": 1769000000000,  // Jan 22
  "tag": "0074_flowchart_embeddings"
},
{
  "idx": 75,
  "when": 1769100000000,  // Jan 23
  "tag": "0075_prompt_embedding"
},
{
  "idx": 76,
  "when": 1768919764694,  // Jan 20 ← PROBLEM! This is BEFORE 0074 and 0075!
  "tag": "0076_charming_rachel_grey"
}
```

## How to Fix

### Step 1: Update the timestamp in the journal

Edit `drizzle/meta/_journal.json` and change the `when` value to be **greater than** all previous migrations:

```json
{
  "idx": 76,
  "when": 1769200000000,  // Now it's Jan 24, after 0075
  "tag": "0076_charming_rachel_grey"
}
```

### Step 2: Run migrations again

```bash
npm run db:migrate
```

### Step 3: Verify the column exists

```sql
SELECT * FROM pragma_table_info('table_name') WHERE name = 'column_name';
```

## Prevention

### Step 1: Use the Correct Workflow

**When I need to create a migration, I MUST:**

```bash
# 1. First, modify the schema file in src/db/schema/

# 2. Then run drizzle-kit (NOT manually create files!)
npx drizzle-kit generate --custom

# 3. The command will output the created file name - edit THAT file
# Example output: "Created drizzle/0077_some_name.sql"

# 4. Add the actual SQL to the generated file

# 5. IMMEDIATELY check the timestamp ordering (see below)

# 6. Run the migration
npm run db:migrate

# 7. Verify the change
# Use: mcp__sqlite__describe_table table_name
```

### Step 2: Always Verify Timestamps

**After running `npx drizzle-kit generate --custom`, ALWAYS:**

1. Open `drizzle/meta/_journal.json`
2. Find the new migration entry (last one)
3. Compare its `when` timestamp to the previous entry
4. If the new timestamp is **less than** the previous one, manually increase it

**Quick check command:**
```bash
# Show last 3 migrations with their timestamps
tail -20 drizzle/meta/_journal.json | grep -E '"when"|"tag"'
```

**Example of correct ordering:**
```
"when": 1769000000000,
"tag": "0074_..."
"when": 1769100000000,  // +100000000 from previous
"tag": "0075_..."
"when": 1769200000000,  // +100000000 from previous ✓
"tag": "0076_..."
```

## Why This Happens

1. **Claude manually creates migrations** instead of using `drizzle-kit generate --custom`
2. **Or** `drizzle-kit generate` uses `Date.now()` but previous migrations have future timestamps
3. New migration gets a timestamp earlier than existing ones
4. Drizzle sees the migration as "already applied" based on ordering

## Common Claude Mistakes to Avoid

| ❌ Wrong | ✅ Right |
|----------|----------|
| `Write` tool to create `drizzle/0077_foo.sql` | Run `npx drizzle-kit generate --custom` via Bash |
| `Edit` tool to add entry to `_journal.json` | Let drizzle-kit manage the journal |
| Guessing the next migration number | Let drizzle-kit assign it |
| Copying timestamps from previous migrations | Let drizzle-kit generate timestamp, then verify |

## Related CLAUDE.md Rules

This issue is documented in the main CLAUDE.md under:
- "CRITICAL: Never Modify Migration Files After Deployment"
- "Creating Database Migrations" section

This skill provides the specific diagnosis and fix procedure.
