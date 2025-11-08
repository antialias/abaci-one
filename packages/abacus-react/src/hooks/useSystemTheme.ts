/**
 * Hook to detect the current theme from the document root
 * Works with theme systems that set data-theme attribute or class on <html>
 */

import { useEffect, useState } from "react";

export type SystemTheme = "light" | "dark";

/**
 * Detects the current theme from the document root
 * Looks for:
 * 1. data-theme="light" or data-theme="dark" attribute
 * 2. .light or .dark class on document.documentElement
 * 3. Falls back to "dark" as default
 *
 * @returns Current theme ("light" or "dark")
 */
export function useSystemTheme(): SystemTheme {
  const [theme, setTheme] = useState<SystemTheme>(() => {
    // SSR-safe initialization
    if (typeof window === "undefined") {
      return "dark";
    }

    // Check data-theme attribute
    const root = document.documentElement;
    const dataTheme = root.getAttribute("data-theme");
    if (dataTheme === "light" || dataTheme === "dark") {
      return dataTheme;
    }

    // Check for class
    if (root.classList.contains("light")) return "light";
    if (root.classList.contains("dark")) return "dark";

    // Default
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;

    // Update theme when data-theme attribute changes
    const updateTheme = () => {
      const dataTheme = root.getAttribute("data-theme");
      if (dataTheme === "light" || dataTheme === "dark") {
        setTheme(dataTheme);
        return;
      }

      // Check for class changes
      if (root.classList.contains("light")) {
        setTheme("light");
      } else if (root.classList.contains("dark")) {
        setTheme("dark");
      }
    };

    // Watch for attribute changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-theme" ||
            mutation.attributeName === "class")
        ) {
          updateTheme();
          break;
        }
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Initial update
    updateTheme();

    return () => observer.disconnect();
  }, []);

  return theme;
}
