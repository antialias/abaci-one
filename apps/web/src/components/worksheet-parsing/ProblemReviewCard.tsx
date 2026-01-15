"use client";

/**
 * ProblemReviewCard - Mobile-first card UI for reviewing one problem at a time
 *
 * Features:
 * - Large cropped view of the problem region from the worksheet
 * - Clear display of terms, student answer, and correct answer
 * - Inline editing for corrections
 * - Quick action buttons: Approve, Correct, Flag
 * - Navigation controls
 */

import {
  type ReactNode,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { css } from "../../../styled-system/css";
import type { ParsedProblem, BoundingBox } from "@/lib/worksheet-parsing";
import type { ProblemCorrection } from "./EditableProblemRow";

export interface ProblemReviewCardProps {
  /** The problem being reviewed */
  problem: ParsedProblem;
  /** Index in the problems array (0-based) */
  index: number;
  /** Total number of problems */
  totalProblems: number;
  /** Full worksheet image URL */
  worksheetImageUrl: string;
  /** Callback when correction is submitted */
  onSubmitCorrection: (correction: ProblemCorrection) => void;
  /** Callback when approved without changes */
  onApprove: () => void;
  /** Callback when flagged for re-scan */
  onFlag: () => void;
  /** Callback to navigate to next problem */
  onNext: () => void;
  /** Callback to navigate to previous problem */
  onPrev: () => void;
  /** Whether currently saving */
  isSaving?: boolean;
  /** Dark mode */
  isDark?: boolean;
}

/**
 * Parse terms string into array of numbers
 */
function parseTermsString(input: string): number[] | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const parts = cleaned.split(/([+-])/).filter((p) => p.trim());
  const terms: number[] = [];
  let sign = 1;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "+") {
      sign = 1;
    } else if (trimmed === "-") {
      sign = -1;
    } else {
      const num = parseInt(trimmed, 10);
      if (Number.isNaN(num)) return null;
      terms.push(sign * num);
      sign = 1;
    }
  }

  return terms.length > 0 ? terms : null;
}

/**
 * Format terms array into readable string
 */
function formatTerms(terms: number[]): string {
  if (terms.length === 0) return "";
  if (terms.length === 1) return terms[0].toString();

  return terms
    .map((term, i) => {
      if (i === 0) return term.toString();
      if (term >= 0) return `+ ${term}`;
      return `- ${Math.abs(term)}`;
    })
    .join(" ");
}

/**
 * Get confidence level info
 */
function getConfidenceInfo(confidence: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (confidence >= 0.85) {
    return { label: "High", color: "green.400", bgColor: "green.900/30" };
  }
  if (confidence >= 0.7) {
    return { label: "Medium", color: "yellow.400", bgColor: "yellow.900/30" };
  }
  return { label: "Low", color: "red.400", bgColor: "red.900/30" };
}

/**
 * Cropped image component that displays a specific region of the worksheet
 */
function CroppedProblemImage({
  imageUrl,
  boundingBox,
  isDark,
}: {
  imageUrl: string;
  boundingBox: BoundingBox;
  isDark?: boolean;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate CSS to crop and display the region, plus bounding box overlay position
  const { cropStyle, boxStyle } = useMemo(() => {
    if (!imageSize.width || !containerSize.width) {
      return { cropStyle: {}, boxStyle: {} };
    }

    // Add padding around the bounding box (20% on each side)
    const padding = 0.2;
    const x = Math.max(0, boundingBox.x - boundingBox.width * padding);
    const y = Math.max(0, boundingBox.y - boundingBox.height * padding);
    const width = Math.min(1 - x, boundingBox.width * (1 + padding * 2));
    const height = Math.min(1 - y, boundingBox.height * (1 + padding * 2));

    // Calculate scale to fit the region in the container
    const regionAspect = width / height;
    const containerAspect = containerSize.width / containerSize.height;

    let scale: number;
    if (regionAspect > containerAspect) {
      // Region is wider - fit to width
      scale = containerSize.width / (width * imageSize.width);
    } else {
      // Region is taller - fit to height
      scale = containerSize.height / (height * imageSize.height);
    }

    const scaledImageWidth = imageSize.width * scale;
    const scaledImageHeight = imageSize.height * scale;

    // Center the cropped region
    const offsetX =
      -x * scaledImageWidth +
      (containerSize.width - width * scaledImageWidth) / 2;
    const offsetY =
      -y * scaledImageHeight +
      (containerSize.height - height * scaledImageHeight) / 2;

    // Calculate bounding box overlay position (in container coordinates)
    const boxLeft = boundingBox.x * scaledImageWidth + offsetX;
    const boxTop = boundingBox.y * scaledImageHeight + offsetY;
    const boxWidth = boundingBox.width * scaledImageWidth;
    const boxHeight = boundingBox.height * scaledImageHeight;

    return {
      cropStyle: {
        width: `${scaledImageWidth}px`,
        height: `${scaledImageHeight}px`,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      },
      boxStyle: {
        left: `${boxLeft}px`,
        top: `${boxTop}px`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
      },
    };
  }, [imageSize, containerSize, boundingBox]);

  return (
    <div
      ref={containerRef}
      data-element="cropped-problem-image"
      style={{ overflow: "hidden" }}
      className={css({
        width: "100%",
        height: "200px",
        borderRadius: "lg",
        backgroundColor: isDark ? "gray.900" : "gray.100",
        position: "relative",
      })}
    >
      {imageSize.width > 0 && (
        <>
          {/* biome-ignore lint/performance/noImgElement: Using CSS transforms for cropping that next/image doesn't support */}
          <img
            src={imageUrl}
            alt="Problem region"
            style={cropStyle}
            className={css({
              position: "absolute",
              top: 0,
              left: 0,
              objectFit: "none",
            })}
          />
          {/* Bounding box overlay to highlight the detected problem */}
          {/* Uses massive box-shadow spread to darken everything outside the box */}
          <div
            data-element="problem-bounding-box"
            style={boxStyle}
            className={css({
              position: "absolute",
              border: "2px solid",
              borderColor: "blue.400",
              borderRadius: "sm",
              pointerEvents: "none",
              // Large spread shadow covers everything outside, creating cutout effect
              boxShadow:
                "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.4)",
            })}
          />
        </>
      )}
    </div>
  );
}

export function ProblemReviewCard({
  problem,
  index,
  totalProblems,
  worksheetImageUrl,
  onSubmitCorrection,
  onApprove,
  onFlag,
  onNext,
  onPrev,
  isSaving = false,
  isDark = true,
}: ProblemReviewCardProps): ReactNode {
  const [isEditing, setIsEditing] = useState(false);
  const [termsInput, setTermsInput] = useState(formatTerms(problem.terms));
  const [studentAnswerInput, setStudentAnswerInput] = useState(
    problem.studentAnswer?.toString() ?? "",
  );
  const [termsError, setTermsError] = useState<string | null>(null);
  const termsInputRef = useRef<HTMLInputElement>(null);

  // Reset form when problem changes
  useEffect(() => {
    setIsEditing(false);
    setTermsInput(formatTerms(problem.terms));
    setStudentAnswerInput(problem.studentAnswer?.toString() ?? "");
    setTermsError(null);
  }, [problem]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && termsInputRef.current) {
      termsInputRef.current.focus();
    }
  }, [isEditing]);

  const isCorrect =
    problem.studentAnswer !== null &&
    problem.studentAnswer === problem.correctAnswer;
  const minConfidence = Math.min(
    problem.termsConfidence,
    problem.studentAnswerConfidence,
  );
  const confidenceInfo = getConfidenceInfo(minConfidence);

  // Calculate correct answer from current terms input
  const calculatedAnswer = useMemo(() => {
    const parsed = parseTermsString(termsInput);
    if (!parsed) return null;
    return parsed.reduce((a, b) => a + b, 0);
  }, [termsInput]);

  const handleSaveCorrection = useCallback(() => {
    const parsedTerms = parseTermsString(termsInput);
    if (!parsedTerms || parsedTerms.length < 2) {
      setTermsError("Enter at least 2 terms");
      return;
    }

    let parsedAnswer: number | null = null;
    if (studentAnswerInput.trim()) {
      parsedAnswer = parseInt(studentAnswerInput.trim(), 10);
      if (Number.isNaN(parsedAnswer)) {
        return;
      }
    }

    const termsChanged =
      JSON.stringify(parsedTerms) !== JSON.stringify(problem.terms);
    const answerChanged = parsedAnswer !== problem.studentAnswer;

    if (termsChanged || answerChanged) {
      onSubmitCorrection({
        problemNumber: problem.problemNumber,
        correctedTerms: termsChanged ? parsedTerms : undefined,
        correctedStudentAnswer: answerChanged ? parsedAnswer : undefined,
      });
    }

    setIsEditing(false);
  }, [termsInput, studentAnswerInput, problem, onSubmitCorrection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveCorrection();
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setTermsInput(formatTerms(problem.terms));
        setStudentAnswerInput(problem.studentAnswer?.toString() ?? "");
      }
    },
    [handleSaveCorrection, problem],
  );

  return (
    <div
      data-component="problem-review-card"
      data-problem-index={index}
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 4,
        backgroundColor: isDark ? "gray.800" : "white",
        borderRadius: "xl",
        boxShadow: "lg",
      })}
    >
      {/* Header with problem number and navigation */}
      <div
        data-element="card-header"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <div
          data-element="problem-number-group"
          className={css({ display: "flex", alignItems: "center", gap: 2 })}
        >
          <span
            data-element="problem-number"
            className={css({
              fontSize: "lg",
              fontWeight: "bold",
              color: isDark ? "white" : "gray.900",
            })}
          >
            Problem {index + 1}
          </span>
          <span
            data-element="problem-counter"
            className={css({
              fontSize: "sm",
              color: isDark ? "gray.400" : "gray.500",
            })}
          >
            of {totalProblems}
          </span>
        </div>

        {/* Confidence badge */}
        <span
          data-element="confidence-badge"
          data-confidence-level={confidenceInfo.label.toLowerCase()}
          className={css({
            px: 2,
            py: 1,
            fontSize: "xs",
            fontWeight: "medium",
            borderRadius: "full",
            backgroundColor: confidenceInfo.bgColor,
            color: confidenceInfo.color,
          })}
        >
          {Math.round(minConfidence * 100)}% confidence
        </span>
      </div>

      {/* Cropped problem image */}
      <CroppedProblemImage
        imageUrl={worksheetImageUrl}
        boundingBox={problem.problemBoundingBox}
        isDark={isDark}
      />

      {/* Problem details */}
      {isEditing ? (
        <div
          data-element="edit-form"
          className={css({ display: "flex", flexDirection: "column", gap: 3 })}
        >
          {/* Terms input */}
          <div data-element="terms-input-group">
            <label
              data-element="terms-label"
              className={css({
                display: "block",
                fontSize: "sm",
                fontWeight: "medium",
                color: isDark ? "gray.400" : "gray.600",
                marginBottom: 1,
              })}
            >
              Problem
            </label>
            <input
              ref={termsInputRef}
              data-input="terms"
              type="text"
              value={termsInput}
              onChange={(e) => {
                setTermsInput(e.target.value);
                setTermsError(null);
              }}
              onKeyDown={handleKeyDown}
              className={css({
                width: "100%",
                px: 3,
                py: 2,
                fontSize: "lg",
                fontFamily: "mono",
                backgroundColor: isDark ? "gray.900" : "gray.100",
                color: isDark ? "white" : "gray.900",
                border: "2px solid",
                borderColor: termsError
                  ? "red.500"
                  : isDark
                    ? "gray.600"
                    : "gray.300",
                borderRadius: "lg",
                _focus: {
                  outline: "none",
                  borderColor: "blue.500",
                },
              })}
              placeholder="45 + 27 - 12"
            />
            {termsError && (
              <p
                data-element="terms-error"
                className={css({
                  fontSize: "sm",
                  color: "red.400",
                  marginTop: 1,
                })}
              >
                {termsError}
              </p>
            )}
            {calculatedAnswer !== null && (
              <p
                data-element="calculated-answer"
                className={css({
                  fontSize: "sm",
                  color: isDark ? "gray.500" : "gray.500",
                  marginTop: 1,
                })}
              >
                Correct answer: {calculatedAnswer}
              </p>
            )}
          </div>

          {/* Student answer input */}
          <div data-element="student-answer-input-group">
            <label
              data-element="student-answer-label"
              className={css({
                display: "block",
                fontSize: "sm",
                fontWeight: "medium",
                color: isDark ? "gray.400" : "gray.600",
                marginBottom: 1,
              })}
            >
              Student's Answer
            </label>
            <input
              data-input="student-answer"
              type="text"
              value={studentAnswerInput}
              onChange={(e) => setStudentAnswerInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={css({
                width: "120px",
                px: 3,
                py: 2,
                fontSize: "lg",
                fontFamily: "mono",
                backgroundColor: isDark ? "gray.900" : "gray.100",
                color: isDark ? "white" : "gray.900",
                border: "2px solid",
                borderColor: isDark ? "gray.600" : "gray.300",
                borderRadius: "lg",
                _focus: {
                  outline: "none",
                  borderColor: "blue.500",
                },
              })}
              placeholder="?"
            />
          </div>

          {/* Edit mode buttons */}
          <div
            data-element="edit-actions"
            className={css({ display: "flex", gap: 2, marginTop: 2 })}
          >
            <button
              type="button"
              data-action="save-correction"
              onClick={handleSaveCorrection}
              disabled={isSaving}
              className={css({
                flex: 1,
                py: 2,
                fontSize: "sm",
                fontWeight: "medium",
                backgroundColor: "green.600",
                color: "white",
                border: "none",
                borderRadius: "lg",
                cursor: "pointer",
                _hover: { backgroundColor: "green.700" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </button>
            <button
              type="button"
              data-action="cancel-edit"
              onClick={() => {
                setIsEditing(false);
                setTermsInput(formatTerms(problem.terms));
                setStudentAnswerInput(problem.studentAnswer?.toString() ?? "");
              }}
              className={css({
                px: 4,
                py: 2,
                fontSize: "sm",
                fontWeight: "medium",
                backgroundColor: isDark ? "gray.700" : "gray.200",
                color: isDark ? "white" : "gray.700",
                border: "none",
                borderRadius: "lg",
                cursor: "pointer",
                _hover: { backgroundColor: isDark ? "gray.600" : "gray.300" },
              })}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          data-element="display-mode"
          className={css({ display: "flex", flexDirection: "column", gap: 2 })}
        >
          {/* Problem expression - large display */}
          <div
            data-element="problem-expression"
            className={css({
              fontFamily: "mono",
              fontSize: "2xl",
              fontWeight: "bold",
              color: isDark ? "white" : "gray.900",
              textAlign: "center",
              padding: 3,
              backgroundColor: isDark ? "gray.900" : "gray.100",
              borderRadius: "lg",
            })}
          >
            <span data-element="terms-display">
              {formatTerms(problem.terms)}
            </span>{" "}
            ={" "}
            <span
              data-element="student-answer-display"
              data-answer-status={
                problem.studentAnswer === null
                  ? "missing"
                  : isCorrect
                    ? "correct"
                    : "incorrect"
              }
              className={css({
                color:
                  problem.studentAnswer === null
                    ? isDark
                      ? "gray.500"
                      : "gray.400"
                    : isCorrect
                      ? "green.400"
                      : "red.400",
              })}
            >
              {problem.studentAnswer ?? "?"}
            </span>
          </div>

          {/* Result indicator */}
          <div
            data-element="result-indicator"
            data-result={
              isCorrect
                ? "correct"
                : problem.studentAnswer === null
                  ? "missing"
                  : "incorrect"
            }
            className={css({
              textAlign: "center",
              fontSize: "sm",
              color: isCorrect
                ? "green.400"
                : problem.studentAnswer === null
                  ? isDark
                    ? "gray.500"
                    : "gray.500"
                  : "red.400",
            })}
          >
            {isCorrect
              ? "✓ Correct"
              : problem.studentAnswer === null
                ? "No answer detected"
                : `✗ Incorrect — Correct answer: ${problem.correctAnswer}`}
          </div>

          {/* Notes from LLM if any */}
          {problem.notes && (
            <div
              data-element="llm-notes"
              className={css({
                fontSize: "sm",
                color: isDark ? "yellow.400" : "yellow.600",
                backgroundColor: isDark ? "yellow.900/20" : "yellow.50",
                padding: 2,
                borderRadius: "md",
                borderLeft: "3px solid",
                borderColor: "yellow.500",
              })}
            >
              ⚠️ {problem.notes}
            </div>
          )}
        </div>
      )}

      {/* Action buttons - only show when not editing */}
      {!isEditing && (
        <div
          data-element="action-buttons"
          className={css({ display: "flex", gap: 2 })}
        >
          <button
            type="button"
            data-action="approve-problem"
            onClick={onApprove}
            disabled={isSaving}
            className={css({
              flex: 1,
              py: 3,
              fontSize: "sm",
              fontWeight: "bold",
              backgroundColor: "green.600",
              color: "white",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: "green.700" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            ✓ Looks Good
          </button>
          <button
            type="button"
            data-action="edit-problem"
            onClick={() => setIsEditing(true)}
            className={css({
              flex: 1,
              py: 3,
              fontSize: "sm",
              fontWeight: "bold",
              backgroundColor: isDark ? "blue.600" : "blue.500",
              color: "white",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: isDark ? "blue.700" : "blue.600" },
            })}
          >
            ✏️ Correct
          </button>
          <button
            type="button"
            data-action="flag-problem"
            onClick={onFlag}
            disabled={isSaving}
            className={css({
              px: 4,
              py: 3,
              fontSize: "sm",
              fontWeight: "bold",
              backgroundColor: isDark ? "gray.700" : "gray.200",
              color: isDark ? "orange.400" : "orange.600",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: isDark ? "gray.600" : "gray.300" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            🚩
          </button>
        </div>
      )}

      {/* Navigation */}
      <div
        data-element="navigation"
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 2,
          borderTop: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        <button
          type="button"
          data-action="prev-problem"
          onClick={onPrev}
          disabled={index === 0}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 3,
            py: 2,
            fontSize: "sm",
            fontWeight: "medium",
            backgroundColor: "transparent",
            color: isDark ? "gray.400" : "gray.600",
            border: "none",
            borderRadius: "md",
            cursor: "pointer",
            _hover: { backgroundColor: isDark ? "gray.700" : "gray.100" },
            _disabled: { opacity: 0.3, cursor: "not-allowed" },
          })}
        >
          ← Previous
        </button>

        <span
          data-element="navigation-counter"
          className={css({
            fontSize: "sm",
            color: isDark ? "gray.500" : "gray.500",
          })}
        >
          {index + 1} / {totalProblems}
        </span>

        <button
          type="button"
          data-action="next-problem"
          onClick={onNext}
          disabled={index === totalProblems - 1}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 3,
            py: 2,
            fontSize: "sm",
            fontWeight: "medium",
            backgroundColor: "transparent",
            color: isDark ? "gray.400" : "gray.600",
            border: "none",
            borderRadius: "md",
            cursor: "pointer",
            _hover: { backgroundColor: isDark ? "gray.700" : "gray.100" },
            _disabled: { opacity: 0.3, cursor: "not-allowed" },
          })}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default ProblemReviewCard;
