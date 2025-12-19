# Answer Key Feature Implementation Plan

## Design Decisions

1. **Format**: Compact list (e.g., `1. 45 + 27 = 72`)
2. **Placement**: End of PDF (after all worksheet pages)
3. **Problem numbers**: Match worksheet config - show if `displayRules.problemNumbers !== 'never'`

## Implementation Steps

### 1. Add config option

- **File**: `types.ts`
- Add `includeAnswerKey?: boolean` to `WorksheetFormState`
- Default: `false`

### 2. Update validation

- **File**: `validation.ts`
- Pass through `includeAnswerKey` in validated config

### 3. Create answer key generator

- **File**: `typstGenerator.ts` (new function)
- Function: `generateAnswerKeyTypst(config, problems, showProblemNumbers)`
- Output: Typst source for answer key page(s)
- Format: Compact multi-column list

  ```
  Answer Key

  1. 45 + 27 = 72      11. 33 + 18 = 51
  2. 89 + 34 = 123     12. 56 + 77 = 133
  ...
  ```

### 4. Integrate into page generation

- **File**: `typstGenerator.ts`
- After worksheet pages, if `includeAnswerKey`:
  ```typescript
  if (config.includeAnswerKey) {
    const answerKeyPages = generateAnswerKeyTypst(
      config,
      problems,
      showProblemNumbers,
    );
    return [...worksheetPages, ...answerKeyPages];
  }
  ```

### 5. Add UI toggle

- **File**: Find worksheet config form component
- Add checkbox: "Include Answer Key"

### 6. Update preview (optional)

- Show answer key pages in preview carousel

## Answer Key Typst Template

```typst
#set page(paper: "us-letter", margin: 0.5in)
#set text(font: "New Computer Modern Math", size: 12pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[Answer Key]
  #v(0.5em)
  #text(size: 12pt, fill: gray)[{worksheet name}]
]

#v(1em)

#columns(3, gutter: 1em)[
  // Problem 1
  #text[*1.* 45 + 27 = *72*]

  // Problem 2
  #text[*2.* 89 − 34 = *55*]

  // etc...
]
```

## Files to Modify

1. `types.ts` - Add `includeAnswerKey` field
2. `validation.ts` - Pass through new field
3. `typstGenerator.ts` - Add answer key generation
4. Worksheet form component - Add UI toggle
5. Preview component (optional) - Show answer key pages
