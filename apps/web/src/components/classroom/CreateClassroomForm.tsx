"use client";

import { useCallback, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreateClassroom } from "@/hooks/useClassroom";
import { css } from "../../../styled-system/css";

interface CreateClassroomFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Form to create a new classroom (become a teacher)
 */
export function CreateClassroomForm({
  onSuccess,
  onCancel,
}: CreateClassroomFormProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [name, setName] = useState("");
  const createClassroom = useCreateClassroom();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      try {
        await createClassroom.mutateAsync({ name: name.trim() });
        onSuccess?.();
      } catch {
        // Error is handled by mutation state
      }
    },
    [name, createClassroom, onSuccess],
  );

  return (
    <div
      data-component="create-classroom-form"
      className={css({
        padding: "24px",
        backgroundColor: isDark ? "gray.800" : "white",
        borderRadius: "16px",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        maxWidth: "400px",
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
        Create Your Classroom
      </h2>
      <p
        className={css({
          fontSize: "0.875rem",
          color: isDark ? "gray.400" : "gray.600",
          marginBottom: "20px",
        })}
      >
        As a teacher, you can enroll students and observe their practice
        sessions.
      </p>

      <form onSubmit={handleSubmit}>
        <label
          htmlFor="classroom-name"
          className={css({
            display: "block",
            fontSize: "0.875rem",
            fontWeight: "medium",
            color: isDark ? "gray.300" : "gray.700",
            marginBottom: "6px",
          })}
        >
          Classroom Name
        </label>
        <input
          id="classroom-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Ms. Smith's Math Class"
          data-input="classroom-name"
          className={css({
            width: "100%",
            padding: "12px 14px",
            backgroundColor: isDark ? "gray.700" : "gray.50",
            border: "2px solid",
            borderColor: isDark ? "gray.600" : "gray.200",
            borderRadius: "8px",
            fontSize: "1rem",
            color: isDark ? "white" : "gray.800",
            marginBottom: "16px",
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

        {createClassroom.error && (
          <p
            className={css({
              fontSize: "0.8125rem",
              color: "red.500",
              marginBottom: "12px",
            })}
          >
            {createClassroom.error.message}
          </p>
        )}

        <div className={css({ display: "flex", gap: "12px" })}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={createClassroom.isPending}
              data-action="cancel-create-classroom"
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
          <button
            type="submit"
            disabled={createClassroom.isPending || !name.trim()}
            data-action="create-classroom"
            className={css({
              flex: 2,
              padding: "12px",
              backgroundColor: isDark ? "green.700" : "green.500",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.15s ease",
              _hover: {
                backgroundColor: isDark ? "green.600" : "green.600",
              },
              _disabled: {
                opacity: 0.5,
                cursor: "not-allowed",
              },
            })}
          >
            {createClassroom.isPending ? "Creating..." : "Create Classroom"}
          </button>
        </div>
      </form>
    </div>
  );
}
