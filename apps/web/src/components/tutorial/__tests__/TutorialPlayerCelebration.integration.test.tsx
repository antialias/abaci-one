import "./test-setup";
import { AbacusDisplayProvider } from "@soroban/abacus-react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import type { Tutorial } from "../../../types/tutorial";
import { TutorialProvider } from "../TutorialContext";
import { TutorialPlayer } from "../TutorialPlayer";

// Mock the AbacusReact component to make testing easier
vi.mock("@soroban/abacus-react", () => ({
  AbacusReact: ({ value, onValueChange, overlays }: any) => {
    const [currentValue, setCurrentValue] = React.useState(value);

    // Sync with prop changes
    React.useEffect(() => {
      setCurrentValue(value);
    }, [value]);

    const handleClick = () => {
      const newValue = currentValue === 3 ? 5 : currentValue === 5 ? 6 : 3;
      setCurrentValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <div data-testid="mock-abacus">
        <div data-testid="abacus-value">{currentValue}</div>
        <button onClick={handleClick} data-testid="change-value-btn">
          Change Value
        </button>
        {/* Render overlays for tooltip testing */}
        {overlays?.map((overlay: any, index: number) => (
          <div key={index} data-testid={`overlay-${index}`}>
            {overlay.content}
          </div>
        ))}
      </div>
    );
  },
  StepBeadHighlight: {},
}));

const mockTutorial: Tutorial = {
  id: "integration-test-tutorial",
  title: "Integration Test Tutorial",
  description: "Testing celebration tooltip integration",
  steps: [
    {
      id: "step-1",
      title: "Add Two",
      problem: "3 + 2",
      description: "Add 2 to 3 to get 5",
      startValue: 3,
      targetValue: 5,
      expectedAction: "add",
      actionDescription: "3 + 2 = 5",
      tooltip: {
        content: "Add 2 to reach 5",
        explanation: "Move two earth beads up to add 2",
      },
      multiStepInstructions: ["Move two earth beads up"],
    },
  ],
};

describe("TutorialPlayer Celebration Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTutorialPlayer = (tutorial = mockTutorial, props = {}) => {
    return render(
      <AbacusDisplayProvider>
        <TutorialProvider tutorial={tutorial}>
          <TutorialPlayer tutorial={tutorial} isDebugMode={false} {...props} />
        </TutorialProvider>
      </AbacusDisplayProvider>,
    );
  };

  describe("Celebration Tooltip Behavior", () => {
    it("should show celebration tooltip when target value is reached", async () => {
      const onStepComplete = vi.fn();
      renderTutorialPlayer(mockTutorial, { onStepComplete });

      // Wait for tutorial to load with initial value
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      // Change value to target (5)
      const changeBtn = screen.getByTestId("change-value-btn");

      await act(async () => {
        fireEvent.click(changeBtn);
      });

      // Wait for value to change to 5
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("5");
      });

      // Wait for step completion and celebration tooltip
      await waitFor(
        () => {
          expect(onStepComplete).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      // Look for celebration content in overlays
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it("should hide celebration tooltip when user moves away from target", async () => {
      const onStepComplete = vi.fn();
      renderTutorialPlayer(mockTutorial, { onStepComplete });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      const changeBtn = screen.getByTestId("change-value-btn");

      // First reach target value (5)
      await act(async () => {
        fireEvent.click(changeBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("5");
      });

      // Wait for celebration to appear
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Now move away from target (to 6)
      await act(async () => {
        fireEvent.click(changeBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("6");
      });

      // Celebration should disappear
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration).toBeFalsy();
          expect(excellentWork).toBeFalsy();
        },
        { timeout: 2000 },
      );
    });

    it("should return celebration when user goes back to target value", async () => {
      renderTutorialPlayer(mockTutorial);

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      const changeBtn = screen.getByTestId("change-value-btn");

      // Reach target (5)
      await act(async () => {
        fireEvent.click(changeBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("5");
      });

      // Verify celebration appears
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Move away (to 6)
      await act(async () => {
        fireEvent.click(changeBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("6");
      });

      // Celebration should be gone
      await waitFor(() => {
        expect(screen.queryByText("🎉")).toBeFalsy();
        expect(screen.queryByText("Excellent work!")).toBeFalsy();
      });

      // Go back to start (3) then back to target (5)
      await act(async () => {
        fireEvent.click(changeBtn); // 6 -> 3
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      await act(async () => {
        fireEvent.click(changeBtn); // 3 -> 5
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("5");
      });

      // Celebration should return
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it("should handle multiple step navigation with celebration tooltips", async () => {
      const multiStepTutorial: Tutorial = {
        ...mockTutorial,
        steps: [
          mockTutorial.steps[0],
          {
            id: "step-2",
            title: "Add One",
            problem: "4 + 1",
            description: "Add 1 to 4 to get 5",
            startValue: 4,
            targetValue: 5,
            expectedAction: "add",
            actionDescription: "4 + 1 = 5",
            tooltip: {
              content: "Add 1 to reach 5",
              explanation: "Move one earth bead up to add 1",
            },
            multiStepInstructions: ["Move one earth bead up"],
          },
        ],
      };

      renderTutorialPlayer(multiStepTutorial);

      // Complete first step
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      const changeBtn = screen.getByTestId("change-value-btn");

      await act(async () => {
        fireEvent.click(changeBtn); // 3 -> 5
      });

      // Wait for celebration
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Navigate to next step
      const nextButton = screen.getByText(/Next/);
      await act(async () => {
        fireEvent.click(nextButton);
      });

      // Wait for step 2 to load
      await waitFor(() => {
        expect(screen.getByText("4 + 1")).toBeInTheDocument();
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("4");
      });

      // Complete second step
      await act(async () => {
        fireEvent.click(changeBtn); // Should go from 4 to 5
      });

      // Celebration should appear for second step too
      await waitFor(
        () => {
          const celebration = screen.queryByText("🎉");
          const excellentWork = screen.queryByText("Excellent work!");
          expect(celebration || excellentWork).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it("should properly reset celebration state between steps", async () => {
      const multiStepTutorial: Tutorial = {
        ...mockTutorial,
        steps: [
          mockTutorial.steps[0],
          {
            id: "step-2",
            title: "Different Target",
            problem: "2 + 4",
            description: "Add 4 to 2 to get 6",
            startValue: 2,
            targetValue: 6,
            expectedAction: "add",
            actionDescription: "2 + 4 = 6",
            tooltip: {
              content: "Add 4 to reach 6",
              explanation: "Move four earth beads up to add 4",
            },
            multiStepInstructions: ["Move four earth beads up"],
          },
        ],
      };

      renderTutorialPlayer(multiStepTutorial);

      // Complete first step (target 5)
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      const changeBtn = screen.getByTestId("change-value-btn");

      await act(async () => {
        fireEvent.click(changeBtn); // 3 -> 5
      });

      // Wait for celebration
      await waitFor(() => {
        const celebration = screen.queryByText("🎉");
        const excellentWork = screen.queryByText("Excellent work!");
        expect(celebration || excellentWork).toBeTruthy();
      });

      // Navigate to step 2
      const nextButton = screen.getByText(/Next/);
      await act(async () => {
        fireEvent.click(nextButton);
      });

      // Step 2 should start fresh (no celebration initially)
      await waitFor(() => {
        expect(screen.getByText("2 + 4")).toBeInTheDocument();
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("2");
      });

      // Should not show celebration initially for new step
      expect(screen.queryByText("🎉")).toBeFalsy();
      expect(screen.queryByText("Excellent work!")).toBeFalsy();
    });
  });

  describe("Tooltip Content and Styling", () => {
    it("should show correct celebration content and styling", async () => {
      renderTutorialPlayer(mockTutorial);

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      const changeBtn = screen.getByTestId("change-value-btn");

      // Reach target value
      await act(async () => {
        fireEvent.click(changeBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("5");
      });

      // Verify both celebration elements appear
      await waitFor(
        () => {
          expect(screen.queryByText("🎉")).toBeTruthy();
          expect(screen.queryByText("Excellent work!")).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // The overlay should have celebration styling
      const overlay = screen.queryByTestId("overlay-0");
      expect(overlay).toBeTruthy();
    });

    it("should show instruction content when not at target", async () => {
      renderTutorialPlayer(mockTutorial);

      // Initially should show instructions (not celebration)
      await waitFor(() => {
        expect(screen.getByTestId("abacus-value")).toHaveTextContent("3");
      });

      // Should not show celebration initially
      expect(screen.queryByText("🎉")).toBeFalsy();
      expect(screen.queryByText("Excellent work!")).toBeFalsy();
    });
  });
});
