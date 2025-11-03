# Migration Guide: useAbacusState → useAbacusPlaceStates

## Overview

The `useAbacusState` hook has been **deprecated** in favor of the new `useAbacusPlaceStates` hook. This migration is part of a larger architectural improvement to eliminate array-based column indexing in favor of native place-value semantics.

## Why Migrate?

### Problems with `useAbacusState` (deprecated)
- ❌ Uses **array indices** for columns (0=leftmost, requires totalColumns)
- ❌ Requires threading `totalColumns` through component tree
- ❌ Index math creates confusion: `columnIndex = totalColumns - 1 - placeValue`
- ❌ Prone to off-by-one errors
- ❌ No support for BigInt (large numbers >15 digits)

### Benefits of `useAbacusPlaceStates` (new)
- ✅ Uses **place values** directly (0=ones, 1=tens, 2=hundreds)
- ✅ Native semantic meaning, no index conversion needed
- ✅ Cleaner architecture with `Map<PlaceValue, State>`
- ✅ Supports both `number` and `BigInt` for large values
- ✅ Type-safe with `ValidPlaceValues` (0-9)
- ✅ No totalColumns threading required

## Migration Steps

### 1. Update Hook Usage

**Before (deprecated):**
```tsx
import { useAbacusState } from '@soroban/abacus-react';

function MyComponent() {
  const {
    value,
    setValue,
    columnStates,  // Array of column states
    getColumnState,
    setColumnState,
    toggleBead
  } = useAbacusState(123, 5); // totalColumns=5

  // Need to calculate indices
  const onesColumnIndex = 4; // rightmost
  const tensColumnIndex = 3; // second from right

  return <AbacusReact value={value} columns={5} />;
}
```

**After (new):**
```tsx
import { useAbacusPlaceStates } from '@soroban/abacus-react';

function MyComponent() {
  const {
    value,
    setValue,
    placeStates,   // Map<PlaceValue, PlaceState>
    getPlaceState,
    setPlaceState,
    toggleBeadAtPlace
  } = useAbacusPlaceStates(123, 4); // maxPlaceValue=4 (0-4 = 5 columns)

  // Direct place value access - no index math!
  const onesState = getPlaceState(0);
  const tensState = getPlaceState(1);

  return <AbacusReact value={value} columns={5} />;
}
```

### 2. Update State Access Patterns

**Before (array indexing):**
```tsx
// Get state for tens column (need to know position in array)
const tensIndex = columnStates.length - 2; // second from right
const tensState = columnStates[tensIndex];
```

**After (place value):**
```tsx
// Get state for tens place - no calculation needed!
const tensState = getPlaceState(1); // 1 = tens place
```

### 3. Update State Manipulation

**Before:**
```tsx
// Toggle bead in ones column (need BeadConfig with column index)
toggleBead({
  type: 'earth',
  value: 1,
  active: false,
  position: 2,
  placeValue: 0 // This was confusing - had place value BUT operated on column index
});
```

**After:**
```tsx
// Toggle bead at ones place - clean and semantic
toggleBeadAtPlace({
  type: 'earth',
  value: 1,
  active: false,
  position: 2,
  placeValue: 0 // Now actually used as place value!
});
```

### 4. Update Iteration Logic

**Before (array iteration):**
```tsx
columnStates.forEach((state, columnIndex) => {
  const placeValue = columnStates.length - 1 - columnIndex; // Manual conversion
  console.log(`Column ${columnIndex} (place ${placeValue}):`, state);
});
```

**After (Map iteration):**
```tsx
placeStates.forEach((state, placeValue) => {
  console.log(`Place ${placeValue}:`, state); // Direct access, no conversion!
});
```

## API Comparison

### useAbacusState (deprecated)

```typescript
function useAbacusState(
  initialValue?: number,
  targetColumns?: number
): {
  value: number;
  setValue: (newValue: number) => void;
  columnStates: ColumnState[];      // Array
  getColumnState: (columnIndex: number) => ColumnState;
  setColumnState: (columnIndex: number, state: ColumnState) => void;
  toggleBead: (bead: BeadConfig) => void;
}
```

### useAbacusPlaceStates (new)

```typescript
function useAbacusPlaceStates(
  controlledValue?: number | bigint,
  maxPlaceValue?: ValidPlaceValues
): {
  value: number | bigint;
  setValue: (newValue: number | bigint) => void;
  placeStates: PlaceStatesMap;      // Map
  getPlaceState: (place: ValidPlaceValues) => PlaceState;
  setPlaceState: (place: ValidPlaceValues, state: PlaceState) => void;
  toggleBeadAtPlace: (bead: BeadConfig) => void;
}
```

## Complete Example

### Before: Array-based (deprecated)

```tsx
import { useState } from 'react';
import { useAbacusState, AbacusReact } from '@soroban/abacus-react';

function DeprecatedExample() {
  const { value, setValue, columnStates } = useAbacusState(0, 3);

  const handleAddTen = () => {
    // Need to know array position of tens column
    const totalColumns = columnStates.length;
    const tensColumnIndex = totalColumns - 2; // Complex!
    const current = columnStates[tensColumnIndex];

    // Increment tens digit
    const currentTensValue = (current.heavenActive ? 5 : 0) + current.earthActive;
    const newTensValue = (currentTensValue + 1) % 10;
    setValue(value + 10);
  };

  return (
    <div>
      <AbacusReact value={value} columns={3} interactive />
      <button onClick={handleAddTen}>Add 10</button>
    </div>
  );
}
```

### After: Place-value based (new)

```tsx
import { useState } from 'react';
import { useAbacusPlaceStates, AbacusReact } from '@soroban/abacus-react';

function NewExample() {
  const { value, setValue, getPlaceState } = useAbacusPlaceStates(0, 2);

  const handleAddTen = () => {
    // Direct access to tens place - simple!
    const tensState = getPlaceState(1); // 1 = tens

    // Increment tens digit
    const currentTensValue = (tensState.heavenActive ? 5 : 0) + tensState.earthActive;
    const newTensValue = (currentTensValue + 1) % 10;

    if (typeof value === 'number') {
      setValue(value + 10);
    } else {
      setValue(value + 10n);
    }
  };

  return (
    <div>
      <AbacusReact value={value} columns={3} interactive />
      <button onClick={handleAddTen}>Add 10</button>
    </div>
  );
}
```

## BigInt Support (New Feature)

The new hook supports BigInt for numbers exceeding JavaScript's safe integer limit:

```tsx
const { value, setValue } = useAbacusPlaceStates(
  123456789012345678901234567890n, // BigInt!
  29 // 30 digits (place values 0-29)
);

console.log(typeof value); // "bigint"
```

## Type Safety Improvements

The new hook uses branded types and strict typing:

```tsx
import type {
  ValidPlaceValues,  // 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  PlaceState,
  PlaceStatesMap
} from '@soroban/abacus-react';

// Type-safe place value access
const onesState: PlaceState = getPlaceState(0);
const tensState: PlaceState = getPlaceState(1);

// Compile-time error for invalid place values
const invalidState = getPlaceState(15); // Error if maxPlaceValue < 15
```

## Timeline

- **Current**: Both hooks available, `useAbacusState` marked `@deprecated`
- **Next major version**: `useAbacusState` will be removed
- **Recommendation**: Migrate as soon as possible

## Getting Help

If you encounter issues during migration:
1. Check the [README.md](./README.md) for updated examples
2. Review [Storybook stories](./src) for usage patterns
3. Open an issue at https://github.com/anthropics/claude-code/issues

## Summary

| Feature | useAbacusState (old) | useAbacusPlaceStates (new) |
|---------|---------------------|---------------------------|
| Architecture | Array-based columns | Map-based place values |
| Index math | Required | Not needed |
| Semantic meaning | Indirect | Direct |
| BigInt support | ❌ No | ✅ Yes |
| Type safety | Basic | Enhanced |
| Column threading | Required | Not required |
| **Status** | ⚠️ Deprecated | ✅ Recommended |

**Bottom line:** The new hook eliminates complexity and makes your code more maintainable. Migration is straightforward - primarily renaming and removing index calculations.
