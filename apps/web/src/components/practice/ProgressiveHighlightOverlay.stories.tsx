"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { css } from "../../../styled-system/css";
import {
  ProgressiveHighlightOverlay,
  ProgressiveHighlightOverlayCompact,
} from "./ProgressiveHighlightOverlay";
import type { CompletedProblem } from "@/hooks/useWorksheetParsing";

const meta: Meta<typeof ProgressiveHighlightOverlay> = {
  title: "Practice/Worksheet Parsing/ProgressiveHighlightOverlay",
  component: ProgressiveHighlightOverlay,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    staggerDelay: { control: { type: "number", min: 0, max: 200 } },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "400px",
          height: "500px",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=500&h=600&fit=crop)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "gray.200",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProgressiveHighlightOverlay>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a grid of problem bounding boxes
 */
function generateGridProblems(
  rows: number,
  cols: number,
  count?: number,
): CompletedProblem[] {
  const problems: CompletedProblem[] = [];
  const totalCount = count ?? rows * cols;
  const cellWidth = 1 / cols;
  const cellHeight = 1 / rows;
  const padding = 0.01; // Small padding between cells

  let problemNumber = 1;
  for (let row = 0; row < rows && problems.length < totalCount; row++) {
    for (let col = 0; col < cols && problems.length < totalCount; col++) {
      problems.push({
        problemNumber,
        problemBoundingBox: {
          x: col * cellWidth + padding,
          y: row * cellHeight + padding,
          width: cellWidth - padding * 2,
          height: cellHeight - padding * 2,
        },
      });
      problemNumber++;
    }
  }

  return problems;
}

/**
 * Generate randomly positioned problem boxes (more realistic worksheet layout)
 */
function generateRandomProblems(count: number): CompletedProblem[] {
  const problems: CompletedProblem[] = [];

  for (let i = 1; i <= count; i++) {
    const baseX = ((i - 1) % 4) * 0.25;
    const baseY = Math.floor((i - 1) / 4) * 0.15;

    problems.push({
      problemNumber: i,
      problemBoundingBox: {
        x: baseX + 0.01 + Math.random() * 0.02,
        y: baseY + 0.02 + Math.random() * 0.02,
        width: 0.2 + Math.random() * 0.03,
        height: 0.1 + Math.random() * 0.02,
      },
    });
  }

  return problems;
}

// ============================================
// PROBLEM COUNT VARIATIONS
// ============================================

export const Empty: Story = {
  args: {
    completedProblems: [],
    staggerDelay: 50,
  },
};

export const SingleProblem: Story = {
  args: {
    completedProblems: generateGridProblems(1, 1),
    staggerDelay: 50,
  },
};

export const FourProblems: Story = {
  args: {
    completedProblems: generateGridProblems(2, 2),
    staggerDelay: 50,
  },
};

export const EightProblems: Story = {
  args: {
    completedProblems: generateGridProblems(2, 4),
    staggerDelay: 50,
  },
};

export const TwelveProblems: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 50,
  },
};

export const TwentyFourProblems: Story = {
  args: {
    completedProblems: generateGridProblems(4, 6),
    staggerDelay: 50,
  },
};

export const FortyProblems: Story = {
  args: {
    completedProblems: generateGridProblems(5, 8),
    staggerDelay: 50,
  },
};

// ============================================
// STAGGER DELAY VARIATIONS
// ============================================

export const NoStagger: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 0,
  },
};

export const FastStagger: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 20,
  },
};

export const NormalStagger: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 50,
  },
};

export const SlowStagger: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 100,
  },
};

export const VerySlowStagger: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 200,
  },
};

// ============================================
// COMPACT VERSION
// ============================================

export const CompactEmpty: Story = {
  render: (args) => <ProgressiveHighlightOverlayCompact {...args} />,
  args: {
    completedProblems: [],
    staggerDelay: 50,
  },
};

export const CompactTwelveProblems: Story = {
  render: (args) => <ProgressiveHighlightOverlayCompact {...args} />,
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 50,
  },
};

export const CompactTwentyFourProblems: Story = {
  render: (args) => <ProgressiveHighlightOverlayCompact {...args} />,
  args: {
    completedProblems: generateGridProblems(4, 6),
    staggerDelay: 50,
  },
};

// ============================================
// DIFFERENT LAYOUTS
// ============================================

export const TallLayout: Story = {
  args: {
    completedProblems: generateGridProblems(6, 2),
    staggerDelay: 50,
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "250px",
          height: "500px",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=300&h=600&fit=crop)",
          backgroundSize: "cover",
          backgroundColor: "gray.200",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export const WideLayout: Story = {
  args: {
    completedProblems: generateGridProblems(2, 6),
    staggerDelay: 50,
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "600px",
          height: "250px",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=700&h=300&fit=crop)",
          backgroundSize: "cover",
          backgroundColor: "gray.200",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export const SmallTile: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4),
    staggerDelay: 50,
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "150px",
          height: "150px",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=200&h=200&fit=crop)",
          backgroundSize: "cover",
          backgroundColor: "gray.200",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

// ============================================
// STREAMING SIMULATION
// ============================================

function StreamingDemo({
  variant = "full",
  problemCount = 24,
}: {
  variant?: "full" | "compact";
  problemCount?: number;
}) {
  const [problems, setProblems] = useState<CompletedProblem[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const allProblems = generateGridProblems(
    Math.ceil(problemCount / 6),
    Math.min(problemCount, 6),
    problemCount,
  );

  useEffect(() => {
    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const addNextProblem = () => {
      if (index < allProblems.length) {
        setProblems((prev) => [...prev, allProblems[index]]);
        index++;
        timeoutId = setTimeout(addNextProblem, 150 + Math.random() * 200);
      } else {
        setIsComplete(true);
      }
    };

    // Start after a short delay
    timeoutId = setTimeout(addNextProblem, 500);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [allProblems]);

  const Overlay =
    variant === "compact"
      ? ProgressiveHighlightOverlayCompact
      : ProgressiveHighlightOverlay;

  return (
    <div>
      <div
        className={css({
          position: "absolute",
          top: "8px",
          left: "8px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          zIndex: 20,
        })}
      >
        {isComplete
          ? `Complete! ${problems.length} problems`
          : `Parsing... ${problems.length}/${allProblems.length}`}
      </div>
      <Overlay completedProblems={problems} staggerDelay={50} />
    </div>
  );
}

export const StreamingSimulation: Story = {
  render: () => <StreamingDemo problemCount={24} />,
};

export const StreamingSimulationCompact: Story = {
  render: () => <StreamingDemo variant="compact" problemCount={24} />,
};

export const StreamingSimulationLarge: Story = {
  render: () => <StreamingDemo problemCount={40} />,
};

// ============================================
// RESTART ANIMATION DEMO
// ============================================

function RestartDemo() {
  const [key, setKey] = useState(0);
  const problems = generateGridProblems(3, 4);

  return (
    <div>
      <button
        type="button"
        onClick={() => setKey((k) => k + 1)}
        className={css({
          position: "absolute",
          top: "8px",
          right: "8px",
          backgroundColor: "blue.500",
          color: "white",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "medium",
          cursor: "pointer",
          zIndex: 20,
          _hover: { backgroundColor: "blue.600" },
        })}
      >
        Replay Animation
      </button>
      <ProgressiveHighlightOverlay
        key={key}
        completedProblems={problems}
        staggerDelay={50}
      />
    </div>
  );
}

export const RestartAnimation: Story = {
  render: () => <RestartDemo />,
};

// ============================================
// REALISTIC WORKSHEET LAYOUT
// ============================================

export const RealisticLayout: Story = {
  args: {
    completedProblems: generateRandomProblems(16),
    staggerDelay: 50,
  },
};

// ============================================
// PARTIAL PROGRESS
// ============================================

export const PartialProgress3of12: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4, 3),
    staggerDelay: 50,
  },
};

export const PartialProgress8of12: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4, 8),
    staggerDelay: 50,
  },
};

export const PartialProgress11of12: Story = {
  args: {
    completedProblems: generateGridProblems(3, 4, 11),
    staggerDelay: 50,
  },
};

// ============================================
// SIDE BY SIDE COMPARISON
// ============================================

function ComparisonDemo() {
  const problems = generateGridProblems(3, 4);

  return (
    <div
      className={css({
        display: "flex",
        gap: "1.5rem",
      })}
    >
      <div>
        <div
          className={css({
            marginBottom: "0.5rem",
            fontWeight: "medium",
            fontSize: "0.875rem",
          })}
        >
          Full (with checkmarks)
        </div>
        <div
          className={css({
            position: "relative",
            width: "250px",
            height: "300px",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundImage:
              "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=300&h=350&fit=crop)",
            backgroundSize: "cover",
            backgroundColor: "gray.200",
          })}
        >
          <ProgressiveHighlightOverlay
            completedProblems={problems}
            staggerDelay={50}
          />
        </div>
      </div>

      <div>
        <div
          className={css({
            marginBottom: "0.5rem",
            fontWeight: "medium",
            fontSize: "0.875rem",
          })}
        >
          Compact (borders only)
        </div>
        <div
          className={css({
            position: "relative",
            width: "250px",
            height: "300px",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundImage:
              "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=300&h=350&fit=crop)",
            backgroundSize: "cover",
            backgroundColor: "gray.200",
          })}
        >
          <ProgressiveHighlightOverlayCompact
            completedProblems={problems}
            staggerDelay={50}
          />
        </div>
      </div>
    </div>
  );
}

export const FullVsCompact: Story = {
  render: () => <ComparisonDemo />,
  decorators: [
    (Story) => (
      <div className={css({ padding: "1rem" })}>
        <Story />
      </div>
    ),
  ],
};
