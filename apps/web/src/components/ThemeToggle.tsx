"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../styled-system/css";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    // Cycle: light → dark → system → light
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getThemeLabel = () => {
    if (theme === "system") {
      return `Auto (${resolvedTheme === "dark" ? "Dark" : "Light"})`;
    }
    return theme === "dark" ? "Dark" : "Light";
  };

  const getThemeIcon = () => {
    if (theme === "system") {
      return "🌗"; // Half moon for system/auto
    }
    return resolvedTheme === "dark" ? "🌙" : "☀️";
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Current theme: ${getThemeLabel()}. Click to cycle.`}
      title={`Current: ${getThemeLabel()}. Click to cycle themes.`}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        px: "1rem",
        py: "0.5rem",
        bg: "bg.surface",
        color: "text.primary",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: "0.5rem",
        cursor: "pointer",
        fontSize: "0.875rem",
        fontWeight: 500,
        transition: "all 0.2s",
        _hover: {
          bg: "interactive.hover",
          borderColor: "border.emphasis",
        },
      })}
    >
      {getThemeIcon()}
      <span>{getThemeLabel()}</span>
    </button>
  );
}
