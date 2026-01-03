"use client";

/**
 * ParsingProgressModal - Shows progress during worksheet parsing
 *
 * Displays animated stages while the LLM analyzes the worksheet image.
 * Since the API is synchronous, stages are simulated based on typical timing.
 */

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";

interface ParsingProgressModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close (e.g., cancel button) */
  onClose: () => void;
  /** Whether parsing completed successfully */
  isSuccess?: boolean;
  /** Whether parsing failed */
  isError?: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Number of problems found (shown on success) */
  problemCount?: number;
}

// Stages with typical timing (in milliseconds)
const STAGES = [
  { id: "preparing", label: "Preparing image...", duration: 1000 },
  { id: "analyzing", label: "Analyzing worksheet...", duration: 8000 },
  { id: "extracting", label: "Extracting problems...", duration: 6000 },
  { id: "validating", label: "Validating results...", duration: 3000 },
] as const;

type StageId = (typeof STAGES)[number]["id"];

export function ParsingProgressModal({
  isOpen,
  onClose,
  isSuccess = false,
  isError = false,
  errorMessage,
  problemCount,
}: ParsingProgressModalProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageStartTime, setStageStartTime] = useState<number>(Date.now());

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStageIndex(0);
      setStageStartTime(Date.now());
    }
  }, [isOpen]);

  // Advance through stages based on timing
  useEffect(() => {
    if (!isOpen || isSuccess || isError) return;
    if (currentStageIndex >= STAGES.length - 1) return;

    const stage = STAGES[currentStageIndex];
    const elapsed = Date.now() - stageStartTime;
    const remaining = Math.max(0, stage.duration - elapsed);

    const timer = setTimeout(() => {
      setCurrentStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
      setStageStartTime(Date.now());
    }, remaining);

    return () => clearTimeout(timer);
  }, [isOpen, isSuccess, isError, currentStageIndex, stageStartTime]);

  // Auto-close on success after brief delay
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  const currentStage = STAGES[currentStageIndex];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: Z_INDEX.MODAL_BACKDROP,
          })}
        />
        <Dialog.Content
          className={css({
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "2rem",
            width: "90%",
            maxWidth: "360px",
            zIndex: Z_INDEX.MODAL,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            _dark: {
              backgroundColor: "gray.800",
            },
          })}
          aria-describedby={undefined}
        >
          <Dialog.Title
            className={css({
              fontSize: "1.125rem",
              fontWeight: "600",
              marginBottom: "1.5rem",
              textAlign: "center",
              color: "gray.800",
              _dark: { color: "white" },
            })}
          >
            {isSuccess
              ? "✅ Parsing Complete"
              : isError
                ? "❌ Parsing Failed"
                : "📊 Analyzing Worksheet"}
          </Dialog.Title>

          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
            })}
          >
            {/* Success State */}
            {isSuccess && (
              <div
                className={css({
                  textAlign: "center",
                  color: "green.600",
                  _dark: { color: "green.400" },
                })}
              >
                <div
                  className={css({
                    fontSize: "3rem",
                    marginBottom: "0.5rem",
                  })}
                >
                  ✓
                </div>
                <p className={css({ fontSize: "1rem", fontWeight: "500" })}>
                  Found {problemCount ?? "some"} problems
                </p>
              </div>
            )}

            {/* Error State */}
            {isError && (
              <div
                className={css({
                  textAlign: "center",
                })}
              >
                <div
                  className={css({
                    fontSize: "3rem",
                    marginBottom: "0.5rem",
                  })}
                >
                  ⚠️
                </div>
                <p
                  className={css({
                    fontSize: "0.875rem",
                    color: "red.600",
                    _dark: { color: "red.400" },
                    maxWidth: "280px",
                  })}
                >
                  {errorMessage ||
                    "An error occurred while parsing the worksheet."}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className={css({
                    marginTop: "1rem",
                    px: 4,
                    py: 2,
                    backgroundColor: "gray.100",
                    color: "gray.700",
                    borderRadius: "lg",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "500",
                    _hover: { backgroundColor: "gray.200" },
                    _dark: {
                      backgroundColor: "gray.700",
                      color: "gray.200",
                      _hover: { backgroundColor: "gray.600" },
                    },
                  })}
                >
                  Close
                </button>
              </div>
            )}

            {/* Loading State */}
            {!isSuccess && !isError && (
              <>
                {/* Spinner */}
                <div
                  className={css({
                    width: "48px",
                    height: "48px",
                    border: "4px solid",
                    borderColor: "blue.100",
                    borderTopColor: "blue.500",
                    borderRadius: "full",
                    animation: "spin 1s linear infinite",
                    _dark: {
                      borderColor: "gray.700",
                      borderTopColor: "blue.400",
                    },
                  })}
                />

                {/* Current Stage */}
                <p
                  className={css({
                    fontSize: "1rem",
                    fontWeight: "500",
                    color: "gray.700",
                    animation: "pulseOpacity 2s ease-in-out infinite",
                    _dark: { color: "gray.300" },
                  })}
                >
                  {currentStage.label}
                </p>

                {/* Stage Progress */}
                <div
                  className={css({
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  })}
                >
                  {STAGES.map((stage, index) => (
                    <div
                      key={stage.id}
                      className={css({
                        width: "8px",
                        height: "8px",
                        borderRadius: "full",
                        backgroundColor:
                          index < currentStageIndex
                            ? "green.500"
                            : index === currentStageIndex
                              ? "blue.500"
                              : "gray.300",
                        transition: "background-color 0.3s",
                        _dark: {
                          backgroundColor:
                            index < currentStageIndex
                              ? "green.400"
                              : index === currentStageIndex
                                ? "blue.400"
                                : "gray.600",
                        },
                      })}
                    />
                  ))}
                </div>

                {/* Timing hint */}
                <p
                  className={css({
                    fontSize: "0.75rem",
                    color: "gray.500",
                    textAlign: "center",
                    _dark: { color: "gray.400" },
                  })}
                >
                  This usually takes 15-30 seconds
                </p>

                {/* Cancel hint - parsing continues in background */}
                <button
                  type="button"
                  onClick={onClose}
                  className={css({
                    fontSize: "0.75rem",
                    color: "gray.400",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    _hover: { color: "gray.600" },
                    _dark: {
                      color: "gray.500",
                      _hover: { color: "gray.300" },
                    },
                  })}
                >
                  Hide (parsing continues in background)
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ParsingProgressModal;
