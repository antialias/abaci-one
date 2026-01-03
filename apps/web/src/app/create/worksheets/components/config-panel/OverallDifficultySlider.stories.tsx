import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { OverallDifficultySlider } from "./OverallDifficultySlider";
import { DIFFICULTY_PROFILES } from "../../difficultyProfiles";
import type { DisplayRules } from "../../displayRules";

const meta = {
  title: "Worksheets/Config Panel/OverallDifficultySlider",
  component: OverallDifficultySlider,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OverallDifficultySlider>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper to handle state
function SliderWrapper(
  args: React.ComponentProps<typeof OverallDifficultySlider>,
) {
  const [difficulty, setDifficulty] = useState(args.currentDifficulty);
  const [config, setConfig] = useState({ pAnyStart: 0, pAllStart: 0 });

  return (
    <div style={{ maxWidth: "500px" }}>
      <OverallDifficultySlider
        {...args}
        currentDifficulty={difficulty}
        onChange={(updates) => {
          const newDifficulty =
            (updates.pAnyStart + updates.pAllStart * 2) / 3 +
            (1 -
              Object.values(updates.displayRules).filter((v) => v === "always")
                .length /
                10);
          setDifficulty(newDifficulty);
          setConfig({
            pAnyStart: updates.pAnyStart,
            pAllStart: updates.pAllStart,
          });
        }}
      />
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "#f3f4f6",
          borderRadius: "6px",
          fontSize: "12px",
        }}
      >
        <strong>Current Configuration:</strong>
        <div
          style={{
            marginTop: "8px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          pAnyStart: {config.pAnyStart.toFixed(2)}
          <br />
          pAllStart: {config.pAllStart.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export const EarlyLearner: Story = {
  render: (args) => <SliderWrapper {...args} />,
  args: {
    currentDifficulty: 2.0,
  },
};

export const Intermediate: Story = {
  render: (args) => <SliderWrapper {...args} />,
  args: {
    currentDifficulty: 5.0,
  },
};

export const Expert: Story = {
  render: (args) => <SliderWrapper {...args} />,
  args: {
    currentDifficulty: 8.5,
  },
};

export const MinimumDifficulty: Story = {
  render: (args) => <SliderWrapper {...args} />,
  args: {
    currentDifficulty: 0,
  },
};

export const MaximumDifficulty: Story = {
  render: (args) => <SliderWrapper {...args} />,
  args: {
    currentDifficulty: 10,
  },
};

export const InteractiveWithPresets: Story = {
  render: () => {
    const [difficulty, setDifficulty] = useState(5.0);
    const [pAnyStart, setPAnyStart] = useState(0.5);
    const [pAllStart, setPAllStart] = useState(0.1);
    const [displayRules, setDisplayRules] = useState<DisplayRules>({
      tenFrames: "sometimes",
      carryBoxes: "sometimes",
      placeValueColors: "sometimes",
      answerBoxes: "always",
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "never",
      borrowingHints: "never",
    });

    return (
      <div style={{ maxWidth: "600px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600 }}
          >
            Difficulty Presets
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Object.entries(DIFFICULTY_PROFILES).map(([key, profile]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const calcDiff =
                    (profile.regrouping.pAnyStart +
                      profile.regrouping.pAllStart * 2) /
                      3 +
                    (1 -
                      Object.values(profile.displayRules).filter(
                        (v) => v === "always",
                      ).length /
                        10);
                  setDifficulty(calcDiff);
                  setPAnyStart(profile.regrouping.pAnyStart);
                  setPAllStart(profile.regrouping.pAllStart);
                  setDisplayRules(profile.displayRules);
                }}
                style={{
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {profile.label}
              </button>
            ))}
          </div>
        </div>

        <OverallDifficultySlider
          currentDifficulty={difficulty}
          onChange={(updates) => {
            const newDiff =
              (updates.pAnyStart + updates.pAllStart * 2) / 3 +
              (1 -
                Object.values(updates.displayRules).filter(
                  (v) => v === "always",
                ).length /
                  10);
            setDifficulty(newDiff);
            setPAnyStart(updates.pAnyStart);
            setPAllStart(updates.pAllStart);
            setDisplayRules(updates.displayRules);
          }}
        />

        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            background: "#f3f4f6",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        >
          <strong>Current State:</strong>
          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              fontFamily: "monospace",
            }}
          >
            <div>Difficulty: {difficulty.toFixed(2)} / 10</div>
            <div>pAnyStart: {pAnyStart.toFixed(2)}</div>
            <div>pAllStart: {pAllStart.toFixed(2)}</div>
            <div style={{ marginTop: "8px" }}>
              <strong>Display Rules:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                {Object.entries(displayRules).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

export const SnappingBehavior: Story = {
  render: () => {
    const [difficulty, setDifficulty] = useState(5.0);
    const [snappedTo, setSnappedTo] = useState<string>("");

    return (
      <div style={{ maxWidth: "500px" }}>
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            background: "#eff6ff",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        >
          <strong>ℹ️ Snapping Behavior:</strong>
          <p style={{ margin: "8px 0 0 0" }}>
            As you drag the slider, it will snap to the nearest valid
            configuration along the pedagogical difficulty path. Watch how it
            snaps to combinations of regrouping intensity and scaffolding level.
          </p>
        </div>

        <OverallDifficultySlider
          currentDifficulty={difficulty}
          onChange={(updates) => {
            const newDiff =
              (updates.pAnyStart + updates.pAllStart * 2) / 3 +
              (1 -
                Object.values(updates.displayRules).filter(
                  (v) => v === "always",
                ).length /
                  10);
            setDifficulty(newDiff);
            setSnappedTo(
              updates.difficultyProfile
                ? DIFFICULTY_PROFILES[updates.difficultyProfile].label
                : "Custom",
            );
          }}
        />

        {snappedTo && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "#f3f4f6",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          >
            <strong>Snapped to:</strong> {snappedTo}
          </div>
        )}
      </div>
    );
  },
};
