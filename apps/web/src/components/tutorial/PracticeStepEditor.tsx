"use client";

import { useCallback, useEffect, useState } from "react";
import { css } from "../../../styled-system/css";
import { vstack } from "../../../styled-system/patterns";
import type { PracticeStep } from "../../types/tutorial";
import { validatePracticeStepConfiguration } from "../../utils/problemGenerator";
import {
  createBasicAllowedConfiguration,
  skillConfigurationToSkillSets,
} from "../../utils/skillConfiguration";
import type { SkillConfiguration } from "./SkillSelector";
import {
  Button,
  EditorLayout,
  FormGroup,
  GridLayout,
  NumberInput,
  Section,
  TextInput,
} from "./shared/EditorComponents";

interface PracticeStepEditorProps {
  step: PracticeStep;
  onChange: (step: PracticeStep) => void;
  onDelete?: () => void;
  className?: string;
}

export function PracticeStepEditor({
  step,
  onChange,
  onDelete,
  className,
}: PracticeStepEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationResult, setValidationResult] = useState<ReturnType<
    typeof validatePracticeStepConfiguration
  > | null>(null);
  const [skillConfig, setSkillConfig] = useState<SkillConfiguration>(() => {
    // Initialize with a basic configuration for new steps or convert from existing
    return createBasicAllowedConfiguration();
  });

  const updateStep = useCallback(
    (updates: Partial<PracticeStep>) => {
      onChange({ ...step, ...updates });
    },
    [step, onChange],
  );

  const updateSkillConfiguration = useCallback(
    (config: SkillConfiguration) => {
      setSkillConfig(config);
      const { required, target, forbidden } =
        skillConfigurationToSkillSets(config);
      updateStep({
        requiredSkills: required,
        targetSkills: target,
        forbiddenSkills: forbidden,
      });
    },
    [updateStep],
  );

  // Helper functions for skill mode management
  const getModeStyles = (skillMode: string): any => {
    switch (skillMode) {
      case "off":
        return {
          bg: "gray.100",
          color: "gray.400",
          border: "1px solid",
          borderColor: "gray.200",
        };
      case "allowed":
        return {
          bg: "green.100",
          color: "green.800",
          border: "1px solid",
          borderColor: "green.300",
        };
      case "target":
        return {
          bg: "blue.100",
          color: "blue.800",
          border: "1px solid",
          borderColor: "blue.300",
        };
      case "forbidden":
        return {
          bg: "red.100",
          color: "red.800",
          border: "1px solid",
          borderColor: "red.300",
        };
      default:
        return {
          bg: "gray.100",
          color: "gray.600",
          border: "1px solid",
          borderColor: "gray.300",
        };
    }
  };

  const getModeIcon = (skillMode: string): string => {
    switch (skillMode) {
      case "off":
        return "⚫";
      case "allowed":
        return "✅";
      case "target":
        return "🎯";
      case "forbidden":
        return "❌";
      default:
        return "⚫";
    }
  };

  const getNextMode = (currentMode: string): string => {
    const modes = ["off", "allowed", "target", "forbidden"];
    const currentIndex = modes.indexOf(currentMode);
    return modes[(currentIndex + 1) % modes.length];
  };

  const updateSkill = useCallback(
    (category: string, skill: string, mode: string) => {
      const newSkills = { ...skillConfig };
      if (category === "basic") {
        newSkills.basic = { ...newSkills.basic, [skill]: mode };
      } else if (category === "fiveComplements") {
        newSkills.fiveComplements = {
          ...newSkills.fiveComplements,
          [skill]: mode,
        };
      }
      updateSkillConfiguration(newSkills);
    },
    [skillConfig, updateSkillConfiguration],
  );

  // Convert partial skill sets to full skill sets for the selector
  const _targetSkillsForSelector: SkillSet = {
    basic: {
      directAddition: step.targetSkills?.basic?.directAddition || false,
      heavenBead: step.targetSkills?.basic?.heavenBead || false,
      simpleCombinations: step.targetSkills?.basic?.simpleCombinations || false,
    },
    fiveComplements: {
      "4=5-1": step.targetSkills?.fiveComplements?.["4=5-1"] || false,
      "3=5-2": step.targetSkills?.fiveComplements?.["3=5-2"] || false,
      "2=5-3": step.targetSkills?.fiveComplements?.["2=5-3"] || false,
      "1=5-4": step.targetSkills?.fiveComplements?.["1=5-4"] || false,
    },
    tenComplements: {
      "9=10-1": step.targetSkills?.tenComplements?.["9=10-1"] || false,
      "8=10-2": step.targetSkills?.tenComplements?.["8=10-2"] || false,
      "7=10-3": step.targetSkills?.tenComplements?.["7=10-3"] || false,
      "6=10-4": step.targetSkills?.tenComplements?.["6=10-4"] || false,
      "5=10-5": step.targetSkills?.tenComplements?.["5=10-5"] || false,
      "4=10-6": step.targetSkills?.tenComplements?.["4=10-6"] || false,
      "3=10-7": step.targetSkills?.tenComplements?.["3=10-7"] || false,
      "2=10-8": step.targetSkills?.tenComplements?.["2=10-8"] || false,
      "1=10-9": step.targetSkills?.tenComplements?.["1=10-9"] || false,
    },
  };

  // Validate configuration when step changes
  useEffect(() => {
    const result = validatePracticeStepConfiguration(step);
    setValidationResult(result);
  }, [step]);

  const presetConfigurations = [
    {
      name: "Basic Addition Only",
      config: {
        ...createBasicAllowedConfiguration(),
        basic: {
          directAddition: "allowed",
          heavenBead: "off",
          simpleCombinations: "off",
        },
      } as SkillConfiguration,
    },
    {
      name: "Practice Heaven Bead",
      config: {
        ...createBasicAllowedConfiguration(),
        basic: {
          directAddition: "allowed",
          heavenBead: "target",
          simpleCombinations: "allowed",
        },
      } as SkillConfiguration,
    },
    {
      name: "Learn Five Complements",
      config: {
        ...createBasicAllowedConfiguration(),
        basic: {
          directAddition: "allowed",
          heavenBead: "allowed",
          simpleCombinations: "allowed",
        },
        fiveComplements: {
          "4=5-1": "target",
          "3=5-2": "target",
          "2=5-3": "off",
          "1=5-4": "off",
        },
      } as SkillConfiguration,
    },
    {
      name: "All Basic Skills",
      config: {
        ...createBasicAllowedConfiguration(),
        basic: {
          directAddition: "allowed",
          heavenBead: "allowed",
          simpleCombinations: "allowed",
        },
        fiveComplements: {
          "4=5-1": "allowed",
          "3=5-2": "allowed",
          "2=5-3": "allowed",
          "1=5-4": "allowed",
        },
      } as SkillConfiguration,
    },
  ];

  return (
    <EditorLayout
      title="Practice Step"
      onClose={() => {
        /* This will be replaced by parent handler */
      }}
      onDelete={onDelete}
      deleteLabel="Delete"
      className={className}
    >
      {/* Basic Info */}
      <FormGroup>
        <TextInput
          label="Title"
          value={step.title}
          onChange={(value) => updateStep({ title: value })}
          placeholder="Practice step title"
        />

        <TextInput
          label="Description"
          value={step.description}
          onChange={(value) => updateStep({ description: value })}
          placeholder="Brief description"
          multiline
          rows={2}
        />

        <FormGroup columns={2}>
          <NumberInput
            label="Problems"
            value={step.problemCount}
            onChange={(value) => updateStep({ problemCount: value })}
            min={1}
            max={50}
          />
          <NumberInput
            label="Max Terms"
            value={step.maxTerms}
            onChange={(value) => updateStep({ maxTerms: value })}
            min={2}
            max={10}
          />
        </FormGroup>
      </FormGroup>

      {/* Quick Setup Presets */}
      <Section title="Quick Setup" background="none">
        <GridLayout columns={2} gap={1}>
          {presetConfigurations.map((preset) => (
            <Button
              key={preset.name}
              onClick={() => updateSkillConfiguration(preset.config)}
              variant="secondary"
              size="xs"
              title={preset.name}
            >
              {preset.name.split(" ")[0]}
            </Button>
          ))}
        </GridLayout>
      </Section>

      {/* Compact Skill Configuration */}
      <div
        className={css({
          p: 2,
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          rounded: "md",
        })}
      >
        <h4
          className={css({
            fontSize: "sm",
            fontWeight: "medium",
            mb: 2,
            color: "gray.800",
          })}
        >
          Skills
        </h4>

        <div className={vstack({ gap: 2, alignItems: "stretch" })}>
          {/* Basic Operations - Compact */}
          <div>
            <h5
              className={css({
                fontSize: "xs",
                fontWeight: "medium",
                mb: 1,
                color: "gray.700",
              })}
            >
              Basic
            </h5>
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 1,
              })}
            >
              {[
                { key: "directAddition", label: "1-4" },
                { key: "heavenBead", label: "5" },
                { key: "simpleCombinations", label: "6-9" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    updateSkill(
                      "basic",
                      key,
                      getNextMode(
                        skillConfig.basic[
                          key as keyof typeof skillConfig.basic
                        ],
                      ),
                    )
                  }
                  className={css(
                    {
                      px: 1,
                      py: 1,
                      rounded: "sm",
                      fontSize: "xs",
                      cursor: "pointer",
                      textAlign: "center",
                    },
                    getModeStyles(
                      skillConfig.basic[key as keyof typeof skillConfig.basic],
                    ),
                  )}
                >
                  {getModeIcon(
                    skillConfig.basic[key as keyof typeof skillConfig.basic],
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Five Complements - Compact */}
          <div>
            <h5
              className={css({
                fontSize: "xs",
                fontWeight: "medium",
                mb: 1,
                color: "gray.700",
              })}
            >
              Five Complements
            </h5>
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
              })}
            >
              {[
                { key: "4=5-1", label: "4=5-1" },
                { key: "3=5-2", label: "3=5-2" },
                { key: "2=5-3", label: "2=5-3" },
                { key: "1=5-4", label: "1=5-4" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    updateSkill(
                      "fiveComplements",
                      key,
                      getNextMode(
                        skillConfig.fiveComplements[
                          key as keyof typeof skillConfig.fiveComplements
                        ],
                      ),
                    )
                  }
                  className={css(
                    {
                      px: 1,
                      py: 1,
                      rounded: "sm",
                      fontSize: "xs",
                      cursor: "pointer",
                      textAlign: "center",
                    },
                    getModeStyles(
                      skillConfig.fiveComplements[
                        key as keyof typeof skillConfig.fiveComplements
                      ],
                    ),
                  )}
                >
                  {getModeIcon(
                    skillConfig.fiveComplements[
                      key as keyof typeof skillConfig.fiveComplements
                    ],
                  )}{" "}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Toggle */}
      <Button
        onClick={() => setShowAdvanced(!showAdvanced)}
        variant="outline"
        size="xs"
      >
        {showAdvanced ? "▼" : "▶"} Advanced
      </Button>

      {/* Advanced Options */}
      {showAdvanced && (
        <Section title="Advanced Settings" background="gray">
          <FormGroup columns={2}>
            <NumberInput
              label="Min #"
              value={step.numberRange?.min || 1}
              onChange={(value) =>
                updateStep({
                  numberRange: {
                    ...step.numberRange,
                    min: value,
                    max: step.numberRange?.max || 9,
                  },
                })
              }
              min={1}
              max={99}
            />
            <NumberInput
              label="Max #"
              value={step.numberRange?.max || 9}
              onChange={(value) =>
                updateStep({
                  numberRange: {
                    min: step.numberRange?.min || 1,
                    max: value,
                  },
                })
              }
              min={1}
              max={99}
            />
          </FormGroup>
          <FormGroup columns={2}>
            <NumberInput
              label="Max Sum"
              value={step.sumConstraints?.maxSum || 9}
              onChange={(value) =>
                updateStep({
                  sumConstraints: {
                    ...step.sumConstraints,
                    maxSum: value,
                  },
                })
              }
              min={1}
              max={999}
            />
            <NumberInput
              label="Min Sum"
              value={step.sumConstraints?.minSum || ""}
              onChange={(value) =>
                updateStep({
                  sumConstraints: {
                    ...step.sumConstraints,
                    minSum: value || undefined,
                  },
                })
              }
              min={1}
              max={999}
              placeholder="Optional"
            />
          </FormGroup>
        </Section>
      )}

      {/* Validation */}
      {validationResult && !validationResult.isValid && (
        <Section background="none">
          <div
            className={css({
              p: 2,
              bg: "yellow.50",
              border: "1px solid",
              borderColor: "yellow.200",
              rounded: "sm",
              fontSize: "xs",
              color: "yellow.800",
            })}
          >
            ⚠️ {validationResult.warnings.length} warning(s)
          </div>
        </Section>
      )}
    </EditorLayout>
  );
}
