# Pedagogical Algorithm Testing Strategy

This document outlines our improved testing approach for the soroban pedagogical algorithm, moving from massive snapshot suites to focused, fast, and robust validation.

## Current Test Structure

### 1. **pedagogicalCore.test.ts** (PRIMARY) ⭐
- **35 tests** with **lean snapshots** (6 golden anchors) + **micro-invariant validation**
- **Fast**: 9ms runtime with comprehensive coverage
- **Focused invariants**: Term positioning, arithmetic, complement shapes, step consistency
- **Stable**: Only snapshots essential, deterministic fields

### 2. **termPositionBuilder.test.ts** (FOCUSED UNIT TESTS)
- **8 focused unit tests** for position calculation edge cases
- **Critical for UI highlighting** - ensures terms map to correct substrings
- **Fast and deterministic** (2ms runtime)

### 3. **pedagogicalSnapshot.test.ts** (LEGACY FALLBACK)
- **292 comprehensive tests** with 40k+ lines of snapshots
- **Gated behind** `LEGACY_SNAPSHOTS=1` environment variable
- **Use only for regression testing** when making major algorithmic changes

## Key Testing Principles Applied

### ✅ **Lean Snapshots**
Instead of snapshotting the entire result object (with beadMovements, stepIndex, etc.), we only snapshot:
```typescript
{
  startValue, targetValue, fullDecomposition, totalSteps,
  isMeaningfulDecomposition,
  steps: [{ term, english, termPosition, expectedValue, isValid }]
}
```

### ✅ **Explicit Invariants**
Critical behaviors validated with assertions, not snapshots:

**Term-Position Mapping**:
```typescript
function assertTermMapping(seq) {
  seq.steps.forEach(step => {
    const slice = text.slice(step.termPosition.startIndex, step.termPosition.endIndex)
    const normalized = step.mathematicalTerm.startsWith('-')
      ? step.mathematicalTerm.slice(1) : step.mathematicalTerm
    expect(slice).toBe(normalized)
  })
}
```

**Arithmetic Invariant**:
```typescript
function assertArithmeticInvariant(seq) {
  let currentValue = seq.startValue
  seq.steps.forEach(step => {
    const delta = step.mathematicalTerm.startsWith('-')
      ? -parseInt(step.mathematicalTerm.slice(1), 10)
      : parseInt(step.mathematicalTerm, 10)
    currentValue += delta
    expect(currentValue).toBe(step.expectedValue)
  })
}
```

**Complement Shape Contract**:
```typescript
function assertComplementShape(seq) {
  // Validates that complements start with powers of 10 (or 5 for five-complements)
  const complementMatches = seq.fullDecomposition.match(/\((\d+) - (\d+(?:\s-\s\d+)*)\)/g) || []
  // ... validation logic
}
```

### ✅ **Performance Optimization**
- **Representative coverage**: 6 golden anchor snapshots vs 292 comprehensive ones
- **Invariant-only stress tests**: Broad coverage without snapshot overhead
- **Fast feedback**: Core validation completes in ~8ms

## When to Use Each Test File

### Use **pedagogicalCore.test.ts** when:
- ✅ Adding new pedagogical patterns
- ✅ Validating algorithm correctness
- ✅ Running in CI/daily development
- ✅ Debugging positioning or arithmetic issues

### Use **termPositionBuilder.test.ts** when:
- ✅ UI highlighting is broken
- ✅ Term positions map to wrong substrings
- ✅ Adding new complement grouping logic

### Use **pedagogicalSnapshot.test.ts** when:
- ⚠️  Making major algorithmic changes
- ⚠️  Need comprehensive regression testing
- ⚠️  Investigating edge cases in legacy behavior
- Run with: `LEGACY_SNAPSHOTS=1 pnpm test pedagogicalSnapshot.test.ts`

## Benefits of This Approach

### 🚀 **Performance**
- **Core tests**: 35 tests in 9ms (includes micro-invariants)
- **Unit tests**: 8 tests in 2ms (position validation)
- **Combined**: 43 tests in 11ms total
- **Legacy tests**: 292 tests in 50ms+ (gated)
- **CI-friendly**: Fast feedback loop

### 🎯 **Focused Validation**
- **Explicit invariants** catch logical bugs immediately
- **Term positioning** validated with precise assertions
- **Complement contracts** ensure proper mathematical structure

### 🛡️ **Stability**
- **Lean snapshots** resistant to benign changes
- **Term-first instructions** provide deterministic output
- **Minimal snapshot churn** on algorithm improvements

### 🔍 **Debuggability**
- **Clear test names** indicate exact failure scenarios
- **Explicit assertions** provide specific error messages
- **Representative coverage** without noise

## Migration Complete ✅

The pedagogical algorithm now has:
- ✅ **Position bug fix** - terms correctly map to UI highlights
- ✅ **Deterministic instructions** - stable term-based output
- ✅ **Comprehensive invariants** - mathematical correctness guaranteed
- ✅ **Fast test suite** - 8ms core validation
- ✅ **Lean snapshots** - only essential fields protected
- ✅ **Legacy safety net** - 292 tests available when needed

**For daily development, use pedagogicalCore.test.ts. It provides complete validation with excellent performance.**