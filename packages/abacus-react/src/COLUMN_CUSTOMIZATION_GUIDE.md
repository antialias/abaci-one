# AbacusReact Column Customization Guide

This guide explains how to use the comprehensive column customization features in the AbacusReact component.

## Overview

The AbacusReact component provides powerful column-level customization through the `customStyles.columns` API. This allows you to style specific columns individually for educational highlights, visual emphasis, and interactive feedback.

## Quick Start

```typescript
<AbacusReact
  value={1234}
  columns={4}
  customStyles={{
    columns: {
      2: { // Tens column
        columnPost: {
          stroke: '#3b82f6',
          strokeWidth: 4,
          opacity: 1
        }
      }
    }
  }}
/>
```

## Column Customization API

### Structure

```typescript
customStyles: {
  columns: {
    [columnIndex: number]: {
      heavenBeads?: BeadStyle;      // Style heaven beads in this column
      earthBeads?: BeadStyle;       // Style earth beads in this column
      activeBeads?: BeadStyle;      // Style active beads in this column
      inactiveBeads?: BeadStyle;    // Style inactive beads in this column
      columnPost?: ColumnPostStyle; // Style the rod/post of this column
      numerals?: NumeralStyle;      // Style the numbers below this column
      numeralContainer?: NumeralStyle; // Style the number container
    }
  }
}
```

### Style Types

#### BeadStyle

```typescript
interface BeadStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cursor?: string;
  className?: string;
}
```

#### ColumnPostStyle

```typescript
interface ColumnPostStyle {
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}
```

#### NumeralStyle

```typescript
interface NumeralStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  className?: string;
}
```

## Common Use Cases

### 1. Tutorial Highlighting

Highlight columns during educational sequences:

```typescript
const tutorialStyles = {
  columns: {
    [activeColumnIndex]: {
      columnPost: {
        stroke: "#3b82f6",
        strokeWidth: 4,
        opacity: 1,
      },
      numerals: {
        color: "#1d4ed8",
        fontWeight: "bold",
        backgroundColor: "#dbeafe",
        borderRadius: 4,
      },
    },
  },
};
```

### 2. Interactive Feedback

Show hover and click states:

```typescript
const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

const dynamicStyles = useMemo(
  () => ({
    columns: {
      ...(hoveredColumn !== null && {
        [hoveredColumn]: {
          columnPost: { stroke: "#3b82f6", strokeWidth: 4 },
          heavenBeads: { stroke: "#3b82f6", strokeWidth: 2 },
          earthBeads: { stroke: "#3b82f6", strokeWidth: 2 },
        },
      }),
    },
  }),
  [hoveredColumn],
);
```

### 3. Place Value Education

Color-code place values:

```typescript
const placeValueStyles = {
  columns: {
    0: {
      // Thousands
      columnPost: { stroke: "#dc2626", strokeWidth: 3 },
      numerals: { color: "#991b1b", fontWeight: "bold" },
    },
    1: {
      // Hundreds
      columnPost: { stroke: "#ea580c", strokeWidth: 3 },
      numerals: { color: "#c2410c", fontWeight: "bold" },
    },
    2: {
      // Tens
      columnPost: { stroke: "#16a34a", strokeWidth: 3 },
      numerals: { color: "#15803d", fontWeight: "bold" },
    },
    3: {
      // Ones
      columnPost: { stroke: "#2563eb", strokeWidth: 3 },
      numerals: { color: "#1d4ed8", fontWeight: "bold" },
    },
  },
};
```

## Integration with Tutorial Systems

### Term-to-Column Highlighting

For math decomposition tutorials where users hover over terms to highlight corresponding abacus columns:

```typescript
// In your tutorial context
const [activeTermIndices, setActiveTermIndices] = useState<Set<number>>(new Set());

// Map terms to columns
const getColumnFromTermIndex = (termIndex: number) => {
  const step = unifiedSteps[termIndex];
  if (!step?.provenance) return null;
  return 4 - step.provenance.rhsPlace; // Convert place value to column index
};

// Generate dynamic column highlights
const dynamicColumnHighlights = useMemo(() => {
  const highlights: Record<number, any> = {};
  activeTermIndices.forEach(termIndex => {
    const columnIndex = getColumnFromTermIndex(termIndex);
    if (columnIndex !== null) {
      highlights[columnIndex] = {
        columnPost: {
          stroke: '#3b82f6',
          strokeWidth: 4,
          opacity: 1
        }
      };
    }
  });
  return highlights;
}, [activeTermIndices, getColumnFromTermIndex]);

// Apply to AbacusReact
<AbacusReact
  customStyles={{ columns: dynamicColumnHighlights }}
  callbacks={{
    onColumnClick: (columnIndex) => {
      // Handle bidirectional interaction
      const termIndices = getTermIndicesFromColumn(columnIndex);
      setActiveTermIndices(new Set(termIndices));
    }
  }}
/>
```

## Performance Optimization

### Memoization

Always memoize dynamic style generation:

```typescript
// ✅ Good
const customStyles = useMemo(
  () => ({
    columns: {
      [activeColumn]: {
        columnPost: { stroke: "#3b82f6", strokeWidth: 4 },
      },
    },
  }),
  [activeColumn],
);

// ❌ Bad - recreates on every render
const customStyles = {
  columns: {
    [activeColumn]: {
      columnPost: { stroke: "#3b82f6", strokeWidth: 4 },
    },
  },
};
```

### Minimize Re-renders

Only update styles when interaction state actually changes:

```typescript
const [interactionState, setInteractionState] = useState({
  hoveredColumn: null,
  selectedColumns: new Set(),
});

// Update state only when needed
const handleColumnHover = useCallback((columnIndex: number) => {
  setInteractionState((prev) =>
    prev.hoveredColumn !== columnIndex
      ? { ...prev, hoveredColumn: columnIndex }
      : prev,
  );
}, []);
```

## Best Practices

### Visual Design

1. **Use column post highlighting first** - Less visually intrusive than changing bead colors
2. **Coordinate colors** - Maintain visual harmony across columns
3. **Progressive disclosure** - Show one concept at a time
4. **Consistent associations** - Same colors for same concepts

### Educational Design

1. **Clear visual hierarchy** - Make important columns stand out
2. **Semantic colors** - Green for correct, red for errors, blue for active
3. **Layer styling** - Combine column posts, backgrounds, and numbers
4. **Consider accessibility** - Ensure sufficient color contrast

### Technical Implementation

1. **Memoize expensive calculations** - Use `useMemo` for dynamic styles
2. **Handle edge cases** - Check for null/undefined values
3. **Test interactions** - Verify hover and click behaviors
4. **Use TypeScript** - Leverage type safety for style objects

## Troubleshooting

### Column Highlights Not Appearing

1. **Check column indices** - Remember they're 0-based from left to right
2. **Verify style structure** - Ensure proper nesting under `customStyles.columns`
3. **Check for overrides** - Individual bead styles take precedence
4. **Inspect DOM** - Use browser dev tools to verify styles are applied

### Performance Issues

1. **Profile re-renders** - Use React DevTools Profiler
2. **Memoize style objects** - Prevent unnecessary recalculations
3. **Limit active highlights** - Too many can impact performance
4. **Consider component splitting** - Separate static and dynamic parts

## Related Documentation

- **[Storybook Examples](http://localhost:6009)** - Interactive examples and documentation
- **[Column Customization Stories](http://localhost:6009/?path=/story/soroban-column-customization--basic-column-highlighting)** - Comprehensive column styling examples
- **[Core Examples](http://localhost:6009/?path=/story/soroban-abacusreact-core-examples--interactive-abacus)** - Basic usage patterns
- **[Tutorial System](http://localhost:6009/?path=/story/soroban-abacusreact-core-examples--tutorial-example)** - Advanced tutorial features

## Examples in Action

The column customization system is actively used in:

- **Tutorial Player** (`apps/web/src/components/tutorial/TutorialPlayer.tsx`) - Dynamic term-to-column highlighting
- **Memory Quiz Game** - Interactive column feedback
- **Educational Storybook Examples** - Comprehensive showcases

This system provides the foundation for creating sophisticated educational interfaces around the abacus component.
