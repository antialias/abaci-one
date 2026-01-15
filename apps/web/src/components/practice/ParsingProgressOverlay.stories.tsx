"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { ParsingProgressOverlay } from "./ParsingProgressOverlay";

const meta: Meta<typeof ParsingProgressOverlay> = {
  title: "Practice/Worksheet Parsing/ParsingProgressOverlay",
  component: ParsingProgressOverlay,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    progressMessage: { control: "text" },
    completedCount: { control: { type: "number", min: 0, max: 50 } },
    totalCount: { control: { type: "number", min: 0, max: 50 } },
    isPanelExpanded: { control: "boolean" },
    hasReasoningText: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "300px",
          height: "300px",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=400&fit=crop)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ParsingProgressOverlay>;

// ============================================
// BASIC STATES
// ============================================

export const Connecting: Story = {
  args: {
    progressMessage: "Connecting to AI...",
    completedCount: 0,
    totalCount: 0,
    isPanelExpanded: false,
    hasReasoningText: false,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const Analyzing: Story = {
  args: {
    progressMessage: "AI is analyzing the worksheet...",
    completedCount: 0,
    totalCount: 0,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const FoundProblemsUnknownTotal: Story = {
  args: {
    progressMessage: null,
    completedCount: 5,
    totalCount: 0,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const FoundProblemsKnownTotal: Story = {
  args: {
    progressMessage: null,
    completedCount: 12,
    totalCount: 24,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const AlmostComplete: Story = {
  args: {
    progressMessage: null,
    completedCount: 23,
    totalCount: 24,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

// ============================================
// PANEL EXPANDED STATES
// ============================================

export const PanelCollapsed: Story = {
  args: {
    progressMessage: null,
    completedCount: 8,
    totalCount: 24,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const PanelExpanded: Story = {
  args: {
    progressMessage: null,
    completedCount: 8,
    totalCount: 24,
    isPanelExpanded: true,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const NoReasoningText: Story = {
  args: {
    progressMessage: "Connecting...",
    completedCount: 0,
    totalCount: 0,
    isPanelExpanded: false,
    hasReasoningText: false,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

// ============================================
// INTERACTIVE DEMO
// ============================================

function InteractiveDemo() {
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) {
    return (
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "white",
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          borderRadius: "12px",
        })}
      >
        <button
          type="button"
          onClick={() => setCancelled(false)}
          className={css({
            padding: "0.5rem 1rem",
            backgroundColor: "blue.500",
            color: "white",
            borderRadius: "6px",
            cursor: "pointer",
          })}
        >
          Restart
        </button>
      </div>
    );
  }

  return (
    <ParsingProgressOverlay
      progressMessage={null}
      completedCount={15}
      totalCount={24}
      isPanelExpanded={isPanelExpanded}
      hasReasoningText={true}
      onTogglePanel={() => setIsPanelExpanded((p) => !p)}
      onCancel={() => setCancelled(true)}
    />
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};

// ============================================
// DIFFERENT PROBLEM COUNTS
// ============================================

export const SmallWorksheet: Story = {
  args: {
    progressMessage: null,
    completedCount: 4,
    totalCount: 8,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

export const LargeWorksheet: Story = {
  args: {
    progressMessage: null,
    completedCount: 25,
    totalCount: 48,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
};

// ============================================
// TILE SIZE VARIATIONS
// ============================================

export const SmallTile: Story = {
  args: {
    progressMessage: null,
    completedCount: 5,
    totalCount: 12,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
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
        })}
      >
        <Story />
      </div>
    ),
  ],
};

export const LargeTile: Story = {
  args: {
    progressMessage: null,
    completedCount: 18,
    totalCount: 32,
    isPanelExpanded: false,
    hasReasoningText: true,
    onTogglePanel: () => {},
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          position: "relative",
          width: "450px",
          height: "450px",
          borderRadius: "16px",
          overflow: "hidden",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=600&h=600&fit=crop)",
          backgroundSize: "cover",
        })}
      >
        <Story />
      </div>
    ),
  ],
};
