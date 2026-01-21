# Merge Conflict Resolution

## Enable diff3/zdiff3 (Required)

```bash
git config --global merge.conflictstyle zdiff3  # Recommended
# or: git config --global merge.conflictstyle diff3
```

This shows the **common ancestor** in conflicts, making resolution much clearer.

## Conflict Marker Format

```
<<<<<<< HEAD
our changes
||||||| base
common ancestor (original code)
=======
their changes
>>>>>>> branch-name
```

## Resolution Strategy

### Step 1: Analyze Each Side

For each conflict:
1. **OURS vs BASE**: What did we change?
2. **THEIRS vs BASE**: What did they change?
3. **Classify** the conflict type (see below)

### Step 2: Apply Resolution Pattern

| Type | Description | Resolution |
|------|-------------|------------|
| **Compatible** | Changes to different parts | Keep both changes |
| **Redundant** | Same intent, different implementation | Choose better implementation |
| **Conflicting** | Incompatible changes to same logic | Combine carefully or choose one |
| **Delete vs Modify** | One deleted, other modified | Check if modification still needed |
| **Rename + References** | Rename + new references | Apply rename to new references |

### Example: Compatible Changes

```
<<<<<<< HEAD
function process(data) {
  validate(data);        // We added validation
  return transform(data);
}
||||||| base
function process(data) {
  return transform(data);
}
=======
function process(data) {
  return transform(data).toUpperCase();  // They added formatting
}
>>>>>>> feature
```

**Resolution:** Keep both - validation AND formatting:
```javascript
function process(data) {
  validate(data);
  return transform(data).toUpperCase();
}
```

### Example: Rename + References

```
<<<<<<< HEAD
const userData = getUserData();
validateUserData(userData);  // We added this
||||||| base
const userData = getUserData();
=======
const userProfile = getUserData();  // They renamed
>>>>>>> feature
```

**Resolution:** Apply rename to our new line:
```javascript
const userProfile = getUserData();
validateUserData(userProfile);  // Use new name
```

## After Resolution

```bash
npm run pre-commit  # Type check, lint, format
npm test            # Run tests
```

**Critical:** Test merged code even if it compiles. Conflicts can create runtime bugs:
```typescript
// OURS renamed parameter, THEIRS added call with old name
function process(userData) { ... }  // param renamed
const result = process(userId);      // ← Compiles but wrong!
```

## Anti-Patterns

- ❌ **Blindly accept OURS/THEIRS** - May discard important changes
- ❌ **Ignore the base** - Can't understand intent without it
- ❌ **Fix bugs during merge** - Keep merge minimal, fix bugs in separate commit
- ❌ **Skip testing** - Merged code can break even if it compiles

## Quick Checklist

```
□ Using diff3 or zdiff3 conflict style
□ For each conflict:
  □ Compared OURS vs BASE
  □ Compared THEIRS vs BASE
  □ Applied appropriate pattern
□ Removed all conflict markers
□ Ran npm run pre-commit
□ Tested functionality
```

## Resources

- [Git Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)
- [Use diff3 for conflict resolution](https://blog.nilbus.com/take-the-pain-out-of-git-conflict-resolution-use-diff3/)
