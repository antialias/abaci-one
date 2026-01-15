"use client";

import { useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../../styled-system/css";
import { useStartPracticeModal } from "../StartPracticeModalContext";

/**
 * Known field configurations for better UX.
 * Maps field names to their display properties and constraints.
 */
const FIELD_CONFIG: Record<
  string,
  {
    label: string;
    type: "number" | "boolean" | "select";
    options?: { value: unknown; label: string }[];
    min?: number;
    max?: number;
    step?: number;
  }
> = {
  // Memory Quiz fields
  selectedCount: {
    label: "Cards",
    type: "select",
    options: [
      { value: 2, label: "2" },
      { value: 5, label: "5" },
      { value: 8, label: "8" },
      { value: 12, label: "12" },
      { value: 15, label: "15" },
    ],
  },
  displayTime: {
    label: "Display Time",
    type: "number",
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  selectedDifficulty: {
    label: "Number Range",
    type: "select",
    options: [
      { value: "beginner", label: "Beginner (1-9)" },
      { value: "easy", label: "Easy (1-50)" },
      { value: "medium", label: "Medium (1-99)" },
      { value: "hard", label: "Hard (1-999)" },
      { value: "expert", label: "Expert (1-9999)" },
    ],
  },
  // Card Sorting fields
  cardCount: {
    label: "Cards",
    type: "select",
    options: [
      { value: 5, label: "5" },
      { value: 8, label: "8" },
      { value: 12, label: "12" },
      { value: 15, label: "15" },
    ],
  },
  showNumbers: {
    label: "Show Numbers",
    type: "boolean",
  },
  // Matching fields
  difficulty: {
    label: "Pairs",
    type: "select",
    options: [
      { value: 6, label: "6" },
      { value: 8, label: "8" },
      { value: 12, label: "12" },
      { value: 15, label: "15" },
    ],
  },
  gameType: {
    label: "Match Type",
    type: "select",
    options: [
      { value: "abacus-numeral", label: "Abacus ↔ Number" },
      { value: "complement-pairs", label: "Complement Pairs" },
    ],
  },
};

/**
 * Customize toggle and dynamic form for game break configuration.
 * Shows game-specific settings when "Customize" is clicked.
 */
export function GameBreakCustomConfig() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const {
    gameBreakSelectedGame,
    selectedGamePracticeConfig,
    gameBreakShowCustomize,
    setGameBreakShowCustomize,
    gameBreakCustomConfig,
    setGameBreakCustomConfig,
    resolvedGameConfig,
  } = useStartPracticeModal();

  // Update a single field in the custom config
  const updateField = useCallback(
    (field: string, value: unknown) => {
      setGameBreakCustomConfig({
        ...gameBreakCustomConfig,
        [field]: value,
      });
    },
    [gameBreakCustomConfig, setGameBreakCustomConfig],
  );

  // Don't show if random or no game selected
  if (!gameBreakSelectedGame || gameBreakSelectedGame === "random") {
    return null;
  }

  // Don't show if game has no practice break config
  if (!selectedGamePracticeConfig) {
    return null;
  }

  // Get the suggested config to determine what fields are available
  const suggestedConfig = selectedGamePracticeConfig.suggestedConfig;
  if (!suggestedConfig || Object.keys(suggestedConfig).length === 0) {
    return null;
  }

  // Filter out locked fields
  const lockedFields = selectedGamePracticeConfig.lockedFields ?? [];
  const editableFields = Object.entries(suggestedConfig).filter(
    ([key]) => !lockedFields.includes(key),
  );

  // If all fields are locked, don't show customize option
  if (editableFields.length === 0) {
    return null;
  }

  return (
    <div
      data-element="game-break-customize"
      className={css({ marginTop: "0.375rem" })}
    >
      {/* Customize toggle button */}
      <button
        type="button"
        data-action="toggle-customize"
        data-expanded={gameBreakShowCustomize}
        onClick={() => setGameBreakShowCustomize(!gameBreakShowCustomize)}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.25rem 0.5rem",
          fontSize: "0.625rem",
          fontWeight: "600",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
          "@media (max-width: 480px), (max-height: 700px)": {
            padding: "0.1875rem 0.375rem",
            fontSize: "0.5625rem",
          },
        })}
        style={{
          backgroundColor: gameBreakShowCustomize
            ? isDark
              ? "rgba(251, 191, 36, 0.2)"
              : "rgba(251, 191, 36, 0.15)"
            : isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.04)",
          color: gameBreakShowCustomize
            ? isDark
              ? "#fcd34d"
              : "#d97706"
            : isDark
              ? "#9ca3af"
              : "#6b7280",
        }}
      >
        <span>{gameBreakShowCustomize ? "▼" : "▶"}</span>
        <span>Customize</span>
        <span>⚙️</span>
      </button>

      {/* Expanded form */}
      {gameBreakShowCustomize && (
        <div
          data-element="game-break-custom-form"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginTop: "0.375rem",
            padding: "0.5rem",
            borderRadius: "6px",
            "@media (max-width: 480px), (max-height: 700px)": {
              gap: "0.375rem",
              padding: "0.375rem",
            },
          })}
          style={{
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.02)",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
          }}
        >
          {editableFields.map(([fieldKey, defaultValue]) => {
            const fieldConfig = FIELD_CONFIG[fieldKey];
            const currentValue = resolvedGameConfig[fieldKey] ?? defaultValue;

            // Render based on field type
            if (fieldConfig?.type === "boolean") {
              return (
                <BooleanField
                  key={fieldKey}
                  fieldKey={fieldKey}
                  label={fieldConfig.label}
                  value={currentValue as boolean}
                  onChange={(v) => updateField(fieldKey, v)}
                  isDark={isDark}
                />
              );
            }

            if (fieldConfig?.type === "select" && fieldConfig.options) {
              return (
                <SelectField
                  key={fieldKey}
                  fieldKey={fieldKey}
                  label={fieldConfig.label}
                  value={currentValue}
                  options={fieldConfig.options}
                  onChange={(v) => updateField(fieldKey, v)}
                  isDark={isDark}
                />
              );
            }

            if (fieldConfig?.type === "number") {
              return (
                <NumberField
                  key={fieldKey}
                  fieldKey={fieldKey}
                  label={fieldConfig.label}
                  value={currentValue as number}
                  min={fieldConfig.min}
                  max={fieldConfig.max}
                  step={fieldConfig.step}
                  onChange={(v) => updateField(fieldKey, v)}
                  isDark={isDark}
                />
              );
            }

            // Fallback for unknown fields - show as label only
            return (
              <div
                key={fieldKey}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.6875rem",
                })}
              >
                <span style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                  {fieldKey}
                </span>
                <span style={{ color: isDark ? "#e5e7eb" : "#374151" }}>
                  {String(currentValue)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sub-components for field types

interface BooleanFieldProps {
  fieldKey: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isDark: boolean;
}

function BooleanField({
  fieldKey,
  label,
  value,
  onChange,
  isDark,
}: BooleanFieldProps) {
  return (
    <div
      data-field={fieldKey}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      })}
    >
      <span
        className={css({
          fontSize: "0.6875rem",
          fontWeight: "500",
          color: isDark ? "#d1d5db" : "#4b5563",
        })}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={css({
          padding: "0.1875rem 0.5rem",
          fontSize: "0.625rem",
          fontWeight: "600",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
        })}
        style={{
          backgroundColor: value
            ? isDark
              ? "rgba(34, 197, 94, 0.25)"
              : "rgba(34, 197, 94, 0.2)"
            : isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.08)",
          color: value
            ? isDark
              ? "#86efac"
              : "#16a34a"
            : isDark
              ? "#9ca3af"
              : "#6b7280",
        }}
      >
        {value ? "Yes" : "No"}
      </button>
    </div>
  );
}

interface SelectFieldProps {
  fieldKey: string;
  label: string;
  value: unknown;
  options: { value: unknown; label: string }[];
  onChange: (value: unknown) => void;
  isDark: boolean;
}

function SelectField({
  fieldKey,
  label,
  value,
  options,
  onChange,
  isDark,
}: SelectFieldProps) {
  return (
    <div
      data-field={fieldKey}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      })}
    >
      <span
        className={css({
          fontSize: "0.6875rem",
          fontWeight: "500",
          color: isDark ? "#d1d5db" : "#4b5563",
          flexShrink: 0,
        })}
      >
        {label}
      </span>
      <div
        className={css({ display: "flex", gap: "0.125rem", flexWrap: "wrap" })}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={css({
                padding: "0.1875rem 0.375rem",
                fontSize: "0.5625rem",
                fontWeight: "600",
                borderRadius: "3px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              })}
              style={{
                backgroundColor: isSelected
                  ? isDark
                    ? "rgba(139, 92, 246, 0.3)"
                    : "rgba(139, 92, 246, 0.2)"
                  : isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                color: isSelected
                  ? isDark
                    ? "#c4b5fd"
                    : "#7c3aed"
                  : isDark
                    ? "#9ca3af"
                    : "#6b7280",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface NumberFieldProps {
  fieldKey: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  isDark: boolean;
}

function NumberField({
  fieldKey,
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  isDark,
}: NumberFieldProps) {
  // Generate options based on min/max/step
  const options: number[] = [];
  for (let v = min; v <= max; v += step) {
    options.push(Math.round(v * 10) / 10); // Handle floating point
  }

  // Format display value
  const formatValue = (v: number) => (step < 1 ? `${v}s` : String(v));

  return (
    <div
      data-field={fieldKey}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      })}
    >
      <span
        className={css({
          fontSize: "0.6875rem",
          fontWeight: "500",
          color: isDark ? "#d1d5db" : "#4b5563",
          flexShrink: 0,
        })}
      >
        {label}
      </span>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
        })}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className={css({
            padding: "0.125rem 0.375rem",
            fontSize: "0.75rem",
            fontWeight: "600",
            borderRadius: "3px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:disabled": {
              opacity: 0.3,
              cursor: "not-allowed",
            },
          })}
          style={{
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.08)",
            color: isDark ? "#e5e7eb" : "#374151",
          }}
        >
          −
        </button>
        <span
          className={css({
            minWidth: "2rem",
            textAlign: "center",
            fontSize: "0.6875rem",
            fontWeight: "600",
            color: isDark ? "#e5e7eb" : "#374151",
          })}
        >
          {formatValue(value)}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className={css({
            padding: "0.125rem 0.375rem",
            fontSize: "0.75rem",
            fontWeight: "600",
            borderRadius: "3px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "&:disabled": {
              opacity: 0.3,
              cursor: "not-allowed",
            },
          })}
          style={{
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.08)",
            color: isDark ? "#e5e7eb" : "#374151",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
