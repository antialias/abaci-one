# Worksheet Generator

**Create customizable math worksheets with progressive difficulty, problem space validation, and Typst-powered PDF generation.**

## Features

- **Addition & Subtraction**: Full support for multi-digit problems (1-5 digits)
- **Progressive Difficulty**: Smart Mode automatically scales difficulty based on skill level
- **Problem Space Validation**: Real-time warnings when configurations have limited unique problems
- **Typst Integration**: High-quality PDF generation with customizable layouts
- **Display Rules**: Configurable visual aids (carry boxes, ten frames, place-value colors, etc.)
- **Mastery System**: Adaptive learning with skill tracking and progression

## Quick Start

```typescript
// Access the worksheet studio at /create/worksheets/addition
// Configure settings, preview problems, download PDF
```

## Architecture Documentation

### Core Systems

**Problem Generation** - [`PROBLEM_GENERATION_ARCHITECTURE.md`](./PROBLEM_GENERATION_ARCHITECTURE.md)

- Complete technical documentation of problem generation algorithms
- Two generation strategies: generate-all + shuffle (small spaces) vs retry-based (large spaces)
- Problem space estimation and duplicate risk calculation
- Edge cases: single-digit constraints, mixed mastery mode, subtraction borrowing
- Performance considerations and testing guide

**Quick Reference** - [`.claude/PROBLEM_GENERATION.md`](../../../.claude/PROBLEM_GENERATION.md)

- Fast lookup for developers and Claude Code
- Strategy selection logic with code examples
- Debugging commands and common modifications
- Q&A troubleshooting section

**UX Improvements** - [`USER_WARNING_IMPROVEMENTS.md`](./USER_WARNING_IMPROVEMENTS.md)

- Recommended UI enhancements for problem space warnings
- Design mockups for config panel indicators
- Implementation phases and component structure

### Additional Documentation

- **Configuration Schema** - [`CONFIG_SCHEMA_GUIDE.md`](./CONFIG_SCHEMA_GUIDE.md) - Complete guide to worksheet configuration
- **Smart Difficulty** - [`addition/SMART_DIFFICULTY_SPEC.md`](./addition/SMART_DIFFICULTY_SPEC.md) - Smart Mode progression spec
- **Subtraction System** - [`SUBTRACTION_AND_OPERATOR_PLAN.md`](./SUBTRACTION_AND_OPERATOR_PLAN.md) - Subtraction implementation
- **⚠️ Operator-Specific Settings** - [`OPERATOR_SPECIFIC_SETTINGS.md`](./OPERATOR_SPECIFIC_SETTINGS.md) - **[NEEDS REFACTORING]** Mixed mode architecture & refactoring plan

## Key Concepts

### Problem Space

The "problem space" is the set of all unique problems possible given your constraints:

- **1-digit 100% regrouping**: Only 45 unique problems exist (e.g., 2+8, 3+7, 4+9...)
- **2-digit mixed regrouping**: ~4,000 unique problems
- **3-digit problems**: ~400,000 unique problems

**Why it matters**: Requesting more problems than exist in the space results in duplicates. The system warns you when this happens.

### Generation Strategies

**Generate-All + Shuffle** (Small spaces < 10,000)

- Enumerates all valid problems upfront
- Shuffles deterministically
- Zero retries, guaranteed coverage
- Cycles through full set when requesting more than available

**Retry-Based** (Large spaces ≥ 10,000)

- Randomly generates problems
- Retries on duplicates (up to 100 times)
- Allows some duplicates to prevent performance issues

### Progressive Difficulty

**Smart Mode** - Automatically adjusts difficulty based on:

- Student skill level (tracked via mastery system)
- Previous performance
- Target regrouping/borrowing probability

**Manual Mode** - You control:

- Digit range (1-5 digits)
- Regrouping/borrowing probability (0-100%)
- Progressive vs constant difficulty

## Common Edge Cases

### Single-Digit 100% Regrouping

**Problem**: Only 45 unique problems where both operands are 0-9 and result requires carrying.

**Solution**:

- Reduce pages to 1-2 (20-40 problems)
- Lower regrouping to 50%
- Increase to 2-digit problems

### Mastery + Mixed Mode

**Problem**: Addition and subtraction use separate skill-based configs, making combined problem space estimation complex.

**Solution**: Validation is skipped for this mode. Each operator uses its own config independently.

### Subtraction Multiple Borrowing

**Problem**: 1-2 digit subtraction cannot have 2+ borrow operations (mathematical impossibility).

**Solution**: System automatically falls back to single-borrow problems for these ranges.

## File Structure

```
worksheets/
├── README.md (this file)
├── PROBLEM_GENERATION_ARCHITECTURE.md    # Technical deep-dive
├── USER_WARNING_IMPROVEMENTS.md          # UX enhancement plan
├── problemGenerator.ts                   # Core generation logic
├── utils/
│   └── validateProblemSpace.ts          # Space estimation
├── components/
│   ├── config-panel/                    # Configuration UI
│   └── worksheet-preview/               # Preview + warnings
│       ├── WorksheetPreviewContext.tsx  # Validation state
│       └── DuplicateWarningBanner.tsx   # Warning display
└── addition/
    ├── SMART_DIFFICULTY_SPEC.md         # Smart Mode spec
    └── page.tsx                         # Addition worksheet page
```

## Testing

```bash
# Type check
npm run type-check

# Run all checks before committing
npm run pre-commit
```

See `PROBLEM_GENERATION_ARCHITECTURE.md` for comprehensive testing checklist.

## Contributing

When modifying problem generation:

1. Read `PROBLEM_GENERATION_ARCHITECTURE.md` for complete system understanding
2. Check `.claude/PROBLEM_GENERATION.md` for quick reference
3. Run the testing checklist
4. Update inline comments if changing generation strategy
5. Consider UX impact (see `USER_WARNING_IMPROVEMENTS.md`)

## Related Documentation

**Parent**: [`apps/web/README.md`](../../../README.md) - Web application overview
**Abacus Component**: [`packages/abacus-react/README.md`](../../../../../packages/abacus-react/README.md) - Abacus visualization library
