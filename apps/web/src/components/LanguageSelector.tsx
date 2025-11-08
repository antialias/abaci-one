"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useLocale } from "next-intl";
import { useState } from "react";
import { useLocaleContext } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { locales } from "@/i18n/routing";
import { css } from "../../styled-system/css";

interface LanguageSelectorProps {
  variant?: "dropdown-item" | "inline";
  isFullscreen?: boolean;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  hi: "हिन्दी",
  es: "Español",
  la: "Latina",
  goh: "Diutisc",
};

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  ja: "🇯🇵",
  hi: "🇮🇳",
  es: "🇪🇸",
  la: "🏛️",
  goh: "🏰",
};

export function LanguageSelector({
  variant = "inline",
  isFullscreen = false,
}: LanguageSelectorProps) {
  const locale = useLocale();
  const { changeLocale } = useLocaleContext();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [open, setOpen] = useState(false);

  const handleLanguageChange = (langCode: string) => {
    changeLocale(langCode as (typeof locales)[number]);
    setOpen(false);
  };

  if (variant === "dropdown-item") {
    // Simple inline version for use inside other dropdowns
    return (
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              bg: "transparent",
              color: isFullscreen ? "white" : isDark ? "gray.200" : "gray.900",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              border: "none",
              transition: "all 0.2s ease",
              width: "100%",
              _hover: {
                bg: isFullscreen
                  ? "rgba(139, 92, 246, 0.2)"
                  : isDark
                    ? "rgba(139, 92, 246, 0.2)"
                    : "rgba(139, 92, 246, 0.1)",
              },
            })}
          >
            <span style={{ fontSize: "18px" }}>🌐</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              {LANGUAGE_FLAGS[locale]} {LANGUAGE_LABELS[locale]}
            </span>
            <svg
              className={css({
                w: "4",
                h: "4",
                transition: "transform",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              })}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={css({
              bg: isFullscreen
                ? "rgba(0, 0, 0, 0.95)"
                : isDark
                  ? "gray.900"
                  : "white",
              border: "1px solid",
              borderColor: isFullscreen
                ? "rgba(255, 255, 255, 0.1)"
                : isDark
                  ? "gray.700"
                  : "gray.200",
              borderRadius: "8px",
              padding: "6px",
              minWidth: "200px",
              boxShadow: isDark
                ? "0 8px 24px rgba(0, 0, 0, 0.4)"
                : "0 8px 24px rgba(0, 0, 0, 0.15)",
              backdropFilter: isFullscreen ? "blur(12px)" : "none",
              zIndex: 10000,
            })}
            side="right"
            sideOffset={8}
            align="start"
          >
            {locales.map((langCode) => (
              <DropdownMenu.Item
                key={langCode}
                onSelect={() => handleLanguageChange(langCode)}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: isFullscreen
                    ? "white"
                    : isDark
                      ? "gray.200"
                      : "gray.900",
                  bg:
                    locale === langCode
                      ? isDark
                        ? "gray.800"
                        : "gray.100"
                      : "transparent",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  _hover: {
                    bg: isFullscreen
                      ? "rgba(139, 92, 246, 0.3)"
                      : isDark
                        ? "gray.800"
                        : "gray.100",
                  },
                })}
              >
                <span>{LANGUAGE_FLAGS[langCode]}</span>
                <span>{LANGUAGE_LABELS[langCode]}</span>
                {locale === langCode && (
                  <span style={{ marginLeft: "auto" }}>✓</span>
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  // Inline variant for full navbar
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            bg: isFullscreen
              ? "rgba(0, 0, 0, 0.85)"
              : isDark
                ? "gray.800"
                : "white",
            backdropFilter: isFullscreen ? "blur(8px)" : "none",
            border: "1px solid",
            borderColor: isFullscreen
              ? "rgba(139, 92, 246, 0.3)"
              : isDark
                ? "gray.700"
                : "gray.300",
            borderRadius: "8px",
            color: isFullscreen
              ? "rgba(209, 213, 219, 0.9)"
              : isDark
                ? "gray.200"
                : "gray.700",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            outline: "none",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            _hover: {
              bg: isFullscreen
                ? "rgba(139, 92, 246, 0.25)"
                : isDark
                  ? "gray.700"
                  : "gray.50",
              color: isFullscreen
                ? "rgba(196, 181, 253, 1)"
                : isDark
                  ? "gray.100"
                  : "gray.900",
              borderColor: "rgba(139, 92, 246, 0.5)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            },
          })}
        >
          <span>{LANGUAGE_FLAGS[locale]}</span>
          <span>{LANGUAGE_LABELS[locale]}</span>
          <svg
            className={css({
              w: "4",
              h: "4",
              transition: "transform",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={css({
            bg: isFullscreen
              ? "rgba(0, 0, 0, 0.95)"
              : isDark
                ? "gray.900"
                : "white",
            border: "1px solid",
            borderColor: isFullscreen
              ? "rgba(255, 255, 255, 0.1)"
              : isDark
                ? "gray.700"
                : "gray.200",
            borderRadius: "8px",
            padding: "6px",
            minWidth: "200px",
            boxShadow: isDark
              ? "0 8px 24px rgba(0, 0, 0, 0.4)"
              : "0 8px 24px rgba(0, 0, 0, 0.15)",
            backdropFilter: isFullscreen ? "blur(12px)" : "none",
            zIndex: 10000,
          })}
          side="bottom"
          sideOffset={8}
          align="start"
        >
          {locales.map((langCode) => (
            <DropdownMenu.Item
              key={langCode}
              onSelect={() => handleLanguageChange(langCode)}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "14px",
                color: isFullscreen
                  ? "white"
                  : isDark
                    ? "gray.200"
                    : "gray.900",
                bg:
                  locale === langCode
                    ? isDark
                      ? "gray.800"
                      : "gray.100"
                    : "transparent",
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                _hover: {
                  bg: isFullscreen
                    ? "rgba(139, 92, 246, 0.3)"
                    : isDark
                      ? "gray.800"
                      : "gray.100",
                },
              })}
            >
              <span>{LANGUAGE_FLAGS[langCode]}</span>
              <span>{LANGUAGE_LABELS[langCode]}</span>
              {locale === langCode && (
                <span style={{ marginLeft: "auto" }}>✓</span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
