"use client";

import { useTranslations } from "next-intl";
import { css } from "@styled/css";
import { hstack } from "@styled/patterns";

type GenerationStatus = "idle" | "generating" | "error";

interface GenerateButtonProps {
  status: GenerationStatus;
  onGenerate: () => void;
  isDark?: boolean;
}

/**
 * Button to trigger worksheet PDF generation
 * Shows loading state during generation
 */
export function GenerateButton({
  status,
  onGenerate,
  isDark = false,
}: GenerateButtonProps) {
  const t = useTranslations("create.worksheets.addition");
  const isGenerating = status === "generating";

  return (
    <button
      type="button"
      data-action="generate-worksheet"
      onClick={onGenerate}
      disabled={isGenerating}
      className={css({
        w: "full",
        px: "6",
        py: "4",
        bg: "brand.600",
        color: "white",
        fontSize: "md",
        fontWeight: "bold",
        rounded: "xl",
        shadow: "md",
        transition: "all 0.2s",
        cursor: isGenerating ? "not-allowed" : "pointer",
        opacity: isGenerating ? "0.7" : "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2",
        border: "2px solid",
        borderColor: "brand.700",
        _hover: isGenerating
          ? {}
          : {
              bg: "brand.700",
              borderColor: "brand.800",
              transform: "translateY(-1px)",
              shadow: "lg",
            },
        _active: {
          transform: "translateY(0)",
        },
      })}
    >
      {isGenerating ? (
        <>
          <div
            className={css({
              w: "5",
              h: "5",
              border: "2px solid",
              borderColor: "white",
              borderTopColor: "transparent",
              rounded: "full",
              animation: "spin 1s linear infinite",
            })}
          />
          <span>Generating PDF...</span>
        </>
      ) : (
        <>
          <span className={css({ fontSize: "xl" })}>⬇️</span>
          <span>Download PDF</span>
        </>
      )}
    </button>
  );
}
