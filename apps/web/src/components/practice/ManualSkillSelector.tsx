"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import useMeasure from "react-use-measure";
import {
  SKILL_CATEGORIES,
  type SkillCategoryKey,
} from "@/constants/skillCategories";
import { Z_INDEX } from "@/constants/zIndex";
import { useTheme } from "@/contexts/ThemeContext";
import type { PlayerSkillMastery } from "@/db/schema/player-skill-mastery";
import type {
  MasteryClassification,
  SkillBktResult,
} from "@/lib/curriculum/bkt/types";
import { BASE_SKILL_COMPLEXITY } from "@/utils/skillComplexity";
import { css } from "../../../styled-system/css";

// Use the same order as the original component for UI display
const DISPLAY_ORDER: SkillCategoryKey[] = [
  "basic",
  "fiveComplements",
  "fiveComplementsSub",
  "tenComplements",
  "tenComplementsSub",
  "advanced",
];

type CategoryKey = SkillCategoryKey;

/**
 * ComplexityBadge - Shows the base complexity cost for a skill
 *
 * Base costs represent intrinsic mechanical complexity:
 * - 0★ Trivial: Basic bead movements, no mental calculation
 * - 1★ Simple: Single complement (one mental substitution)
 * - 2★ Cross-column: Operations that cross column boundaries (ten complements)
 * - 3★ Cascading: Multi-column cascading operations (advanced)
 */
function ComplexityBadge({
  skillId,
  isDark,
}: {
  skillId: string;
  isDark: boolean;
}) {
  const baseCost = BASE_SKILL_COMPLEXITY[skillId] ?? 1;

  // No badge for zero-cost (trivial) skills
  if (baseCost === 0) {
    return null;
  }

  const styles: Record<number, { bg: string; text: string; label: string }> = {
    1: {
      bg: isDark ? "green.900" : "green.100",
      text: isDark ? "green.300" : "green.700",
      label: "1★",
    },
    2: {
      bg: isDark ? "orange.900" : "orange.100",
      text: isDark ? "orange.300" : "orange.700",
      label: "2★",
    },
    3: {
      bg: isDark ? "red.900" : "red.100",
      text: isDark ? "red.300" : "red.700",
      label: "3★",
    },
  };

  const style = styles[baseCost] ?? styles[1];

  return (
    <span
      data-element="complexity-badge"
      data-complexity={baseCost}
      title={`Base complexity: ${baseCost}`}
      className={css({
        fontSize: "10px",
        fontWeight: "bold",
        px: "1.5",
        py: "0.5",
        borderRadius: "sm",
        bg: style.bg,
        color: style.text,
        whiteSpace: "nowrap",
      })}
    >
      {style.label}
    </span>
  );
}

/**
 * ComplexityLegend - Shows explanation of complexity badges
 */
function ComplexityLegend({ isDark }: { isDark: boolean }) {
  return (
    <div
      data-element="complexity-legend"
      className={css({
        display: "flex",
        flexWrap: "wrap",
        gap: "2",
        fontSize: "xs",
        color: isDark ? "gray.400" : "gray.600",
        py: "1.5",
        px: "2",
        bg: isDark ? "gray.750" : "gray.50",
        borderRadius: "md",
        alignItems: "center",
      })}
    >
      <span className={css({ fontWeight: "medium", mr: "1" })}>
        Complexity:
      </span>
      <span
        className={css({ display: "flex", alignItems: "center", gap: "1" })}
      >
        <span
          className={css({
            fontSize: "10px",
            fontWeight: "bold",
            px: "1",
            py: "0.5",
            borderRadius: "sm",
            bg: isDark ? "green.900" : "green.100",
            color: isDark ? "green.300" : "green.700",
          })}
        >
          1★
        </span>
        Simple
      </span>
      <span
        className={css({ display: "flex", alignItems: "center", gap: "1" })}
      >
        <span
          className={css({
            fontSize: "10px",
            fontWeight: "bold",
            px: "1",
            py: "0.5",
            borderRadius: "sm",
            bg: isDark ? "orange.900" : "orange.100",
            color: isDark ? "orange.300" : "orange.700",
          })}
        >
          2★
        </span>
        Cross-column
      </span>
      <span
        className={css({ display: "flex", alignItems: "center", gap: "1" })}
      >
        <span
          className={css({
            fontSize: "10px",
            fontWeight: "bold",
            px: "1",
            py: "0.5",
            borderRadius: "sm",
            bg: isDark ? "red.900" : "red.100",
            color: isDark ? "red.300" : "red.700",
          })}
        >
          3★
        </span>
        Cascading
      </span>
    </div>
  );
}

/**
 * BktStatusBadge - Shows BKT mastery status for a skill
 *
 * Shows pKnown percentage with color indicating classification:
 * - Green (strong): pKnown >= 0.8
 * - Yellow (developing): 0.5 <= pKnown < 0.8
 * - Red (weak): pKnown < 0.5
 *
 * When skill is unchecked, shows faded gray badge.
 * When skill has no BKT data, shows nothing.
 */
function BktStatusBadge({
  bktResult,
  isSelected,
  isDark,
}: {
  bktResult: SkillBktResult | undefined;
  isSelected: boolean;
  isDark: boolean;
}) {
  if (!bktResult) return null;

  const { pKnown, masteryClassification } = bktResult;
  const percentage = Math.round(pKnown * 100);

  // Style based on classification and selection state
  const getStyle = (
    classification: MasteryClassification,
    selected: boolean,
  ) => {
    if (!selected) {
      // Faded gray for unchecked skills
      return {
        bg: isDark ? "gray.800" : "gray.100",
        color: isDark ? "gray.500" : "gray.500",
        label: `~${percentage}%`,
      };
    }

    switch (classification) {
      case "strong":
        return {
          bg: isDark ? "green.900" : "green.100",
          color: isDark ? "green.400" : "green.700",
          label: `Strong ~${percentage}%`,
        };
      case "developing":
        return {
          bg: isDark ? "yellow.900" : "yellow.100",
          color: isDark ? "yellow.400" : "yellow.700",
          label: `~${percentage}%`,
        };
      case "weak":
        return {
          bg: isDark ? "red.900" : "red.100",
          color: isDark ? "red.400" : "red.700",
          label: `Weak ~${percentage}%`,
        };
    }
  };

  const style = getStyle(masteryClassification, isSelected);

  return (
    <span
      data-element="bkt-status-badge"
      data-classification={masteryClassification}
      data-pknown={pKnown}
      title={`P(known) ≈ ${percentage}% - ${masteryClassification}`}
      className={css({
        fontSize: "10px",
        fontWeight: "medium",
        px: "1.5",
        py: "0.5",
        borderRadius: "sm",
        bg: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
      })}
    >
      {style.label}
    </span>
  );
}

/**
 * AnimatedAccordionContent - Spring-animated height accordion content
 *
 * Provides smooth expand/collapse animation using react-spring.
 * Content is always rendered (for measurement) but height is animated.
 */
function AnimatedAccordionContent({
  isOpen,
  children,
  className,
}: {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [measureRef, bounds] = useMeasure();

  const spring = useSpring({
    height: isOpen ? bounds.height : 0,
    opacity: isOpen ? 1 : 0,
    config: {
      tension: 280,
      friction: 28,
      clamp: true, // Prevents overshoot on height
    },
  });

  return (
    <animated.div
      data-element="animated-accordion-content"
      data-state={isOpen ? "open" : "closed"}
      style={{
        height: spring.height,
        opacity: spring.opacity,
        overflow: "hidden",
      }}
      className={className}
    >
      <div ref={measureRef}>{children}</div>
    </animated.div>
  );
}

/**
 * Book preset mappings (SAI Abacus Mind Math levels)
 */
const BOOK_PRESETS = {
  "sai-level-1": {
    name: "Abacus Mind Math - Level 1",
    description: "Basic operations, no regrouping",
    skills: [
      "basic.directAddition",
      "basic.heavenBead",
      "basic.simpleCombinations",
      "basic.directSubtraction",
      "basic.heavenBeadSubtraction",
      "basic.simpleCombinationsSub",
      "fiveComplements.4=5-1",
      "fiveComplements.3=5-2",
      "fiveComplements.2=5-3",
      "fiveComplements.1=5-4",
      "fiveComplementsSub.-4=-5+1",
      "fiveComplementsSub.-3=-5+2",
      "fiveComplementsSub.-2=-5+3",
      "fiveComplementsSub.-1=-5+4",
    ],
  },
  "sai-level-2": {
    name: "Abacus Mind Math - Level 2",
    description: "Five complements mastered, practicing speed",
    skills: [
      "basic.directAddition",
      "basic.heavenBead",
      "basic.simpleCombinations",
      "basic.directSubtraction",
      "basic.heavenBeadSubtraction",
      "basic.simpleCombinationsSub",
      "fiveComplements.4=5-1",
      "fiveComplements.3=5-2",
      "fiveComplements.2=5-3",
      "fiveComplements.1=5-4",
      "fiveComplementsSub.-4=-5+1",
      "fiveComplementsSub.-3=-5+2",
      "fiveComplementsSub.-2=-5+3",
      "fiveComplementsSub.-1=-5+4",
    ],
  },
  "sai-level-3": {
    name: "Abacus Mind Math - Level 3",
    description: "Ten complements (carrying/borrowing)",
    skills: [
      "basic.directAddition",
      "basic.heavenBead",
      "basic.simpleCombinations",
      "basic.directSubtraction",
      "basic.heavenBeadSubtraction",
      "basic.simpleCombinationsSub",
      "fiveComplements.4=5-1",
      "fiveComplements.3=5-2",
      "fiveComplements.2=5-3",
      "fiveComplements.1=5-4",
      "fiveComplementsSub.-4=-5+1",
      "fiveComplementsSub.-3=-5+2",
      "fiveComplementsSub.-2=-5+3",
      "fiveComplementsSub.-1=-5+4",
      "tenComplements.9=10-1",
      "tenComplements.8=10-2",
      "tenComplements.7=10-3",
      "tenComplements.6=10-4",
      "tenComplements.5=10-5",
      "tenComplements.4=10-6",
      "tenComplements.3=10-7",
      "tenComplements.2=10-8",
      "tenComplements.1=10-9",
      "tenComplementsSub.-9=+1-10",
      "tenComplementsSub.-8=+2-10",
      "tenComplementsSub.-7=+3-10",
      "tenComplementsSub.-6=+4-10",
      "tenComplementsSub.-5=+5-10",
      "tenComplementsSub.-4=+6-10",
      "tenComplementsSub.-3=+7-10",
      "tenComplementsSub.-2=+8-10",
      "tenComplementsSub.-1=+9-10",
    ],
  },
} as const;

export interface ManualSkillSelectorProps {
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Student name (for display) */
  studentName: string;
  /** Student ID for saving */
  playerId: string;
  /** Currently mastered skill IDs (deprecated, use skillMasteryData instead) */
  currentMasteredSkills?: string[];
  /** Full skill mastery data including lastPracticedAt for recency display */
  skillMasteryData?: PlayerSkillMastery[];
  /** Callback when save is clicked */
  onSave: (masteredSkillIds: string[]) => Promise<void>;
  /** BKT results map for showing skill mastery status */
  bktResultsMap?: Map<string, SkillBktResult>;
}

/**
 * ManualSkillSelector - Modal for manually setting student skill mastery
 *
 * Allows teachers to:
 * - Select which skills a student has mastered
 * - Use book level presets to auto-populate
 * - Adjust individual skills before saving
 */
export function ManualSkillSelector({
  open,
  onClose,
  studentName,
  playerId,
  currentMasteredSkills = [],
  skillMasteryData = [],
  onSave,
  bktResultsMap,
}: ManualSkillSelectorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(currentMasteredSkills),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Scroll state for showing/hiding scroll indicators
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Update scroll indicators based on scroll position
  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 5);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 5);
  }, []);

  // Check scroll state on mount, content changes, and category expansion
  useEffect(() => {
    updateScrollIndicators();
    // Re-check after a brief delay to account for accordion animation
    const timer = setTimeout(updateScrollIndicators, 300);
    return () => clearTimeout(timer);
  }, [expandedCategories, updateScrollIndicators]);

  // Track previous expanded categories to detect newly expanded ones
  const prevExpandedRef = useRef<string[]>([]);

  // Scroll to show expanded category content optimally
  useEffect(() => {
    const prevExpanded = prevExpandedRef.current;
    const newlyExpanded = expandedCategories.filter(
      (cat) => !prevExpanded.includes(cat),
    );
    prevExpandedRef.current = expandedCategories;

    if (newlyExpanded.length === 0) return;

    // Wait for accordion animation to complete
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Find the newly expanded category element
      const categoryKey = newlyExpanded[0];
      const categoryEl = container.querySelector(
        `[data-category="${categoryKey}"]`,
      ) as HTMLElement;
      if (!categoryEl) return;

      const containerRect = container.getBoundingClientRect();
      const categoryRect = categoryEl.getBoundingClientRect();

      // Check if the entire category fits in the visible area
      const categoryHeight = categoryRect.height;
      const containerHeight = containerRect.height;
      const categoryTopRelative =
        categoryRect.top - containerRect.top + container.scrollTop;

      if (categoryHeight <= containerHeight) {
        // Category fits - scroll to show it entirely, with header at top if needed
        const categoryBottomRelative = categoryTopRelative + categoryHeight;
        const visibleBottom = container.scrollTop + containerHeight;

        if (categoryBottomRelative > visibleBottom) {
          // Category extends below visible area - scroll to show it
          // Prefer showing header at top if that shows more content
          const scrollToShowAll = categoryBottomRelative - containerHeight;
          const scrollToShowHeader = categoryTopRelative;

          // Use whichever scroll position shows the category better
          container.scrollTo({
            top: Math.max(scrollToShowHeader, scrollToShowAll),
            behavior: "smooth",
          });
        }
      } else {
        // Category doesn't fit - scroll header to top to show as many checkboxes as possible
        container.scrollTo({
          top: categoryTopRelative,
          behavior: "smooth",
        });
      }
    }, 150); // Wait for accordion animation

    return () => clearTimeout(timer);
  }, [expandedCategories]);

  // Track previous open state to detect open transition
  const wasOpenRef = useRef(open);

  // Sync selected skills only when modal OPENS (closed→open transition)
  // Don't reset when props change while already open (prevents flicker on save)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (justOpened) {
      setSelectedSkills(new Set(currentMasteredSkills));
    }
  }, [open, currentMasteredSkills]);

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === "") {
      // Clear all
      setSelectedSkills(new Set());
      return;
    }

    const preset = BOOK_PRESETS[presetKey as keyof typeof BOOK_PRESETS];
    if (preset) {
      setSelectedSkills(new Set(preset.skills));
      // Expand all categories to show changes
      setExpandedCategories(Object.keys(SKILL_CATEGORIES));
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const toggleCategory = (category: CategoryKey) => {
    const categorySkills = Object.keys(SKILL_CATEGORIES[category].skills).map(
      (skill) => `${category}.${skill}`,
    );
    const allSelected = categorySkills.every((id) => selectedSkills.has(id));

    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in category
        for (const id of categorySkills) {
          next.delete(id);
        }
      } else {
        // Select all in category
        for (const id of categorySkills) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(Array.from(selectedSkills));
      onClose();
    } catch (error) {
      console.error("Failed to save skills:", error);
      alert("Failed to save skills. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedSkills.size;
  const totalSkills = Object.values(SKILL_CATEGORIES).reduce(
    (sum, cat) => sum + Object.keys(cat.skills).length,
    0,
  );

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: "fixed",
            inset: 0,
            bg: "rgba(0, 0, 0, 0.5)",
            zIndex: Z_INDEX.MODAL_BACKDROP,
          })}
        />
        <Dialog.Content
          data-component="manual-skill-selector"
          className={css({
            position: "fixed",
            // Mobile: full screen using inset (handles iOS Safari URL bar properly)
            // Desktop: centered modal below nav
            top: { base: 0, md: "calc(10vh + 120px)" },
            left: { base: 0, md: "50%" },
            right: { base: 0, md: "auto" },
            bottom: { base: 0, md: "auto" },
            transform: { base: "none", md: "translateX(-50%)" },
            bg: isDark ? "gray.800" : "white",
            borderRadius: { base: 0, md: "xl" },
            boxShadow: { base: "none", md: "xl" },
            px: { base: "4", md: "6" },
            py: "4",
            maxWidth: { base: "none", md: "550px" },
            width: { base: "auto", md: "90vw" },
            height: { base: "auto", md: "70vh" },
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: Z_INDEX.MODAL,
          })}
        >
          {/* Fixed Header Section - kept compact */}
          <div
            data-section="modal-header"
            className={css({ flexShrink: 0, mb: "3" })}
          >
            {/* Title row with close hint */}
            <Dialog.Title
              className={css({
                fontSize: { base: "lg", md: "xl" },
                fontWeight: "bold",
                color: isDark ? "gray.100" : "gray.900",
                mb: "2",
              })}
            >
              Skills for {studentName}
            </Dialog.Title>

            <Dialog.Description
              className={css({
                fontSize: "sm",
                color: isDark ? "gray.400" : "gray.600",
                mb: "3",
              })}
            >
              Select mastered skills or import from a book level preset.
            </Dialog.Description>

            {/* Compact controls row */}
            <div
              data-element="controls-row"
              className={css({
                display: "flex",
                gap: "2",
                alignItems: "center",
                flexWrap: "wrap",
                mb: "2",
              })}
            >
              {/* Book Preset Selector - inline */}
              <select
                id="preset-select"
                data-element="book-preset-select"
                onChange={(e) => handlePresetChange(e.target.value)}
                className={css({
                  flex: "1",
                  minWidth: "180px",
                  px: "2",
                  py: "1.5",
                  border: "1px solid",
                  borderColor: isDark ? "gray.600" : "gray.300",
                  borderRadius: "md",
                  bg: isDark ? "gray.700" : "white",
                  color: isDark ? "gray.100" : "gray.900",
                  fontSize: "sm",
                  cursor: "pointer",
                  _focus: {
                    outline: "none",
                    borderColor: "blue.500",
                  },
                })}
              >
                <option value="">Import preset...</option>
                {Object.entries(BOOK_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name}
                  </option>
                ))}
              </select>

              {/* Selected count */}
              <span
                data-element="selected-count"
                className={css({
                  fontSize: "xs",
                  color: isDark ? "gray.400" : "gray.500",
                  whiteSpace: "nowrap",
                })}
              >
                {selectedCount}/{totalSkills}
              </span>

              {/* Clear All */}
              <button
                type="button"
                data-action="clear-all"
                onClick={() => setSelectedSkills(new Set())}
                className={css({
                  fontSize: "xs",
                  color: isDark ? "red.400" : "red.600",
                  bg: "transparent",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  _hover: { textDecoration: "underline" },
                })}
              >
                Clear
              </button>
            </div>

            {/* Complexity Legend - more compact */}
            <ComplexityLegend isDark={isDark} />
          </div>

          {/* Scrollable Skills Section with dynamic scroll indicators */}
          <div
            data-element="skills-scroll-wrapper"
            className={css({
              flex: 1,
              minHeight: 0,
              position: "relative",
              border: "1px solid",
              borderColor: isDark ? "gray.600" : "gray.200",
              borderRadius: "lg",
              overflow: "hidden",
            })}
          >
            {/* Top scroll shadow - appears when content is scrolled down */}
            <div
              data-element="scroll-indicator-top"
              className={css({
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "24px",
                background: isDark
                  ? "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)"
                  : "linear-gradient(to bottom, rgba(0,0,0,0.12), transparent)",
                pointerEvents: "none",
                zIndex: 2,
                opacity: canScrollUp ? 1 : 0,
                transition: "opacity 0.15s ease",
              })}
            />
            {/* Bottom scroll shadow - appears when more content below */}
            <div
              data-element="scroll-indicator-bottom"
              className={css({
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "24px",
                background: isDark
                  ? "linear-gradient(to top, rgba(0,0,0,0.4), transparent)"
                  : "linear-gradient(to top, rgba(0,0,0,0.12), transparent)",
                pointerEvents: "none",
                zIndex: 2,
                opacity: canScrollDown ? 1 : 0,
                transition: "opacity 0.15s ease",
              })}
            />
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollIndicators}
              data-element="skills-scroll-container"
              className={css({
                height: "100%",
                overflowY: "auto",
              })}
            >
              {/* Skills Accordion */}
              <Accordion.Root
                type="multiple"
                value={expandedCategories}
                onValueChange={setExpandedCategories}
              >
                {DISPLAY_ORDER.map((categoryKey) => {
                  const category = SKILL_CATEGORIES[categoryKey];
                  return { categoryKey, category };
                }).map(({ categoryKey, category }) => {
                  const categorySkillIds = Object.keys(category.skills).map(
                    (skill) => `${categoryKey}.${skill}`,
                  );
                  const selectedInCategory = categorySkillIds.filter((id) =>
                    selectedSkills.has(id),
                  ).length;
                  const allSelected =
                    selectedInCategory === categorySkillIds.length;
                  const someSelected = selectedInCategory > 0 && !allSelected;

                  return (
                    <Accordion.Item
                      key={categoryKey}
                      value={categoryKey}
                      data-category={categoryKey}
                      className={css({
                        borderBottom: "1px solid",
                        borderColor: isDark ? "gray.600" : "gray.200",
                        _last: { borderBottom: "none" },
                      })}
                    >
                      <Accordion.Header
                        className={css({
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        })}
                      >
                        <Accordion.Trigger
                          className={css({
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            bg: isDark ? "gray.700" : "gray.50",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            _hover: { bg: isDark ? "gray.600" : "gray.100" },
                          })}
                        >
                          <div
                            className={css({
                              display: "flex",
                              alignItems: "center",
                              gap: "3",
                            })}
                          >
                            <input
                              type="checkbox"
                              data-action="toggle-category"
                              data-category={categoryKey}
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected;
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleCategory(categoryKey);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={css({
                                width: "18px",
                                height: "18px",
                                cursor: "pointer",
                              })}
                            />
                            <span
                              className={css({
                                fontWeight: "semibold",
                                color: isDark ? "gray.100" : "gray.800",
                              })}
                            >
                              {category.name}
                            </span>
                          </div>
                          <div
                            className={css({
                              display: "flex",
                              alignItems: "center",
                              gap: "2",
                            })}
                          >
                            <span
                              className={css({
                                fontSize: "xs",
                                color: isDark ? "gray.400" : "gray.500",
                              })}
                            >
                              {selectedInCategory}/{categorySkillIds.length}
                            </span>
                            <span
                              className={css({
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "1",
                                fontSize: "xs",
                                color: isDark ? "gray.400" : "gray.500",
                              })}
                            >
                              <span>
                                {expandedCategories.includes(categoryKey)
                                  ? "Hide"
                                  : "Show"}
                              </span>
                              <span
                                className={css({
                                  display: "inline-block",
                                  transition: "transform 0.2s ease",
                                  transform: expandedCategories.includes(
                                    categoryKey,
                                  )
                                    ? "rotate(90deg)"
                                    : "rotate(0deg)",
                                })}
                              >
                                ›
                              </span>
                            </span>
                          </div>
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <AnimatedAccordionContent
                        isOpen={expandedCategories.includes(categoryKey)}
                        className={css({
                          bg: isDark ? "gray.800" : "white",
                        })}
                      >
                        <div className={css({ p: "3" })}>
                          {Object.entries(category.skills).map(
                            ([skillKey, skillName]) => {
                              const skillId = `${categoryKey}.${skillKey}`;
                              const isSelected = selectedSkills.has(skillId);
                              const bktResult = bktResultsMap?.get(skillId);

                              return (
                                <label
                                  key={skillId}
                                  data-skill={skillId}
                                  className={css({
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "3",
                                    padding: "8px 12px",
                                    borderRadius: "md",
                                    cursor: "pointer",
                                    _hover: {
                                      bg: isDark ? "gray.700" : "gray.50",
                                    },
                                  })}
                                >
                                  <input
                                    type="checkbox"
                                    data-action="toggle-skill"
                                    data-skill={skillId}
                                    checked={isSelected}
                                    onChange={() => toggleSkill(skillId)}
                                    className={css({
                                      width: "16px",
                                      height: "16px",
                                      cursor: "pointer",
                                    })}
                                  />
                                  <ComplexityBadge
                                    skillId={skillId}
                                    isDark={isDark}
                                  />
                                  <span
                                    className={css({
                                      fontSize: "sm",
                                      color: isSelected
                                        ? isDark
                                          ? "green.400"
                                          : "green.700"
                                        : isDark
                                          ? "gray.300"
                                          : "gray.700",
                                      fontWeight: isSelected
                                        ? "medium"
                                        : "normal",
                                      flex: 1,
                                    })}
                                  >
                                    {skillName}
                                  </span>
                                  {/* Show BKT status badge when data exists */}
                                  <BktStatusBadge
                                    bktResult={bktResult}
                                    isSelected={isSelected}
                                    isDark={isDark}
                                  />
                                </label>
                              );
                            },
                          )}
                        </div>
                      </AnimatedAccordionContent>
                    </Accordion.Item>
                  );
                })}
              </Accordion.Root>
            </div>
          </div>

          {/* Fixed Footer Section */}
          <div
            data-section="modal-footer"
            className={css({
              flexShrink: 0,
              display: "flex",
              gap: "3",
              justifyContent: "flex-end",
              pt: "4",
              borderTop: "1px solid",
              borderColor: isDark ? "gray.700" : "gray.200",
              mt: "2",
            })}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              data-action="cancel"
              className={css({
                px: "4",
                py: "2",
                fontSize: "sm",
                fontWeight: "medium",
                color: isDark ? "gray.300" : "gray.700",
                bg: "transparent",
                border: "1px solid",
                borderColor: isDark ? "gray.600" : "gray.300",
                borderRadius: "md",
                cursor: "pointer",
                _hover: { bg: isDark ? "gray.700" : "gray.50" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-action="save-skills"
              className={css({
                px: "4",
                py: "2",
                fontSize: "sm",
                fontWeight: "medium",
                color: "white",
                bg: "blue.600",
                border: "none",
                borderRadius: "md",
                cursor: "pointer",
                _hover: { bg: "blue.700" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              {isSaving ? "Saving..." : "Save Skills"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ManualSkillSelector;
