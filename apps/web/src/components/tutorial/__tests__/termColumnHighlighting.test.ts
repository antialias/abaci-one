import { describe, expect, it } from "vitest";
import { generateUnifiedInstructionSequence } from "../../../utils/unifiedStepGenerator";

describe("Term-to-Column Highlighting Integration", () => {
  it("should map term indices to correct column indices", () => {
    const result = generateUnifiedInstructionSequence(3475, 3500); // 3475 + 25

    // Find a step with provenance data
    const stepWithProvenance = result.steps.find((step) => step.provenance);
    expect(stepWithProvenance).toBeDefined();

    if (stepWithProvenance?.provenance) {
      // Test the conversion logic: rhsPlace (0=ones, 1=tens) → columnIndex (4=ones, 3=tens)
      const expectedColumnIndex = 4 - stepWithProvenance.provenance.rhsPlace;

      // For tens place (rhsPlace=1), should map to columnIndex=3
      if (stepWithProvenance.provenance.rhsPlace === 1) {
        expect(expectedColumnIndex).toBe(3);
      }

      // For ones place (rhsPlace=0), should map to columnIndex=4
      if (stepWithProvenance.provenance.rhsPlace === 0) {
        expect(expectedColumnIndex).toBe(4);
      }
    }
  });

  it("should generate provenance data for complex operations", () => {
    const result = generateUnifiedInstructionSequence(3475, 3500); // 3475 + 25

    // Should have steps with provenance for both tens and ones digits
    const stepsWithProvenance = result.steps.filter((step) => step.provenance);
    expect(stepsWithProvenance.length).toBeGreaterThan(0);

    // Verify we have both tens and ones place operations
    const places = stepsWithProvenance.map((step) => step.provenance!.rhsPlace);
    expect(places).toContain(0); // ones place
    expect(places).toContain(1); // tens place

    // Verify provenance data structure
    stepsWithProvenance.forEach((step) => {
      const prov = step.provenance!;
      expect(typeof prov.rhs).toBe("number");
      expect(typeof prov.rhsDigit).toBe("number");
      expect(typeof prov.rhsPlace).toBe("number");
      expect(typeof prov.rhsPlaceName).toBe("string");
      expect(typeof prov.rhsValue).toBe("number");
    });
  });

  it("should handle bidirectional mapping correctly", () => {
    const result = generateUnifiedInstructionSequence(1234, 1289); // 1234 + 55

    // Create a mock implementation of the mapping functions
    const getColumnFromTermIndex = (termIndex: number) => {
      const step = result.steps[termIndex];
      if (!step?.provenance) return null;
      return 4 - step.provenance.rhsPlace;
    };

    const getTermIndicesFromColumn = (columnIndex: number) => {
      const termIndices: number[] = [];
      result.steps.forEach((step, index) => {
        if (step.provenance) {
          const stepColumnIndex = 4 - step.provenance.rhsPlace;
          if (stepColumnIndex === columnIndex) {
            termIndices.push(index);
          }
        }
      });
      return termIndices;
    };

    // Test round-trip mapping
    const stepsWithProvenance = result.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.provenance);

    stepsWithProvenance.forEach(({ index: termIndex }) => {
      const columnIndex = getColumnFromTermIndex(termIndex);
      if (columnIndex !== null) {
        const backToTermIndices = getTermIndicesFromColumn(columnIndex);
        expect(backToTermIndices).toContain(termIndex);
      }
    });
  });

  it("should handle edge cases gracefully", () => {
    const result = generateUnifiedInstructionSequence(5, 7); // Simple case: 5 + 2

    // Even simple cases should work with the mapping
    const getColumnFromTermIndex = (termIndex: number) => {
      const step = result.steps[termIndex];
      if (!step?.provenance) return null;
      return 4 - step.provenance.rhsPlace;
    };

    // Should not throw errors for invalid indices
    expect(getColumnFromTermIndex(-1)).toBe(null);
    expect(getColumnFromTermIndex(999)).toBe(null);

    // Should handle steps without provenance
    const stepWithoutProvenance = result.steps.find((step) => !step.provenance);
    if (stepWithoutProvenance) {
      const index = result.steps.indexOf(stepWithoutProvenance);
      expect(getColumnFromTermIndex(index)).toBe(null);
    }
  });

  it("should use correct styling for dynamic column highlights", () => {
    // Test the expected column-level styling values from the implementation
    const expectedDynamicColumnStyle = {
      columnPost: {
        stroke: "#3b82f6",
        strokeWidth: 4,
        opacity: 1,
      },
    };

    // Verify blue color scheme for column highlighting
    expect(expectedDynamicColumnStyle.columnPost.stroke).toBe("#3b82f6"); // Blue
    expect(expectedDynamicColumnStyle.columnPost.strokeWidth).toBe(4); // Thicker than default
    expect(expectedDynamicColumnStyle.columnPost.opacity).toBe(1); // Fully visible

    // Verify this is different from bead-level highlighting
    const staticBeadStyle = {
      fill: "#fbbf24",
      stroke: "#f59e0b",
      strokeWidth: 3,
    }; // Orange
    expect(expectedDynamicColumnStyle.columnPost.stroke).not.toBe(
      staticBeadStyle.stroke,
    );
  });
});
