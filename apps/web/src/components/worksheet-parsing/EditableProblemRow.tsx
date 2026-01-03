"use client";

/**
 * EditableProblemRow - Inline editor for parsed worksheet problems
 *
 * Allows users to correct:
 * - Problem terms (the addends/subtrahends)
 * - Student's answer
 * - Mark problem for exclusion
 */

import type { ReactNode } from "react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { css } from "../../../styled-system/css";
import type { ParsedProblem } from "@/lib/worksheet-parsing";
import { Tooltip } from "@/components/ui/Tooltip";

export interface ProblemCorrection {
  problemNumber: number;
  correctedTerms?: number[] | null;
  correctedStudentAnswer?: number | null;
  shouldExclude?: boolean;
  shouldRestore?: boolean;
}

export interface EditableProblemRowProps {
  /** The problem data */
  problem: ParsedProblem;
  /** The 0-based index of this problem in the list */
  index: number;
  /** Whether this problem is currently selected (highlighted on image) */
  isSelected: boolean;
  /** Callback when this problem is clicked (for highlighting) */
  onSelect: () => void;
  /** Callback when corrections are submitted */
  onSubmitCorrection: (correction: ProblemCorrection) => void;
  /** Whether a correction is currently being saved */
  isSaving: boolean;
  /** Dark mode styling */
  isDark?: boolean;
  /** Whether any problems are selected (shows all checkboxes when true) */
  hasSelections?: boolean;
  /** Whether this problem is checked for re-parsing */
  isCheckedForReparse?: boolean;
  /** Callback when checkbox is toggled */
  onToggleReparse?: (index: number) => void;
  /** Optional cropped thumbnail URL for this problem */
  thumbnailUrl?: string;
}

/**
 * Parse a terms string like "45 + 27 - 12" into an array of numbers
 */
function parseTermsString(input: string): number[] | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  // Split by + or - while keeping the operator
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
      sign = 1; // Reset sign after using
    }
  }

  return terms.length > 0 ? terms : null;
}

/**
 * Format terms array into a string like "45 + 27 - 12"
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
 * Tooltip content showing confidence details and LLM notes
 */
function ConfidenceTooltipContent({
  termsConfidence,
  answerConfidence,
  notes,
}: {
  termsConfidence: number;
  answerConfidence: number;
  notes?: string | null;
}): ReactNode {
  const minConfidence = Math.min(termsConfidence, answerConfidence);
  const confidencePercent = Math.round(minConfidence * 100);

  // Determine confidence level label and color
  const getConfidenceLevel = (pct: number) => {
    if (pct >= 80) return { label: "High confidence", color: "green.400" };
    if (pct >= 50) return { label: "Uncertain", color: "yellow.400" };
    return { label: "Low confidence", color: "red.400" };
  };

  const level = getConfidenceLevel(confidencePercent);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: "280px",
      })}
    >
      {/* Confidence percentage and label */}
      <div className={css({ display: "flex", alignItems: "center", gap: 2 })}>
        <span
          className={css({
            fontSize: "lg",
            fontWeight: "bold",
            color: level.color,
          })}
        >
          {confidencePercent}%
        </span>
        <span className={css({ fontSize: "sm", color: level.color })}>
          {level.label}
        </span>
      </div>

      {/* LLM notes if present */}
      {notes && (
        <div
          className={css({
            fontSize: "sm",
            color: "gray.300",
            borderLeft: "2px solid token(colors.yellow.600)",
            paddingLeft: 2,
            fontStyle: "italic",
          })}
        >
          "{notes}"
        </div>
      )}

      {/* Confidence scale explanation */}
      <div
        className={css({
          fontSize: "xs",
          color: "gray.400",
          borderTop: "1px solid token(colors.gray.700)",
          paddingTop: 2,
          marginTop: 1,
        })}
      >
        <div className={css({ fontWeight: "medium", marginBottom: 1 })}>
          What this means:
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          })}
        >
          <span>
            <span className={css({ color: "green.400" })}>●</span> 80%+ =
            Confident reading
          </span>
          <span>
            <span className={css({ color: "yellow.400" })}>●</span> 50-79% =
            Unsure, check this
          </span>
          <span>
            <span className={css({ color: "red.400" })}>●</span> &lt;50% =
            Likely wrong, verify
          </span>
        </div>
      </div>
    </div>
  );
}

export function EditableProblemRow({
  problem,
  index,
  isSelected,
  onSelect,
  onSubmitCorrection,
  isSaving,
  isDark = true,
  hasSelections = false,
  isCheckedForReparse = false,
  onToggleReparse,
  thumbnailUrl,
}: EditableProblemRowProps): ReactNode {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [termsInput, setTermsInput] = useState(formatTerms(problem.terms));
  const [studentAnswerInput, setStudentAnswerInput] = useState(
    problem.studentAnswer?.toString() ?? "",
  );
  const [termsError, setTermsError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const termsInputRef = useRef<HTMLInputElement>(null);

  // Focus terms input when entering edit mode
  useEffect(() => {
    if (isEditing && termsInputRef.current) {
      termsInputRef.current.focus();
      termsInputRef.current.select();
    }
  }, [isEditing]);

  // Reset form when problem changes
  useEffect(() => {
    setTermsInput(formatTerms(problem.terms));
    setStudentAnswerInput(problem.studentAnswer?.toString() ?? "");
    setTermsError(null);
    setAnswerError(null);
  }, [problem]);

  // Check if form inputs are valid (for enabling Save button)
  const isFormValid = useMemo(() => {
    // Terms must parse and have at least 2 terms
    const parsedTerms = parseTermsString(termsInput);
    if (!parsedTerms || parsedTerms.length < 2) return false;

    // Student answer must be empty or a valid number
    if (studentAnswerInput.trim()) {
      const parsed = parseInt(studentAnswerInput.trim(), 10);
      if (Number.isNaN(parsed)) return false;
    }

    return true;
  }, [termsInput, studentAnswerInput]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(false);
      setTermsInput(formatTerms(problem.terms));
      setStudentAnswerInput(problem.studentAnswer?.toString() ?? "");
      setTermsError(null);
      setAnswerError(null);
    },
    [problem],
  );

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Validate terms
      const parsedTerms = parseTermsString(termsInput);
      if (!parsedTerms || parsedTerms.length < 2) {
        setTermsError('Enter at least 2 terms (e.g., "45 + 27")');
        return;
      }

      // Validate student answer (can be empty for "no answer")
      let parsedAnswer: number | null = null;
      if (studentAnswerInput.trim()) {
        parsedAnswer = parseInt(studentAnswerInput.trim(), 10);
        if (Number.isNaN(parsedAnswer)) {
          setAnswerError("Enter a valid number or leave blank");
          return;
        }
      }

      // Check if anything actually changed
      const termsChanged =
        JSON.stringify(parsedTerms) !== JSON.stringify(problem.terms);
      const answerChanged = parsedAnswer !== problem.studentAnswer;

      if (!termsChanged && !answerChanged) {
        // Nothing changed, just exit edit mode
        setIsEditing(false);
        return;
      }

      // Submit correction
      onSubmitCorrection({
        problemNumber: problem.problemNumber,
        correctedTerms: termsChanged ? parsedTerms : undefined,
        correctedStudentAnswer: answerChanged ? parsedAnswer : undefined,
      });

      setIsEditing(false);
    },
    [termsInput, studentAnswerInput, problem, onSubmitCorrection],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave(e as unknown as React.MouseEvent);
      } else if (e.key === "Escape") {
        handleCancel(e as unknown as React.MouseEvent);
      }
    },
    [handleSave, handleCancel],
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleReparse?.(index);
    },
    [index, onToggleReparse],
  );

  const isExcluded = problem.excluded === true;
  const isCorrect =
    problem.studentAnswer !== null &&
    problem.studentAnswer === problem.correctAnswer;
  const isIncorrect =
    problem.studentAnswer !== null &&
    problem.studentAnswer !== problem.correctAnswer;
  const isLowConfidence =
    Math.min(problem.termsConfidence, problem.studentAnswerConfidence) < 0.7;

  // Edit mode UI
  if (isEditing) {
    return (
      <div
        data-element="problem-row-editing"
        data-problem-index={index}
        className={css({
          padding: 3,
          backgroundColor: isDark ? "blue.900" : "blue.50",
          borderRadius: "lg",
          border: "2px solid token(colors.blue.500)",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 2,
            marginBottom: 3,
          })}
        >
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
              color: isDark ? "gray.400" : "gray.600",
            })}
          >
            #{index + 1}
          </span>
          <span
            className={css({
              fontSize: "xs",
              px: 2,
              py: 0.5,
              borderRadius: "md",
              backgroundColor: isDark ? "blue.800" : "blue.100",
              color: isDark ? "blue.300" : "blue.700",
            })}
          >
            Editing
          </span>
        </div>

        {/* Terms input */}
        <div className={css({ marginBottom: 3 })}>
          <label
            className={css({
              display: "block",
              fontSize: "xs",
              fontWeight: "medium",
              color: isDark ? "gray.400" : "gray.600",
              marginBottom: 1,
            })}
          >
            Problem terms (e.g., "45 + 27 - 12")
          </label>
          <input
            ref={termsInputRef}
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
              fontSize: "sm",
              fontFamily: "mono",
              backgroundColor: isDark ? "gray.800" : "white",
              color: isDark ? "white" : "gray.900",
              border: "1px solid",
              borderColor: termsError
                ? "red.500"
                : isDark
                  ? "gray.600"
                  : "gray.300",
              borderRadius: "md",
              _focus: {
                outline: "none",
                borderColor: "blue.500",
                boxShadow: "0 0 0 2px token(colors.blue.500/20)",
              },
            })}
            placeholder="45 + 27 - 12"
          />
          {termsError && (
            <p
              className={css({
                fontSize: "xs",
                color: "red.400",
                marginTop: 1,
              })}
            >
              {termsError}
            </p>
          )}
        </div>

        {/* Student answer input */}
        <div className={css({ marginBottom: 3 })}>
          <label
            className={css({
              display: "block",
              fontSize: "xs",
              fontWeight: "medium",
              color: isDark ? "gray.400" : "gray.600",
              marginBottom: 1,
            })}
          >
            Student's answer (leave blank if no answer)
          </label>
          <input
            type="text"
            value={studentAnswerInput}
            onChange={(e) => {
              setStudentAnswerInput(e.target.value);
              setAnswerError(null);
            }}
            onKeyDown={handleKeyDown}
            className={css({
              width: "100px",
              px: 3,
              py: 2,
              fontSize: "sm",
              fontFamily: "mono",
              backgroundColor: isDark ? "gray.800" : "white",
              color: isDark ? "white" : "gray.900",
              border: "1px solid",
              borderColor: answerError
                ? "red.500"
                : isDark
                  ? "gray.600"
                  : "gray.300",
              borderRadius: "md",
              _focus: {
                outline: "none",
                borderColor: "blue.500",
                boxShadow: "0 0 0 2px token(colors.blue.500/20)",
              },
            })}
            placeholder="60"
          />
          {answerError && (
            <p
              className={css({
                fontSize: "xs",
                color: "red.400",
                marginTop: 1,
              })}
            >
              {answerError}
            </p>
          )}
        </div>

        {/* Correct answer display */}
        <div
          className={css({
            fontSize: "xs",
            color: isDark ? "gray.500" : "gray.500",
            marginBottom: 3,
          })}
        >
          Correct answer (from terms):{" "}
          <span className={css({ fontFamily: "mono", fontWeight: "medium" })}>
            {parseTermsString(termsInput)?.reduce((a, b) => a + b, 0) ?? "?"}
          </span>
        </div>

        {/* Action buttons */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 2,
          })}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isFormValid}
            className={css({
              px: 3,
              py: 1.5,
              fontSize: "sm",
              fontWeight: "medium",
              backgroundColor: "green.600",
              color: "white",
              border: "none",
              borderRadius: "md",
              cursor: "pointer",
              _hover: { backgroundColor: "green.700" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className={css({
              px: 3,
              py: 1.5,
              fontSize: "sm",
              fontWeight: "medium",
              backgroundColor: isDark ? "gray.700" : "gray.200",
              color: isDark ? "white" : "gray.700",
              border: "none",
              borderRadius: "md",
              cursor: "pointer",
              _hover: { backgroundColor: isDark ? "gray.600" : "gray.300" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Show checkbox if hovered, has any selections, or this is checked
  const showCheckbox = isHovered || hasSelections || isCheckedForReparse;

  // Determine the background color based on state
  const bgColor = isExcluded
    ? isDark
      ? "gray.800"
      : "gray.200"
    : isSelected
      ? isDark
        ? "blue.900"
        : "blue.50"
      : isCheckedForReparse
        ? isDark
          ? "blue.900/50"
          : "blue.50"
        : isLowConfidence
          ? isDark
            ? "yellow.900/30"
            : "yellow.50"
          : isDark
            ? "gray.700"
            : "gray.100";

  const hoverBgColor = isExcluded
    ? isDark
      ? "gray.700"
      : "gray.300"
    : isSelected
      ? isDark
        ? "blue.900"
        : "blue.100"
      : isDark
        ? "gray.600"
        : "gray.200";

  // Display mode UI
  return (
    <div
      data-element="problem-row-container"
      data-problem-index={index}
      data-selected={isSelected}
      data-checked={isCheckedForReparse}
      data-excluded={isExcluded}
      className={css({
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        borderRadius: "lg",
        backgroundColor: bgColor,
        border: isSelected
          ? "2px solid token(colors.blue.500)"
          : isCheckedForReparse
            ? "2px solid token(colors.blue.500/50)"
            : "2px solid transparent",
        cursor: "pointer",
        transition: "all 0.15s",
        _hover: {
          backgroundColor: hoverBgColor,
        },
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox - always takes up space when onToggleReparse is provided, but only visible on hover/selection */}
      {onToggleReparse && (
        <button
          type="button"
          data-action="toggle-reparse"
          onClick={handleCheckboxClick}
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            flexShrink: 0,
            backgroundColor: "transparent",
            borderRadius: "lg 0 0 lg",
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
            // Hide checkbox visually but keep space reserved
            opacity: showCheckbox
              ? isCheckedForReparse || isHovered
                ? 1
                : 0.5
              : 0,
            pointerEvents: showCheckbox ? "auto" : "none",
          })}
        >
          <div
            className={css({
              width: "20px",
              height: "20px",
              borderRadius: "sm",
              border: "2px solid",
              borderColor: isCheckedForReparse
                ? "blue.400"
                : isDark
                  ? "gray.500"
                  : "gray.400",
              backgroundColor: isCheckedForReparse ? "blue.500" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "xs",
              fontWeight: "bold",
            })}
          >
            {isCheckedForReparse && "✓"}
          </div>
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        data-element="problem-row"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={css({
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 3,
          padding: 3,
          backgroundColor: "transparent",
          borderRadius: onToggleReparse ? "0 lg lg 0" : "lg",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        })}
      >
        {/* Small thumbnail of cropped problem region - fixed size container */}
        <div
          className={css({
            width: "48px",
            height: "32px",
            flexShrink: 0,
            borderRadius: "sm",
            overflow: "hidden",
            backgroundColor: "gray.900",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              className={css({
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              })}
            />
          )}
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flex: 1,
            opacity: isExcluded ? 0.5 : 1,
          })}
        >
          {/* Problem expression */}
          <div
            className={css({
              fontFamily: "mono",
              fontSize: "sm",
              color: isExcluded
                ? isDark
                  ? "gray.500"
                  : "gray.500"
                : isDark
                  ? "white"
                  : "gray.900",
              textDecoration: isExcluded ? "line-through" : "none",
            })}
          >
            #{index + 1}: {formatTerms(problem.terms)} ={" "}
            <span
              className={css({
                color:
                  problem.studentAnswer === null
                    ? isDark
                      ? "gray.500"
                      : "gray.400"
                    : isCorrect
                      ? isDark
                        ? "green.400"
                        : "green.600"
                      : isDark
                        ? "red.400"
                        : "red.600",
              })}
            >
              {problem.studentAnswer ?? "?"}
            </span>
          </div>

          {/* Correct answer and status */}
          <div
            className={css({
              fontSize: "xs",
              color: isCorrect
                ? isDark
                  ? "green.400"
                  : "green.600"
                : problem.studentAnswer == null
                  ? isDark
                    ? "gray.500"
                    : "gray.500"
                  : isDark
                    ? "red.400"
                    : "red.600",
            })}
          >
            {isCorrect
              ? "✓ Correct"
              : problem.studentAnswer == null
                ? "No answer detected"
                : `✗ Incorrect (correct: ${problem.correctAnswer})`}
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 2,
          })}
        >
          {/* Low confidence warning with tooltip */}
          {isLowConfidence && (
            <Tooltip
              side="left"
              content={
                <ConfidenceTooltipContent
                  termsConfidence={problem.termsConfidence}
                  answerConfidence={problem.studentAnswerConfidence}
                  notes={problem.notes}
                />
              }
            >
              <span
                className={css({
                  fontSize: "sm",
                  cursor: "help",
                })}
              >
                ⚠️
              </span>
            </Tooltip>
          )}

          {/* Excluded badge or Edit button */}
          {isExcluded ? (
            <span
              className={css({
                px: 2,
                py: 1,
                fontSize: "xs",
                fontWeight: "medium",
                borderRadius: "md",
                backgroundColor: isDark ? "gray.700" : "gray.300",
                color: isDark ? "gray.400" : "gray.600",
              })}
            >
              Excluded
            </span>
          ) : (
            <button
              type="button"
              data-action="edit-problem"
              onClick={handleEdit}
              className={css({
                px: 2,
                py: 1,
                fontSize: "xs",
                fontWeight: "medium",
                backgroundColor: isDark ? "gray.600" : "gray.200",
                color: isDark ? "white" : "gray.700",
                border: "none",
                borderRadius: "md",
                cursor: "pointer",
                _hover: {
                  backgroundColor: isDark ? "gray.500" : "gray.300",
                },
              })}
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditableProblemRow;
