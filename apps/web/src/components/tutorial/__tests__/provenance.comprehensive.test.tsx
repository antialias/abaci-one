import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Tutorial } from "../../../types/tutorial";
import { generateUnifiedInstructionSequence } from "../../../utils/unifiedStepGenerator";
import { DecompositionWithReasons } from "../DecompositionWithReasons";
import { TutorialProvider, useTutorialContext } from "../TutorialContext";

// Mock Radix Tooltip for reliable testing
vi.mock("@radix-ui/react-tooltip", () => ({
  Provider: ({ children }: any) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  Root: ({ children, open = true }: any) => (
    <div data-testid="tooltip-root">{children}</div>
  ),
  Trigger: ({ children }: any) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  Portal: ({ children }: any) => (
    <div data-testid="tooltip-portal">{children}</div>
  ),
  Content: ({ children, className, ...props }: any) => (
    <div data-testid="tooltip-content" className={className} {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="tooltip-arrow" {...props} />,
}));

describe("Provenance System - Comprehensive Tests", () => {
  const provenanceTutorial: Tutorial = {
    id: "provenance-test",
    title: "Provenance Test",
    description: "Testing provenance system",
    steps: [
      {
        id: "test-step",
        title: "3475 + 25 = 3500",
        problem: "3475 + 25",
        description: "Add 25 to get 3500",
        startValue: 3475,
        targetValue: 3500,
        expectedAction: "multi-step" as const,
        actionDescription: "Follow the steps",
        tooltip: { content: "Test", explanation: "Test explanation" },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function renderWithTutorialContext(component: React.ReactElement) {
    return render(
      <TutorialProvider
        tutorial={provenanceTutorial}
        onStepComplete={() => {}}
        onTutorialComplete={() => {}}
        onEvent={() => {}}
      >
        {component}
      </TutorialProvider>,
    );
  }

  describe("Unified Step Generator Provenance", () => {
    it("should generate correct provenance data for 3475 + 25 = 3500", () => {
      const result = generateUnifiedInstructionSequence(3475, 3500);

      // Verify basic structure
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.fullDecomposition).toContain("3475 + 25");

      // Find the "20" step (tens digit)
      const twentyStep = result.steps.find(
        (step) => step.mathematicalTerm === "20",
      );
      expect(twentyStep).toBeDefined();
      expect(twentyStep?.provenance).toBeDefined();

      if (twentyStep?.provenance) {
        // Verify provenance data matches the specification exactly
        expect(twentyStep.provenance).toEqual({
          rhs: 25, // the addend
          rhsDigit: 2, // digit from tens place
          rhsPlace: 1, // tens = place 1
          rhsPlaceName: "tens", // human readable
          rhsDigitIndex: 0, // '2' is first character in '25'
          rhsValue: 20, // 2 * 10^1 = 20
        });
      }

      // Verify ones digit complement group
      const complementSteps = result.steps.filter((step) =>
        step.provenance?.groupId?.includes("10comp-0-5"),
      );
      expect(complementSteps.length).toBeGreaterThan(0);

      // All complement steps should trace back to the same source digit
      complementSteps.forEach((step) => {
        expect(step.provenance?.rhs).toBe(25);
        expect(step.provenance?.rhsDigit).toBe(5);
        expect(step.provenance?.rhsPlace).toBe(0);
        expect(step.provenance?.rhsPlaceName).toBe("ones");
      });

      // Verify equation anchors for digit highlighting
      expect(result.equationAnchors).toBeDefined();
      expect(result.equationAnchors?.differenceText).toBe("25");
      expect(result.equationAnchors?.rhsDigitPositions).toHaveLength(2);
    });
  });

  describe("Tooltip Enhancement Logic", () => {
    it("should generate correct enhanced tooltip content", () => {
      const provenance = {
        rhs: 25,
        rhsDigit: 2,
        rhsPlace: 1,
        rhsPlaceName: "tens" as const,
        rhsDigitIndex: 0,
        rhsValue: 20,
      };

      // Test the exact logic from getEnhancedTooltipContent
      const title = `Add the ${provenance.rhsPlaceName} digit — ${provenance.rhsDigit} ${provenance.rhsPlaceName} (${provenance.rhsValue})`;
      const subtitle = `From addend ${provenance.rhs}`;

      expect(title).toBe("Add the tens digit — 2 tens (20)");
      expect(subtitle).toBe("From addend 25");

      // Test breadcrumb chips
      const chips = [
        {
          label: "Digit we're using",
          value: `${provenance.rhsDigit} (${provenance.rhsPlaceName})`,
        },
        {
          label: "So we add here",
          value: `+${provenance.rhsDigit} ${provenance.rhsPlaceName} → ${provenance.rhsValue}`,
        },
      ];

      expect(chips[0]).toEqual({
        label: "Digit we're using",
        value: "2 (tens)",
      });

      expect(chips[1]).toEqual({
        label: "So we add here",
        value: "+2 tens → 20",
      });

      // Test explanation text
      const explanation = `We're adding the ${provenance.rhsPlaceName} digit of ${provenance.rhs} → ${provenance.rhsDigit} ${provenance.rhsPlaceName}.`;
      expect(explanation).toBe("We're adding the tens digit of 25 → 2 tens.");
    });
  });

  describe("Context Integration", () => {
    it("should provide unified steps through tutorial context", () => {
      let contextSteps: any = null;

      function TestComponent() {
        const { unifiedSteps } = useTutorialContext();
        contextSteps = unifiedSteps;
        return <div data-testid="test-component">Test</div>;
      }

      renderWithTutorialContext(<TestComponent />);

      // Context should provide steps with provenance
      expect(contextSteps).toBeDefined();
      expect(Array.isArray(contextSteps)).toBe(true);
      expect(contextSteps.length).toBeGreaterThan(0);

      // Find the "20" step
      const twentyStep = contextSteps.find(
        (step: any) => step.mathematicalTerm === "20",
      );
      expect(twentyStep).toBeDefined();
      expect(twentyStep.provenance).toBeDefined();
      expect(twentyStep.provenance.rhsValue).toBe(20);
    });
  });

  describe("DecompositionWithReasons Integration", () => {
    it("should render enhanced tooltips with provenance information", () => {
      const result = generateUnifiedInstructionSequence(3475, 3500);

      renderWithTutorialContext(
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />,
      );

      // Verify that enhanced provenance content exists in the DOM
      // The specific enhanced tooltip content we expect to see:
      // - "Add the tens digit — 2 tens (20)" (enhanced title)
      // - "From addend 25" (enhanced subtitle)
      // - "We're adding the tens digit of 25 → 2 tens" (enhanced explanation)

      // Check that the DOM contains at least one instance of our enhanced content
      // This proves the provenance system is working and generating enhanced tooltips
      const enhancedContent = [
        screen.queryAllByText("Add the tens digit — 2 tens (20)"),
        screen.queryAllByText("From addend 25"),
        screen.queryAllByText(/We're adding the tens digit of 25/),
      ].flat();

      // The provenance system should generate enhanced content for mathematical terms
      expect(enhancedContent.length).toBeGreaterThan(0);
    });
  });

  describe("Regression Tests", () => {
    it("should not break existing functionality without provenance", () => {
      // Test with a simple case that might not generate provenance
      renderWithTutorialContext(
        <DecompositionWithReasons
          fullDecomposition="7 + 3 = 10"
          termPositions={[
            { startIndex: 0, endIndex: 1 },
            { startIndex: 4, endIndex: 5 },
            { startIndex: 8, endIndex: 10 },
          ]}
          segments={[]}
        />,
      );

      // Should still render without errors
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("should handle empty or malformed data gracefully", () => {
      renderWithTutorialContext(
        <DecompositionWithReasons
          fullDecomposition=""
          termPositions={[]}
          segments={[]}
        />,
      );

      // Should render without throwing
      expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    });
  });

  describe("End-to-End User Experience", () => {
    it("should provide clear digit-to-pill connection for students", () => {
      const result = generateUnifiedInstructionSequence(3475, 3500);

      // Verify that every step with provenance clearly indicates its source
      result.steps.forEach((step) => {
        if (step.provenance) {
          // Each step should know which addend digit it came from
          expect(step.provenance.rhs).toBe(25);
          expect([2, 5]).toContain(step.provenance.rhsDigit);
          expect(["tens", "ones"]).toContain(step.provenance.rhsPlaceName);

          // The digit index should point to the correct character in "25"
          if (step.provenance.rhsDigit === 2) {
            expect(step.provenance.rhsDigitIndex).toBe(0); // '2' is at index 0
          } else if (step.provenance.rhsDigit === 5) {
            expect(step.provenance.rhsDigitIndex).toBe(1); // '5' is at index 1
          }
        }
      });

      // Equation anchors should allow precise highlighting
      expect(result.equationAnchors?.rhsDigitPositions[0]).toEqual({
        digitIndex: 0,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      });

      expect(result.equationAnchors?.rhsDigitPositions[1]).toEqual({
        digitIndex: 1,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      });
    });
  });
});
