"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Resizable from "react-resizable-layout";
import { calculateBeadDiffFromValues } from "@soroban/abacus-react";
import { css } from "../../../styled-system/css";
import { hstack, stack, vstack } from "../../../styled-system/patterns";
import {
  createBasicSkillSet,
  type PracticeStep,
  type StepValidationError,
  type Tutorial,
  type TutorialStep,
  type TutorialValidation,
} from "../../types/tutorial";
import { generateAbacusInstructions } from "../../utils/abacusInstructionGenerator";
import { generateSingleProblem } from "../../utils/problemGenerator";
import {
  createBasicAllowedConfiguration,
  skillConfigurationToSkillSets,
} from "../../utils/skillConfiguration";
import { generateUnifiedInstructionSequence } from "../../utils/unifiedStepGenerator";
import { PracticeStepEditor } from "./PracticeStepEditor";
import {
  BetweenStepAdd,
  CompactStepItem,
  EditorLayout,
  FormGroup,
  NumberInput,
  TextInput,
} from "./shared/EditorComponents";
import { TutorialPlayer } from "./TutorialPlayer";

// Modal component for tutorial metadata editing
interface TutorialInfoModalProps {
  tutorial: Tutorial;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTutorial: (updates: Partial<Tutorial>) => void;
}

function TutorialInfoModal({
  tutorial,
  isOpen,
  onClose,
  onUpdateTutorial,
}: TutorialInfoModalProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  if (!isOpen) return null;

  const updateTutorialMeta = (updates: Partial<Tutorial>) => {
    onUpdateTutorial({ ...updates, updatedAt: new Date() });
  };

  return (
    <div
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bg: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <div
        className={css({
          bg: "white",
          borderRadius: "lg",
          p: 6,
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          shadow: "xl",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          })}
        >
          <h2 className={css({ fontSize: "xl", fontWeight: "bold" })}>
            Tutorial Settings
          </h2>
          <button
            onClick={onClose}
            className={css({
              p: 2,
              borderRadius: "md",
              cursor: "pointer",
              _hover: { bg: "gray.100" },
            })}
          >
            ✕
          </button>
        </div>

        <div className={stack({ gap: 4 })}>
          {/* Description */}
          <div>
            <label
              className={css({
                fontSize: "sm",
                fontWeight: "medium",
                color: "gray.700",
                display: "block",
                mb: 2,
              })}
            >
              Description
            </label>
            {editingField === "description" ? (
              <textarea
                value={tutorial.description}
                onChange={(e) =>
                  updateTutorialMeta({ description: e.target.value })
                }
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                rows={4}
                className={css({
                  w: "full",
                  p: 3,
                  border: "1px solid",
                  borderColor: "blue.300",
                  borderRadius: "md",
                  fontSize: "sm",
                  resize: "vertical",
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField("description")}
                className={css({
                  fontSize: "sm",
                  cursor: "pointer",
                  p: 3,
                  border: "1px solid",
                  borderColor: "gray.200",
                  borderRadius: "md",
                  _hover: { bg: "gray.50", borderColor: "gray.300" },
                  lineHeight: "normal",
                  color: tutorial.description ? "inherit" : "gray.400",
                  minHeight: "100px",
                })}
              >
                {tutorial.description || "Click to add description..."}
              </div>
            )}
          </div>

          {/* Category, Difficulty, Duration row */}
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
            })}
          >
            {/* Category */}
            <div>
              <label
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "gray.700",
                  display: "block",
                  mb: 2,
                })}
              >
                Category
              </label>
              {editingField === "category" ? (
                <input
                  type="text"
                  value={tutorial.category}
                  onChange={(e) =>
                    updateTutorialMeta({ category: e.target.value })
                  }
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setEditingField(null);
                    }
                  }}
                  className={css({
                    w: "full",
                    p: 2,
                    border: "1px solid",
                    borderColor: "blue.300",
                    borderRadius: "md",
                    fontSize: "sm",
                  })}
                />
              ) : (
                <div
                  onClick={() => setEditingField("category")}
                  className={css({
                    fontSize: "sm",
                    cursor: "pointer",
                    p: 2,
                    border: "1px solid",
                    borderColor: "gray.200",
                    borderRadius: "md",
                    _hover: { bg: "gray.50", borderColor: "gray.300" },
                  })}
                >
                  {tutorial.category}
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "gray.700",
                  display: "block",
                  mb: 2,
                })}
              >
                Difficulty
              </label>
              {editingField === "difficulty" ? (
                <select
                  value={tutorial.difficulty}
                  onChange={(e) => {
                    updateTutorialMeta({ difficulty: e.target.value as any });
                    setEditingField(null);
                  }}
                  onBlur={() => setEditingField(null)}
                  className={css({
                    w: "full",
                    p: 2,
                    border: "1px solid",
                    borderColor: "blue.300",
                    borderRadius: "md",
                    fontSize: "sm",
                  })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              ) : (
                <div
                  onClick={() => setEditingField("difficulty")}
                  className={css({
                    fontSize: "sm",
                    cursor: "pointer",
                    p: 2,
                    border: "1px solid",
                    borderColor: "gray.200",
                    borderRadius: "md",
                    _hover: { bg: "gray.50", borderColor: "gray.300" },
                    textTransform: "capitalize",
                  })}
                >
                  {tutorial.difficulty}
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "gray.700",
                  display: "block",
                  mb: 2,
                })}
              >
                Duration (min)
              </label>
              {editingField === "estimatedDuration" ? (
                <input
                  type="number"
                  value={tutorial.estimatedDuration}
                  onChange={(e) =>
                    updateTutorialMeta({
                      estimatedDuration: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setEditingField(null);
                    }
                  }}
                  className={css({
                    w: "full",
                    p: 2,
                    border: "1px solid",
                    borderColor: "blue.300",
                    borderRadius: "md",
                    fontSize: "sm",
                  })}
                />
              ) : (
                <div
                  onClick={() => setEditingField("estimatedDuration")}
                  className={css({
                    fontSize: "sm",
                    cursor: "pointer",
                    p: 2,
                    border: "1px solid",
                    borderColor: "gray.200",
                    borderRadius: "md",
                    _hover: { bg: "gray.50", borderColor: "gray.300" },
                  })}
                >
                  {tutorial.estimatedDuration}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label
              className={css({
                fontSize: "sm",
                fontWeight: "medium",
                color: "gray.700",
                display: "block",
                mb: 2,
              })}
            >
              Tags (comma-separated)
            </label>
            {editingField === "tags" ? (
              <input
                type="text"
                value={tutorial.tags?.join(", ") || ""}
                onChange={(e) =>
                  updateTutorialMeta({
                    tags: e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                className={css({
                  w: "full",
                  p: 2,
                  border: "1px solid",
                  borderColor: "blue.300",
                  borderRadius: "md",
                  fontSize: "sm",
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField("tags")}
                className={css({
                  fontSize: "sm",
                  cursor: "pointer",
                  p: 2,
                  border: "1px solid",
                  borderColor: "gray.200",
                  borderRadius: "md",
                  _hover: { bg: "gray.50", borderColor: "gray.300" },
                  color: tutorial.tags?.length ? "inherit" : "gray.400",
                })}
              >
                {tutorial.tags?.join(", ") || "Click to add tags..."}
              </div>
            )}
          </div>

          {/* Author */}
          <div>
            <label
              className={css({
                fontSize: "sm",
                fontWeight: "medium",
                color: "gray.700",
                display: "block",
                mb: 2,
              })}
            >
              Author
            </label>
            {editingField === "author" ? (
              <input
                type="text"
                value={tutorial.author}
                onChange={(e) => updateTutorialMeta({ author: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
                className={css({
                  w: "full",
                  p: 2,
                  border: "1px solid",
                  borderColor: "blue.300",
                  borderRadius: "md",
                  fontSize: "sm",
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField("author")}
                className={css({
                  fontSize: "sm",
                  cursor: "pointer",
                  p: 2,
                  border: "1px solid",
                  borderColor: "gray.200",
                  borderRadius: "md",
                  _hover: { bg: "gray.50", borderColor: "gray.300" },
                })}
              >
                {tutorial.author}
              </div>
            )}
          </div>
        </div>

        <div
          className={css({
            mt: 6,
            display: "flex",
            justifyContent: "flex-end",
          })}
        >
          <button
            onClick={onClose}
            className={css({
              px: 4,
              py: 2,
              bg: "blue.500",
              color: "white",
              border: "none",
              borderRadius: "md",
              fontSize: "sm",
              fontWeight: "medium",
              cursor: "pointer",
              _hover: { bg: "blue.600" },
            })}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Practice Step Preview Component
interface PracticeStepPreviewProps {
  step: PracticeStep;
}

function PracticeStepPreview({ step }: PracticeStepPreviewProps) {
  const [problems, setProblems] = useState<
    Array<{
      id: string;
      terms: number[];
      answer: number;
      difficulty: "easy" | "medium" | "hard";
      requiredSkills: string[];
    }>
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateProblems = useCallback(async () => {
    setIsGenerating(true);
    const generatedProblems = [];
    const maxToShow = Math.min(6, step.problemCount); // Show up to 6 problems in preview
    const seenProblems = new Set<string>(); // Track generated problems to avoid duplicates

    // Use a basic configuration for generating problems
    const config = createBasicAllowedConfiguration();
    const { required, target, forbidden } =
      skillConfigurationToSkillSets(config);

    let attempts = 0;
    const maxAttempts = 200; // Prevent infinite loops

    while (generatedProblems.length < maxToShow && attempts < maxAttempts) {
      const problem = generateSingleProblem(
        {
          numberRange: step.numberRange || { min: 1, max: 9 },
          maxSum: step.sumConstraints?.maxSum,
          minSum: step.sumConstraints?.minSum,
          maxTerms: step.maxTerms,
          problemCount: step.problemCount,
        },
        step.requiredSkills || required,
        step.targetSkills || target,
        step.forbiddenSkills || forbidden,
        50, // attempts
      );

      if (problem) {
        // Create a unique key for the problem based on terms and answer
        const problemKey = `${problem.terms.join("+")}_${problem.answer}`;

        if (!seenProblems.has(problemKey)) {
          seenProblems.add(problemKey);
          generatedProblems.push(problem);
        }
      }

      attempts++;
    }

    setProblems(generatedProblems);
    setIsGenerating(false);
  }, [step]);

  useEffect(() => {
    generateProblems();
  }, [generateProblems]);

  return (
    <div className={css({ p: 4, height: "100%", overflowY: "auto" })}>
      <div className={vstack({ gap: 4, alignItems: "stretch" })}>
        {/* Header */}
        <div
          className={css({
            borderBottom: "1px solid",
            borderColor: "gray.200",
            pb: 3,
          })}
        >
          <h2
            className={css({
              fontSize: "xl",
              fontWeight: "bold",
              color: "purple.800",
              mb: 2,
            })}
          >
            🎯 {step.title}
          </h2>
          <p className={css({ color: "gray.600", mb: 2 })}>
            {step.description}
          </p>
          <div className={css({ fontSize: "sm", color: "gray.500" })}>
            {step.problemCount} problems • Max {step.maxTerms} terms • Numbers{" "}
            {step.numberRange?.min || 1}-{step.numberRange?.max || 9}
          </div>
        </div>

        {/* Action Button */}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <h3 className={css({ fontSize: "lg", fontWeight: "semibold" })}>
            Sample Problems
          </h3>
          <button
            onClick={generateProblems}
            disabled={isGenerating}
            className={css({
              px: 4,
              py: 2,
              bg: isGenerating ? "gray.200" : "purple.500",
              color: isGenerating ? "gray.500" : "white",
              border: "none",
              borderRadius: "md",
              fontSize: "sm",
              cursor: isGenerating ? "not-allowed" : "pointer",
              _hover: isGenerating ? {} : { bg: "purple.600" },
            })}
          >
            {isGenerating ? "Generating..." : "Regenerate"}
          </button>
        </div>

        {/* Problems Flow */}
        {problems.length > 0 ? (
          <div
            className={css({
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
              overflowX: "auto",
            })}
          >
            {problems.map((problem, index) => (
              <div
                key={problem.id}
                className={css({
                  bg: "white",
                  border: "2px solid",
                  borderColor: "purple.200",
                  borderRadius: "lg",
                  p: 3,
                  textAlign: "center",
                  minWidth: "120px",
                  flexShrink: 0,
                })}
              >
                {/* Problem Number */}
                <div
                  className={css({
                    fontSize: "xs",
                    fontWeight: "bold",
                    color: "purple.600",
                    mb: 2,
                  })}
                >
                  Problem {index + 1}
                </div>

                {/* Problem Display */}
                <div
                  className={css({
                    fontFamily: "mono",
                    fontSize: "lg",
                    fontWeight: "bold",
                    mb: 2,
                  })}
                >
                  {problem.terms.map((term, termIndex) => (
                    <div
                      key={termIndex}
                      className={css({
                        textAlign: "right",
                        lineHeight: "tight",
                      })}
                    >
                      {term}
                    </div>
                  ))}
                  <div
                    className={css({
                      borderTop: "2px solid",
                      borderColor: "gray.400",
                      mt: 1,
                      pt: 1,
                      fontSize: "xl",
                      textAlign: "right",
                    })}
                  >
                    {problem.answer}
                  </div>
                </div>

                {/* Difficulty Badge */}
                <div
                  className={css({
                    fontSize: "xs",
                    fontWeight: "medium",
                    px: 2,
                    py: 1,
                    borderRadius: "full",
                    bg:
                      problem.difficulty === "easy"
                        ? "green.100"
                        : problem.difficulty === "medium"
                          ? "yellow.100"
                          : "red.100",
                    color:
                      problem.difficulty === "easy"
                        ? "green.800"
                        : problem.difficulty === "medium"
                          ? "yellow.800"
                          : "red.800",
                  })}
                >
                  {problem.difficulty}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={css({
              bg: "gray.50",
              border: "2px dashed",
              borderColor: "gray.300",
              borderRadius: "lg",
              p: 8,
              textAlign: "center",
              color: "gray.500",
            })}
          >
            {isGenerating ? (
              <div>
                <div className={css({ fontSize: "lg", mb: 2 })}>🔄</div>
                <div>Generating problems...</div>
              </div>
            ) : (
              <div>
                <div className={css({ fontSize: "lg", mb: 2 })}>📝</div>
                <div>No problems generated yet</div>
                <div className={css({ fontSize: "sm", mt: 1 })}>
                  Click "Regenerate" to create sample problems
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Summary */}
        <div
          className={css({
            bg: "purple.50",
            border: "1px solid",
            borderColor: "purple.200",
            borderRadius: "md",
            p: 3,
          })}
        >
          <h4
            className={css({
              fontSize: "sm",
              fontWeight: "semibold",
              color: "purple.800",
              mb: 2,
            })}
          >
            Configuration Summary
          </h4>
          <div
            className={css({
              fontSize: "xs",
              color: "purple.700",
              lineHeight: "relaxed",
            })}
          >
            <div>
              <strong>Total Problems:</strong> {step.problemCount}
            </div>
            <div>
              <strong>Terms per Problem:</strong> Up to {step.maxTerms}
            </div>
            <div>
              <strong>Number Range:</strong> {step.numberRange?.min || 1} to{" "}
              {step.numberRange?.max || 9}
            </div>
            <div>
              <strong>Sum Limit:</strong>{" "}
              {step.sumConstraints?.maxSum || "No limit"}
            </div>
            {step.sumConstraints?.minSum && (
              <div>
                <strong>Min Sum:</strong> {step.sumConstraints.minSum}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for the "New" dropdown for empty state
interface NewItemDropdownProps {
  onAddStep: () => void;
  onAddPracticeStep: () => void;
}

function NewItemDropdown({
  onAddStep,
  onAddPracticeStep,
}: NewItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={css({ position: "relative", textAlign: "center", my: 2 })}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={css({
          px: 3,
          py: 1,
          bg: "gray.100",
          color: "gray.600",
          border: "1px dashed",
          borderColor: "gray.300",
          borderRadius: "md",
          fontSize: "sm",
          cursor: "pointer",
          _hover: { bg: "gray.200", borderColor: "gray.400" },
        })}
      >
        + New
      </button>

      {isOpen && (
        <div
          className={css({
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            mt: 1,
            bg: "white",
            border: "1px solid",
            borderColor: "gray.200",
            borderRadius: "md",
            shadow: "md",
            zIndex: 10,
            minW: "150px",
          })}
        >
          <button
            onClick={() => {
              onAddStep();
              setIsOpen(false);
            }}
            className={css({
              w: "full",
              px: 3,
              py: 2,
              textAlign: "left",
              fontSize: "sm",
              cursor: "pointer",
              _hover: { bg: "blue.50", color: "blue.700" },
              borderBottom: "1px solid",
              borderColor: "gray.100",
            })}
          >
            📝 Concept Step
          </button>
          <button
            onClick={() => {
              onAddPracticeStep();
              setIsOpen(false);
            }}
            className={css({
              w: "full",
              px: 3,
              py: 2,
              textAlign: "left",
              fontSize: "sm",
              cursor: "pointer",
              _hover: { bg: "purple.50", color: "purple.700" },
            })}
          >
            🎯 Problem Page
          </button>
        </div>
      )}
    </div>
  );
}

interface TutorialEditorProps {
  tutorial: Tutorial;
  onSave?: (tutorial: Tutorial) => Promise<void>;
  onValidate?: (tutorial: Tutorial) => Promise<TutorialValidation>;
  onPreview?: (tutorial: Tutorial, stepIndex: number) => void;
  className?: string;
}

interface EditorState {
  isEditing: boolean;
  isDirty: boolean;
  selectedStepIndex: number | null;
  selectedPracticeStepId: string | null;
  previewStepIndex: number | null;
  validation: TutorialValidation | null;
  isSaving: boolean;
  showTutorialInfoModal: boolean;
}

export function TutorialEditor({
  tutorial: initialTutorial,
  onSave,
  onValidate,
  onPreview,
  className,
}: TutorialEditorProps) {
  const [tutorial, setTutorial] = useState<Tutorial>(initialTutorial);
  const [editorState, setEditorState] = useState<EditorState>({
    isEditing: false,
    isDirty: false,
    selectedStepIndex: null,
    selectedPracticeStepId: null,
    previewStepIndex: null,
    validation: null,
    isSaving: false,
    showTutorialInfoModal: false,
  });

  // Auto-validate when tutorial changes
  useEffect(() => {
    if (onValidate && editorState.isDirty) {
      onValidate(tutorial).then((validation) => {
        setEditorState((prev) => ({ ...prev, validation }));
      });
    }
  }, [tutorial, onValidate, editorState.isDirty]);

  // Tutorial metadata handlers
  const updateTutorialMeta = useCallback((updates: Partial<Tutorial>) => {
    setTutorial((prev) => ({ ...prev, ...updates, updatedAt: new Date() }));
    setEditorState((prev) => ({ ...prev, isDirty: true }));
  }, []);

  // Step management
  const addStep = useCallback(
    (position?: number) => {
      // Create unified sequence to determine proper positioning
      const unifiedSteps: Array<{
        type: "concept" | "practice";
        step: any;
        originalIndex: number;
        position: number;
      }> = [];

      // Add concept steps with positions
      tutorial.steps.forEach((step, index) => {
        unifiedSteps.push({
          type: "concept",
          step,
          originalIndex: index,
          position: step.position ?? index,
        });
      });

      // Add practice steps with positions
      (tutorial.practiceSteps || []).forEach((practiceStep, index) => {
        unifiedSteps.push({
          type: "practice",
          step: practiceStep,
          originalIndex: index,
          position: practiceStep.position ?? tutorial.steps.length + index,
        });
      });

      // Sort by position to get unified sequence
      unifiedSteps.sort((a, b) => a.position - b.position);

      // Determine the actual position value to assign to the new step
      let newStepPosition: number;
      if (position === undefined || position >= unifiedSteps.length) {
        // Add at end
        newStepPosition =
          unifiedSteps.length > 0
            ? unifiedSteps[unifiedSteps.length - 1].position + 1
            : 0;
      } else if (position === 0) {
        // Add at beginning
        newStepPosition =
          unifiedSteps.length > 0 ? unifiedSteps[0].position - 1 : 0;
      } else {
        // Insert between existing steps
        const prevStep = unifiedSteps[position - 1];
        const nextStep = unifiedSteps[position];
        newStepPosition = (prevStep.position + nextStep.position) / 2;
      }

      // Generate a default operation based on existing steps
      const existingSteps = tutorial.steps;
      let defaultStart = 0;
      let defaultTarget = 1;

      // Create increasingly complex defaults based on tutorial progression
      if (existingSteps.length === 0) {
        // First step: simple 0 + 1
        defaultStart = 0;
        defaultTarget = 1;
      } else if (existingSteps.length < 5) {
        // First few steps: basic earth bead additions
        defaultStart = existingSteps.length;
        defaultTarget = existingSteps.length + 1;
      } else if (existingSteps.length < 10) {
        // Introduce heaven bead: 0 + 5, then combinations
        defaultStart = existingSteps.length - 5;
        defaultTarget = defaultStart + 5;
      } else {
        // More complex operations: complements and multi-place
        const baseValue = ((existingSteps.length - 10) % 8) + 2;
        defaultStart = baseValue;
        defaultTarget =
          baseValue +
          Math.min(4, Math.floor((existingSteps.length - 10) / 8) + 2);
      }

      // Generate automatic instructions using our instruction generator
      const generatedInstructions = generateAbacusInstructions(
        defaultStart,
        defaultTarget,
      );

      const newStep: TutorialStep = {
        id: `step-${Date.now()}`,
        title: `${defaultStart} + ${defaultTarget - defaultStart}`,
        problem: `${defaultStart} + ${defaultTarget - defaultStart}`,
        description: `Learn to add ${defaultTarget - defaultStart} to ${defaultStart} using the abacus`,
        startValue: defaultStart,
        targetValue: defaultTarget,
        expectedAction: generatedInstructions.expectedAction,
        actionDescription: generatedInstructions.actionDescription,
        highlightBeads: generatedInstructions.highlightBeads,
        multiStepInstructions: generatedInstructions.multiStepInstructions,
        tooltip: generatedInstructions.tooltip,
        // errorMessages removed - bead diff tooltip provides better guidance
        position: newStepPosition,
      };

      // Add to concept steps array (position in array doesn't matter since we sort by position property)
      const newSteps = [...tutorial.steps, newStep];

      setTutorial((prev) => ({
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({
        ...prev,
        isDirty: true,
        selectedStepIndex: newSteps.length - 1, // Select the newly added step
      }));
    },
    [tutorial.steps, tutorial.practiceSteps],
  );

  const _duplicateStep = useCallback(
    (stepIndex: number) => {
      const stepToDuplicate = tutorial.steps[stepIndex];
      if (!stepToDuplicate) return;

      const duplicatedStep: TutorialStep = {
        ...stepToDuplicate,
        id: `step-${Date.now()}`,
        title: `${stepToDuplicate.title} (Copy)`,
      };

      const newSteps = [...tutorial.steps];
      newSteps.splice(stepIndex + 1, 0, duplicatedStep);

      setTutorial((prev) => ({
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({
        ...prev,
        isDirty: true,
        selectedStepIndex: stepIndex + 1,
      }));
    },
    [tutorial.steps],
  );

  const deleteStep = useCallback(
    (stepIndex: number) => {
      if (tutorial.steps.length <= 1) return; // Don't delete the last step

      const newSteps = tutorial.steps.filter((_, index) => index !== stepIndex);
      setTutorial((prev) => ({
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({
        ...prev,
        isDirty: true,
        selectedStepIndex:
          prev.selectedStepIndex === stepIndex ? null : prev.selectedStepIndex,
      }));
    },
    [tutorial.steps],
  );

  const _moveStep = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const newSteps = [...tutorial.steps];
      const [movedStep] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, movedStep);

      setTutorial((prev) => ({
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({
        ...prev,
        isDirty: true,
        selectedStepIndex: toIndex,
      }));
    },
    [tutorial.steps],
  );

  // Practice step management
  const addPracticeStep = useCallback(
    (position?: number) => {
      // Create unified sequence to determine proper positioning
      const unifiedSteps: Array<{
        type: "concept" | "practice";
        step: any;
        originalIndex: number;
        position: number;
      }> = [];

      // Add concept steps with positions
      tutorial.steps.forEach((step, index) => {
        unifiedSteps.push({
          type: "concept",
          step,
          originalIndex: index,
          position: step.position ?? index,
        });
      });

      // Add practice steps with positions
      (tutorial.practiceSteps || []).forEach((practiceStep, index) => {
        unifiedSteps.push({
          type: "practice",
          step: practiceStep,
          originalIndex: index,
          position: practiceStep.position ?? tutorial.steps.length + index,
        });
      });

      // Sort by position to get unified sequence
      unifiedSteps.sort((a, b) => a.position - b.position);

      // Determine the actual position value to assign to the new practice step
      let newStepPosition: number;
      if (position === undefined || position >= unifiedSteps.length) {
        // Add at end
        newStepPosition =
          unifiedSteps.length > 0
            ? unifiedSteps[unifiedSteps.length - 1].position + 1
            : 0;
      } else if (position === 0) {
        // Add at beginning
        newStepPosition =
          unifiedSteps.length > 0 ? unifiedSteps[0].position - 1 : 0;
      } else {
        // Insert between existing steps
        const prevStep = unifiedSteps[position - 1];
        const nextStep = unifiedSteps[position];
        newStepPosition = (prevStep.position + nextStep.position) / 2;
      }

      const newPracticeStep: PracticeStep = {
        id: `practice-${Date.now()}`,
        title: "New Practice Step",
        description: "Practice description here",
        problemCount: 10,
        maxTerms: 3,
        requiredSkills: createBasicSkillSet(),
        numberRange: { min: 1, max: 9 },
        sumConstraints: { maxSum: 9 },
        position: newStepPosition,
      };

      // Add to practice steps array (position in array doesn't matter since we sort by position property)
      const newPracticeSteps = [
        ...(tutorial.practiceSteps || []),
        newPracticeStep,
      ];

      setTutorial((prev) => ({
        ...prev,
        practiceSteps: newPracticeSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({
        ...prev,
        isDirty: true,
        selectedPracticeStepId: newPracticeStep.id,
      }));
    },
    [tutorial.steps, tutorial.practiceSteps],
  );

  const updatePracticeStep = useCallback(
    (stepIndex: number, updates: Partial<PracticeStep>) => {
      const newPracticeSteps = [...(tutorial.practiceSteps || [])];
      if (newPracticeSteps[stepIndex]) {
        newPracticeSteps[stepIndex] = {
          ...newPracticeSteps[stepIndex],
          ...updates,
        };

        setTutorial((prev) => ({
          ...prev,
          practiceSteps: newPracticeSteps,
          updatedAt: new Date(),
        }));
        setEditorState((prev) => ({ ...prev, isDirty: true }));
      }
    },
    [tutorial.practiceSteps],
  );

  const deletePracticeStep = useCallback(
    (stepIndex: number) => {
      const newPracticeSteps = (tutorial.practiceSteps || []).filter(
        (_, index) => index !== stepIndex,
      );
      setTutorial((prev) => ({
        ...prev,
        practiceSteps: newPracticeSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({ ...prev, isDirty: true }));
    },
    [tutorial.practiceSteps],
  );

  const updateStep = useCallback(
    (stepIndex: number, updates: Partial<TutorialStep>) => {
      const newSteps = [...tutorial.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };

      setTutorial((prev) => ({
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      }));
      setEditorState((prev) => ({ ...prev, isDirty: true }));
    },
    [tutorial.steps],
  );

  // Calculate step-by-step states and bead diffs for multi-step instructions
  const calculateStepStatesAndDiffs = useCallback(
    (stepIndex: number) => {
      const step = tutorial.steps[stepIndex];
      if (
        !step ||
        !step.multiStepInstructions ||
        step.multiStepInstructions.length === 0
      ) {
        return [];
      }

      try {
        // Use unified sequence if available, otherwise generate it
        let unifiedSequence = (step as any).unifiedSequence;
        if (!unifiedSequence) {
          unifiedSequence = generateUnifiedInstructionSequence(
            step.startValue,
            step.targetValue,
          );
        }

        const stepStates = [];
        let currentValue = step.startValue;

        console.log("=== Calculating Step States and Diffs ===");
        console.log("Start value:", currentValue);
        console.log("Target value:", step.targetValue);
        console.log("Unified sequence steps:", unifiedSequence.steps.length);
        console.log(
          "Multi-step instructions:",
          step.multiStepInstructions.length,
        );

        for (
          let i = 0;
          i < step.multiStepInstructions.length &&
          i < unifiedSequence.steps.length;
          i++
        ) {
          const unifiedStep = unifiedSequence.steps[i];
          const expectedValue = unifiedStep.expectedValue;

          console.log(`\nStep ${i}:`);
          console.log(`  From: ${currentValue} → To: ${expectedValue}`);
          console.log(`  Math term: ${unifiedStep.mathematicalTerm}`);

          // Calculate bead diff from current to expected state (incremental)
          const beadDiff = calculateBeadDiffFromValues(
            currentValue,
            expectedValue,
          );

          console.log(`  Bead diff summary: "${beadDiff.summary}"`);
          console.log(`  Has changes: ${beadDiff.hasChanges}`);
          console.log(`  Changes count: ${beadDiff.changes.length}`);
          console.log(
            `  Changes:`,
            beadDiff.changes
              .map(
                (c) =>
                  `${c.placeValue}:${c.beadType}:${c.direction}${c.position !== undefined ? `:pos${c.position}` : ""}`,
              )
              .join(", "),
          );

          stepStates.push({
            stepIndex: i,
            instruction: step.multiStepInstructions[i],
            currentValue,
            expectedValue,
            beadDiff,
            mathematicalTerm: unifiedStep.mathematicalTerm,
          });

          // Update current value for next iteration (incremental approach)
          currentValue = expectedValue;
        }

        console.log(`\nGenerated ${stepStates.length} step states`);
        stepStates.forEach((state, i) => {
          console.log(
            `  Step ${i}: ${state.currentValue}→${state.expectedValue}, changes: ${state.beadDiff.changes.length}`,
          );
        });

        return stepStates;
      } catch (error) {
        console.error("Failed to calculate step states:", error);
        return [];
      }
    },
    [tutorial.steps],
  );

  // Generate unified instructions for a specific step
  const generateUnifiedInstructionsForStep = useCallback(
    (stepIndex: number) => {
      const step = tutorial.steps[stepIndex];
      if (!step) return;

      try {
        const unifiedSequence = generateUnifiedInstructionSequence(
          step.startValue,
          step.targetValue,
        );

        // Generate bead highlights and visual elements for compatibility
        const visualInstructions = generateAbacusInstructions(
          step.startValue,
          step.targetValue,
          step.problem,
        );

        const instructionUpdates: Partial<TutorialStep> = {
          expectedAction: visualInstructions.expectedAction,
          actionDescription: unifiedSequence.fullDecomposition, // Use unified pedagogical decomposition
          highlightBeads: visualInstructions.highlightBeads,
          stepBeadHighlights: visualInstructions.stepBeadHighlights,
          totalSteps: unifiedSequence.totalSteps,
          multiStepInstructions: unifiedSequence.steps.map(
            (step) => step.englishInstruction,
          ), // Use unified instructions
          tooltip: visualInstructions.tooltip,
          // errorMessages removed - bead diff tooltip provides better guidance
          // Store the unified sequence for debugging
          unifiedSequence: unifiedSequence,
        };

        updateStep(stepIndex, instructionUpdates);
      } catch (error) {
        console.error("Failed to generate unified instructions:", error);
        // Could show user notification here
      }
    },
    [tutorial.steps, updateStep],
  );

  // Editor actions
  const _toggleEdit = useCallback(() => {
    setEditorState((prev) => ({ ...prev, isEditing: !prev.isEditing }));
  }, []);

  const previewStep = useCallback(
    (stepIndex: number) => {
      setEditorState((prev) => ({ ...prev, previewStepIndex: stepIndex }));
      onPreview?.(tutorial, stepIndex);
    },
    [tutorial, onPreview],
  );

  const _saveTutorial = useCallback(async () => {
    if (!onSave) return;

    setEditorState((prev) => ({ ...prev, isSaving: true }));
    try {
      await onSave(tutorial);
      setEditorState((prev) => ({
        ...prev,
        isDirty: false,
        isSaving: false,
      }));
    } catch (error) {
      console.error("Failed to save tutorial:", error);
      setEditorState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [tutorial, onSave]);

  // Validation helpers
  const getStepErrors = useCallback(
    (stepIndex: number): StepValidationError[] => {
      if (!editorState.validation) return [];
      return editorState.validation.errors.filter(
        (error) => error.stepId === tutorial.steps[stepIndex]?.id,
      );
    },
    [editorState.validation, tutorial.steps],
  );

  const getStepWarnings = useCallback(
    (stepIndex: number): StepValidationError[] => {
      if (!editorState.validation) return [];
      return editorState.validation.warnings.filter(
        (warning) => warning.stepId === tutorial.steps[stepIndex]?.id,
      );
    },
    [editorState.validation, tutorial.steps],
  );

  // Memoize TutorialPlayer props to avoid expensive recalculations on every render
  const playerStepIndex = useMemo(() => {
    return editorState.selectedStepIndex !== null
      ? editorState.selectedStepIndex
      : editorState.previewStepIndex || 0;
  }, [editorState.selectedStepIndex, editorState.previewStepIndex]);

  const playerKey = useMemo(() => {
    return `tutorial-player-${playerStepIndex}`;
  }, [playerStepIndex]);

  return (
    <div
      className={css(
        {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          bg: "gray.50",
        },
        className,
      )}
    >
      {editorState.isEditing ? (
        <Resizable axis="x" initial={400} min={300} max={800} step={1}>
          {({ position, separatorProps }) => (
            <div
              className={css({
                display: "flex",
                width: "100%",
                height: "100%",
              })}
            >
              {/* Editor sidebar */}
              <div
                className={css({
                  width: `${position}px`,
                  bg: "white",
                  borderRight: "1px solid",
                  borderColor: "gray.200",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  flexShrink: 0,
                })}
              >
                {/* Tutorial Settings Button */}
                <div
                  className={css({
                    p: 3,
                    borderBottom: "1px solid",
                    borderColor: "gray.200",
                    flexShrink: 0,
                  })}
                >
                  <button
                    onClick={() =>
                      setEditorState((prev) => ({
                        ...prev,
                        showTutorialInfoModal: true,
                      }))
                    }
                    className={css({
                      w: "full",
                      p: 3,
                      bg: "white",
                      border: "1px solid",
                      borderColor: "gray.300",
                      borderRadius: "md",
                      fontSize: "sm",
                      fontWeight: "medium",
                      cursor: "pointer",
                      textAlign: "left",
                      _hover: { bg: "gray.50", borderColor: "gray.400" },
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      })}
                    >
                      <div>
                        <div className={css({ fontWeight: "medium", mb: 1 })}>
                          Tutorial Settings
                        </div>
                        <div
                          className={css({ fontSize: "xs", color: "gray.600" })}
                        >
                          {tutorial.category} • {tutorial.difficulty} •{" "}
                          {tutorial.estimatedDuration}
                          min
                        </div>
                      </div>
                      <div
                        className={css({ fontSize: "lg", color: "gray.400" })}
                      >
                        ⚙️
                      </div>
                    </div>
                  </button>
                </div>

                {/* Tutorial Flow - Scrollable */}
                <div
                  className={css({
                    flex: 1,
                    overflowY: "auto",
                    p: 4,
                    minHeight: 0,
                  })}
                >
                  <div>
                    <h3 className={css({ fontWeight: "bold", mb: 3 })}>
                      Tutorial Flow (
                      {(tutorial.steps?.length || 0) +
                        (tutorial.practiceSteps?.length || 0)}{" "}
                      items)
                    </h3>

                    <div className={stack({ gap: 0 })}>
                      {(() => {
                        // Create unified sequence of all steps with positions
                        const unifiedSteps: Array<{
                          type: "concept" | "practice";
                          step: any;
                          originalIndex: number;
                          position: number;
                        }> = [];

                        // Add concept steps with positions
                        tutorial.steps.forEach((step, index) => {
                          unifiedSteps.push({
                            type: "concept",
                            step,
                            originalIndex: index,
                            position: step.position ?? index,
                          });
                        });

                        // Add practice steps with positions
                        (tutorial.practiceSteps || []).forEach(
                          (practiceStep, index) => {
                            unifiedSteps.push({
                              type: "practice",
                              step: practiceStep,
                              originalIndex: index,
                              position:
                                practiceStep.position ??
                                tutorial.steps.length + index,
                            });
                          },
                        );

                        // Sort by position
                        unifiedSteps.sort((a, b) => a.position - b.position);

                        const items = [];

                        // Add BetweenStepAdd at the beginning
                        items.push(
                          <BetweenStepAdd
                            key="add-0"
                            onAddStep={() => addStep(0)}
                            onAddPracticeStep={() => addPracticeStep(0)}
                          />,
                        );

                        // Render each step with BetweenStepAdd after it
                        unifiedSteps.forEach((item, index) => {
                          if (item.type === "concept") {
                            const errors = getStepErrors(item.originalIndex);
                            const warnings = getStepWarnings(
                              item.originalIndex,
                            );
                            const isSelected =
                              editorState.selectedStepIndex ===
                              item.originalIndex;

                            items.push(
                              <div key={`concept-${item.step.id}`}>
                                <CompactStepItem
                                  type="concept"
                                  index={index}
                                  title={item.step.title}
                                  subtitle={`${item.step.problem} → ${item.step.targetValue}`}
                                  isSelected={isSelected}
                                  hasErrors={errors.length > 0}
                                  hasWarnings={warnings.length > 0}
                                  errorCount={errors.length}
                                  warningCount={warnings.length}
                                  onClick={() =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      selectedStepIndex: item.originalIndex,
                                      selectedPracticeStepId: null,
                                    }))
                                  }
                                  onPreview={() =>
                                    previewStep(item.originalIndex)
                                  }
                                  onDelete={() =>
                                    deleteStep(item.originalIndex)
                                  }
                                >
                                  {/* Error/Warning Details - show when there are issues */}
                                  {(errors.length > 0 ||
                                    warnings.length > 0) && (
                                    <div
                                      className={css({
                                        mt: 1,
                                        pt: 1,
                                        borderTop: "1px solid",
                                        borderColor: "gray.200",
                                      })}
                                    >
                                      {errors.map((error, errorIndex) => (
                                        <div
                                          key={errorIndex}
                                          className={css({
                                            fontSize: "xs",
                                            color: "red.600",
                                            mb: 0.5,
                                          })}
                                        >
                                          ❌ {error.message}
                                        </div>
                                      ))}
                                      {warnings.map((warning, warningIndex) => (
                                        <div
                                          key={warningIndex}
                                          className={css({
                                            fontSize: "xs",
                                            color: "orange.600",
                                            mb: 0.5,
                                          })}
                                        >
                                          ⚠️ {warning.message}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CompactStepItem>
                              </div>,
                            );
                          } else {
                            // Practice step
                            const isSelected =
                              editorState.selectedPracticeStepId ===
                              item.step.id;

                            items.push(
                              <div key={`practice-${item.step.id}`}>
                                <CompactStepItem
                                  type="practice"
                                  index={index}
                                  title={item.step.title}
                                  subtitle={`${item.step.problemCount} problems • Max ${item.step.maxTerms} terms`}
                                  isSelected={isSelected}
                                  hasErrors={false}
                                  hasWarnings={false}
                                  onClick={() =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      selectedPracticeStepId: item.step.id,
                                      selectedStepIndex: null,
                                    }))
                                  }
                                  onDelete={() =>
                                    deletePracticeStep(item.originalIndex)
                                  }
                                />
                              </div>,
                            );
                          }

                          // Add BetweenStepAdd after each step
                          items.push(
                            <BetweenStepAdd
                              key={`add-${index + 1}`}
                              onAddStep={() => addStep(index + 1)}
                              onAddPracticeStep={() =>
                                addPracticeStep(index + 1)
                              }
                            />,
                          );
                        });

                        // Show empty state if no actual steps (only BetweenStepAdd components)
                        if (unifiedSteps.length === 0) {
                          return (
                            <div
                              className={css({
                                textAlign: "center",
                                py: 8,
                                color: "gray.500",
                              })}
                            >
                              <div className={css({ mb: 4, fontSize: "lg" })}>
                                📝
                              </div>
                              <div
                                className={css({ mb: 4, fontWeight: "medium" })}
                              >
                                No steps yet
                              </div>
                              <div className={css({ mb: 4, fontSize: "sm" })}>
                                Add your first concept step or practice step to
                                get started
                              </div>
                              <NewItemDropdown
                                onAddStep={() => addStep(0)}
                                onAddPracticeStep={() => addPracticeStep(0)}
                              />
                            </div>
                          );
                        }

                        return items;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resizable separator */}
              <hr
                {...separatorProps}
                className={css({
                  width: "4px",
                  height: "auto",
                  border: "none",
                  bg: "gray.300",
                  cursor: "ew-resize",
                  _hover: { bg: "blue.400" },
                  transition: "background-color 0.2s",
                })}
              />

              {/* Main content - Split between Step Editor and Preview */}
              <div
                className={css({
                  width: `calc(100% - ${position}px - 4px)`,
                  display: "flex",
                  flexDirection: "row",
                  height: "100%",
                })}
              >
                {/* Unified Step Editor - handles both concept and practice steps */}
                {editorState.selectedStepIndex !== null ||
                editorState.selectedPracticeStepId ? (
                  <div
                    className={css({
                      flex: "0 0 400px",
                      bg: "white",
                      borderRight: "1px solid",
                      borderColor: "gray.200",
                      overflowY: "auto",
                      height: "100%",
                    })}
                  >
                    {/* Conditional Editor Content */}
                    {editorState.selectedStepIndex !== null ? (
                      /* Concept Step Editor */
                      <EditorLayout
                        title={`Edit Step ${editorState.selectedStepIndex + 1}`}
                        onClose={() =>
                          setEditorState((prev) => ({
                            ...prev,
                            selectedStepIndex: null,
                            selectedPracticeStepId: null,
                          }))
                        }
                      >
                        <FormGroup>
                          <TextInput
                            label="Title"
                            value={
                              tutorial.steps[editorState.selectedStepIndex]
                                .title
                            }
                            onChange={(value) =>
                              updateStep(editorState.selectedStepIndex, {
                                title: value,
                              })
                            }
                          />

                          <TextInput
                            label="Problem"
                            value={
                              tutorial.steps[editorState.selectedStepIndex]
                                .problem
                            }
                            onChange={(value) =>
                              updateStep(editorState.selectedStepIndex, {
                                problem: value,
                              })
                            }
                          />

                          <FormGroup columns={2}>
                            <NumberInput
                              label="Start Value"
                              value={
                                tutorial.steps[editorState.selectedStepIndex]
                                  .startValue
                              }
                              onChange={(value) =>
                                updateStep(editorState.selectedStepIndex, {
                                  startValue: value,
                                })
                              }
                            />
                            <NumberInput
                              label="Target Value"
                              value={
                                tutorial.steps[editorState.selectedStepIndex]
                                  .targetValue
                              }
                              onChange={(value) =>
                                updateStep(editorState.selectedStepIndex, {
                                  targetValue: value,
                                })
                              }
                            />
                          </FormGroup>

                          {/* Automatic Instruction Generation Controls */}
                          <div
                            className={css({
                              p: 3,
                              bg: "blue.50",
                              borderRadius: "md",
                              border: "1px solid",
                              borderColor: "blue.200",
                            })}
                          >
                            <div
                              className={hstack({
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 2,
                              })}
                            >
                              <span
                                className={css({
                                  fontSize: "sm",
                                  fontWeight: "medium",
                                  color: "blue.800",
                                })}
                              >
                                🤖 Automatic Instructions
                              </span>
                              <div className={hstack({ gap: 2 })}>
                                <button
                                  onClick={() =>
                                    generateUnifiedInstructionsForStep(
                                      editorState.selectedStepIndex,
                                    )
                                  }
                                  className={css({
                                    px: 3,
                                    py: 1,
                                    fontSize: "xs",
                                    bg: "green.600",
                                    color: "white",
                                    borderRadius: "md",
                                    cursor: "pointer",
                                    _hover: { bg: "green.700" },
                                  })}
                                >
                                  ✨ Generate Instructions
                                </button>
                              </div>
                            </div>
                            <p
                              className={css({
                                fontSize: "xs",
                                color: "blue.700",
                                mb: 0,
                              })}
                            >
                              Automatically generates pedagogical decomposition
                              like "3 + 14 = 3 + 10 + (5 - 1) = 17" with proper
                              soroban complement rules.
                            </p>
                          </div>

                          <TextInput
                            label="Description"
                            value={
                              tutorial.steps[editorState.selectedStepIndex]
                                .description
                            }
                            onChange={(value) =>
                              updateStep(editorState.selectedStepIndex, {
                                description: value,
                              })
                            }
                            multiline
                            rows={3}
                          />

                          {/* Unified Pedagogical Decomposition Display */}
                          {(
                            tutorial.steps[editorState.selectedStepIndex] as any
                          )?.unifiedSequence && (
                            <div
                              className={css({
                                p: 3,
                                bg: "green.50",
                                borderRadius: "md",
                                border: "1px solid",
                                borderColor: "green.200",
                              })}
                            >
                              <div
                                className={css({
                                  fontSize: "sm",
                                  fontWeight: "medium",
                                  color: "green.800",
                                  mb: 2,
                                })}
                              >
                                ✨ Unified Pedagogical Decomposition
                              </div>
                              <div
                                className={css({
                                  fontFamily: "mono",
                                  fontSize: "sm",
                                  color: "green.700",
                                  bg: "green.100",
                                  p: 2,
                                  borderRadius: "sm",
                                  mb: 2,
                                })}
                              >
                                {
                                  (
                                    tutorial.steps[
                                      editorState.selectedStepIndex
                                    ] as any
                                  ).unifiedSequence.fullDecomposition
                                }
                              </div>
                              <div
                                className={css({
                                  fontSize: "xs",
                                  color: "green.600",
                                })}
                              >
                                This shows the complete mathematical breakdown
                                with 1:1 mapping to bead movements. Each term
                                corresponds to specific abacus actions in
                                pedagogical order.
                              </div>
                            </div>
                          )}

                          {/* Manual Instruction Editing */}
                          <div
                            className={css({
                              p: 3,
                              bg: "gray.50",
                              borderRadius: "md",
                              border: "1px solid",
                              borderColor: "gray.200",
                            })}
                          >
                            <h4
                              className={css({
                                fontSize: "sm",
                                fontWeight: "medium",
                                mb: 3,
                                color: "gray.800",
                              })}
                            >
                              ✏️ Manual Instruction Editing
                            </h4>

                            <FormGroup columns={2}>
                              <div>
                                <label
                                  className={css({
                                    fontSize: "sm",
                                    fontWeight: "medium",
                                    color: "gray.700",
                                    display: "block",
                                    mb: 2,
                                  })}
                                >
                                  Expected Action
                                </label>
                                <select
                                  value={
                                    tutorial.steps[
                                      editorState.selectedStepIndex
                                    ].expectedAction
                                  }
                                  onChange={(e) =>
                                    updateStep(editorState.selectedStepIndex, {
                                      expectedAction: e.target.value as any,
                                    })
                                  }
                                  className={css({
                                    w: "full",
                                    p: 2,
                                    border: "1px solid",
                                    borderColor: "gray.300",
                                    borderRadius: "md",
                                    fontSize: "sm",
                                  })}
                                >
                                  <option value="add">Add</option>
                                  <option value="remove">Remove</option>
                                  <option value="multi-step">Multi-step</option>
                                </select>
                              </div>

                              <TextInput
                                label="Action Description"
                                value={
                                  tutorial.steps[editorState.selectedStepIndex]
                                    .actionDescription
                                }
                                onChange={(value) =>
                                  updateStep(editorState.selectedStepIndex, {
                                    actionDescription: value,
                                  })
                                }
                              />
                            </FormGroup>

                            <FormGroup columns={2}>
                              <TextInput
                                label="Tooltip Title"
                                value={
                                  tutorial.steps[editorState.selectedStepIndex]
                                    .tooltip.content
                                }
                                onChange={(value) =>
                                  updateStep(editorState.selectedStepIndex, {
                                    tooltip: {
                                      ...tutorial.steps[
                                        editorState.selectedStepIndex
                                      ].tooltip,
                                      content: value,
                                    },
                                  })
                                }
                              />

                              <TextInput
                                label="Tooltip Explanation"
                                value={
                                  tutorial.steps[editorState.selectedStepIndex]
                                    .tooltip.explanation
                                }
                                onChange={(value) =>
                                  updateStep(editorState.selectedStepIndex, {
                                    tooltip: {
                                      ...tutorial.steps[
                                        editorState.selectedStepIndex
                                      ].tooltip,
                                      explanation: value,
                                    },
                                  })
                                }
                              />
                            </FormGroup>

                            {/* Error messages form removed - bead diff tooltip provides better guidance */}

                            {/* Multi-step Instructions */}
                            {tutorial.steps[editorState.selectedStepIndex]
                              .expectedAction === "multi-step" && (
                              <div className={css({ mt: 3 })}>
                                <div
                                  className={css({
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    mb: 2,
                                  })}
                                >
                                  <label
                                    className={css({
                                      fontSize: "sm",
                                      fontWeight: "medium",
                                      color: "gray.700",
                                    })}
                                  >
                                    Multi-step Instructions
                                  </label>
                                  <button
                                    onClick={() =>
                                      generateUnifiedInstructionsForStep(
                                        editorState.selectedStepIndex,
                                      )
                                    }
                                    className={css({
                                      px: 3,
                                      py: 1,
                                      fontSize: "xs",
                                      bg: "green.500",
                                      color: "white",
                                      borderRadius: "md",
                                      cursor: "pointer",
                                      _hover: { bg: "green.600" },
                                    })}
                                  >
                                    ✨ Generate Instructions
                                  </button>
                                </div>
                                <div className={css({ space: 2 })}>
                                  {(() => {
                                    // Use the new bead diff calculation for each step
                                    const stepStatesAndDiffs =
                                      calculateStepStatesAndDiffs(
                                        editorState.selectedStepIndex,
                                      );

                                    return (
                                      tutorial.steps[
                                        editorState.selectedStepIndex
                                      ].multiStepInstructions || []
                                    ).map((instruction, index) => {
                                      const stepData =
                                        stepStatesAndDiffs[index];
                                      const expectedValue = stepData
                                        ? stepData.expectedValue.toString()
                                        : "Calculating...";
                                      const beadDiff = stepData
                                        ? stepData.beadDiff
                                        : null;
                                      const mathematicalTerm = stepData
                                        ? stepData.mathematicalTerm
                                        : "";

                                      return (
                                        <div
                                          key={index}
                                          className={css({
                                            display: "flex",
                                            gap: 2,
                                            mb: 2,
                                          })}
                                        >
                                          <div className={css({ flex: 1 })}>
                                            <input
                                              type="text"
                                              value={instruction}
                                              onChange={(e) => {
                                                const newInstructions = [
                                                  ...(tutorial.steps[
                                                    editorState
                                                      .selectedStepIndex
                                                  ].multiStepInstructions ||
                                                    []),
                                                ];
                                                newInstructions[index] =
                                                  e.target.value;
                                                updateStep(
                                                  editorState.selectedStepIndex,
                                                  {
                                                    multiStepInstructions:
                                                      newInstructions,
                                                  },
                                                );
                                              }}
                                              className={css({
                                                w: "full",
                                                p: 2,
                                                border: "1px solid",
                                                borderColor: "gray.300",
                                                borderRadius: "md",
                                                fontSize: "sm",
                                              })}
                                              placeholder={`Step ${index + 1}`}
                                            />
                                            <div
                                              className={css({
                                                fontSize: "xs",
                                                color: "gray.500",
                                                mt: 1,
                                              })}
                                            >
                                              Expected state after step:{" "}
                                              {expectedValue}
                                              {mathematicalTerm && (
                                                <span
                                                  className={css({
                                                    color: "blue.600",
                                                    ml: 2,
                                                    fontWeight: "medium",
                                                  })}
                                                >
                                                  (Math: {mathematicalTerm})
                                                </span>
                                              )}
                                            </div>

                                            {/* Dynamic Bead Diff Display */}
                                            {beadDiff?.hasChanges && (
                                              <div
                                                className={css({
                                                  fontSize: "xs",
                                                  mt: 2,
                                                  p: 2,
                                                  bg: "yellow.50",
                                                  border: "1px solid",
                                                  borderColor: "yellow.200",
                                                  borderRadius: "sm",
                                                })}
                                              >
                                                <div
                                                  className={css({
                                                    fontWeight: "medium",
                                                    color: "yellow.800",
                                                    mb: 1,
                                                  })}
                                                >
                                                  🎯 Bead Movements for this
                                                  Step:
                                                </div>
                                                <div
                                                  className={css({
                                                    color: "yellow.700",
                                                    mb: 1,
                                                  })}
                                                >
                                                  {beadDiff.summary}
                                                </div>
                                                <div
                                                  className={css({
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: 1,
                                                    mt: 1,
                                                  })}
                                                >
                                                  {beadDiff.changes.map(
                                                    (change, changeIndex) => (
                                                      <span
                                                        key={changeIndex}
                                                        className={css({
                                                          fontSize: "xs",
                                                          px: 1,
                                                          py: 0.5,
                                                          borderRadius: "xs",
                                                          bg:
                                                            change.direction ===
                                                            "activate"
                                                              ? "green.100"
                                                              : "red.100",
                                                          color:
                                                            change.direction ===
                                                            "activate"
                                                              ? "green.800"
                                                              : "red.800",
                                                          border: "1px solid",
                                                          borderColor:
                                                            change.direction ===
                                                            "activate"
                                                              ? "green.300"
                                                              : "red.300",
                                                        })}
                                                      >
                                                        {change.direction ===
                                                        "activate"
                                                          ? "↗️"
                                                          : "↙️"}
                                                        {change.beadType ===
                                                        "heaven"
                                                          ? "H"
                                                          : "E"}
                                                        {change.position !==
                                                        undefined
                                                          ? change.position
                                                          : ""}
                                                        @P{change.placeValue}
                                                      </span>
                                                    ),
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => {
                                              const newInstructions = (
                                                tutorial.steps[
                                                  editorState.selectedStepIndex
                                                ].multiStepInstructions || []
                                              ).filter((_, i) => i !== index);
                                              updateStep(
                                                editorState.selectedStepIndex,
                                                {
                                                  multiStepInstructions:
                                                    newInstructions,
                                                },
                                              );
                                            }}
                                            className={css({
                                              px: 2,
                                              py: 1,
                                              fontSize: "xs",
                                              bg: "red.500",
                                              color: "white",
                                              borderRadius: "md",
                                              cursor: "pointer",
                                              _hover: { bg: "red.600" },
                                              alignSelf: "flex-start",
                                            })}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      );
                                    });
                                  })()}
                                  <button
                                    onClick={() => {
                                      const newInstructions = [
                                        ...(tutorial.steps[
                                          editorState.selectedStepIndex
                                        ].multiStepInstructions || []),
                                        "",
                                      ];
                                      updateStep(
                                        editorState.selectedStepIndex,
                                        {
                                          multiStepInstructions:
                                            newInstructions,
                                        },
                                      );
                                    }}
                                    className={css({
                                      px: 3,
                                      py: 1,
                                      fontSize: "xs",
                                      bg: "green.500",
                                      color: "white",
                                      borderRadius: "md",
                                      cursor: "pointer",
                                      _hover: { bg: "green.600" },
                                    })}
                                  >
                                    Add Step
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormGroup>
                      </EditorLayout>
                    ) : editorState.selectedPracticeStepId ? (
                      /* Practice Step Editor */
                      (() => {
                        const practiceStepIndex = (
                          tutorial.practiceSteps || []
                        ).findIndex(
                          (step) =>
                            step.id === editorState.selectedPracticeStepId,
                        );
                        const practiceStep = (tutorial.practiceSteps || [])[
                          practiceStepIndex
                        ];

                        return practiceStep ? (
                          <PracticeStepEditor
                            step={practiceStep}
                            onChange={(updatedStep) =>
                              updatePracticeStep(practiceStepIndex, updatedStep)
                            }
                            onDelete={() => {
                              deletePracticeStep(practiceStepIndex);
                              setEditorState((prev) => ({
                                ...prev,
                                selectedPracticeStepId: null,
                                selectedStepIndex: null,
                              }));
                            }}
                          />
                        ) : null;
                      })()
                    ) : null}
                  </div>
                ) : null}

                {/* Preview Section */}
                <div
                  className={css({
                    flex: 1,
                    overflowY: "auto",
                    height: "100%",
                    minWidth: 0,
                  })}
                >
                  {editorState.selectedPracticeStepId ? (
                    /* Practice Step Preview */
                    (() => {
                      const practiceStep = (tutorial.practiceSteps || []).find(
                        (step) =>
                          step.id === editorState.selectedPracticeStepId,
                      );

                      return practiceStep ? (
                        <PracticeStepPreview step={practiceStep} />
                      ) : (
                        <div
                          className={css({
                            p: 4,
                            textAlign: "center",
                            color: "gray.500",
                          })}
                        >
                          Practice step not found
                        </div>
                      );
                    })()
                  ) : (
                    /* Tutorial Player for Concept Steps */
                    <TutorialPlayer
                      key={playerKey}
                      tutorial={tutorial}
                      initialStepIndex={playerStepIndex}
                      isDebugMode={true}
                      showDebugPanel={editorState.isEditing}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </Resizable>
      ) : (
        /* Non-editing view - tutorial player with edit button */
        <div
          className={css({
            width: "100%",
            height: "100%",
            position: "relative",
          })}
        >
          {/* Edit Tutorial Button */}
          <div
            className={css({
              position: "absolute",
              top: 4,
              right: 4,
              zIndex: 10,
            })}
          >
            <button
              onClick={() =>
                setEditorState((prev) => ({ ...prev, isEditing: true }))
              }
              className={css({
                px: 4,
                py: 2,
                bg: "blue.500",
                color: "white",
                border: "none",
                borderRadius: "md",
                fontSize: "sm",
                fontWeight: "medium",
                cursor: "pointer",
                shadow: "md",
                _hover: { bg: "blue.600" },
              })}
            >
              Edit Tutorial
            </button>
          </div>

          <TutorialPlayer
            key={playerKey}
            tutorial={tutorial}
            initialStepIndex={playerStepIndex}
            isDebugMode={true}
            showDebugPanel={editorState.isEditing}
          />
        </div>
      )}

      {/* Tutorial Info Modal */}
      <TutorialInfoModal
        tutorial={tutorial}
        isOpen={editorState.showTutorialInfoModal}
        onClose={() =>
          setEditorState((prev) => ({ ...prev, showTutorialInfoModal: false }))
        }
        onUpdateTutorial={updateTutorialMeta}
      />
    </div>
  );
}
