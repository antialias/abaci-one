"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useEntryPrompts, type EntryPrompt } from "@/hooks/useEntryPrompts";
import { css } from "../../../styled-system/css";

/**
 * Banner that shows pending entry prompts from teachers to parents
 *
 * Displayed at the top of the practice page when a teacher has requested
 * that a parent's child enter their classroom.
 */
export function EntryPromptBanner() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const {
    prompts,
    isLoading,
    acceptPrompt,
    declinePrompt,
    isAccepting,
    isDeclining,
    acceptingPromptId,
    decliningPromptId,
  } = useEntryPrompts();

  const handleAccept = useCallback(
    async (promptId: string) => {
      try {
        await acceptPrompt(promptId);
      } catch (error) {
        console.error("Failed to accept prompt:", error);
      }
    },
    [acceptPrompt],
  );

  const handleDecline = useCallback(
    async (promptId: string) => {
      try {
        await declinePrompt(promptId);
      } catch (error) {
        console.error("Failed to decline prompt:", error);
      }
    },
    [declinePrompt],
  );

  // Don't render if loading or no prompts
  if (isLoading || prompts.length === 0) {
    return null;
  }

  return (
    <div
      data-component="entry-prompt-banner"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginBottom: "16px",
      })}
    >
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          onAccept={handleAccept}
          onDecline={handleDecline}
          isAccepting={isAccepting && acceptingPromptId === prompt.id}
          isDeclining={isDeclining && decliningPromptId === prompt.id}
          isDark={isDark}
        />
      ))}
    </div>
  );
}

interface PromptCardProps {
  prompt: EntryPrompt;
  onAccept: (promptId: string) => void;
  onDecline: (promptId: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  isDark: boolean;
}

function PromptCard({
  prompt,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
  isDark,
}: PromptCardProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeRemaining(prompt.expiresAt),
  );
  const isExpired = timeLeft <= 0;
  const isLoading = isAccepting || isDeclining;

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(prompt.expiresAt);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [prompt.expiresAt]);

  // Don't render if expired
  if (isExpired) {
    return null;
  }

  return (
    <div
      data-element="prompt-card"
      data-prompt-id={prompt.id}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "16px",
        bg: isDark ? "orange.900/30" : "orange.50",
        border: "2px solid",
        borderColor: isDark ? "orange.700" : "orange.300",
        borderRadius: "12px",
        flexWrap: "wrap",
      })}
    >
      {/* Prompt message */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flex: "1",
          minWidth: "200px",
        })}
      >
        <span
          className={css({
            fontSize: "1.5rem",
          })}
        >
          {prompt.player.emoji}
        </span>
        <div>
          <p
            className={css({
              fontSize: "0.9375rem",
              fontWeight: "medium",
              color: isDark ? "gray.100" : "gray.900",
            })}
          >
            <strong>{prompt.teacher.displayName}</strong> wants{" "}
            <strong>{prompt.player.name}</strong> to enter{" "}
            <strong>{prompt.classroom.name}</strong>
          </p>
          <p
            className={css({
              fontSize: "0.8125rem",
              color: isDark ? "gray.400" : "gray.500",
              marginTop: "2px",
            })}
          >
            Classroom invitation
          </p>
        </div>
      </div>

      {/* Countdown and actions */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "12px",
        })}
      >
        {/* Countdown */}
        <CountdownTimer timeLeft={timeLeft} isDark={isDark} />

        {/* Actions */}
        <div
          className={css({
            display: "flex",
            gap: "8px",
          })}
        >
          <button
            type="button"
            onClick={() => onDecline(prompt.id)}
            disabled={isLoading}
            data-action="decline-prompt"
            className={css({
              padding: "8px 16px",
              bg: "transparent",
              color: isDark ? "gray.300" : "gray.600",
              border: "1px solid",
              borderColor: isDark ? "gray.600" : "gray.300",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: "medium",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
              transition: "all 0.15s ease",
              _hover: {
                bg: isDark ? "gray.800" : "gray.100",
              },
              _disabled: {
                cursor: "not-allowed",
                opacity: 0.5,
              },
            })}
          >
            {isDeclining ? "Declining..." : "Decline"}
          </button>
          <button
            type="button"
            onClick={() => onAccept(prompt.id)}
            disabled={isLoading}
            data-action="accept-prompt"
            className={css({
              padding: "8px 16px",
              bg: isDark ? "green.700" : "green.500",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: "medium",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
              transition: "all 0.15s ease",
              _hover: {
                bg: isDark ? "green.600" : "green.600",
              },
              _disabled: {
                cursor: "not-allowed",
                opacity: 0.5,
              },
            })}
          >
            {isAccepting ? "Entering..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CountdownTimerProps {
  timeLeft: number;
  isDark: boolean;
}

function CountdownTimer({ timeLeft, isDark }: CountdownTimerProps) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 60; // Less than 1 minute

  return (
    <div
      data-element="countdown-timer"
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        bg: isUrgent
          ? isDark
            ? "red.900/50"
            : "red.100"
          : isDark
            ? "gray.800"
            : "gray.100",
        borderRadius: "16px",
        fontSize: "0.8125rem",
        fontWeight: "medium",
        fontFamily: "monospace",
        color: isUrgent
          ? isDark
            ? "red.400"
            : "red.600"
          : isDark
            ? "gray.400"
            : "gray.600",
      })}
    >
      <span>Expires</span>
      <span>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}

/**
 * Get time remaining in seconds until expiry
 */
function getTimeRemaining(expiresAt: string): number {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = Math.floor((expiry - now) / 1000);
  return Math.max(0, diff);
}
