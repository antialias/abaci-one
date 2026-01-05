"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLinkChild } from "@/hooks/useUserPlayers";
import { css } from "../../../styled-system/css";

interface LinkChildFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal form to link to an existing child via family code
 *
 * Used when a second parent wants to add a child that was
 * created by another parent.
 */
export function LinkChildForm({
  isOpen,
  onClose,
  onSuccess,
}: LinkChildFormProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [familyCode, setFamilyCode] = useState("");
  const [linkedPlayer, setLinkedPlayer] = useState<{
    name: string;
    emoji: string;
  } | null>(null);

  // React Query mutation
  const linkChild = useLinkChild();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFamilyCode("");
      setLinkedPlayer(null);
      linkChild.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!familyCode.trim()) return;

      linkChild.mutate(familyCode.trim(), {
        onSuccess: (data) => {
          if (data.success && data.player) {
            setLinkedPlayer({
              name: data.player.name,
              emoji: data.player.emoji,
            });
            onSuccess?.();
          }
        },
      });
    },
    [familyCode, linkChild, onSuccess],
  );

  // Handle close and reset
  const handleClose = useCallback(() => {
    setFamilyCode("");
    setLinkedPlayer(null);
    linkChild.reset();
    onClose();
  }, [onClose, linkChild]);

  if (!isOpen) return null;

  // Get error message from mutation
  const error = linkChild.data?.success === false ? linkChild.data.error : null;

  return (
    <div
      data-component="link-child-modal"
      className={css({
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      })}
      onClick={handleClose}
    >
      <div
        className={css({
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          position: "relative",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {linkedPlayer ? (
          // Success state
          <div
            className={css({
              textAlign: "center",
              padding: "20px 0",
            })}
          >
            <div
              className={css({
                fontSize: "4rem",
                marginBottom: "16px",
              })}
            >
              {linkedPlayer.emoji}
            </div>
            <h2
              className={css({
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: isDark ? "white" : "gray.800",
                marginBottom: "8px",
              })}
            >
              Successfully Linked!
            </h2>
            <p
              className={css({
                fontSize: "0.875rem",
                color: isDark ? "gray.400" : "gray.600",
                marginBottom: "20px",
              })}
            >
              You now have access to {linkedPlayer.name}&apos;s practice data.
            </p>
            <button
              type="button"
              onClick={handleClose}
              data-action="close-link-success"
              className={css({
                padding: "12px 24px",
                backgroundColor: isDark ? "green.700" : "green.500",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "medium",
                cursor: "pointer",
                _hover: {
                  backgroundColor: isDark ? "green.600" : "green.600",
                },
              })}
            >
              Done
            </button>
          </div>
        ) : (
          // Form state
          <>
            <h2
              className={css({
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: isDark ? "white" : "gray.800",
                marginBottom: "8px",
              })}
            >
              Link Existing Child
            </h2>
            <p
              className={css({
                fontSize: "0.875rem",
                color: isDark ? "gray.400" : "gray.600",
                marginBottom: "20px",
              })}
            >
              Enter the family code shared by another parent to link to their
              child.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="FAM-XXXXXX"
                data-input="family-code"
                className={css({
                  width: "100%",
                  padding: "14px 16px",
                  backgroundColor: isDark ? "gray.700" : "gray.100",
                  border: "2px solid",
                  borderColor: error
                    ? "red.500"
                    : isDark
                      ? "gray.600"
                      : "gray.200",
                  borderRadius: "8px",
                  fontSize: "1.125rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  color: isDark ? "white" : "gray.800",
                  marginBottom: "8px",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                  _focus: {
                    borderColor: isDark ? "blue.500" : "blue.400",
                  },
                  _placeholder: {
                    color: isDark ? "gray.500" : "gray.400",
                  },
                })}
              />

              {error && (
                <p
                  className={css({
                    fontSize: "0.8125rem",
                    color: "red.500",
                    marginBottom: "12px",
                    textAlign: "center",
                  })}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={linkChild.isPending || !familyCode.trim()}
                data-action="submit-link-child"
                className={css({
                  width: "100%",
                  padding: "14px",
                  backgroundColor: isDark ? "blue.700" : "blue.500",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "medium",
                  cursor: linkChild.isPending ? "wait" : "pointer",
                  transition: "all 0.15s ease",
                  marginTop: "8px",
                  _hover: {
                    backgroundColor: isDark ? "blue.600" : "blue.600",
                  },
                  _disabled: {
                    opacity: 0.5,
                    cursor: "not-allowed",
                  },
                })}
              >
                {linkChild.isPending ? "Linking..." : "Link Child"}
              </button>
            </form>
          </>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          data-action="close-link-child-modal"
          className={css({
            position: "absolute",
            top: "12px",
            right: "12px",
            padding: "8px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: isDark ? "gray.500" : "gray.400",
            fontSize: "20px",
            lineHeight: 1,
            _hover: {
              color: isDark ? "gray.300" : "gray.600",
            },
          })}
        >
          ×
        </button>
      </div>
    </div>
  );
}
