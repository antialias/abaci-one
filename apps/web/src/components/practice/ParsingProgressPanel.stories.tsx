"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { css } from "../../../styled-system/css";
import { ParsingProgressPanel } from "./ParsingProgressPanel";

const meta: Meta<typeof ParsingProgressPanel> = {
  title: "Practice/Worksheet Parsing/ParsingProgressPanel",
  component: ParsingProgressPanel,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    isExpanded: { control: "boolean" },
    reasoningText: { control: "text" },
    status: {
      control: "select",
      options: [
        "idle",
        "connecting",
        "reasoning",
        "generating",
        "complete",
        "error",
      ],
    },
    isDark: { control: "boolean" },
  },
  decorators: [
    (Story, context) => (
      <div
        className={css({
          backgroundColor: context.args.isDark ? "gray.900" : "gray.100",
          padding: "1.5rem",
          borderRadius: "12px",
          maxWidth: "400px",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ParsingProgressPanel>;

// Sample reasoning texts
const SHORT_REASONING = `I can see a worksheet with math problems. Let me analyze each one carefully.`;

const MEDIUM_REASONING = `I can see a worksheet with math problems arranged in a grid format. The problems appear to be addition exercises. Let me start analyzing from the top-left corner.

Problem 1: 45 + 27 = 72 (student wrote 72, correct!)
Problem 2: 38 + 19 = 57 (student wrote 57, correct!)
Problem 3: 64 + 28 = 92 (student wrote 82, incorrect - off by 10)`;

const LONG_REASONING = `I can see a worksheet with math problems arranged in a 4x6 grid format. The problems are addition exercises with 2-digit numbers. The student has written their answers in the boxes below each problem.

Let me analyze each problem systematically, starting from the top-left and moving right:

Row 1:
- Problem 1: 45 + 27 = 72 (student wrote 72, correct!)
- Problem 2: 38 + 19 = 57 (student wrote 57, correct!)
- Problem 3: 64 + 28 = 92 (student wrote 82, incorrect - appears to have forgotten to carry)
- Problem 4: 51 + 36 = 87 (student wrote 87, correct!)
- Problem 5: 29 + 43 = 72 (student wrote 72, correct!)
- Problem 6: 76 + 18 = 94 (student wrote 94, correct!)

Row 2:
- Problem 7: 33 + 58 = 91 (student wrote 91, correct!)
- Problem 8: 47 + 35 = 82 (student wrote 82, correct!)
- Problem 9: 62 + 29 = 91 (student wrote 81, incorrect - missed the carry from ones place)

The handwriting is generally clear. I'm detecting bounding boxes for each problem based on the grid layout.`;

// ============================================
// STATUS STATES
// ============================================

export const Idle: Story = {
  args: {
    isExpanded: true,
    reasoningText: "",
    status: "idle",
    isDark: false,
  },
};

export const Connecting: Story = {
  args: {
    isExpanded: true,
    reasoningText: "",
    status: "connecting",
    isDark: false,
  },
};

export const Reasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

export const Generating: Story = {
  args: {
    isExpanded: true,
    reasoningText: LONG_REASONING,
    status: "generating",
    isDark: false,
  },
};

export const Complete: Story = {
  args: {
    isExpanded: true,
    reasoningText: LONG_REASONING,
    status: "complete",
    isDark: false,
  },
};

export const ErrorState: Story = {
  args: {
    isExpanded: true,
    reasoningText: SHORT_REASONING,
    status: "error",
    isDark: false,
  },
};

// ============================================
// EXPANDED/COLLAPSED
// ============================================

export const Collapsed: Story = {
  args: {
    isExpanded: false,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

export const Expanded: Story = {
  args: {
    isExpanded: true,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

// ============================================
// REASONING TEXT LENGTHS
// ============================================

export const EmptyReasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: "",
    status: "connecting",
    isDark: false,
  },
};

export const ShortReasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: SHORT_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

export const MediumReasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

export const LongReasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: LONG_REASONING,
    status: "reasoning",
    isDark: false,
  },
};

// ============================================
// DARK MODE
// ============================================

export const DarkConnecting: Story = {
  args: {
    isExpanded: true,
    reasoningText: "",
    status: "connecting",
    isDark: true,
  },
};

export const DarkReasoning: Story = {
  args: {
    isExpanded: true,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: true,
  },
};

export const DarkComplete: Story = {
  args: {
    isExpanded: true,
    reasoningText: LONG_REASONING,
    status: "complete",
    isDark: true,
  },
};

export const DarkError: Story = {
  args: {
    isExpanded: true,
    reasoningText: SHORT_REASONING,
    status: "error",
    isDark: true,
  },
};

// ============================================
// STREAMING SIMULATION
// ============================================

function StreamingDemo({ isDark = false }: { isDark?: boolean }) {
  const [reasoningText, setReasoningText] = useState("");
  const [status, setStatus] = useState<
    "connecting" | "reasoning" | "generating" | "complete"
  >("connecting");

  const fullText = LONG_REASONING;

  useEffect(() => {
    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const simulateStreaming = () => {
      if (status === "connecting") {
        // Wait 1 second then start reasoning
        timeoutId = setTimeout(() => {
          setStatus("reasoning");
        }, 1000);
        return;
      }

      if (status === "reasoning" && index < fullText.length) {
        // Add characters progressively
        const charsToAdd = Math.floor(Math.random() * 5) + 1;
        const newText = fullText.slice(0, index + charsToAdd);
        setReasoningText(newText);
        index += charsToAdd;

        if (index >= fullText.length) {
          // Switch to generating
          timeoutId = setTimeout(() => {
            setStatus("generating");
          }, 500);
        } else {
          timeoutId = setTimeout(simulateStreaming, 30 + Math.random() * 50);
        }
        return;
      }

      if (status === "generating") {
        // Wait 2 seconds then complete
        timeoutId = setTimeout(() => {
          setStatus("complete");
        }, 2000);
        return;
      }
    };

    simulateStreaming();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status, fullText]);

  return (
    <div>
      <div
        className={css({
          marginBottom: "0.75rem",
          fontSize: "0.75rem",
          color: isDark ? "gray.400" : "gray.600",
        })}
      >
        Status: <strong>{status}</strong> | Characters: {reasoningText.length}
      </div>
      <ParsingProgressPanel
        isExpanded={true}
        reasoningText={reasoningText}
        status={status}
        isDark={isDark}
      />
    </div>
  );
}

export const StreamingSimulation: Story = {
  render: () => <StreamingDemo />,
};

export const StreamingSimulationDark: Story = {
  render: () => <StreamingDemo isDark={true} />,
  decorators: [
    (Story) => (
      <div
        className={css({
          backgroundColor: "gray.900",
          padding: "1.5rem",
          borderRadius: "12px",
          maxWidth: "400px",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

// ============================================
// WIDTH VARIATIONS
// ============================================

export const NarrowWidth: Story = {
  args: {
    isExpanded: true,
    reasoningText: MEDIUM_REASONING,
    status: "reasoning",
    isDark: false,
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          backgroundColor: "gray.100",
          padding: "1rem",
          borderRadius: "8px",
          maxWidth: "250px",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export const WideWidth: Story = {
  args: {
    isExpanded: true,
    reasoningText: LONG_REASONING,
    status: "reasoning",
    isDark: false,
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          backgroundColor: "gray.100",
          padding: "1.5rem",
          borderRadius: "12px",
          maxWidth: "600px",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

// ============================================
// WITH PHOTO TILE CONTEXT
// ============================================

function WithPhotoTileDemo() {
  return (
    <div className={css({ maxWidth: "300px" })}>
      {/* Simulated photo tile */}
      <div
        className={css({
          position: "relative",
          width: "100%",
          aspectRatio: "1",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=400&fit=crop)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        })}
      >
        {/* Overlay would go here */}
        <div
          className={css({
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <div
            className={css({
              width: "32px",
              height: "32px",
              border: "3px solid rgba(255, 255, 255, 0.3)",
              borderTopColor: "white",
              borderRadius: "full",
              animation: "spin 1s linear infinite",
            })}
          />
        </div>
      </div>

      {/* Panel below tile */}
      <ParsingProgressPanel
        isExpanded={true}
        reasoningText={MEDIUM_REASONING}
        status="reasoning"
        isDark={false}
      />
    </div>
  );
}

export const WithPhotoTileContext: Story = {
  render: () => <WithPhotoTileDemo />,
  decorators: [
    (Story) => (
      <div
        className={css({
          backgroundColor: "gray.100",
          padding: "1.5rem",
          borderRadius: "12px",
        })}
      >
        <Story />
      </div>
    ),
  ],
};
