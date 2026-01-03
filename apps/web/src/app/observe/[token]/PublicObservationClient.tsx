"use client";

import { useEffect, useState } from "react";
import { SessionObserverView } from "@/components/classroom";
import type { ActiveSessionInfo } from "@/hooks/useClassroom";
import { css } from "../../../../styled-system/css";

interface PublicObservationClientProps {
  session: ActiveSessionInfo;
  shareToken: string;
  student: {
    name: string;
    emoji: string;
    color: string;
  };
  expiresAt: number;
  /** If set, the current user can observe this student directly (without share link) */
  authenticatedObserveUrl?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

export function PublicObservationClient({
  session,
  shareToken,
  student,
  expiresAt,
  authenticatedObserveUrl,
}: PublicObservationClientProps) {
  const [navHeight, setNavHeight] = useState(20); // Minimal padding for public page (no nav)
  const [timeRemaining, setTimeRemaining] = useState(expiresAt - Date.now());

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(expiresAt - Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Simple page without full nav (public access)
  return (
    <div
      data-component="public-observation-page"
      className={css({
        minHeight: "100vh",
        backgroundColor: "gray.50",
        _dark: { backgroundColor: "gray.900" },
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      })}
      style={{
        paddingTop: `${navHeight}px`,
      }}
    >
      {/* Authenticated observer recommendation banner */}
      {authenticatedObserveUrl && (
        <div
          data-element="authenticated-recommend-banner"
          className={css({
            backgroundColor: "green.50",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "0.875rem",
            color: "green.700",
            borderBottom: "1px solid",
            borderColor: "green.200",
            _dark: {
              backgroundColor: "green.900",
              color: "green.200",
              borderColor: "green.800",
            },
          })}
        >
          <span>✨ You have full access to observe {student.name}.</span>
          <a
            href={authenticatedObserveUrl}
            className={css({
              fontWeight: "semibold",
              textDecoration: "underline",
              color: "green.800",
              _dark: { color: "green.100" },
              _hover: { color: "green.900", _dark: { color: "white" } },
            })}
          >
            Switch to full observation mode →
          </a>
        </div>
      )}

      {/* Expiration banner */}
      <div
        data-element="expiration-banner"
        className={css({
          backgroundColor: timeRemaining > 0 ? "blue.50" : "red.50",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: "0.875rem",
          color: timeRemaining > 0 ? "blue.700" : "red.700",
          borderBottom: "1px solid",
          borderColor: timeRemaining > 0 ? "blue.200" : "red.200",
          _dark: {
            backgroundColor: timeRemaining > 0 ? "blue.900" : "red.900",
            color: timeRemaining > 0 ? "blue.200" : "red.200",
            borderColor: timeRemaining > 0 ? "blue.800" : "red.800",
          },
        })}
      >
        <span>👁️ View-only access</span>
        <span>•</span>
        <span>{formatTimeRemaining(timeRemaining)}</span>
      </div>

      {/* Main content */}
      <div
        className={css({
          flex: 1,
          width: "100%",
          overflow: "hidden",
        })}
      >
        <SessionObserverView
          session={session}
          student={student}
          observerId="" // Not used for token-based observation
          shareToken={shareToken}
          variant="page"
          isViewOnly
        />
      </div>
    </div>
  );
}
