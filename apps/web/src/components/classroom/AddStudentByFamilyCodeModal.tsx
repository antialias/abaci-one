"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";

interface AddStudentByFamilyCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
}

interface PlayerPreview {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

/**
 * Modal for teachers to add a student to their classroom using a family code
 *
 * Flow:
 * 1. Teacher enters family code
 * 2. System looks up student and creates enrollment request
 * 3. Parent receives notification to approve
 */
export function AddStudentByFamilyCodeModal({
  isOpen,
  onClose,
  classroomId,
}: AddStudentByFamilyCodeModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [familyCode, setFamilyCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [playerPreview, setPlayerPreview] = useState<PlayerPreview | null>(
    null,
  );

  const handleSubmit = useCallback(async () => {
    if (!familyCode.trim()) {
      setError("Please enter a family code");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/classrooms/${classroomId}/enroll-by-family-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyCode: familyCode.trim() }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to add student");
        return;
      }

      setPlayerPreview(data.player);
      setSuccess(true);
    } catch (err) {
      setError("Failed to add student. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [familyCode, classroomId]);

  const handleClose = useCallback(() => {
    setFamilyCode("");
    setError(null);
    setSuccess(false);
    setPlayerPreview(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: Z_INDEX.MODAL,
          })}
        />
        <Dialog.Content
          data-component="add-student-by-family-code-modal"
          className={css({
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: isDark ? "gray.800" : "white",
            borderRadius: "16px",
            padding: "24px",
            width: "calc(100% - 2rem)",
            maxWidth: "400px",
            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.4)",
            zIndex: Z_INDEX.MODAL + 1,
            outline: "none",
          })}
        >
          {success && playerPreview ? (
            /* Success state */
            <>
              <div
                className={css({
                  textAlign: "center",
                  marginBottom: "24px",
                })}
              >
                <div
                  className={css({
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    margin: "0 auto 16px",
                  })}
                  style={{ backgroundColor: playerPreview.color }}
                >
                  {playerPreview.emoji}
                </div>
                <Dialog.Title
                  className={css({
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: isDark ? "white" : "gray.900",
                    marginBottom: "8px",
                  })}
                >
                  Enrollment Request Sent!
                </Dialog.Title>
                <Dialog.Description
                  className={css({
                    fontSize: "0.9375rem",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  <strong>{playerPreview.name}</strong> will be added to your
                  classroom once their parent approves the request.
                </Dialog.Description>
              </div>

              <button
                type="button"
                onClick={handleClose}
                data-action="close-success"
                className={css({
                  width: "100%",
                  padding: "12px",
                  backgroundColor: isDark ? "green.700" : "green.500",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: "medium",
                  cursor: "pointer",
                  _hover: {
                    backgroundColor: isDark ? "green.600" : "green.600",
                  },
                })}
              >
                Done
              </button>
            </>
          ) : (
            /* Input state */
            <>
              <Dialog.Title
                className={css({
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                  color: isDark ? "white" : "gray.900",
                  marginBottom: "8px",
                })}
              >
                Add Student by Family Code
              </Dialog.Title>
              <Dialog.Description
                className={css({
                  fontSize: "0.875rem",
                  color: isDark ? "gray.400" : "gray.600",
                  marginBottom: "20px",
                })}
              >
                Enter a student's family sharing code to send an enrollment
                request. Their parent will need to approve before they're added
                to your classroom.
              </Dialog.Description>

              <div className={css({ marginBottom: "16px" })}>
                <label
                  htmlFor="family-code"
                  className={css({
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "medium",
                    color: isDark ? "gray.300" : "gray.700",
                    marginBottom: "6px",
                  })}
                >
                  Family Code
                </label>
                <input
                  id="family-code"
                  type="text"
                  value={familyCode}
                  onChange={(e) => {
                    setFamilyCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g., ABCD-1234"
                  data-element="family-code-input"
                  className={css({
                    width: "100%",
                    padding: "12px",
                    fontSize: "1.25rem",
                    fontFamily: "monospace",
                    textAlign: "center",
                    letterSpacing: "0.1em",
                    backgroundColor: isDark ? "gray.700" : "gray.50",
                    border: "2px solid",
                    borderColor: error
                      ? isDark
                        ? "red.500"
                        : "red.400"
                      : isDark
                        ? "gray.600"
                        : "gray.300",
                    borderRadius: "8px",
                    color: isDark ? "white" : "gray.900",
                    outline: "none",
                    _focus: {
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
                    },
                    _placeholder: {
                      color: isDark ? "gray.500" : "gray.400",
                    },
                  })}
                />
              </div>

              {error && (
                <div
                  data-element="error-message"
                  className={css({
                    padding: "12px",
                    backgroundColor: isDark ? "red.900/30" : "red.50",
                    border: "1px solid",
                    borderColor: isDark ? "red.700" : "red.200",
                    borderRadius: "8px",
                    color: isDark ? "red.300" : "red.700",
                    fontSize: "0.875rem",
                    marginBottom: "16px",
                  })}
                >
                  {error}
                </div>
              )}

              <div className={css({ display: "flex", gap: "12px" })}>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    data-action="cancel"
                    className={css({
                      flex: 1,
                      padding: "12px",
                      backgroundColor: isDark ? "gray.700" : "gray.200",
                      color: isDark ? "gray.300" : "gray.700",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "1rem",
                      fontWeight: "medium",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: isDark ? "gray.600" : "gray.300",
                      },
                      _disabled: { opacity: 0.5, cursor: "not-allowed" },
                    })}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !familyCode.trim()}
                  data-action="submit"
                  className={css({
                    flex: 1,
                    padding: "12px",
                    backgroundColor: isDark ? "blue.700" : "blue.500",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    fontWeight: "medium",
                    cursor: "pointer",
                    _hover: {
                      backgroundColor: isDark ? "blue.600" : "blue.600",
                    },
                    _disabled: { opacity: 0.5, cursor: "not-allowed" },
                  })}
                >
                  {isSubmitting ? "Adding..." : "Add Student"}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
