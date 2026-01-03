"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { css } from "../../../../../styled-system/css";

interface CalendarPreviewProps {
  month: number;
  year: number;
  format: "monthly" | "daily";
  previewSvg: string | null;
}

async function fetchTypstPreview(
  month: number,
  year: number,
  format: string,
): Promise<string | null> {
  const response = await fetch("/api/create/calendar/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month, year, format }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message || "Failed to fetch preview",
    );
  }

  const data = await response.json();
  return data.svg;
}

export function CalendarPreview({
  month,
  year,
  format,
  previewSvg,
}: CalendarPreviewProps) {
  const t = useTranslations("calendar");
  // Use React Query to fetch Typst-generated preview (client-side only)
  const { data: typstPreviewSvg, isLoading } = useQuery({
    queryKey: ["calendar-typst-preview", month, year, format],
    queryFn: () => fetchTypstPreview(month, year, format),
    enabled: typeof window !== "undefined", // Run on client for both formats
  });

  // Use generated PDF SVG if available, otherwise use Typst live preview
  const displaySvg = previewSvg || typstPreviewSvg;

  // Show loading state while fetching preview
  if (isLoading || !displaySvg) {
    return (
      <div
        data-component="calendar-preview"
        className={css({
          bg: "gray.800",
          borderRadius: "12px",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "600px",
        })}
      >
        <p
          className={css({
            fontSize: "1.25rem",
            color: "gray.400",
            textAlign: "center",
          })}
        >
          {isLoading ? t("preview.loading") : t("preview.noPreview")}
        </p>
      </div>
    );
  }

  return (
    <div
      data-component="calendar-preview"
      className={css({
        bg: "gray.800",
        borderRadius: "12px",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      })}
    >
      <p
        className={css({
          fontSize: "1.125rem",
          color: "yellow.400",
          marginBottom: "1rem",
          textAlign: "center",
          fontWeight: "bold",
        })}
      >
        {previewSvg
          ? t("preview.generatedPdf")
          : format === "daily"
            ? t("preview.livePreviewFirstDay")
            : t("preview.livePreview")}
      </p>
      <div
        className={css({
          bg: "white",
          borderRadius: "8px",
          padding: "1rem",
          maxWidth: "100%",
          overflow: "auto",
        })}
        dangerouslySetInnerHTML={{ __html: displaySvg }}
      />
    </div>
  );
}
