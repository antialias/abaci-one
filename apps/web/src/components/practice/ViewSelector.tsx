"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../styled-system/css";

/**
 * Available student list views
 */
export type StudentView =
  | "all"
  | "my-children"
  | "my-children-active"
  | "enrolled"
  | "in-classroom"
  | "in-classroom-active"
  | "needs-attention";

interface ViewConfig {
  id: StudentView;
  label: string;
  icon: string;
  /** Only show this view to users who have a classroom */
  teacherOnly?: boolean;
  /** Parent view ID - this is a sub-view that appears when parent has active sessions */
  parentView?: StudentView;
  /** Short label for nested display */
  shortLabel?: string;
}

export const VIEW_CONFIGS: ViewConfig[] = [
  {
    id: "all",
    label: "All",
    icon: "👥",
  },
  {
    id: "needs-attention",
    label: "Needs Attention",
    shortLabel: "Attention",
    icon: "🚨",
  },
  {
    id: "my-children",
    label: "My Children",
    icon: "👶",
  },
  {
    id: "my-children-active",
    label: "Active Sessions",
    shortLabel: "Active",
    icon: "🎯",
    parentView: "my-children",
  },
  {
    id: "enrolled",
    label: "Enrolled",
    icon: "📋",
    teacherOnly: true,
  },
  {
    id: "in-classroom",
    label: "In Classroom",
    shortLabel: "Present",
    icon: "🏫",
    teacherOnly: true,
  },
  {
    id: "in-classroom-active",
    label: "Active Sessions",
    shortLabel: "Active",
    icon: "🎯",
    parentView: "in-classroom",
    teacherOnly: true,
  },
];

// Map parent views to their subviews (for parent's "My Children" compound chip)
const PARENT_TO_SUBVIEW: Partial<Record<StudentView, StudentView>> = {
  "my-children": "my-children-active",
};

// Teacher compound chip: enrolled → in-classroom → in-classroom-active
const TEACHER_COMPOUND_VIEWS: StudentView[] = [
  "enrolled",
  "in-classroom",
  "in-classroom-active",
];

interface ViewSelectorProps {
  /** Currently selected view */
  currentView: StudentView;
  /** Callback when view changes */
  onViewChange: (view: StudentView) => void;
  /** Views to show (filtered by user type) */
  availableViews: StudentView[];
  /** Counts per view (e.g., { all: 5, 'my-children': 3 }) */
  viewCounts?: Partial<Record<StudentView, number>>;
  /** Hide the teacher compound chip (when rendered externally in a card) */
  hideTeacherCompound?: boolean;
  /** Optional classroom card to render inline (for teachers) */
  classroomCard?: ReactNode;
}

/**
 * View selector chips for filtering student list.
 *
 * Shows view options as clickable chips. Views with active session filters
 * are rendered as compound chips with connected parent/filter sections.
 */
export function ViewSelector({
  currentView,
  onViewChange,
  availableViews,
  viewCounts = {},
  hideTeacherCompound = false,
  classroomCard,
}: ViewSelectorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Check if teacher compound views are available
  const hasTeacherCompound = TEACHER_COMPOUND_VIEWS.some((v) =>
    availableViews.includes(v),
  );

  // Build a set of subview IDs that are available (have active count > 0)
  const availableSubviews = new Set(
    availableViews.filter(
      (v) => VIEW_CONFIGS.find((c) => c.id === v)?.parentView,
    ),
  );

  // Filter views for rendering:
  // - Exclude teacher compound views (rendered separately)
  // - Exclude subviews (rendered as part of compound chips)
  const regularViews = availableViews.filter((viewId) => {
    // Exclude teacher compound views
    if (TEACHER_COMPOUND_VIEWS.includes(viewId)) return false;
    // Exclude subviews (they're part of compound chips)
    if (VIEW_CONFIGS.find((c) => c.id === viewId)?.parentView) return false;
    return true;
  });

  return (
    <div
      data-component="view-selector"
      className={css({
        display: "flex",
        gap: "8px",
        alignItems: "flex-end",
        // Mobile: horizontal scroll, Desktop: wrap
        overflowX: "auto",
        overflowY: "hidden",
        flexWrap: { base: "nowrap", md: "wrap" },
        // Hide scrollbar but allow scroll
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        // Prevent text selection while swiping
        userSelect: "none",
        // Add padding for mobile so chips don't touch edge when scrolling
        paddingRight: { base: "8px", md: 0 },
      })}
    >
      {regularViews.map((viewId) => {
        const config = VIEW_CONFIGS.find((v) => v.id === viewId);
        if (!config) return null;

        const subviewId = PARENT_TO_SUBVIEW[viewId];
        const subviewConfig = subviewId
          ? VIEW_CONFIGS.find((c) => c.id === subviewId)
          : null;
        const hasActiveSubview = subviewId && availableSubviews.has(subviewId);

        const isParentActive = currentView === viewId;
        const isSubviewActive = subviewId && currentView === subviewId;

        const parentCount = viewCounts[viewId];
        const activeCount = subviewId ? viewCounts[subviewId] : undefined;

        // If this view has a subview with active sessions, render as compound chip
        if (hasActiveSubview && subviewConfig) {
          return (
            <CompoundChip
              key={viewId}
              parentConfig={config}
              subviewConfig={subviewConfig}
              isParentActive={isParentActive}
              isSubviewActive={!!isSubviewActive}
              parentCount={parentCount}
              activeCount={activeCount}
              onParentClick={() => onViewChange(viewId)}
              onSubviewClick={() => onViewChange(subviewId)}
              isDark={isDark}
            />
          );
        }

        // Otherwise render as simple chip
        return (
          <SimpleChip
            key={viewId}
            config={config}
            isActive={isParentActive}
            count={parentCount}
            onClick={() => onViewChange(viewId)}
            isDark={isDark}
          />
        );
      })}

      {/* Teacher compound chip: Enrolled → In Classroom → Active */}
      {hasTeacherCompound && !hideTeacherCompound && (
        <TeacherCompoundChip
          currentView={currentView}
          onViewChange={onViewChange}
          viewCounts={viewCounts}
          availableViews={availableViews}
          isDark={isDark}
        />
      )}

      {/* Classroom card (for teachers) - rendered inline last */}
      {classroomCard}
    </div>
  );
}

interface SimpleChipProps {
  config: ViewConfig;
  isActive: boolean;
  count?: number;
  onClick: () => void;
  isDark: boolean;
}

function SimpleChip({
  config,
  isActive,
  count,
  onClick,
  isDark,
}: SimpleChipProps) {
  // Needs-attention uses orange/red to indicate urgency
  const isAttention = config.id === "needs-attention";
  const colorScheme = isAttention ? "orange" : "blue";

  return (
    <button
      type="button"
      data-view={config.id}
      data-active={isActive}
      onClick={onClick}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "16px",
        border: "1px solid",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "medium",
        transition: "all 0.15s ease",
        flexShrink: 0,
        whiteSpace: "nowrap",
        bg: isActive
          ? isDark
            ? `${colorScheme}.900`
            : `${colorScheme}.100`
          : isDark
            ? "gray.800"
            : "white",
        borderColor: isActive
          ? isDark
            ? `${colorScheme}.600`
            : `${colorScheme}.300`
          : isDark
            ? "gray.600"
            : "gray.300",
        color: isActive
          ? isDark
            ? `${colorScheme}.300`
            : `${colorScheme}.700`
          : isDark
            ? "gray.300"
            : "gray.700",
        _hover: {
          borderColor: isActive
            ? isDark
              ? `${colorScheme}.500`
              : `${colorScheme}.400`
            : isDark
              ? "gray.500"
              : "gray.400",
          bg: isActive
            ? isDark
              ? `${colorScheme}.800`
              : `${colorScheme}.200`
            : isDark
              ? "gray.700"
              : "gray.50",
        },
      })}
    >
      <span>{config.icon}</span>
      <span>{config.shortLabel ?? config.label}</span>
      {count !== undefined && (
        <span
          data-element="view-count"
          className={css({
            fontSize: "11px",
            fontWeight: "bold",
            padding: "1px 6px",
            borderRadius: "10px",
            bg: isActive
              ? isDark
                ? `${colorScheme}.700`
                : `${colorScheme}.200`
              : isDark
                ? "gray.700"
                : "gray.200",
          })}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface CompoundChipProps {
  parentConfig: ViewConfig;
  subviewConfig: ViewConfig;
  isParentActive: boolean;
  isSubviewActive: boolean;
  parentCount?: number;
  activeCount?: number;
  onParentClick: () => void;
  onSubviewClick: () => void;
  isDark: boolean;
}

/**
 * Compound chip that groups a parent view with its active session filter.
 *
 * ┌─────────────────────────────────────────┐
 * │ 👶 My Children (3)  │  🎯 Active (1)   │
 * └─────────────────────────────────────────┘
 *         ↑ parent part      ↑ filter part
 */
function CompoundChip({
  parentConfig,
  subviewConfig,
  isParentActive,
  isSubviewActive,
  parentCount,
  activeCount,
  onParentClick,
  onSubviewClick,
  isDark,
}: CompoundChipProps) {
  // Either part being selected makes the whole compound "active"
  const isEitherActive = isParentActive || isSubviewActive;

  return (
    <div
      data-component="compound-chip"
      data-parent-view={parentConfig.id}
      data-active={isEitherActive}
      className={css({
        display: "flex",
        alignItems: "stretch",
        borderRadius: "16px",
        border: "1px solid",
        overflow: "hidden",
        flexShrink: 0,
        transition: "all 0.15s ease",
        borderColor: isEitherActive
          ? isDark
            ? "blue.600"
            : "blue.300"
          : isDark
            ? "gray.600"
            : "gray.300",
      })}
    >
      {/* Parent part - left side */}
      <button
        type="button"
        data-view={parentConfig.id}
        data-active={isParentActive}
        data-role="parent"
        onClick={onParentClick}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "medium",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
          border: "none",
          borderRight: "1px solid",
          // Parent selected = blue background
          bg: isParentActive
            ? isDark
              ? "blue.900"
              : "blue.100"
            : isSubviewActive
              ? isDark
                ? "gray.800"
                : "gray.50"
              : isDark
                ? "gray.800"
                : "white",
          borderColor: isDark ? "gray.600" : "gray.300",
          color: isParentActive
            ? isDark
              ? "blue.300"
              : "blue.700"
            : isDark
              ? "gray.300"
              : "gray.700",
          _hover: {
            bg: isParentActive
              ? isDark
                ? "blue.800"
                : "blue.200"
              : isDark
                ? "gray.700"
                : "gray.100",
          },
        })}
      >
        <span>{parentConfig.icon}</span>
        <span>{parentConfig.label}</span>
        {parentCount !== undefined && (
          <span
            data-element="view-count"
            className={css({
              fontSize: "11px",
              fontWeight: "bold",
              padding: "1px 6px",
              borderRadius: "10px",
              bg: isParentActive
                ? isDark
                  ? "blue.700"
                  : "blue.200"
                : isDark
                  ? "gray.700"
                  : "gray.200",
            })}
          >
            {parentCount}
          </span>
        )}
      </button>

      {/* Subview part - right side (active filter) */}
      <button
        type="button"
        data-view={subviewConfig.id}
        data-active={isSubviewActive}
        data-role="filter"
        onClick={onSubviewClick}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "medium",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
          border: "none",
          // Subview selected = green background (indicates "live" status)
          bg: isSubviewActive
            ? isDark
              ? "green.900"
              : "green.100"
            : isParentActive
              ? isDark
                ? "gray.800"
                : "gray.50"
              : isDark
                ? "gray.800"
                : "white",
          color: isSubviewActive
            ? isDark
              ? "green.300"
              : "green.700"
            : isDark
              ? "gray.400"
              : "gray.500",
          _hover: {
            bg: isSubviewActive
              ? isDark
                ? "green.800"
                : "green.200"
              : isDark
                ? "gray.700"
                : "gray.100",
            color: isSubviewActive
              ? isDark
                ? "green.200"
                : "green.800"
              : isDark
                ? "gray.300"
                : "gray.600",
          },
        })}
      >
        <span>{subviewConfig.icon}</span>
        <span>{subviewConfig.shortLabel ?? subviewConfig.label}</span>
        {activeCount !== undefined && (
          <span
            data-element="active-count"
            className={css({
              fontSize: "10px",
              fontWeight: "bold",
              padding: "1px 5px",
              borderRadius: "8px",
              bg: isSubviewActive
                ? isDark
                  ? "green.700"
                  : "green.200"
                : isDark
                  ? "gray.700"
                  : "gray.200",
            })}
          >
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}

export interface TeacherCompoundChipProps {
  currentView: StudentView;
  onViewChange: (view: StudentView) => void;
  viewCounts: Partial<Record<StudentView, number>>;
  availableViews: StudentView[];
  isDark?: boolean;
  /** When true, removes outer border/radius (for embedding in a card) */
  embedded?: boolean;
  /** Optional classroom name to display instead of "Enrolled" in first segment */
  classroomName?: string;
  /** Optional callback for add student action - renders a "+" prefix when provided */
  onAddStudent?: () => void;
  /** Optional settings trigger element to render inside the first segment */
  settingsTrigger?: ReactNode;
}

/**
 * Teacher compound chip: Enrolled → In Classroom → Active
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ 📋 Enrolled (10)  │  🏫 Present (5)  │  🎯 Active (2)   │
 * └──────────────────────────────────────────────────────────┘
 *      ↑ all enrolled    ↑ in classroom     ↑ practicing
 */
export function TeacherCompoundChip({
  currentView,
  onViewChange,
  viewCounts,
  availableViews,
  isDark: isDarkProp,
  embedded = false,
  classroomName,
  onAddStudent,
  settingsTrigger,
}: TeacherCompoundChipProps) {
  const { resolvedTheme } = useTheme();
  const isDark = isDarkProp ?? resolvedTheme === "dark";
  const enrolledConfig = VIEW_CONFIGS.find((c) => c.id === "enrolled")!;
  const inClassroomConfig = VIEW_CONFIGS.find((c) => c.id === "in-classroom")!;
  const activeConfig = VIEW_CONFIGS.find(
    (c) => c.id === "in-classroom-active",
  )!;

  const isEnrolledActive = currentView === "enrolled";
  const isInClassroomActive = currentView === "in-classroom";
  const isActiveActive = currentView === "in-classroom-active";
  const isAnyActive = isEnrolledActive || isInClassroomActive || isActiveActive;

  const hasInClassroomSegment =
    availableViews.includes("in-classroom") &&
    (viewCounts["in-classroom"] ?? 0) > 0;
  const hasActiveSegment =
    availableViews.includes("in-classroom-active") &&
    (viewCounts["in-classroom-active"] ?? 0) > 0;

  return (
    <div
      data-component="teacher-compound-chip"
      data-active={isAnyActive}
      data-embedded={embedded}
      className={css({
        display: "flex",
        alignItems: "stretch",
        // When embedded, no border/radius - blends into parent card
        borderRadius: embedded ? "0" : "16px",
        border: embedded ? "none" : "1px solid",
        overflow: "hidden",
        flexShrink: 0,
        transition: "all 0.15s ease",
        // When embedded, fill width
        width: embedded ? "100%" : "auto",
        borderColor: isAnyActive
          ? isDark
            ? "blue.600"
            : "blue.300"
          : isDark
            ? "gray.600"
            : "gray.300",
      })}
    >
      {/* Add student prefix button */}
      {onAddStudent && (
        <button
          type="button"
          onClick={onAddStudent}
          data-action="add-student-to-classroom"
          title="Add Student to Classroom"
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: embedded ? "4px 8px" : "6px 10px",
            backgroundColor: isDark ? "green.800" : "green.100",
            color: isDark ? "green.300" : "green.700",
            border: "none",
            borderRight: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            fontSize: embedded ? "12px" : "13px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.15s ease",
            _hover: {
              backgroundColor: isDark ? "green.700" : "green.200",
            },
            _active: {
              backgroundColor: isDark ? "green.600" : "green.300",
            },
          })}
        >
          +
        </button>
      )}

      {/* Enrolled segment - shows classroom name if provided */}
      <ChipSegment
        config={enrolledConfig}
        isActive={isEnrolledActive}
        count={viewCounts["enrolled"]}
        onClick={() => onViewChange("enrolled")}
        isDark={isDark}
        position={hasInClassroomSegment ? "first" : "last"}
        isCompoundActive={isAnyActive}
        colorScheme="blue"
        embedded={embedded}
        labelOverride={classroomName}
        settingsTrigger={settingsTrigger}
      />

      {/* In Classroom segment - only show if there are students present */}
      {hasInClassroomSegment && (
        <ChipSegment
          config={inClassroomConfig}
          isActive={isInClassroomActive}
          count={viewCounts["in-classroom"]}
          onClick={() => onViewChange("in-classroom")}
          isDark={isDark}
          position={hasActiveSegment ? "middle" : "last"}
          isCompoundActive={isAnyActive}
          colorScheme="blue"
          embedded={embedded}
        />
      )}

      {/* Active segment - only show if there are active sessions */}
      {hasActiveSegment && (
        <ChipSegment
          config={activeConfig}
          isActive={isActiveActive}
          count={viewCounts["in-classroom-active"]}
          onClick={() => onViewChange("in-classroom-active")}
          isDark={isDark}
          position="last"
          isCompoundActive={isAnyActive}
          colorScheme="green"
          embedded={embedded}
        />
      )}
    </div>
  );
}

interface ChipSegmentProps {
  config: ViewConfig;
  isActive: boolean;
  count?: number;
  onClick: () => void;
  isDark: boolean;
  position: "first" | "middle" | "last";
  isCompoundActive: boolean;
  colorScheme: "blue" | "green";
  /** When embedded in a card, segments flex evenly */
  embedded?: boolean;
  /** Optional label override (e.g., classroom name instead of "Enrolled") */
  labelOverride?: string;
  /** Optional settings trigger element to render after the label */
  settingsTrigger?: ReactNode;
}

function ChipSegment({
  config,
  isActive,
  count,
  onClick,
  isDark,
  position,
  isCompoundActive,
  colorScheme,
  embedded = false,
  labelOverride,
  settingsTrigger,
}: ChipSegmentProps) {
  const isLast = position === "last";

  return (
    <button
      type="button"
      data-view={config.id}
      data-active={isActive}
      data-position={position}
      onClick={onClick}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: embedded ? "center" : "flex-start",
        gap: embedded ? "4px" : "6px",
        padding: embedded ? "4px 8px" : "6px 12px",
        cursor: "pointer",
        fontSize: embedded ? "11px" : "13px",
        fontWeight: "medium",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        border: "none",
        // When embedded, segments share space equally
        flex: embedded ? 1 : "none",
        borderRight: isLast ? "none" : "1px solid",
        borderColor: isDark ? "gray.600" : "gray.300",
        bg: isActive
          ? isDark
            ? `${colorScheme}.900`
            : `${colorScheme}.100`
          : isCompoundActive
            ? isDark
              ? "gray.800"
              : "gray.50"
            : isDark
              ? "gray.800"
              : "white",
        color: isActive
          ? isDark
            ? `${colorScheme}.300`
            : `${colorScheme}.700`
          : isDark
            ? "gray.400"
            : "gray.600",
        _hover: {
          bg: isActive
            ? isDark
              ? `${colorScheme}.800`
              : `${colorScheme}.200`
            : isDark
              ? "gray.700"
              : "gray.100",
          color: isActive
            ? isDark
              ? `${colorScheme}.200`
              : `${colorScheme}.800`
            : isDark
              ? "gray.300"
              : "gray.700",
        },
      })}
    >
      <span>{config.icon}</span>
      <span>{labelOverride ?? config.shortLabel ?? config.label}</span>
      {settingsTrigger}
      {count !== undefined && (
        <span
          data-element="segment-count"
          className={css({
            fontSize: "10px",
            fontWeight: "bold",
            padding: "1px 5px",
            borderRadius: "8px",
            bg: isActive
              ? isDark
                ? `${colorScheme}.700`
                : `${colorScheme}.200`
              : isDark
                ? "gray.700"
                : "gray.200",
          })}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Get available views based on user type and active session counts
 *
 * Sub-views (like 'my-children-active') only appear when there are active sessions
 * in the parent view.
 *
 * @param isTeacher - Whether the user is a teacher
 * @param viewCounts - Map of view IDs to counts (used for conditional views)
 */
export function getAvailableViews(
  isTeacher: boolean,
  viewCounts?: Partial<Record<StudentView, number>>,
): StudentView[] {
  return VIEW_CONFIGS.filter((v) => {
    // Filter by teacher-only
    if (v.teacherOnly && !isTeacher) return false;

    // Sub-views only appear when parent has active sessions
    if (v.parentView) {
      const activeCount = viewCounts?.[v.id] ?? 0;
      return activeCount > 0;
    }

    // Needs-attention only appears when there are students needing attention
    if (v.id === "needs-attention") {
      const count = viewCounts?.["needs-attention"] ?? 0;
      return count > 0;
    }

    // In-classroom only appears when there are students present
    if (v.id === "in-classroom") {
      const count = viewCounts?.["in-classroom"] ?? 0;
      return count > 0;
    }

    return true;
  }).map((v) => v.id);
}

/**
 * Get default view based on user type
 *
 * - Teacher → "Enrolled"
 * - Parent → "All" (or "My Children" if they have enrolled children)
 */
export function getDefaultView(
  isTeacher: boolean,
  hasEnrolledChildren?: boolean,
): StudentView {
  if (isTeacher) return "enrolled";
  if (hasEnrolledChildren) return "my-children";
  return "all";
}
