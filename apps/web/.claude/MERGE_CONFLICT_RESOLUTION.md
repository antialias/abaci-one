# Intelligent Merge Conflict Resolution with diff3

## Overview

This document describes best practices for intelligently resolving Git merge conflicts using diff3-style conflict markers, which show the common ancestor to provide crucial context about what changed on each side.

## What is diff3?

**diff3** is a 3-way merge conflict style that shows:
1. **OURS** (HEAD/current branch changes)
2. **BASE** (common ancestor/original code)
3. **THEIRS** (incoming branch changes)

Standard Git conflicts only show OURS vs THEIRS, making it impossible to determine which side added or removed what. With diff3, you can see **what changed** on each side relative to the base.

## Conflict Marker Format

```
<<<<<<< HEAD (or branch name)
our changes - what we did to the base
||||||| base (or commit hash)
original content - the common ancestor
=======
their changes - what they did to the base
>>>>>>> branch-name (or commit hash)
```

## Why diff3 is Superior

### Without diff3 (standard merge):
```
<<<<<<< HEAD
function calculate(a, b) {
  return a + b + 10;
}
=======
function calculate(x, y) {
  return x + y;
}
>>>>>>> feature-branch
```

**Problem:** Can't tell if:
- We added `+ 10` or they removed it?
- We renamed params or they renamed them?
- Both changes are intentional or redundant?

### With diff3:
```
<<<<<<< HEAD
function calculate(a, b) {
  return a + b + 10;
}
||||||| base
function calculate(a, b) {
  return a + b;
}
=======
function calculate(x, y) {
  return x + y;
}
>>>>>>> feature-branch
```

**Clear insights:**
- **OURS**: Added `+ 10` (kept param names)
- **BASE**: Original had `a + b`
- **THEIRS**: Renamed params to `x, y`
- **Resolution**: Combine both changes: `return x + y + 10;`

## Intelligent Resolution Strategy

### Step 1: Compare Each Side to Base

For each conflict:
1. **OURS vs BASE**: What did we change?
2. **THEIRS vs BASE**: What did they change?
3. **Classify the conflict type** (see below)

### Step 2: Classify Conflict Type

| Conflict Type | Description | Resolution Strategy |
|--------------|-------------|---------------------|
| **Compatible** | Changes are to different parts/aspects | Keep both changes |
| **Redundant** | Same intent, different implementation | Choose the better implementation or merge carefully |
| **Conflicting** | Incompatible changes to same logic | Understand intent, combine if possible, or choose one |
| **Delete vs Modify** | One side deleted, other modified | Decide if modification is still relevant without deleted code |
| **Rename vs Reference** | One renamed, other added references | Update references to new name |

### Step 3: Resolution Patterns

#### Pattern 1: Independent Changes (Compatible)
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

**Analysis:**
- OURS: Added validation call (new line)
- THEIRS: Added `.toUpperCase()` to return (modified existing line)
- Both changes are independent

**Resolution:**
```javascript
function process(data) {
  validate(data);        // Keep our validation
  return transform(data).toUpperCase();  // Keep their formatting
}
```

#### Pattern 2: Same Intent, Different Implementation (Redundant)
```
<<<<<<< HEAD
if (!data || data.length === 0) {
  throw new Error('Data required');
}
||||||| base
// no validation
=======
if (data.length === 0) {
  throw new Error('Data required');
}
>>>>>>> feature
```

**Analysis:**
- OURS: Added null check + length check
- THEIRS: Added length check only
- Same intent (validation), but OURS is more robust

**Resolution:**
```javascript
// Choose the more robust implementation (OURS)
if (!data || data.length === 0) {
  throw new Error('Data required');
}
```

#### Pattern 3: Conflicting Logic
```
<<<<<<< HEAD
const result = calculate(a, b, mode === 'strict');
||||||| base
const result = calculate(a, b);
=======
const result = await calculateAsync(a, b);
>>>>>>> feature
```

**Analysis:**
- OURS: Added `mode === 'strict'` parameter (sync)
- THEIRS: Changed to async version
- Both changes affect the same call but are incompatible

**Resolution:**
```javascript
// Combine both: use async version + add mode parameter
const result = await calculateAsync(a, b, mode === 'strict');
```

**Note:** This assumes `calculateAsync` supports the third parameter. If not, may need to update the function signature.

#### Pattern 4: Delete vs Modify
```
<<<<<<< HEAD
function helper(x) {
  return x * 2 + offset;  // We modified: added '+ offset'
}
||||||| base
function helper(x) {
  return x * 2;
}
=======
// They deleted the entire function
>>>>>>> feature
```

**Analysis:**
- OURS: Modified function logic
- THEIRS: Deleted function entirely
- Need to determine: Why was it deleted? Is our modification still needed?

**Resolution Strategy:**
1. Check if function is still called anywhere
2. If not called: Accept deletion (THEIRS)
3. If still called: Keep modified version (OURS) or refactor to new approach
4. If they replaced it with different implementation: Migrate our changes to new implementation

#### Pattern 5: Rename + References
```
<<<<<<< HEAD
const userData = getUserData();
processUserData(userData);
validateUserData(userData);  // We added this line
||||||| base
const userData = getUserData();
processUserData(userData);
=======
const userProfile = getUserData();  // They renamed userData -> userProfile
processUserData(userProfile);
>>>>>>> feature
```

**Analysis:**
- OURS: Added new reference to `userData`
- THEIRS: Renamed `userData` to `userProfile` throughout
- Need to apply rename to our new line too

**Resolution:**
```javascript
const userProfile = getUserData();
processUserData(userProfile);
validateUserData(userProfile);  // Use their new name
```

## Modern Improvement: zdiff3

**zdiff3** (Zealous diff3) is a newer variant that extracts common lines outside conflict markers:

### Standard diff3:
```
<<<<<<< HEAD
function foo() {
  console.log('start');
  processA();
  console.log('end');
}
||||||| base
function foo() {
  console.log('start');
  console.log('end');
}
=======
function foo() {
  console.log('start');
  processB();
  console.log('end');
}
>>>>>>> feature
```

### zdiff3:
```
function foo() {
  console.log('start');
<<<<<<< HEAD
  processA();
||||||| base
=======
  processB();
>>>>>>> feature
  console.log('end');
}
```

**Benefit:** Conflict is more compact and focused on actual differences.

**Enable zdiff3:**
```bash
git config --global merge.conflictstyle zdiff3
```

**Enable standard diff3:**
```bash
git config --global merge.conflictstyle diff3
```

## Semantic Merge Concepts

### Text-Based vs Semantic Conflicts

**Text-based merge** (Git default):
- Treats files as lines of text
- Conflicts when same lines modified
- No understanding of code structure

**Semantic merge**:
- Parses code structure (classes, functions, methods)
- Understands language syntax
- Can merge changes to different methods even if lines overlap
- Tools: SemanticMerge, AI-powered tools

### Example: False Conflict

Text-based tools see this as a conflict:
```
class User {
<<<<<<< HEAD
  getName() { return this.name; }
  getEmail() { return this.email; }
||||||| base
  getName() { return this.name; }
=======
  getName() { return this.name; }
  getAge() { return this.age; }
>>>>>>> feature
}
```

Semantic tools recognize:
- OURS: Added `getEmail()` method
- THEIRS: Added `getAge()` method
- Both are compatible additions to different methods
- **Auto-resolve:** Keep both methods

## Resolution Workflow

### 1. Understand Context First
```bash
# See what each branch was trying to accomplish
git log --oneline HEAD ^origin/main
git log --oneline origin/main ^HEAD

# See who made the conflicting changes
git log --all --source -- path/to/conflicted/file.ts
```

### 2. Analyze Each Conflict

For each conflict marker block:
1. **Identify the change types:**
   - Addition (new lines)
   - Deletion (lines removed)
   - Modification (lines changed)
   - Movement (code reorganized)

2. **Determine intent:**
   - Bug fix
   - Feature addition
   - Refactoring
   - Performance optimization
   - Style/formatting change

3. **Classify conflict:**
   - Compatible: Changes to different concerns
   - Redundant: Same goal, different approach
   - Conflicting: Incompatible changes

### 3. Apply Resolution Pattern

Choose appropriate pattern from above based on classification.

### 4. Verify Resolution

After resolving:
```bash
# Ensure code compiles
npm run type-check

# Run tests
npm test

# Check linting
npm run lint

# Format code
npm run format
```

### 5. Document Complex Resolutions

For non-obvious resolutions, add a comment:
```typescript
// Merge resolution: Combined feature-A's validation (line 10)
// with feature-B's async handling (line 15)
const result = await validateAndProcess(data);
```

Or add to commit message:
```
Merge branch 'feature-B' into feature-A

Resolved conflicts in src/processor.ts:
- Combined validation logic from feature-A with async handling from feature-B
- Kept feature-A's error handling as it's more comprehensive
- Applied feature-B's parameter rename throughout
```

## Best Practices

### 1. Enable Better Conflict Markers
```bash
# Use zdiff3 (recommended)
git config --global merge.conflictstyle zdiff3

# Or use standard diff3
git config --global merge.conflictstyle diff3
```

### 2. Enable Rerere (Reuse Recorded Resolution)
```bash
git config --global rerere.enabled true
```

This records conflict resolutions and auto-applies them if the same conflict appears again (e.g., when rebasing).

### 3. Merge Frequently

Teams that merge more frequently report 70% fewer conflicts. Long-lived branches = more conflicts.

### 4. Use Iterative Resolution

For large conflicts:
1. Resolve one conflict at a time
2. Test after each resolution
3. Commit intermediate states if needed (use `git commit --no-verify` to skip hooks)
4. Don't try to resolve everything at once

### 5. Use Visual Merge Tools

For complex conflicts, use a merge tool:
```bash
git mergetool
```

Popular options:
- **VS Code** (built-in, supports diff3 display)
- **kdiff3** (free, shows all 3 versions side-by-side)
- **Beyond Compare** (paid, excellent UI)
- **P4Merge** (free, 3-way view)

### 6. Communicate with Team

For complex merges:
1. **Before resolving:** Check with the other developer about their intent
2. **After resolving:** Have them review the merge commit
3. **Document:** Explain non-obvious resolutions in commit message

### 7. Test Thoroughly

Merge conflicts can create **semantic conflicts** that compile but don't work:
```typescript
// OURS: Changed parameter name
function process(userData) { ... }

// THEIRS: Added call with old parameter name
const result = process(userId);  // ← Will pass type checking but break at runtime!
```

Always test merged code, even if it type-checks.

## Common Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Always Pick OURS or THEIRS
```bash
# Bad: Blindly accepting one side
git checkout --ours path/to/file.ts
git checkout --theirs path/to/file.ts
```

**Problem:** Discards potentially important changes from the other side.

**When it's OK:**
- Generated files (lockfiles, build artifacts)
- Files you're intentionally reverting
- Confirmed with the other developer

### ❌ Anti-Pattern 2: Ignoring the Base
```
# Trying to resolve by only looking at HEAD vs incoming
# without understanding what the original code was
```

**Problem:** Can't understand intent without seeing what changed.

**Solution:** Always use diff3/zdiff3 to see the base.

### ❌ Anti-Pattern 3: Fixing Bugs During Merge
```typescript
<<<<<<< HEAD
const result = calculate(a, b);  // We know this has a bug
=======
const result = compute(a, b);
>>>>>>> feature

// Bad: Fixing the bug while resolving
const result = calculate(a, b, { strict: true });  // Fixed the bug too!
```

**Problem:** Mixes merge resolution with bug fixes, making it hard to review and debug.

**Solution:**
1. First: Resolve the conflict (choose one or combine)
2. Then: Make bug fix in a separate commit
3. Or: Fix bug in both branches before merging

### ❌ Anti-Pattern 4: Resolving Without Testing
```bash
# Bad workflow
git merge feature-branch
# ... resolve conflicts ...
git commit
git push
```

**Problem:** Merged code might not work even if it compiles.

**Solution:**
```bash
git merge feature-branch
# ... resolve conflicts ...
npm run pre-commit  # Type check, lint, format
npm test            # Run tests
# Manual testing if UI changes
git commit
```

### ❌ Anti-Pattern 5: Making Large Changes During Resolution
```typescript
<<<<<<< HEAD
function processData(data) {
  return transform(data);
}
=======
async function processDataAsync(data) {
  return await asyncTransform(data);
}
>>>>>>> feature

// Bad: Major refactoring during merge resolution
async function processData(data, options = {}) {
  // Added new options parameter
  // Changed error handling
  // Added caching layer
  // etc...
}
```

**Problem:** Merge commits should be minimal and reviewable.

**Solution:**
1. Resolve the immediate conflict minimally
2. Make additional improvements in follow-up commits
3. Keep merge commits focused on resolution only

## Debugging Failed Resolutions

### The code compiles but doesn't work?

1. **Check for semantic conflicts:**
   - Function renamed but old name used somewhere
   - Parameter added but not passed in all call sites
   - Return type changed but caller expects old type

2. **Search for partial migrations:**
   ```bash
   # Find references to old names
   git grep "oldFunctionName"

   # Find TODO/FIXME added during merge
   git grep -E "(TODO|FIXME).*merge"
   ```

3. **Compare with both branches:**
   ```bash
   # What did each branch have that's now missing?
   git diff HEAD origin/main -- path/to/file.ts
   git diff HEAD feature-branch -- path/to/file.ts
   ```

### Tests fail after merge?

1. **Run tests from each branch separately:**
   ```bash
   git checkout origin/main
   npm test  # Should pass

   git checkout feature-branch
   npm test  # Should pass

   git checkout merge-commit
   npm test  # Fails? Find out why
   ```

2. **Check for missing dependencies:**
   - Did one branch add a new package?
   - Run `npm install` after merge

3. **Look for context-dependent code:**
   - Code that works differently when both changes are present
   - Example: Two branches both adding the same event listener

## When to Ask for Help

Resolve conflicts yourself when:
- Changes are to different parts of the code
- Intent is clear from diff3 comparison
- Resolution is straightforward (add both changes, pick one, etc.)

Ask the other developer when:
- Changes represent different architectural decisions
- You don't understand the intent of their changes
- The conflict affects core business logic
- Multiple files are interconnected in complex ways

Ask a senior developer / architect when:
- Conflict reveals deeper architectural issues
- Both approaches have significant tradeoffs
- Resolution requires changing the architecture
- Conflict affects critical production code

## Quick Reference: Resolution Checklist

```
□ Enabled diff3 or zdiff3 conflict style
□ Understood what each branch was trying to accomplish
□ For each conflict:
  □ Identified what OURS changed vs BASE
  □ Identified what THEIRS changed vs BASE
  □ Classified conflict type (compatible/redundant/conflicting)
  □ Applied appropriate resolution pattern
  □ Verified resolution makes semantic sense
□ Removed all conflict markers (<<<, |||, ===, >>>)
□ Ran type checking (npm run type-check)
□ Ran linting (npm run lint)
□ Ran tests (npm test)
□ Manually tested if UI changes
□ Documented complex resolutions in commit message
□ Had other developer review if needed
```

## Resources

- [Git SCM: Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)
- [Take the pain out of git conflict resolution: use diff3](https://blog.nilbus.com/take-the-pain-out-of-git-conflict-resolution-use-diff3/)
- [Finding Joy in Git Conflict Resolution](https://technology.doximity.com/articles/finding-joy-in-git-conflict-resolution)
- [Use zdiff3 for easier merge conflict resolution](https://mopacic.net/til/2024/02/24/zdiff3.html)

## Summary

**Key takeaways:**

1. **Always use diff3/zdiff3** - Seeing the base is crucial for understanding intent
2. **Classify before resolving** - Understand the type of conflict (compatible/redundant/conflicting)
3. **Apply patterns** - Use established resolution patterns for common scenarios
4. **Test thoroughly** - Conflicts can create semantic issues that compile but don't work
5. **Communicate** - Don't guess at intent, ask the other developer if unclear
6. **Document complex resolutions** - Help reviewers and future debuggers

**Remember:** Merge conflicts are not just about making the code compile. They're about **preserving the intent of both sets of changes** while maintaining code correctness and quality.
