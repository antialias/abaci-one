"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Accordion from "@radix-ui/react-accordion";
import * as Progress from "@radix-ui/react-progress";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Tooltip from "@radix-ui/react-tooltip";
import { css } from "@styled/css";
import type { SkillId, SkillDefinition } from "../../skills";

interface AllSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillDefinition[];
  currentSkillId: SkillId;
  masteryStates: Map<SkillId, boolean>;
  onSelectSkill: (skillId: SkillId) => void;
  onToggleMastery: (skillId: SkillId, isMastered: boolean) => void;
  isDark?: boolean;
}

type FilterTab = "all" | "mastered" | "available" | "locked";

/**
 * All Skills Modal - Skills Mastery Dashboard
 *
 * Synthesized design combining:
 * - Progress overview at top
 * - Tabbed filtering (All/Mastered/Available/Locked)
 * - Grouped accordion sections
 * - Streamlined skill cards with color-coded stripes
 * - Quick mastery checkboxes + practice buttons
 */
export function AllSkillsModal({
  isOpen,
  onClose,
  skills,
  currentSkillId,
  masteryStates,
  onSelectSkill,
  onToggleMastery,
  isDark = false,
}: AllSkillsModalProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  if (!isOpen) return null;

  // Calculate progress
  const masteredCount = skills.filter(
    (s) => masteryStates.get(s.id) === true,
  ).length;
  const totalCount = skills.length;
  const progressPercentage =
    totalCount > 0 ? (masteredCount / totalCount) * 100 : 0;

  // Categorize skills
  const masteredSkills = skills.filter((s) => masteryStates.get(s.id) === true);
  const availableSkills = skills.filter((s) => {
    const isMastered = masteryStates.get(s.id) === true;
    const prerequisitesMet = s.prerequisites.every(
      (prereqId) => masteryStates.get(prereqId) === true,
    );
    const isAvailable = s.prerequisites.length === 0 || prerequisitesMet;
    return !isMastered && isAvailable;
  });
  const lockedSkills = skills.filter((s) => {
    const isMastered = masteryStates.get(s.id) === true;
    const prerequisitesMet = s.prerequisites.every(
      (prereqId) => masteryStates.get(prereqId) === true,
    );
    const isAvailable = s.prerequisites.length === 0 || prerequisitesMet;
    return !isMastered && !isAvailable;
  });

  // Filter skills based on active tab
  const getFilteredSkills = (): SkillDefinition[] => {
    switch (activeTab) {
      case "mastered":
        return masteredSkills;
      case "available":
        return availableSkills;
      case "locked":
        return lockedSkills;
      case "all":
      default:
        return skills;
    }
  };

  const filteredSkills = getFilteredSkills();

  // Helper to render a skill card
  const renderSkillCard = (skill: SkillDefinition) => {
    const isMastered = masteryStates.get(skill.id) === true;
    const isCurrent = skill.id === currentSkillId;
    const prerequisitesMet = skill.prerequisites.every(
      (prereqId) => masteryStates.get(prereqId) === true,
    );
    const isAvailable = skill.prerequisites.length === 0 || prerequisitesMet;
    const isLocked = !isAvailable;

    // Determine stripe color
    const stripeColor = isMastered
      ? "green.500"
      : isCurrent
        ? "blue.500"
        : isLocked
          ? "gray.400"
          : "gray.300";

    // Determine icon
    const icon = isMastered ? "✓" : isCurrent ? "⭐" : isLocked ? "🔒" : "○";

    return (
      <div
        key={skill.id}
        data-skill-id={skill.id}
        className={css({
          position: "relative",
          padding: "1rem",
          paddingLeft: "1.25rem",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: isDark ? "gray.600" : "gray.200",
          backgroundColor: isDark ? "gray.700" : "white",
          opacity: isLocked ? 0.7 : 1,
          transition: "all 0.2s",
          _hover: {
            borderColor: isDark ? "gray.500" : "gray.300",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
          },
        })}
      >
        {/* Color-coded left stripe */}
        <div
          className={css({
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "4px",
            borderTopLeftRadius: "8px",
            borderBottomLeftRadius: "8px",
            backgroundColor: stripeColor,
          })}
        />

        <div
          className={css({
            display: "flex",
            gap: "1rem",
            alignItems: "flex-start",
          })}
        >
          {/* Icon + Name + Description */}
          <div className={css({ flex: 1, minWidth: 0 })}>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              })}
            >
              <span className={css({ fontSize: "1.125rem", lineHeight: "1" })}>
                {icon}
              </span>
              <h4
                className={css({
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: isDark ? "white" : "gray.900",
                })}
              >
                {skill.name}
                {isCurrent && (
                  <span
                    className={css({
                      marginLeft: "0.5rem",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "blue.600",
                    })}
                  >
                    (Current)
                  </span>
                )}
              </h4>
            </div>

            <p
              className={css({
                fontSize: "0.8125rem",
                color: isDark ? "gray.400" : "gray.600",
                lineHeight: "1.4",
              })}
            >
              {skill.description}
            </p>

            {/* Prerequisites for locked skills */}
            {isLocked && skill.prerequisites.length > 0 && (
              <p
                className={css({
                  fontSize: "0.75rem",
                  color: isDark ? "gray.500" : "gray.500",
                  marginTop: "0.5rem",
                  fontStyle: "italic",
                })}
              >
                Requires:{" "}
                {skill.prerequisites
                  .map((prereqId) => {
                    const prereq = skills.find((s) => s.id === prereqId);
                    return prereq?.name || prereqId;
                  })
                  .join(", ")}
              </p>
            )}
          </div>

          {/* Actions: Checkbox + Practice Button */}
          <div
            className={css({
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexShrink: 0,
            })}
          >
            {/* Mastery Checkbox */}
            {isAvailable && (
              <Tooltip.Root delayDuration={200}>
                <Tooltip.Trigger asChild>
                  <div>
                    <Checkbox.Root
                      checked={isMastered}
                      onCheckedChange={(checked) =>
                        onToggleMastery(skill.id, checked === true)
                      }
                      className={css({
                        width: "20px",
                        height: "20px",
                        borderRadius: "4px",
                        border: "2px solid",
                        borderColor: isMastered
                          ? "green.500"
                          : isDark
                            ? "gray.500"
                            : "gray.300",
                        backgroundColor: isMastered
                          ? "green.500"
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        _hover: {
                          borderColor: isMastered ? "green.600" : "blue.400",
                        },
                      })}
                    >
                      <Checkbox.Indicator
                        className={css({
                          color: "white",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        })}
                      >
                        ✓
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    className={css({
                      backgroundColor: isDark ? "gray.800" : "gray.900",
                      color: "white",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      zIndex: 10002,
                    })}
                  >
                    {isMastered ? "Mark as not mastered" : "Mark as mastered"}
                    <Tooltip.Arrow
                      className={css({
                        fill: isDark ? "gray.800" : "gray.900",
                      })}
                    />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}

            {/* Practice Button */}
            {!isCurrent && isAvailable && (
              <button
                type="button"
                data-action="select-skill"
                onClick={() => {
                  onSelectSkill(skill.id);
                  onClose();
                }}
                className={css({
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: isDark ? "gray.500" : "gray.300",
                  backgroundColor: isDark ? "gray.600" : "white",
                  color: isDark ? "gray.200" : "gray.700",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  _hover: {
                    borderColor: "blue.400",
                    backgroundColor: "blue.50",
                    color: "blue.700",
                  },
                })}
              >
                Practice
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-component="all-skills-modal-overlay"
      className={css({
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "1rem",
      })}
      onClick={onClose}
    >
      <div
        data-component="all-skills-modal"
        className={css({
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "12px",
          maxWidth: "700px",
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Progress */}
        <div
          className={css({
            padding: "1.5rem",
            borderBottom: "1px solid",
            borderColor: isDark ? "gray.700" : "gray.200",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            })}
          >
            <div className={css({ flex: 1 })}>
              <h2
                className={css({
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: isDark ? "white" : "gray.900",
                  marginBottom: "0.5rem",
                })}
              >
                Skills Mastery Dashboard
              </h2>
              <p
                className={css({
                  fontSize: "0.875rem",
                  color: isDark ? "gray.400" : "gray.600",
                  marginBottom: "0.75rem",
                })}
              >
                {skills[0]?.operator === "addition"
                  ? "Addition"
                  : "Subtraction"}{" "}
                • {masteredCount}/{totalCount} skills mastered
              </p>

              {/* Progress Bar */}
              <Progress.Root
                value={progressPercentage}
                className={css({
                  width: "100%",
                  height: "8px",
                  backgroundColor: isDark ? "gray.700" : "gray.200",
                  borderRadius: "999px",
                  overflow: "hidden",
                })}
              >
                <Progress.Indicator
                  className={css({
                    width: "100%",
                    height: "100%",
                    backgroundColor: "green.500",
                    transition: "transform 0.3s ease",
                  })}
                  style={{
                    transform: `translateX(-${100 - progressPercentage}%)`,
                  }}
                />
              </Progress.Root>
              <p
                className={css({
                  fontSize: "0.75rem",
                  color: isDark ? "gray.500" : "gray.500",
                  marginTop: "0.25rem",
                })}
              >
                {Math.round(progressPercentage)}% complete
              </p>
            </div>

            <button
              type="button"
              data-action="close-modal"
              onClick={onClose}
              className={css({
                padding: "0.5rem",
                marginLeft: "1rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: isDark ? "gray.400" : "gray.600",
                cursor: "pointer",
                fontSize: "1.5rem",
                lineHeight: "1",
                transition: "all 0.2s",
                _hover: {
                  backgroundColor: isDark ? "gray.700" : "gray.100",
                  color: isDark ? "gray.200" : "gray.900",
                },
              })}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs for Filtering */}
        <Tooltip.Provider delayDuration={300}>
          <Tabs.Root
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as FilterTab)}
            className={css({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            })}
          >
            <Tabs.List
              className={css({
                display: "flex",
                gap: "0.5rem",
                padding: "1rem 1.5rem 0 1.5rem",
                borderBottom: "1px solid",
                borderColor: isDark ? "gray.700" : "gray.200",
                flexShrink: 0,
              })}
            >
              {[
                { value: "all", label: "All", count: skills.length },
                {
                  value: "mastered",
                  label: "Mastered",
                  count: masteredSkills.length,
                },
                {
                  value: "available",
                  label: "Available",
                  count: availableSkills.length,
                },
                {
                  value: "locked",
                  label: "Locked",
                  count: lockedSkills.length,
                },
              ].map((tab) => (
                <Tabs.Trigger key={tab.value} value={tab.value} asChild>
                  <button
                    type="button"
                    className={css({
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      border: "none",
                      borderBottom: "2px solid",
                      borderColor: "transparent",
                      color: isDark ? "gray.400" : "gray.600",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: "transparent",
                      _hover: {
                        color: isDark ? "gray.200" : "gray.900",
                      },
                      "&[data-state=active]": {
                        color: "blue.600",
                        borderColor: "blue.600",
                      },
                    })}
                  >
                    {tab.label} ({tab.count})
                  </button>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Tab Content - Skills List */}
            <Tabs.Content
              value={activeTab}
              className={css({
                flex: 1,
                overflowY: "auto",
                padding: "1rem 1.5rem",
                minHeight: 0,
              })}
            >
              {filteredSkills.length === 0 ? (
                <div
                  className={css({
                    padding: "2rem",
                    textAlign: "center",
                    color: isDark ? "gray.400" : "gray.600",
                    fontSize: "0.875rem",
                  })}
                >
                  No {activeTab} skills
                </div>
              ) : (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  })}
                >
                  {filteredSkills.map((skill) => renderSkillCard(skill))}
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Tooltip.Provider>

        {/* Footer */}
        <div
          className={css({
            padding: "1rem 1.5rem",
            borderTop: "1px solid",
            borderColor: isDark ? "gray.700" : "gray.200",
            display: "flex",
            justifyContent: "flex-end",
          })}
        >
          <button
            type="button"
            data-action="close-modal"
            onClick={onClose}
            className={css({
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: isDark ? "gray.600" : "gray.300",
              backgroundColor: isDark ? "gray.700" : "white",
              color: isDark ? "gray.200" : "gray.700",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              _hover: {
                backgroundColor: isDark ? "gray.600" : "gray.50",
              },
            })}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
