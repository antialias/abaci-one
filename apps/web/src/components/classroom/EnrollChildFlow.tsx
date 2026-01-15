"use client";

import { useCallback, useState } from "react";
import type { Player } from "@/db/schema";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useClassroomByCode,
  useCreateEnrollmentRequest,
} from "@/hooks/useClassroom";
import { css } from "../../../styled-system/css";

interface EnrollChildFlowProps {
  /** Children available to enroll (linked to current user) */
  children: Player[];
  /** Called when enrollment request is successfully created */
  onSuccess?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

/**
 * EnrollChildFlow - Parent enrollment flow
 *
 * Allows parents to:
 * 1. Enter a classroom code
 * 2. See classroom/teacher info
 * 3. Select which child to enroll
 * 4. Submit enrollment request
 */
export function EnrollChildFlow({
  children,
  onSuccess,
  onCancel,
}: EnrollChildFlowProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Step state
  const [code, setCode] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Look up classroom by code
  const {
    data: classroom,
    isLoading: lookingUp,
    error: lookupError,
  } = useClassroomByCode(code);

  // Enrollment mutation
  const createRequest = useCreateEnrollmentRequest();

  const handleSubmit = useCallback(async () => {
    if (!classroom || !selectedChildId) return;

    try {
      await createRequest.mutateAsync({
        classroomId: classroom.id,
        playerId: selectedChildId,
      });
      onSuccess?.();
    } catch {
      // Error handled by mutation state
    }
  }, [classroom, selectedChildId, createRequest, onSuccess]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  return (
    <div
      data-component="enroll-child-flow"
      className={css({
        padding: "24px",
        backgroundColor: isDark ? "gray.800" : "white",
        borderRadius: "16px",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        maxWidth: "450px",
      })}
    >
      <h2
        className={css({
          fontSize: "1.25rem",
          fontWeight: "bold",
          color: isDark ? "white" : "gray.800",
          marginBottom: "8px",
        })}
      >
        Enroll in a Classroom
      </h2>
      <p
        className={css({
          fontSize: "0.875rem",
          color: isDark ? "gray.400" : "gray.600",
          marginBottom: "20px",
        })}
      >
        Enter the classroom code from your teacher to enroll your child.
      </p>

      {/* Step 1: Enter code */}
      <div className={css({ marginBottom: "20px" })}>
        <label
          htmlFor="classroom-code"
          className={css({
            display: "block",
            fontSize: "0.875rem",
            fontWeight: "medium",
            color: isDark ? "gray.300" : "gray.700",
            marginBottom: "6px",
          })}
        >
          Classroom Code
        </label>
        <input
          id="classroom-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g., ABC123"
          maxLength={6}
          data-input="classroom-code"
          className={css({
            width: "100%",
            padding: "12px 14px",
            backgroundColor: isDark ? "gray.700" : "gray.50",
            border: "2px solid",
            borderColor: isDark ? "gray.600" : "gray.200",
            borderRadius: "8px",
            fontSize: "1.25rem",
            fontWeight: "bold",
            fontFamily: "monospace",
            letterSpacing: "0.15em",
            textAlign: "center",
            textTransform: "uppercase",
            color: isDark ? "white" : "gray.800",
            outline: "none",
            transition: "border-color 0.15s ease",
            _focus: {
              borderColor: isDark ? "blue.500" : "blue.400",
            },
            _placeholder: {
              color: isDark ? "gray.500" : "gray.400",
              fontWeight: "normal",
              letterSpacing: "normal",
            },
          })}
        />

        {/* Lookup status */}
        {code.length >= 4 && (
          <div className={css({ marginTop: "12px" })}>
            {lookingUp && (
              <p
                className={css({
                  fontSize: "0.875rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                Looking up classroom...
              </p>
            )}

            {!lookingUp && !classroom && code.length >= 6 && (
              <p className={css({ fontSize: "0.875rem", color: "red.500" })}>
                No classroom found with this code
              </p>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Classroom found - show info */}
      {classroom && (
        <div
          data-section="classroom-found"
          className={css({
            padding: "16px",
            backgroundColor: isDark ? "green.900/20" : "green.50",
            borderRadius: "12px",
            border: "1px solid",
            borderColor: isDark ? "green.700" : "green.200",
            marginBottom: "20px",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "8px",
            })}
          >
            <span className={css({ fontSize: "1.25rem" })}>🏫</span>
            <div>
              <p
                className={css({
                  fontWeight: "bold",
                  color: isDark ? "green.300" : "green.700",
                })}
              >
                {classroom.name}
              </p>
              <p
                className={css({
                  fontSize: "0.8125rem",
                  color: isDark ? "green.400" : "green.600",
                })}
              >
                Teacher:{" "}
                {(classroom as { teacher?: { name?: string } }).teacher?.name ??
                  "Teacher"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Select child */}
      {classroom && children.length > 0 && (
        <div className={css({ marginBottom: "20px" })}>
          <label
            className={css({
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "medium",
              color: isDark ? "gray.300" : "gray.700",
              marginBottom: "10px",
            })}
          >
            Select child to enroll
          </label>

          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            })}
          >
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedChildId(child.id)}
                data-selected={selectedChildId === child.id}
                data-action={`select-child-${child.id}`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  backgroundColor:
                    selectedChildId === child.id
                      ? isDark
                        ? "blue.900/30"
                        : "blue.50"
                      : isDark
                        ? "gray.700"
                        : "gray.50",
                  border: "2px solid",
                  borderColor:
                    selectedChildId === child.id
                      ? isDark
                        ? "blue.500"
                        : "blue.400"
                      : isDark
                        ? "gray.600"
                        : "gray.200",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                  _hover: {
                    borderColor: isDark ? "blue.500" : "blue.400",
                  },
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
                  style={{ backgroundColor: child.color }}
                >
                  {child.emoji}
                </span>
                <span
                  className={css({
                    fontWeight: "medium",
                    color: isDark ? "white" : "gray.800",
                  })}
                >
                  {child.name}
                </span>
                {selectedChildId === child.id && (
                  <span
                    className={css({
                      marginLeft: "auto",
                      color: isDark ? "blue.400" : "blue.600",
                      fontSize: "1.25rem",
                    })}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {createRequest.error && (
        <p
          className={css({
            fontSize: "0.8125rem",
            color: "red.500",
            marginBottom: "12px",
          })}
        >
          {createRequest.error.message}
        </p>
      )}

      {/* Success display */}
      {createRequest.isSuccess && (
        <div
          className={css({
            padding: "16px",
            backgroundColor: isDark ? "green.900/20" : "green.50",
            borderRadius: "12px",
            border: "1px solid",
            borderColor: isDark ? "green.700" : "green.200",
            marginBottom: "20px",
            textAlign: "center",
          })}
        >
          <p
            className={css({
              fontWeight: "bold",
              color: isDark ? "green.300" : "green.700",
              marginBottom: "4px",
            })}
          >
            Enrollment Request Sent!
          </p>
          <p
            className={css({
              fontSize: "0.875rem",
              color: isDark ? "green.400" : "green.600",
            })}
          >
            The teacher will review and approve the enrollment.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className={css({ display: "flex", gap: "12px" })}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={createRequest.isPending}
            data-action="cancel-enroll"
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
              _disabled: {
                opacity: 0.5,
                cursor: "not-allowed",
              },
            })}
          >
            Cancel
          </button>
        )}

        {!createRequest.isSuccess && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!classroom || !selectedChildId || createRequest.isPending}
            data-action="submit-enrollment"
            className={css({
              flex: 2,
              padding: "12px",
              backgroundColor:
                classroom && selectedChildId
                  ? isDark
                    ? "green.700"
                    : "green.500"
                  : isDark
                    ? "gray.700"
                    : "gray.300",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: classroom && selectedChildId ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
              _hover: {
                backgroundColor:
                  classroom && selectedChildId
                    ? isDark
                      ? "green.600"
                      : "green.600"
                    : undefined,
              },
              _disabled: {
                opacity: 0.5,
                cursor: "not-allowed",
              },
            })}
          >
            {createRequest.isPending
              ? "Enrolling..."
              : `Enroll ${selectedChild?.name || "Child"}`}
          </button>
        )}

        {createRequest.isSuccess && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-action="done"
            className={css({
              flex: 1,
              padding: "12px",
              backgroundColor: isDark ? "green.700" : "green.500",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              _hover: {
                backgroundColor: isDark ? "green.600" : "green.600",
              },
            })}
          >
            Done
          </button>
        )}
      </div>

      {/* No children message */}
      {classroom && children.length === 0 && (
        <p
          className={css({
            fontSize: "0.875rem",
            color: isDark ? "gray.400" : "gray.500",
            textAlign: "center",
            marginTop: "16px",
          })}
        >
          You need to add a child first before enrolling in a classroom.
        </p>
      )}
    </div>
  );
}
