"use client";

import { css } from "../../../../../../styled-system/css";

interface StepProgressProps {
  steps: string[];
  currentIndex: number;
}

export function StepProgress({ steps, currentIndex }: StepProgressProps) {
  return (
    <div
      data-element="step-progress"
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        mt: 2,
      })}
    >
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div
            key={step}
            className={css({ display: "flex", alignItems: "center" })}
          >
            {/* Dot */}
            <div
              title={step}
              className={css({
                width: isCurrent ? "10px" : "8px",
                height: isCurrent ? "10px" : "8px",
                borderRadius: "full",
                bg: isDone ? "green.500" : isCurrent ? "blue.500" : "gray.600",
                transition: "all 0.2s ease",
                cursor: "help",
              })}
            />

            {/* Connector line (if not last) */}
            {index < steps.length - 1 && (
              <div
                className={css({
                  width: "20px",
                  height: "2px",
                  bg: isDone ? "green.500" : "gray.700",
                  mx: 0.5,
                })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
