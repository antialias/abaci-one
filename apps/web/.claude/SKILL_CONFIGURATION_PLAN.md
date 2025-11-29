# Skill Configuration & Creation System

## Overview

Allow users to configure existing mastery skills and create custom skills using the Smart Mode's 2D difficulty editor (Regrouping Intensity × Scaffolding Level) plus digit range slider.

## Architecture

### 1. SkillConfigurationModal Component

A reusable modal that shows:

- **Digit Range Slider** (2-6 digits, matching current UI)
- **2D Difficulty Plot** (Regrouping Intensity × Scaffolding Level)
- **Make Easier/Harder buttons** (Challenge/Support/Both modes)
- **Overall Difficulty Slider**
- **Preview of selected difficulty** (shows pAnyStart, pAllStart, displayRules)
- **Skill Name input** (for custom skills)
- **Description input** (optional, for custom skills)

**Two modes:**

- **Edit Mode**: Configure existing skill (default or custom)
- **Create Mode**: Create new custom skill from scratch

### 2. MasteryModePanel Updates

Add two buttons:

- **"⚙️ Configure"** - Next to current skill name (edits current skill)
- **"+ Create Custom Skill"** - Below skill selector (creates new skill)

Show visual indicators:

- **Default skills**: Show as-is
- **Customized skills**: Show "⚙️ Custom" badge + "Reset to Default" button
- **User-created skills**: Show "✨ Custom" badge + "Delete" button

### 3. Database Schema

```sql
-- Fully user-created skills (new progression items)
CREATE TABLE custom_skills (
  id TEXT PRIMARY KEY,              -- Generated ID (e.g., 'custom-3d-moderate-regroup')
  user_id TEXT NOT NULL,
  operator TEXT NOT NULL,            -- 'addition' | 'subtraction'
  name TEXT NOT NULL,                -- User-provided name
  description TEXT,                  -- Optional description
  digit_range TEXT NOT NULL,         -- JSON: {min, max}
  regrouping_config TEXT NOT NULL,   -- JSON: {pAnyStart, pAllStart}
  display_rules TEXT NOT NULL,       -- JSON: displayRules object
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_custom_skills_user_operator ON custom_skills(user_id, operator);

-- Overrides for default skills (keeps skill ID, modifies config)
CREATE TABLE skill_customizations (
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,            -- Original skill ID (e.g., 'sd-no-regroup')
  operator TEXT NOT NULL,            -- 'addition' | 'subtraction'
  digit_range TEXT NOT NULL,         -- JSON: {min, max}
  regrouping_config TEXT NOT NULL,   -- JSON: {pAnyStart, pAllStart}
  display_rules TEXT NOT NULL,       -- JSON: displayRules object
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, skill_id, operator),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Two tables because:**

- `custom_skills`: Fully user-created skills (new progression items)
- `skill_customizations`: Overrides for default skills (keeps skill ID, modifies config)

### 4. API Endpoints

```typescript
// Get all skills (defaults + custom + customizations)
GET /api/worksheets/skills?operator=addition
// Returns merged list with custom configs applied
// Response: { skills: Skill[], customizations: Map<SkillId, Config> }

// Create custom skill
POST /api/worksheets/skills/custom
{
  name: string
  description?: string
  operator: 'addition' | 'subtraction'
  digitRange: { min: number, max: number }
  regroupingConfig: { pAnyStart: number, pAllStart: number }
  displayRules: DisplayRules
}
// Returns: { id: string, ...skill }

// Update custom skill
PUT /api/worksheets/skills/custom/:id
{
  name?: string
  description?: string
  digitRange?: { min: number, max: number }
  regroupingConfig?: { pAnyStart: number, pAllStart: number }
  displayRules?: DisplayRules
}

// Delete custom skill
DELETE /api/worksheets/skills/custom/:id

// Save skill customization (for default skills)
POST /api/worksheets/skills/:skillId/customize
{
  operator: 'addition' | 'subtraction'
  digitRange: { min: number, max: number }
  regroupingConfig: { pAnyStart: number, pAllStart: number }
  displayRules: DisplayRules
}

// Reset skill to default (delete customization)
DELETE /api/worksheets/skills/:skillId/customize?operator=addition
```

### 5. Skill Loading Logic

```typescript
interface SkillWithCustomization extends Skill {
  isCustomized?: boolean; // Default skill that's been customized
  isCustomCreated?: boolean; // User-created custom skill
  originalConfig?: SkillConfig; // Original before customization
}

async function loadSkillsWithCustomizations(
  operator: "addition" | "subtraction",
): Promise<SkillWithCustomization[]> {
  // 1. Load default skills from static definitions
  const defaultSkills = getSkillsByOperator(operator);

  // 2. Load customizations for defaults
  const customizationsResp = await fetch(
    `/api/worksheets/skills/customizations?operator=${operator}`,
  );
  const { customizations } = await customizationsResp.json();

  // 3. Load user-created custom skills
  const customSkillsResp = await fetch(
    `/api/worksheets/skills/custom?operator=${operator}`,
  );
  const { skills: customSkills } = await customSkillsResp.json();

  // 4. Merge: apply customizations, append custom skills
  const mergedDefaults = defaultSkills.map((skill) => {
    const customization = customizations[skill.id];
    if (customization) {
      return {
        ...skill,
        digitRange: customization.digitRange,
        regroupingConfig: customization.regroupingConfig,
        displayRules: customization.displayRules,
        isCustomized: true,
        originalConfig: {
          digitRange: skill.digitRange,
          regroupingConfig: skill.regroupingConfig,
          displayRules: skill.displayRules,
        },
      };
    }
    return skill;
  });

  return [
    ...mergedDefaults,
    ...customSkills.map((skill) => ({
      ...skill,
      isCustomCreated: true,
    })),
  ];
}
```

### 6. UI Flows

#### Configuring an existing skill:

1. User clicks "⚙️ Configure" next to "2-digit, no regrouping"
2. Modal opens with:
   - Title: "Configure Skill: 2-digit, no regrouping"
   - Current skill's settings pre-loaded in 2D plot
   - Digit slider shows current digitRange
   - "Save" and "Cancel" buttons
3. User adjusts difficulty using plot/buttons/sliders
4. Click "Save" → Saves to `skill_customizations` table
5. Skill now shows "⚙️ Custom" badge
6. "Reset to Default" button appears next to Configure

#### Creating a custom skill:

1. User clicks "+ Create Custom Skill"
2. Modal opens with:
   - Title: "Create Custom Skill"
   - Blank name input (required)
   - Optional description textarea
   - 2D plot starts at Early Learner preset
   - Digit slider starts at {min: 2, max: 2}
   - "Create" and "Cancel" buttons
3. User enters name: "3-digit with moderate regrouping"
4. User adjusts difficulty using 2D plot
5. Click "Create" → Saves to `custom_skills` table
6. New skill appears in skill list with "✨ Custom" badge
7. Skill is selectable in mastery progression
8. User can configure/delete custom skills

#### Resetting a customization:

1. User clicks "Reset to Default" on customized skill
2. Confirmation modal: "Reset to default configuration?"
3. Click "Reset" → Deletes from `skill_customizations` table
4. Skill reverts to original default config
5. "⚙️ Custom" badge removed

#### Deleting a custom skill:

1. User clicks "🗑️ Delete" on custom skill
2. Confirmation modal: "Delete custom skill? This cannot be undone."
3. Click "Delete" → Removes from `custom_skills` table
4. If skill was currently selected, switches to first default skill
5. Skill removed from list

### 7. Component Structure

```
src/app/create/worksheets/components/
├── config-panel/
│   ├── MasteryModePanel.tsx (updated)
│   ├── SkillConfigurationModal.tsx (new)
│   ├── SkillSelector.tsx (extracted from MasteryModePanel)
│   └── CustomSkillBadge.tsx (new)
├── config-sidebar/
│   └── DifficultyTab.tsx (unchanged)
```

### 8. Key Benefits

✅ **Pedagogically sound defaults** - Teachers can start with expert-designed progressions
✅ **Customizable for advanced users** - Adjust any skill to match student needs
✅ **Extendable** - Create additional practice steps in the progression
✅ **Reversible** - Reset customizations to defaults anytime
✅ **Per-user** - Each teacher gets their own custom skills/configs
✅ **Unified UI** - Reuses the proven 2D difficulty editor from Smart Mode
✅ **Non-destructive** - Original skills remain unchanged
✅ **Progressive enhancement** - Works without customization, powerful with it

### 9. Implementation Order

1. ✅ Create database schema and migration
2. ✅ Create API endpoints (skills, customizations, custom skills)
3. ✅ Create SkillConfigurationModal component
4. ✅ Update MasteryModePanel with Configure/Create buttons
5. ✅ Add visual indicators (badges, reset/delete buttons)
6. ✅ Test skill loading/saving flow
7. ✅ Add confirmation modals for destructive actions
8. ✅ Polish UI/UX (tooltips, loading states, error handling)

### 10. Data Models

```typescript
interface SkillConfig {
  digitRange: { min: number; max: number };
  regroupingConfig: { pAnyStart: number; pAllStart: number };
  displayRules: DisplayRules;
}

interface CustomSkill extends SkillConfig {
  id: string;
  userId: string;
  operator: "addition" | "subtraction";
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface SkillCustomization extends SkillConfig {
  userId: string;
  skillId: string;
  operator: "addition" | "subtraction";
  updatedAt: string;
}

interface SkillWithMetadata extends Skill {
  isCustomized?: boolean;
  isCustomCreated?: boolean;
  originalConfig?: SkillConfig;
}
```

### 11. Migration Strategy

Since this is a new feature, no data migration needed. However:

1. Ensure backward compatibility with existing `currentAdditionSkillId`/`currentSubtractionSkillId` in worksheet configs
2. Custom skill IDs should use a prefix (e.g., `custom-{uuid}`) to avoid collisions with default skill IDs
3. When loading a shared worksheet, ignore custom skill IDs (fall back to nearest default skill)

### 12. Future Enhancements

- **Import/Export**: Share custom skills with other teachers
- **Skill Templates**: Pre-made custom skill collections
- **Skill Analytics**: Track which skills students struggle with
- **Recommended Skills**: AI suggests next skill based on performance
- **Skill Ordering**: Drag-and-drop to reorder skill progression
