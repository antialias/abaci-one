"use client";

import { css } from "@styled/css";
import { stack } from "@styled/patterns";
import { useWorksheetConfig } from "../WorksheetConfigContext";
import { useTheme } from "@/contexts/ThemeContext";
import { RuleThermometer } from "../config-panel/RuleThermometer";
import type { DisplayRules } from "../../displayRules";
import { defaultAdditionConfig } from "@/app/create/worksheets/config-schemas";
import { getSkillById } from "../../skills";

export function ScaffoldingTab() {
  const { formState, onChange } = useWorksheetConfig();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const displayRules: DisplayRules =
    formState.displayRules ?? defaultAdditionConfig.displayRules;

  // Check if we're in mastery+mixed mode (needs operator-specific rules)
  const isMasteryMixed =
    formState.mode === "mastery" && formState.operator === "mixed";

  // Get resolved display rules for showing what 'auto' defers to
  let resolvedDisplayRules: DisplayRules | undefined;
  let resolvedAdditionRules: DisplayRules | undefined;
  let resolvedSubtractionRules: DisplayRules | undefined;

  if (formState.mode === "mastery") {
    const operator = formState.operator ?? "addition";

    if (operator === "mixed") {
      // Mixed mode: Get BOTH addition and subtraction skill recommendations
      const addSkillId = formState.currentAdditionSkillId;
      const subSkillId = formState.currentSubtractionSkillId;

      if (addSkillId) {
        const skill = getSkillById(addSkillId as any);
        resolvedAdditionRules = skill?.recommendedScaffolding;
      }

      if (subSkillId) {
        const skill = getSkillById(subSkillId as any);
        resolvedSubtractionRules = skill?.recommendedScaffolding;
      }
    } else {
      // Single operator: Use its skill's recommendations
      const skillId =
        operator === "addition"
          ? formState.currentAdditionSkillId
          : formState.currentSubtractionSkillId;

      if (skillId) {
        const skill = getSkillById(skillId as any);
        resolvedDisplayRules = skill?.recommendedScaffolding;
      }
    }
  }

  const updateRule = (
    key: keyof DisplayRules,
    value: DisplayRules[keyof DisplayRules],
  ) => {
    const newDisplayRules = {
      ...displayRules,
      [key]: value,
    };

    console.log("[ScaffoldingTab] updateRule called:", {
      key,
      value,
      isMasteryMixed,
      newDisplayRules,
    });

    // In mastery+mixed mode, update both general AND operator-specific display rules
    if (isMasteryMixed) {
      console.log(
        "[ScaffoldingTab] Updating ALL operator-specific rules (mastery+mixed)",
      );
      onChange({
        displayRules: newDisplayRules,
        additionDisplayRules: newDisplayRules,
        subtractionDisplayRules: newDisplayRules,
      });
    } else {
      console.log("[ScaffoldingTab] Updating only global displayRules");
      onChange({
        displayRules: newDisplayRules,
      });
    }
  };

  // Get skill names for auto notice
  const getAutoNoticeText = () => {
    if (formState.mode !== "mastery") return null;

    const operator = formState.operator ?? "addition";

    if (operator === "mixed") {
      const addSkill = formState.currentAdditionSkillId
        ? getSkillById(formState.currentAdditionSkillId as any)
        : null;
      const subSkill = formState.currentSubtractionSkillId
        ? getSkillById(formState.currentSubtractionSkillId as any)
        : null;

      if (addSkill && subSkill) {
        return `Auto uses ${addSkill.name} (addition) and ${subSkill.name} (subtraction) recommendations`;
      }
    } else {
      const skillId =
        operator === "addition"
          ? formState.currentAdditionSkillId
          : formState.currentSubtractionSkillId;
      const skill = skillId ? getSkillById(skillId as any) : null;

      if (skill) {
        return `Auto uses ${skill.name} recommendations`;
      }
    }

    return null;
  };

  const autoNoticeText = getAutoNoticeText();

  return (
    <div data-component="scaffolding-tab" className={stack({ gap: "3" })}>
      {/* Quick presets */}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <div
          className={css({
            fontSize: "xs",
            fontWeight: "semibold",
            color: isDark ? "gray.400" : "gray.500",
            textTransform: "uppercase",
            letterSpacing: "wider",
          })}
        >
          Quick Presets
        </div>
        <div className={css({ display: "flex", gap: "1.5" })}>
          {/* Auto preset - defer to mastery progression (only show in mastery mode) */}
          {formState.mode === "mastery" && (
            <button
              onClick={() => {
                const newDisplayRules = {
                  ...displayRules,
                  carryBoxes: "auto" as const,
                  answerBoxes: "auto" as const,
                  placeValueColors: "auto" as const,
                  tenFrames: "auto" as const,
                  borrowNotation: "auto" as const,
                  borrowingHints: "auto" as const,
                };
                // In mastery+mixed mode, update operator-specific rules too
                if (isMasteryMixed) {
                  onChange({
                    displayRules: newDisplayRules,
                    additionDisplayRules: newDisplayRules,
                    subtractionDisplayRules: newDisplayRules,
                  });
                } else {
                  onChange({
                    displayRules: newDisplayRules,
                  });
                }
              }}
              className={css({
                px: "2",
                py: "0.5",
                fontSize: "2xs",
                color: isDark ? "green.300" : "green.600",
                bg: isDark ? "green.900/30" : "green.50",
                border: "1px solid",
                borderColor: isDark ? "green.700" : "green.300",
                rounded: "md",
                cursor: "pointer",
                _hover: { bg: isDark ? "green.800/40" : "green.100" },
              })}
            >
              Auto
            </button>
          )}
          <button
            onClick={() => {
              const newDisplayRules = {
                ...displayRules,
                carryBoxes: "always" as const,
                answerBoxes: "always" as const,
                placeValueColors: "always" as const,
                tenFrames: "always" as const,
                borrowNotation: "always" as const,
                borrowingHints: "always" as const,
              };
              // In mastery+mixed mode, update operator-specific rules too
              if (isMasteryMixed) {
                onChange({
                  displayRules: newDisplayRules,
                  additionDisplayRules: newDisplayRules,
                  subtractionDisplayRules: newDisplayRules,
                });
              } else {
                onChange({
                  displayRules: newDisplayRules,
                });
              }
            }}
            className={css({
              px: "2",
              py: "0.5",
              fontSize: "2xs",
              color: isDark ? "brand.300" : "brand.600",
              border: "1px solid",
              borderColor: isDark ? "brand.500" : "brand.300",
              bg: isDark ? "gray.700" : "white",
              rounded: "md",
              cursor: "pointer",
              _hover: { bg: isDark ? "gray.600" : "brand.50" },
            })}
          >
            All Always
          </button>
          <button
            onClick={() => {
              const newDisplayRules = {
                ...displayRules,
                carryBoxes: "never" as const,
                answerBoxes: "never" as const,
                placeValueColors: "never" as const,
                tenFrames: "never" as const,
                borrowNotation: "never" as const,
                borrowingHints: "never" as const,
              };
              // In mastery+mixed mode, update operator-specific rules too
              if (isMasteryMixed) {
                onChange({
                  displayRules: newDisplayRules,
                  additionDisplayRules: newDisplayRules,
                  subtractionDisplayRules: newDisplayRules,
                });
              } else {
                onChange({
                  displayRules: newDisplayRules,
                });
              }
            }}
            className={css({
              px: "2",
              py: "0.5",
              fontSize: "2xs",
              color: isDark ? "gray.300" : "gray.600",
              border: "1px solid",
              borderColor: isDark ? "gray.500" : "gray.300",
              bg: isDark ? "gray.700" : "white",
              rounded: "md",
              cursor: "pointer",
              _hover: { bg: isDark ? "gray.600" : "gray.50" },
            })}
          >
            Minimal
          </button>
        </div>
      </div>

      {/* Auto notice - shows what skill auto defers to */}
      {autoNoticeText && (
        <div
          className={css({
            fontSize: "2xs",
            color: isDark ? "gray.500" : "gray.500",
            fontStyle: "italic",
            px: "1",
          })}
        >
          {autoNoticeText}
        </div>
      )}

      {/* Pedagogical scaffolding thermometers */}
      <RuleThermometer
        label="Answer Boxes"
        description="Guide students to write organized, aligned answers"
        value={displayRules.answerBoxes}
        onChange={(value) => updateRule("answerBoxes", value)}
        isDark={isDark}
        resolvedValue={resolvedDisplayRules?.answerBoxes}
        resolvedAdditionValue={resolvedAdditionRules?.answerBoxes}
        resolvedSubtractionValue={resolvedSubtractionRules?.answerBoxes}
      />

      <RuleThermometer
        label="Place Value Colors"
        description="Reinforce place value understanding visually"
        value={displayRules.placeValueColors}
        onChange={(value) => updateRule("placeValueColors", value)}
        isDark={isDark}
        resolvedValue={resolvedDisplayRules?.placeValueColors}
        resolvedAdditionValue={resolvedAdditionRules?.placeValueColors}
        resolvedSubtractionValue={resolvedSubtractionRules?.placeValueColors}
      />

      <RuleThermometer
        label={
          formState.operator === "subtraction"
            ? "Borrow Boxes"
            : formState.operator === "mixed"
              ? "Carry/Borrow Boxes"
              : "Carry Boxes"
        }
        description={
          formState.operator === "subtraction"
            ? "Help students track borrowing during subtraction"
            : formState.operator === "mixed"
              ? "Help students track regrouping (carrying in addition, borrowing in subtraction)"
              : "Help students track regrouping during addition"
        }
        value={displayRules.carryBoxes}
        onChange={(value) => updateRule("carryBoxes", value)}
        isDark={isDark}
        resolvedValue={resolvedDisplayRules?.carryBoxes}
        resolvedAdditionValue={resolvedAdditionRules?.carryBoxes}
        resolvedSubtractionValue={resolvedSubtractionRules?.carryBoxes}
      />

      {(formState.operator === "subtraction" ||
        formState.operator === "mixed") && (
        <RuleThermometer
          label="Borrowed 10s Box"
          description="Box for adding 10 to borrowing digit"
          value={displayRules.borrowNotation}
          onChange={(value) => updateRule("borrowNotation", value)}
          isDark={isDark}
          resolvedValue={resolvedDisplayRules?.borrowNotation}
          resolvedAdditionValue={resolvedAdditionRules?.borrowNotation}
          resolvedSubtractionValue={resolvedSubtractionRules?.borrowNotation}
        />
      )}

      {(formState.operator === "subtraction" ||
        formState.operator === "mixed") && (
        <RuleThermometer
          label="Borrowing Hints"
          description="Show arrows and calculations guiding the borrowing process"
          value={displayRules.borrowingHints}
          onChange={(value) => updateRule("borrowingHints", value)}
          isDark={isDark}
          resolvedValue={resolvedDisplayRules?.borrowingHints}
          resolvedAdditionValue={resolvedAdditionRules?.borrowingHints}
          resolvedSubtractionValue={resolvedSubtractionRules?.borrowingHints}
        />
      )}

      <RuleThermometer
        label="Ten-Frames"
        description="Visualize regrouping with concrete counting tools"
        value={displayRules.tenFrames}
        onChange={(value) => updateRule("tenFrames", value)}
        isDark={isDark}
        resolvedValue={resolvedDisplayRules?.tenFrames}
        resolvedAdditionValue={resolvedAdditionRules?.tenFrames}
        resolvedSubtractionValue={resolvedSubtractionRules?.tenFrames}
      />
    </div>
  );
}
