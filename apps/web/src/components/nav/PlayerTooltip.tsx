import * as Tooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import type React from "react";

interface PlayerTooltipProps {
  children: React.ReactNode;
  playerName: string;
  playerColor?: string;
  isLocal?: boolean;
  createdAt?: Date | number;
  extraInfo?: string;
  canReport?: boolean;
  onReport?: () => void;
}

/**
 * Radix-based tooltip for displaying rich player information
 * Shows player name, type (local/network), color, and other details
 */
export function PlayerTooltip({
  children,
  playerName,
  playerColor,
  isLocal = true,
  createdAt,
  extraInfo,
  canReport = false,
  onReport,
}: PlayerTooltipProps) {
  const [open, setOpen] = useState(false);
  // Format creation time
  const getCreatedTimeAgo = () => {
    if (!createdAt) return null;

    const now = Date.now();
    const created =
      typeof createdAt === "number"
        ? createdAt
        : createdAt instanceof Date
          ? createdAt.getTime()
          : 0;
    const diff = now - created;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            style={{
              background:
                "linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))",
              backdropFilter: "blur(8px)",
              borderRadius: "12px",
              padding: "12px 16px",
              boxShadow:
                "0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              maxWidth: "280px",
              zIndex: 9999,
              animation: "tooltipFadeIn 0.2s ease-out",
            }}
          >
            {/* Player name with color accent */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              {playerColor && (
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: playerColor,
                    boxShadow: `0 0 8px ${playerColor}50`,
                    flexShrink: 0,
                  }}
                />
              )}
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "white",
                  lineHeight: 1.3,
                }}
              >
                {playerName}
              </div>
            </div>

            {/* Player type badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
                background: isLocal
                  ? "rgba(16, 185, 129, 0.15)"
                  : "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15))",
                border: `1px solid ${isLocal ? "rgba(16, 185, 129, 0.3)" : "rgba(147, 51, 234, 0.3)"}`,
                fontSize: "11px",
                fontWeight: "600",
                color: isLocal
                  ? "rgba(167, 243, 208, 1)"
                  : "rgba(196, 181, 253, 1)",
                marginBottom: extraInfo || createdAt ? "8px" : 0,
              }}
            >
              <span style={{ fontSize: "10px" }}>{isLocal ? "●" : "📡"}</span>
              {isLocal ? "Your Player" : "Network Player"}
            </div>

            {/* Additional info */}
            {(extraInfo || createdAt) && (
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(209, 213, 219, 0.9)",
                  lineHeight: 1.4,
                  marginTop: "4px",
                }}
              >
                {extraInfo && <div>{extraInfo}</div>}
                {createdAt && (
                  <div style={{ opacity: 0.7 }}>
                    Joined {getCreatedTimeAgo()}
                  </div>
                )}
              </div>
            )}

            {/* Report button */}
            {canReport && onReport && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onReport();
                }}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  padding: "8px 12px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "rgba(248, 113, 113, 1)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                  e.currentTarget.style.color = "rgba(252, 165, 165, 1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                  e.currentTarget.style.color = "rgba(248, 113, 113, 1)";
                }}
              >
                <span>🚩</span>
                <span>Report Player</span>
              </button>
            )}

            <Tooltip.Arrow
              style={{
                fill: "rgba(17, 24, 39, 0.97)",
              }}
            />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tooltipFadeIn {
              from {
                opacity: 0;
                transform: translateY(-4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </Tooltip.Provider>
  );
}
