"use client";

import { css } from "../../../../../../styled-system/css";
import type { ModelType } from "../wizard/types";
import { BoundaryDataCapture } from "../BoundaryDataCapture";
import { DigitCapturePanel } from "../DigitCapturePanel";

export interface DataPanelCapturePanelProps {
  /** Model type */
  modelType: ModelType;
  /** Handler called when new samples are captured */
  onCaptureComplete: () => void;
  /** Selected digit for column classifier (required when modelType is column-classifier) */
  selectedDigit?: number;
}

/**
 * Shared capture panel that renders model-specific capture UI.
 */
export function DataPanelCapturePanel({
  modelType,
  onCaptureComplete,
  selectedDigit = 0,
}: DataPanelCapturePanelProps) {
  return (
    <div
      data-component="data-panel-capture"
      className={css({
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bg: "gray.900",
      })}
    >
      {modelType === "boundary-detector" && (
        <BoundaryDataCapture onSamplesCollected={onCaptureComplete} />
      )}

      {modelType === "column-classifier" && (
        <DigitCapturePanel
          digit={selectedDigit}
          onCaptureSuccess={onCaptureComplete}
          columnCount={4}
        />
      )}
    </div>
  );
}
