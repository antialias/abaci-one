"use client";

import { useCallback } from "react";
import { css } from "../../../styled-system/css";
import { hstack, vstack } from "../../../styled-system/patterns";
import type {
  SkillConfiguration,
  SkillMode,
} from "../../utils/skillConfiguration";

// Export for convenience
export type {
  SkillConfiguration,
  SkillMode,
} from "../../utils/skillConfiguration";

interface SkillSelectorProps {
  skills: SkillConfiguration;
  onChange: (skills: SkillConfiguration) => void;
  title?: string;
  className?: string;
}

export function SkillSelector({
  skills,
  onChange,
  title = "Skill Configuration",
  className,
}: SkillSelectorProps) {
  const updateSkill = useCallback(
    (category: keyof SkillConfiguration, skill: string, mode: SkillMode) => {
      const newSkills = { ...skills };

      if (category === "basic") {
        newSkills.basic = { ...newSkills.basic, [skill]: mode };
      } else if (category === "fiveComplements") {
        newSkills.fiveComplements = {
          ...newSkills.fiveComplements,
          [skill]: mode,
        };
      } else if (category === "tenComplements") {
        newSkills.tenComplements = {
          ...newSkills.tenComplements,
          [skill]: mode,
        };
      }

      onChange(newSkills);
    },
    [skills, onChange],
  );

  const getModeStyles = (skillMode: SkillMode): string => {
    switch (skillMode) {
      case "off":
        return css({
          bg: "gray.100",
          color: "gray.400",
          border: "1px solid",
          borderColor: "gray.200",
        });
      case "allowed":
        return css({
          bg: "green.100",
          color: "green.800",
          border: "1px solid",
          borderColor: "green.300",
        });
      case "target":
        return css({
          bg: "blue.100",
          color: "blue.800",
          border: "1px solid",
          borderColor: "blue.300",
        });
      case "forbidden":
        return css({
          bg: "red.100",
          color: "red.800",
          border: "1px solid",
          borderColor: "red.300",
        });
      default:
        return css({
          bg: "gray.100",
          color: "gray.600",
          border: "1px solid",
          borderColor: "gray.300",
        });
    }
  };

  const getModeIcon = (skillMode: SkillMode): string => {
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

  const getNextMode = (currentMode: SkillMode): SkillMode => {
    const modes: SkillMode[] = ["off", "allowed", "target", "forbidden"];
    const currentIndex = modes.indexOf(currentMode);
    return modes[(currentIndex + 1) % modes.length];
  };

  const SkillButton = ({
    category,
    skill,
    label,
    mode,
  }: {
    category: keyof SkillConfiguration;
    skill: string;
    label: string;
    mode: SkillMode;
  }) => (
    <button
      onClick={() => updateSkill(category, skill, getNextMode(mode))}
      className={css(
        {
          px: 3,
          py: 2,
          rounded: "md",
          fontSize: "sm",
          fontWeight: "medium",
          cursor: "pointer",
          transition: "all 0.2s",
          _hover: { opacity: 0.8 },
          display: "flex",
          alignItems: "center",
          gap: 2,
        },
        getModeStyles(mode),
      )}
      title={`Click to cycle: ${mode} → ${getNextMode(mode)}`}
    >
      <span>{getModeIcon(mode)}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div
      className={css(
        {
          p: 4,
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          rounded: "lg",
        },
        className,
      )}
    >
      <h4
        className={css({
          fontSize: "lg",
          fontWeight: "semibold",
          mb: 4,
          color: "gray.800",
        })}
      >
        {title}
      </h4>

      <div className={vstack({ gap: 4, alignItems: "stretch" })}>
        {/* Basic Operations */}
        <div>
          <h5
            className={css({
              fontSize: "md",
              fontWeight: "medium",
              mb: 2,
              color: "gray.700",
            })}
          >
            Basic Operations
          </h5>
          <div className={hstack({ gap: 2, flexWrap: "wrap" })}>
            <SkillButton
              category="basic"
              skill="directAddition"
              label="Direct Addition (1-4)"
              mode={skills.basic.directAddition}
            />
            <SkillButton
              category="basic"
              skill="heavenBead"
              label="Heaven Bead (5)"
              mode={skills.basic.heavenBead}
            />
            <SkillButton
              category="basic"
              skill="simpleCombinations"
              label="Simple Combinations (6-9)"
              mode={skills.basic.simpleCombinations}
            />
          </div>
        </div>

        {/* Five Complements */}
        <div>
          <h5
            className={css({
              fontSize: "md",
              fontWeight: "medium",
              mb: 2,
              color: "gray.700",
            })}
          >
            Five Complements
          </h5>
          <div className={hstack({ gap: 2, flexWrap: "wrap" })}>
            <SkillButton
              category="fiveComplements"
              skill="4=5-1"
              label="4 = 5 - 1"
              mode={skills.fiveComplements["4=5-1"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="3=5-2"
              label="3 = 5 - 2"
              mode={skills.fiveComplements["3=5-2"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="2=5-3"
              label="2 = 5 - 3"
              mode={skills.fiveComplements["2=5-3"]}
            />
            <SkillButton
              category="fiveComplements"
              skill="1=5-4"
              label="1 = 5 - 4"
              mode={skills.fiveComplements["1=5-4"]}
            />
          </div>
        </div>

        {/* Ten Complements */}
        <div>
          <h5
            className={css({
              fontSize: "md",
              fontWeight: "medium",
              mb: 2,
              color: "gray.700",
            })}
          >
            Ten Complements
          </h5>
          <div className={hstack({ gap: 2, flexWrap: "wrap" })}>
            {Object.entries(skills.tenComplements).map(([complement, mode]) => (
              <SkillButton
                key={complement}
                category="tenComplements"
                skill={complement}
                label={complement}
                mode={mode}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className={css({
          mt: 4,
          pt: 3,
          borderTop: "1px solid",
          borderColor: "gray.200",
          fontSize: "xs",
          color: "gray.600",
        })}
      >
        <div className={css({ fontWeight: "medium", mb: 2 })}>
          Click skills to cycle through modes:
        </div>
        <div className={hstack({ gap: 4, flexWrap: "wrap" })}>
          <div className={hstack({ gap: 1, alignItems: "center" })}>
            <span>⚫</span>
            <span>Off - Not used</span>
          </div>
          <div className={hstack({ gap: 1, alignItems: "center" })}>
            <span>✅</span>
            <span>Allowed - Can be used</span>
          </div>
          <div className={hstack({ gap: 1, alignItems: "center" })}>
            <span>🎯</span>
            <span>Target - Focus practice</span>
          </div>
          <div className={hstack({ gap: 1, alignItems: "center" })}>
            <span>❌</span>
            <span>Forbidden - Not learned yet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
