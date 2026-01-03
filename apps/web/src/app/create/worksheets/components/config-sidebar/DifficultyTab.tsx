"use client";

import { stack } from "@styled/patterns";
import { defaultAdditionConfig } from "@/app/create/worksheets/config-schemas";
import { useTheme } from "@/contexts/ThemeContext";
import type { WorksheetFormState } from "../../types";
import { MasteryModePanel } from "../config-panel/MasteryModePanel";
import { ProgressiveDifficultyToggle } from "../config-panel/ProgressiveDifficultyToggle";
import { CustomModeControls } from "../config-panel/CustomModeControls";
import { DifficultyMethodSelector } from "../DifficultyMethodSelector";
import { useWorksheetConfig } from "../WorksheetConfigContext";

export function DifficultyTab() {
  const { formState, onChange } = useWorksheetConfig();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const currentMethod = formState.mode === "mastery" ? "mastery" : "custom";

  // Handler for difficulty method switching (smart vs mastery)
  const handleMethodChange = (newMethod: "custom" | "mastery") => {
    if (currentMethod === newMethod) {
      return;
    }

    const displayRules =
      formState.displayRules ?? defaultAdditionConfig.displayRules;

    if (newMethod === "custom") {
      onChange({
        mode: "custom",
        displayRules,
        difficultyProfile: "earlyLearner",
      } as unknown as Partial<WorksheetFormState>);
    } else {
      onChange({
        mode: "mastery",
        displayRules,
      } as unknown as Partial<WorksheetFormState>);
    }
  };

  return (
    <div data-component="difficulty-tab" className={stack({ gap: "3" })}>
      {/* Progressive Difficulty Toggle - applies to all modes */}
      <ProgressiveDifficultyToggle
        interpolate={formState.interpolate}
        onChange={(interpolate) => onChange({ interpolate })}
        isDark={isDark}
      />

      {/* Difficulty Method Selector */}
      <DifficultyMethodSelector
        currentMethod={currentMethod}
        onChange={handleMethodChange}
        isDark={isDark}
      />

      {/* Method-specific controls */}
      {currentMethod === "custom" && (
        <CustomModeControls formState={formState} onChange={onChange} />
      )}

      {currentMethod === "mastery" && (
        <MasteryModePanel
          formState={formState}
          onChange={onChange}
          isDark={isDark}
        />
      )}
    </div>
  );
}
