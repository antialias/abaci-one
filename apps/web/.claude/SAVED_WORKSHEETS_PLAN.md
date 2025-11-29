# Saved Worksheets Feature - Auto-Persistence Architecture

> **📊 Implementation Status:** See `SAVED_WORKSHEETS_IMPLEMENTATION_STATUS.md` for current progress, alignment review, and roadmap.

## Overview

**Modern auto-persistence:** Changes save automatically in the background, like Google Docs or Figma. No explicit "Save" buttons.

**Core principle:** The quick anonymous workflow remains the default path. Auto-persistence is transparent and unobtrusive.

### User Experience

1. **Instant feedback**: Changes persist to localStorage immediately (zero latency)
2. **Background sync**: Changes sync to database after 5 seconds of inactivity
3. **Version history**: User can restore any previous state
4. **Smart library**: Worksheets auto-add when user shows commitment (generates PDF, names it)
5. **No save anxiety**: Everything is always saved

### Configuration

All behavior is tuneable via `src/config/persistence.ts` - see file for details.

**Key defaults:**

- Auto-save debounce: 5 seconds
- Add to library: On first PDF generation OR when named
- Version retention: Keep last 10 auto-saves, prune after 30 days
- Snapshots: Create permanent versions on PDF/share/upload (never pruned)

## User Stories

### Core Workflows

1. **Quick anonymous print** (unchanged)
   - User visits `/create/worksheets/addition`
   - Adjusts settings (auto-persisted to localStorage)
   - Downloads PDF immediately
   - No account, no explicit save, no friction

2. **Auto-save for reuse**
   - User configures worksheet
   - Settings auto-save to localStorage every change
   - After 5 seconds of inactivity, syncs to database
   - When they generate PDF, worksheet auto-adds to library
   - Name is auto-generated: "Addition Worksheet - Jan 13, 2025"

3. **Version history**
   - User realizes previous config was better
   - Clicks "Version History" button
   - Sees timeline of changes with preview
   - Clicks "Restore" on previous version
   - Config immediately restores, continues working

4. **Naming**
   - Auto-generated names initially
   - User clicks name to edit inline (like Google Docs)
   - Name change saves immediately
   - Named worksheets are findable in library

5. **Print tracking**
   - User generates PDF with QR codes
   - Each print creates immutable snapshot (version)
   - Students scan QR code to upload
   - Teacher sees which version they completed

## Data Model

### Table: `saved_worksheets`

Main library table - stores current state

```sql
CREATE TABLE saved_worksheets (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT,                           -- Optional: User who created it

  -- Naming
  name TEXT NOT NULL,                     -- User-given or auto-generated name
  description TEXT,                       -- Optional description

  -- Type and config
  worksheet_type TEXT NOT NULL,           -- "addition", "subtraction", etc.
  config JSON NOT NULL,                   -- Current worksheet config

  -- Library metadata
  tags TEXT,                              -- Comma-separated tags for filtering
  is_favorite BOOLEAN DEFAULT FALSE,      -- User starred it
  is_template BOOLEAN DEFAULT FALSE,      -- Featured template
  is_public BOOLEAN DEFAULT FALSE,        -- Can others discover it?

  -- Auto-generated preview
  thumbnail_url TEXT,                     -- Preview image

  -- Engagement tracking
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  last_viewed_at INTEGER,                 -- Last time user opened it
  edit_count INTEGER DEFAULT 0,           -- Number of edits
  time_spent_ms INTEGER DEFAULT 0,        -- Total time user spent editing

  -- Version tracking
  current_version_id TEXT,                -- FK to latest worksheet_versions
  version_count INTEGER DEFAULT 0,        -- Total versions created

  -- Usage tracking
  pdf_generation_count INTEGER DEFAULT 0, -- How many PDFs generated
  share_count INTEGER DEFAULT 0,          -- How many times shared
  upload_count INTEGER DEFAULT 0          -- How many student uploads
)
```

### Table: `worksheet_versions`

Immutable snapshots created at milestones

```sql
CREATE TABLE worksheet_versions (
  id TEXT PRIMARY KEY,                    -- UUID
  saved_worksheet_id TEXT NOT NULL,       -- FK to saved_worksheets

  -- Version metadata
  version_number INTEGER NOT NULL,        -- 1, 2, 3, etc. (auto-incremented)
  version_type TEXT NOT NULL,             -- 'auto-save' | 'snapshot' | 'manual'

  -- Config snapshot
  config JSON NOT NULL,                   -- Full worksheet config at this point

  -- ACTUAL GENERATED PROBLEMS (for snapshots only)
  problems JSON,                          -- Array of {a, b, operator, answer} - NULL for auto-saves
  answer_key JSON,                        -- Pre-computed answer key - NULL for auto-saves

  -- Timing
  created_at INTEGER NOT NULL,            -- When this version was created
  created_by TEXT,                        -- User who created (if manual)

  -- Context (why was this version created?)
  created_reason TEXT,                    -- 'auto-save' | 'pdf-generate' | 'share' | 'upload' | 'manual-pin'
  change_description TEXT,                -- Optional: User notes ("Increased difficulty")

  -- Metadata (for snapshots)
  problem_count INTEGER,                  -- Total problems (NULL for auto-saves)
  page_count INTEGER,                     -- Total pages (NULL for auto-saves)

  FOREIGN KEY (saved_worksheet_id) REFERENCES saved_worksheets(id) ON DELETE CASCADE,
  UNIQUE(saved_worksheet_id, version_number)
)
```

**Version Types:**

- **`auto-save`**: Background saves (every 5s after changes). No problems stored. Pruned after 30 days.
- **`snapshot`**: Milestone saves (PDF, share, upload). Full problems stored. Never pruned.
- **`manual`**: User clicked "Pin this version". Full problems stored. Never pruned.

### Table: `worksheet_instances`

Individual printed copies with QR codes

```sql
CREATE TABLE worksheet_instances (
  id TEXT PRIMARY KEY,                    -- UUID (shown on printed worksheet)
  saved_worksheet_id TEXT NOT NULL,       -- FK to saved_worksheets
  version_id TEXT NOT NULL,               -- FK to worksheet_versions (snapshot)
  version_number INTEGER NOT NULL,        -- Denormalized for quick lookup

  -- Print metadata
  printed_at INTEGER NOT NULL,            -- When PDF was generated
  printed_by TEXT,                        -- User who generated it

  -- Student assignment
  student_name TEXT,                      -- Optional: Assigned student
  class_id TEXT,                          -- Optional: Assigned class
  due_date INTEGER,                       -- Optional: When it's due

  -- Upload tracking
  qr_code_url TEXT NOT NULL,              -- URL students scan: /upload/[instance-id]
  upload_count INTEGER DEFAULT 0,         -- Number of uploads for this instance

  FOREIGN KEY (saved_worksheet_id) REFERENCES saved_worksheets(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES worksheet_versions(id) ON DELETE RESTRICT
)
```

### Extended: `worksheet_attempts`

Link uploaded work to specific instance

```sql
-- Add new column:
ALTER TABLE worksheet_attempts
ADD COLUMN worksheet_instance_id TEXT
REFERENCES worksheet_instances(id);

CREATE INDEX worksheet_attempts_instance_idx
ON worksheet_attempts(worksheet_instance_id);
```

## Auto-Persistence Flow

### 1. Initial Load

```
User visits /create/worksheets/addition
  ↓
Check localStorage for unsaved work
  ↓ (if found)
Prompt: "Continue where you left off?" [Resume] [Start Fresh]
  ↓ (if resume)
Restore config from localStorage
  ↓
Check database for saved worksheet (if ID in localStorage)
  ↓ (if found and newer)
Prompt: "Restore from cloud?" [Yes] [Keep Local]
```

### 2. Config Changes

```
User changes setting (e.g., difficulty slider)
  ↓
IMMEDIATE: Save to localStorage (key: 'worksheet-config')
  ↓
Debounced 5s: Sync to database
  ↓
If worksheet has ID: UPDATE saved_worksheets + CREATE worksheet_versions (auto-save)
If no ID yet: Wait for trigger event
```

### 3. Trigger Events (Add to Library)

```
User generates PDF OR names worksheet
  ↓
If no worksheet ID: CREATE saved_worksheets
  ↓
CREATE worksheet_versions (snapshot type)
  ↓
Store full problems + answer_key
  ↓
UPDATE saved_worksheets.current_version_id
  ↓
Show subtle toast: "✓ Saved to library"
```

### 4. Version History

```
User clicks "Version History"
  ↓
Fetch worksheet_versions for this worksheet
  ↓
Display timeline grouped by day
  ↓
User clicks version → Show preview
  ↓
User clicks "Restore" → UPDATE config, IMMEDIATE localStorage + DB save
```

## UI Changes

### Worksheet Editor (`/create/worksheets/addition`)

**Title bar changes:**

```
┌─────────────────────────────────────────────────────────┐
│ [Click to name]         [Version History ▼] [⋮ More]   │
└─────────────────────────────────────────────────────────┘

Inline editable title (like Google Docs):
  - Shows auto-generated name initially
  - Click to edit
  - Auto-save on blur
  - Placeholder: "Untitled Worksheet"
```

**Status indicator** (bottom right, subtle):

```
┌─────────────────┐
│ ✓ All changes   │
│   saved         │
└─────────────────┘

States:
- "✓ All changes saved" (default, gray)
- "⏳ Saving..." (blue, during debounce)
- "⚠ Offline - changes saved locally" (yellow, no network)
- "✗ Failed to save" (red, with retry button)
```

**Version History dropdown:**

```
┌─────────────────────────────────────────────────┐
│ Version History                                 │
├─────────────────────────────────────────────────┤
│ TODAY                                           │
│ ● 2:45 PM - Current (snapshot)                  │
│   Generated PDF                      [Preview]  │
│                                                  │
│ ○ 2:30 PM - Auto-save                           │
│   Changed difficulty to Advanced     [Restore]  │
│                                                  │
│ YESTERDAY                                       │
│ ○ 4:15 PM - Auto-save                           │
│   Added 3-digit problems             [Restore]  │
│                                                  │
│ [Show older versions...]                        │
└─────────────────────────────────────────────────┘

Legend:
● Snapshot (permanent)
○ Auto-save (pruned after 30 days)
```

### ActionsSidebar Changes

**Remove explicit "Save" button** - replaced with smarter actions:

```
OLD (explicit save):
┌──────────────┐
│ 💾 Save      │  ← DELETE THIS
└──────────────┘

NEW (milestone actions):
┌──────────────┐
│ 📄 Download  │  ← Creates snapshot
│ 📱 Share     │  ← Creates snapshot
│ ⬆️  Upload   │  ← (unchanged)
└──────────────┘

Optional "Pin" action (advanced users):
┌──────────────┐
│ 📌 Pin       │  ← Creates manual snapshot
└──────────────┘
Tooltip: "Save this exact version permanently"
```

### Library Page (`/worksheets/library`)

New page showing saved worksheets:

```
┌─────────────────────────────────────────────────────────┐
│ My Worksheets                    [🔍 Search] [⚙️ Sort]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────────┐  ┌──────────────────┐             │
│ │ Addition         │  │ Subtraction      │             │
│ │ Worksheet        │  │ Practice         │             │
│ │ Jan 13, 2025     │  │ Jan 10, 2025     │             │
│ │                  │  │                  │             │
│ │ 3 versions       │  │ 1 version        │             │
│ │ 5 PDFs generated │  │ 2 PDFs generated │             │
│ │                  │  │                  │             │
│ │ [Open] [⋮]       │  │ [Open] [⋮]       │             │
│ └──────────────────┘  └──────────────────┘             │
│                                                          │
│ [Show archived]                                          │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Auto-Save

```
PATCH /api/worksheets/saved/[id]/auto-save
Body: { config: WorksheetConfig }
Response: { saved: true, version_number: 5 }

Creates worksheet_versions entry with type='auto-save'
Updates saved_worksheets.config and updated_at
Respects PERSISTENCE_CONFIG.autoSave settings
```

### Snapshot Creation

```
POST /api/worksheets/saved/[id]/snapshot
Body: {
  reason: 'pdf-generate' | 'share' | 'upload' | 'manual-pin',
  config: WorksheetConfig,
  problems: Problem[],      // Full generated problems
  answer_key: Answer[]
}
Response: { version_id: string, version_number: 6 }

Creates worksheet_versions entry with type='snapshot'
Stores full problems + answer_key
Never pruned
```

### Version History

```
GET /api/worksheets/saved/[id]/versions
Query: ?include_auto_saves=true&limit=20
Response: {
  versions: [
    {
      id: 'v123',
      version_number: 6,
      type: 'snapshot',
      created_at: 1705172400,
      created_reason: 'pdf-generate',
      config: {...},
      has_problems: true
    },
    ...
  ]
}
```

### Restore Version

```
POST /api/worksheets/saved/[id]/restore
Body: { version_id: 'v123' }
Response: { config: WorksheetConfig }

Updates saved_worksheets.config from version
Does NOT create new version (that happens on next change)
Returns config for client to apply
```

### Library List

```
GET /api/worksheets/saved
Query: ?page=1&limit=20&sort=updated_at&order=desc
Response: {
  worksheets: [...],
  total: 42,
  page: 1,
  has_more: true
}
```

## Implementation Phases

### Phase 1: Auto-Persistence Foundation ✓ DONE

- ✅ Database schema (saved_worksheets, worksheet_versions, worksheet_instances)
- ✅ Migration applied
- ✅ API endpoints created
- ⏳ **PIVOT NEEDED**: Remove SaveWorksheetModal, implement auto-save

### Phase 2: Auto-Save System

1. **Create auto-save hook** (`useWorksheetAutoSave.ts`)
   - localStorage immediate save
   - Debounced DB sync
   - Status indicator state

2. **Update worksheet editor**
   - Remove "Save" button
   - Add inline editable title
   - Add status indicator (bottom right)
   - Add version history dropdown

3. **Implement auto-save API**
   - `PATCH /api/worksheets/saved/[id]/auto-save`
   - Creates auto-save versions
   - Prunes old auto-saves

4. **Update milestone actions**
   - PDF download creates snapshot
   - Share creates snapshot
   - Upload creates snapshot

### Phase 3: Version History

1. **Create version history UI**
   - Dropdown with timeline
   - Preview modal
   - Restore action

2. **Implement version APIs**
   - `GET /api/worksheets/saved/[id]/versions`
   - `POST /api/worksheets/saved/[id]/restore`

3. **Add version pruning job**
   - Background task to prune old auto-saves
   - Respects PERSISTENCE_CONFIG

### Phase 4: Library Page

1. **Create library page** (`/worksheets/library`)
   - Grid of saved worksheets
   - Search and filter
   - Sort options

2. **Card interactions**
   - Click to open in editor
   - Context menu (rename, archive, delete)
   - Duplicate action

3. **Smart library additions**
   - Auto-add on first PDF
   - Auto-add on naming
   - Engagement time tracking

## Migration Strategy

**From current SaveWorksheetModal to auto-persistence:**

1. **Keep existing database schema** - it works for both models
2. **Remove UI components:**
   - Delete `SaveWorksheetModal.tsx`
   - Remove "Save" button from `ActionsSidebar.tsx`
3. **Add new UI components:**
   - Create `useWorksheetAutoSave.ts` hook
   - Create `VersionHistoryDropdown.tsx`
   - Create `InlineEditableTitle.tsx`
   - Create `SaveStatusIndicator.tsx`
4. **Update milestone actions:**
   - PDF download calls snapshot API
   - Share calls snapshot API
5. **Add library page:**
   - Create `/worksheets/library/page.tsx`

## Testing Plan

1. **Auto-save timing**
   - Change config → verify localStorage immediately
   - Wait 5s → verify DB update
   - Make rapid changes → verify only one DB call

2. **Version history**
   - Make 10 changes → verify 10 auto-save versions
   - Generate PDF → verify snapshot created
   - Restore version → verify config updates

3. **Offline behavior**
   - Disconnect network
   - Make changes → verify localStorage works
   - Reconnect → verify sync happens

4. **Version pruning**
   - Create 20 auto-save versions
   - Verify keeps last 10
   - Verify snapshots never pruned

## Success Metrics

- **Zero user friction**: No "Save" dialogs, no anxiety
- **Fast feedback**: Config changes visible in < 16ms (one frame)
- **Reliable sync**: Background sync success rate > 99.9%
- **Library adoption**: > 50% of users who generate PDF have worksheets in library
- **Version usage**: > 10% of users restore a previous version

## Configuration Tuning

If behavior needs adjustment, edit `src/config/persistence.ts`:

```typescript
// Make auto-save more aggressive (save faster)
debounceMs: 2000  // Was 5000

// Keep more version history
maxVersionsToKeep: 20  // Was 10

// Require explicit library addition
library: {
  autoAddOnFirstPdf: false,  // Was true
  autoAddOnNaming: false,    // Was true
}
```
