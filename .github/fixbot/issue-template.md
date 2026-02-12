# Fixbot Issue Template

Use this exact format when creating issues. Replace all `<placeholders>` with actual values.

```markdown
## Failure Summary

**Class:** `<failure-class>`
**Workflow:** <workflow-name>
**Run ID:** <run-id>
**SHA:** `<head-sha>`
**Branch:** `<head-branch>`

## Error Output

```
<exact error messages from the logs, trimmed to the relevant portion>
```

## Affected Files

- `<file-path>` (line <N>)
- `<file-path>` (line <N>)

## Root Cause

<1-2 sentence explanation of why this failed>

## Immediate Fix

<specific, actionable instructions for the fix agent — e.g., "Add `import { useState } from 'react'` to line 1 of `apps/web/src/components/Foo.tsx`">

## Verification Command

```bash
<the exact command to verify the fix, from the verification table>
```
```
