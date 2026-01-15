"use client";

import { css } from "../../../../../../../styled-system/css";

interface SetupCardProps {
  message: string;
}

export function SetupCard({ message }: SetupCardProps) {
  return (
    <div className={css({ textAlign: "center", py: 6 })}>
      <div
        className={css({
          fontSize: "2xl",
          mb: 3,
          animation: "spin 1s linear infinite",
        })}
      >
        ⚙️
      </div>
      <div
        className={css({
          fontSize: "lg",
          fontWeight: "medium",
          color: "gray.200",
          mb: 2,
        })}
      >
        Setting Up
      </div>
      <div className={css({ color: "gray.400", fontSize: "sm" })}>
        {message || "Initializing Python environment..."}
      </div>
    </div>
  );
}
