# Worksheet Config Schema Guide

## Type-Safe JSON Blob with Schema Versioning

This system provides type-safe storage of worksheet settings using JSON blobs with automatic schema migration.

## Key Features

1. **Runtime Type Safety**: Zod validates all configs at runtime
2. **Schema Versioning**: Each config has a `version` field for evolution
3. **Automatic Migration**: Old configs automatically upgrade to latest version
4. **Graceful Degradation**: Invalid configs fall back to sensible defaults
5. **Future-Proof**: Add new worksheet types without schema changes

## Adding a New Setting to Existing Worksheet Type

**Example**: Add `showHints` to addition worksheets

1. **Update the schema** (`config-schemas.ts`):
```typescript
export const additionConfigV2Schema = z.object({
  version: z.literal(2),
  // ... all V1 fields ...
  showHints: z.boolean(), // NEW FIELD
})
```

2. **Create migration function**:
```typescript
function migrateAdditionV1toV2(v1: AdditionConfigV1): AdditionConfigV2 {
  return {
    ...v1,
    version: 2,
    showHints: false, // Default value for new field
  }
}
```

3. **Update discriminated union**:
```typescript
export const additionConfigSchema = z.discriminatedUnion('version', [
  additionConfigV1Schema,
  additionConfigV2Schema, // Add new version
])
```

4. **Update migration switch**:
```typescript
export function migrateAdditionConfig(rawConfig: unknown): AdditionConfigV2 {
  const parsed = additionConfigSchema.safeParse(rawConfig)
  if (!parsed.success) return defaultAdditionConfig

  switch (parsed.data.version) {
    case 1:
      return migrateAdditionV1toV2(parsed.data)
    case 2:
      return parsed.data // Latest version
    default:
      return defaultAdditionConfig
  }
}
```

5. **Update default**:
```typescript
export const defaultAdditionConfig: AdditionConfigV2 = {
  version: 2,
  // ... all fields including showHints: false
}
```

## Adding a New Worksheet Type

**Example**: Add multiplication worksheets

1. **Create schema**:
```typescript
export const multiplicationConfigV1Schema = z.object({
  version: z.literal(1),
  problemsPerPage: z.number().int().min(1).max(100),
  showTimes Table: z.boolean(),
  // ... multiplication-specific fields
})
```

2. **Create helpers**:
```typescript
export function parseMultiplicationConfig(jsonString: string): MultiplicationConfigV1 {
  try {
    const raw = JSON.parse(jsonString)
    return multiplicationConfigSchema.parse(raw)
  } catch (error) {
    return defaultMultiplicationConfig
  }
}

export function serializeMultiplicationConfig(config: Omit<MultiplicationConfigV1, 'version'>): string {
  return JSON.stringify({ ...config, version: 1 })
}
```

3. **Use in app**: No database migration needed!

## Usage in Application Code

### Saving Settings

```typescript
import { serializeAdditionConfig } from './config-schemas'

const configJSON = serializeAdditionConfig({
  problemsPerPage: 20,
  cols: 5,
  // ... all other fields (version added automatically)
})

await db.insert(worksheetSettings).values({
  id: crypto.randomUUID(),
  userId: user.id,
  worksheetType: 'addition',
  config: configJSON,
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

### Loading Settings

```typescript
import { parseAdditionConfig } from './config-schemas'

const row = await db
  .select()
  .from(worksheetSettings)
  .where(eq(worksheetSettings.userId, userId))
  .where(eq(worksheetSettings.worksheetType, 'addition'))
  .limit(1)

const config = row ? parseAdditionConfig(row.config) : defaultAdditionConfig
// config is now type-safe and guaranteed to be latest version!
```

## Migration Examples

### Scenario 1: User has V1 config, app is on V2

```json
// Stored in DB (V1):
{
  "version": 1,
  "problemsPerPage": 20,
  "cols": 5,
  ...
}

// Automatically migrated to V2 when loaded:
{
  "version": 2,
  "problemsPerPage": 20,
  "cols": 5,
  "showHints": false,  // <-- Added with default
  ...
}
```

### Scenario 2: Invalid/corrupted config

```typescript
// Stored in DB (corrupted):
"{invalid json{{"

// Falls back to defaults:
parseAdditionConfig("{invalid json{{")
// Returns: defaultAdditionConfig
```

### Scenario 3: Future version (app downgrade)

```json
// Stored in DB (V3, unknown to current app):
{
  "version": 3,
  "someNewField": "value",
  ...
}

// Falls back to defaults (can't parse unknown version):
// Returns: defaultAdditionConfig
```

## Best Practices

1. **Never remove fields in new versions** - only add (backwards compatible)
2. **Always provide defaults** in migration functions
3. **Test migrations** with real V1 data before deploying V2
4. **Document breaking changes** if absolutely necessary
5. **Keep CURRENT_VERSION constant** in sync with latest schema

## Type Safety Benefits

```typescript
// TypeScript catches missing fields at compile time:
const config: AdditionConfigV1 = {
  version: 1,
  problemsPerPage: 20,
  // ❌ Error: Missing required field 'cols'
}

// Runtime validation catches invalid values:
parseAdditionConfig('{"version": 1, "cols": 999}')
// ❌ Zod error: cols must be <= 10, falls back to defaults

// Full autocomplete in editors:
config.show // ← autocomplete suggests: showCarryBoxes, showAnswerBoxes, etc.
```

## Database Schema Evolution

**Important**: The database schema NEVER needs to change when:
- Adding new worksheet types (just store different JSON)
- Adding new fields to existing types (handled by migration)
- Changing default values (handled in defaultConfig)

**Only needs migration when**:
- Adding indexes for performance
- Changing primary key structure
- Adding completely new columns to worksheet_settings table itself
