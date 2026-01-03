"use client";

import { Z_INDEX } from "@/constants/zIndex";
import { useTheme } from "@/contexts/ThemeContext";
import type { ClassroomTutorialState } from "@/hooks/useClassroomTutorialStates";
import { useTutorialControl } from "@/hooks/useTutorialControl";
import { SkillTutorialLauncher } from "@/components/tutorial/SkillTutorialLauncher";
import { css } from "../../../styled-system/css";

interface TutorialObserverModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Tutorial state from the classroom tutorial states */
  tutorialState: ClassroomTutorialState;
  /** Student info for display */
  student: {
    name: string;
    emoji: string;
    color: string;
  };
  /** Classroom ID for socket channel */
  classroomId: string;
}

/**
 * Modal for teachers to observe a student's skill tutorial in real-time.
 *
 * Uses the same SkillTutorialLauncher component as the student sees,
 * but in observation mode (read-only, state synced via WebSocket).
 */
export function TutorialObserverModal({
  isOpen,
  onClose,
  tutorialState,
  student,
  classroomId,
}: TutorialObserverModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Tutorial control hook for sending commands to student
  const { sendControl, isConnected: isControlConnected } = useTutorialControl(
    classroomId,
    tutorialState.playerId,
    isOpen,
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        data-element="modal-backdrop"
        className={css({
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: Z_INDEX.MODAL_BACKDROP,
        })}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-component="tutorial-observer-modal"
        className={css({
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "95vw",
          maxWidth: "900px",
          maxHeight: "90vh",
          backgroundColor: isDark ? "gray.900" : "white",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          zIndex: Z_INDEX.MODAL,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid",
            borderColor: isDark ? "gray.700" : "gray.200",
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "12px",
            })}
          >
            <span
              className={css({
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.125rem",
              })}
              style={{ backgroundColor: student.color }}
            >
              {student.emoji}
            </span>
            <div>
              <h2
                className={css({
                  fontWeight: "bold",
                  color: isDark ? "white" : "gray.800",
                  fontSize: "0.9375rem",
                })}
              >
                Observing {student.name}
              </h2>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                })}
              >
                <span
                  className={css({
                    fontSize: "0.75rem",
                    color: isDark ? "gray.400" : "gray.500",
                  })}
                >
                  Learning: {tutorialState.skillTitle}
                </span>
                <span
                  className={css({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.6875rem",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    backgroundColor: "green.500",
                    color: "white",
                  })}
                >
                  <span
                    className={css({
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                    })}
                  />
                  LIVE
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-action="close-observer"
            className={css({
              padding: "8px 16px",
              backgroundColor: isDark ? "gray.700" : "gray.200",
              color: isDark ? "gray.200" : "gray.700",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: "medium",
              cursor: "pointer",
              _hover: { backgroundColor: isDark ? "gray.600" : "gray.300" },
            })}
          >
            Close
          </button>
        </div>

        {/* Tutorial content - uses the SAME component as student */}
        <div
          className={css({
            flex: 1,
            overflow: "auto",
            padding: "16px",
          })}
        >
          <SkillTutorialLauncher
            skillId={tutorialState.skillId}
            playerId={tutorialState.playerId}
            theme={isDark ? "dark" : "light"}
            observedState={tutorialState}
            onControl={sendControl}
          />
        </div>

        {/* Teacher controls footer */}
        <div
          className={css({
            padding: "12px 20px",
            borderTop: "1px solid",
            borderColor: isDark ? "gray.700" : "gray.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            backgroundColor: isDark ? "gray.800" : "gray.50",
          })}
        >
          {/* Connection status */}
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "6px",
            })}
          >
            <span
              className={css({
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              })}
              style={{
                backgroundColor: isControlConnected ? "#10b981" : "#ef4444",
              }}
            />
            <span
              className={css({
                fontSize: "0.75rem",
                color: isDark ? "gray.400" : "gray.500",
              })}
            >
              {isControlConnected
                ? "Controls Connected"
                : "Controls Disconnected"}
            </span>
          </div>

          {/* Control buttons */}
          <div className={css({ display: "flex", gap: "8px" })}>
            {/* Intro state controls */}
            {tutorialState.launcherState === "intro" && (
              <>
                <button
                  type="button"
                  data-action="start-tutorial"
                  onClick={() => sendControl({ type: "start-tutorial" })}
                  disabled={!isControlConnected}
                  className={css({
                    padding: "8px 16px",
                    backgroundColor: isDark ? "blue.600" : "blue.500",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: "medium",
                    cursor: "pointer",
                    _hover: {
                      backgroundColor: isDark ? "blue.500" : "blue.600",
                    },
                    _disabled: { opacity: 0.5, cursor: "not-allowed" },
                  })}
                >
                  Start Tutorial
                </button>
                <button
                  type="button"
                  data-action="skip-tutorial"
                  onClick={() => sendControl({ type: "skip-tutorial" })}
                  disabled={!isControlConnected}
                  className={css({
                    padding: "8px 16px",
                    backgroundColor: isDark ? "gray.700" : "gray.200",
                    color: isDark ? "gray.200" : "gray.700",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: "medium",
                    cursor: "pointer",
                    _hover: {
                      backgroundColor: isDark ? "gray.600" : "gray.300",
                    },
                    _disabled: { opacity: 0.5, cursor: "not-allowed" },
                  })}
                >
                  Skip Tutorial
                </button>
              </>
            )}

            {/* Tutorial state controls */}
            {tutorialState.launcherState === "tutorial" &&
              tutorialState.tutorialState && (
                <>
                  <button
                    type="button"
                    data-action="previous-step"
                    onClick={() => sendControl({ type: "previous-step" })}
                    disabled={
                      !isControlConnected ||
                      tutorialState.tutorialState.currentStepIndex === 0
                    }
                    className={css({
                      padding: "8px 12px",
                      backgroundColor: isDark ? "gray.700" : "gray.200",
                      color: isDark ? "gray.200" : "gray.700",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      fontWeight: "medium",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: isDark ? "gray.600" : "gray.300",
                      },
                      _disabled: { opacity: 0.4, cursor: "not-allowed" },
                    })}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    data-action="next-step"
                    onClick={() => sendControl({ type: "next-step" })}
                    disabled={
                      !isControlConnected ||
                      tutorialState.tutorialState.currentStepIndex >=
                        tutorialState.tutorialState.totalSteps - 1
                    }
                    className={css({
                      padding: "8px 12px",
                      backgroundColor: isDark ? "gray.700" : "gray.200",
                      color: isDark ? "gray.200" : "gray.700",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      fontWeight: "medium",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: isDark ? "gray.600" : "gray.300",
                      },
                      _disabled: { opacity: 0.4, cursor: "not-allowed" },
                    })}
                  >
                    Next →
                  </button>
                  <button
                    type="button"
                    data-action="set-to-target"
                    onClick={() =>
                      sendControl({
                        type: "set-abacus-value",
                        value: tutorialState.tutorialState!.targetValue,
                      })
                    }
                    disabled={
                      !isControlConnected ||
                      tutorialState.tutorialState.currentValue ===
                        tutorialState.tutorialState.targetValue
                    }
                    className={css({
                      padding: "8px 12px",
                      backgroundColor: isDark ? "green.700" : "green.100",
                      color: isDark ? "green.200" : "green.700",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      fontWeight: "medium",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: isDark ? "green.600" : "green.200",
                      },
                      _disabled: { opacity: 0.4, cursor: "not-allowed" },
                    })}
                  >
                    Set to {tutorialState.tutorialState.targetValue}
                  </button>
                  <button
                    type="button"
                    data-action="skip-tutorial"
                    onClick={() => sendControl({ type: "skip-tutorial" })}
                    disabled={!isControlConnected}
                    className={css({
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      color: isDark ? "gray.400" : "gray.500",
                      border: "1px solid",
                      borderColor: isDark ? "gray.600" : "gray.300",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: isDark ? "gray.800" : "gray.100",
                      },
                      _disabled: { opacity: 0.4, cursor: "not-allowed" },
                    })}
                  >
                    Skip
                  </button>
                </>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
