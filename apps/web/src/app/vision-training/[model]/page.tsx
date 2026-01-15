"use client";

import { css } from "../../../../styled-system/css";
import { useModelType } from "../hooks/useModelType";
import { UnifiedDataPanel } from "../train/components/data-panel/UnifiedDataPanel";

/**
 * Vision Training Data Hub
 *
 * Main page for /vision-training/[model].
 * Renders the unified data panel for the current model type.
 */
export default function VisionTrainingDataPage() {
  const modelType = useModelType();

  return (
    <div
      data-component="vision-data-hub"
      className={css({
        overflow: "hidden",
        pt: 4,
      })}
      style={{ height: "calc(100vh - var(--nav-height))" }}
    >
      <UnifiedDataPanel modelType={modelType} />
    </div>
  );
}
