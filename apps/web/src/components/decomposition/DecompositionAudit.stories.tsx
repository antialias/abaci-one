/**
 * Decomposition System Audit Story
 *
 * Comprehensive testing for the unified step generator and decomposition display.
 * Test all operation types: addition, subtraction, five complements, ten complements, cascades.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useMemo, useState } from "react";
import { DecompositionProvider } from "@/contexts/DecompositionContext";
import {
  generateUnifiedInstructionSequence,
  type PedagogicalRule,
  type PedagogicalSegment,
  type UnifiedInstructionSequence,
} from "@/utils/unifiedStepGenerator";
import { css } from "../../../styled-system/css";
import { HelpAbacus } from "../practice/HelpAbacus";
import { DecompositionDisplay } from "./DecompositionDisplay";

const meta: Meta = {
  title: "Practice/Decomposition System Audit",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

// Test case categories
interface TestCase {
  name: string;
  start: number;
  target: number;
  expectedRules?: PedagogicalRule[];
  description: string;
}

const TEST_CATEGORIES: Record<string, TestCase[]> = {
  "Basic Addition (Direct)": [
    {
      name: "+1 from 0",
      start: 0,
      target: 1,
      expectedRules: ["Direct"],
      description: "Simplest case",
    },
    {
      name: "+4 from 0",
      start: 0,
      target: 4,
      expectedRules: ["Direct"],
      description: "Max direct add",
    },
    {
      name: "+2 from 2",
      start: 2,
      target: 4,
      expectedRules: ["Direct"],
      description: "Direct when room exists",
    },
    {
      name: "+3 from 1",
      start: 1,
      target: 4,
      expectedRules: ["Direct"],
      description: "Direct to fill earth beads",
    },
  ],
  "Basic Subtraction (Direct)": [
    {
      name: "-1 from 4",
      start: 4,
      target: 3,
      expectedRules: ["Direct"],
      description: "Simple direct subtract",
    },
    {
      name: "-3 from 4",
      start: 4,
      target: 1,
      expectedRules: ["Direct"],
      description: "Larger direct subtract",
    },
    {
      name: "-2 from 3",
      start: 3,
      target: 1,
      expectedRules: ["Direct"],
      description: "Direct from middle",
    },
  ],
  "Five Complement Addition": [
    {
      name: "+4 from 1",
      start: 1,
      target: 5,
      expectedRules: ["FiveComplement"],
      description: "+4 = +5-1",
    },
    {
      name: "+3 from 2",
      start: 2,
      target: 5,
      expectedRules: ["FiveComplement"],
      description: "+3 = +5-2",
    },
    {
      name: "+4 from 2",
      start: 2,
      target: 6,
      expectedRules: ["FiveComplement"],
      description: "+4 = +5-1, result > 5",
    },
    {
      name: "+3 from 3",
      start: 3,
      target: 6,
      expectedRules: ["FiveComplement"],
      description: "+3 = +5-2, result > 5",
    },
    {
      name: "+2 from 4",
      start: 4,
      target: 6,
      expectedRules: ["FiveComplement"],
      description: "+2 = +5-3",
    },
    {
      name: "+1 from 4",
      start: 4,
      target: 5,
      expectedRules: ["FiveComplement"],
      description: "+1 = +5-4",
    },
  ],
  "Five Complement Subtraction": [
    {
      name: "-4 from 5",
      start: 5,
      target: 1,
      expectedRules: ["FiveComplement"],
      description: "-4 = -5+1",
    },
    {
      name: "-3 from 5",
      start: 5,
      target: 2,
      expectedRules: ["FiveComplement"],
      description: "-3 = -5+2",
    },
    {
      name: "-2 from 5",
      start: 5,
      target: 3,
      expectedRules: ["FiveComplement"],
      description: "-2 = -5+3",
    },
    {
      name: "-1 from 5",
      start: 5,
      target: 4,
      expectedRules: ["FiveComplement"],
      description: "-1 = -5+4",
    },
    {
      name: "-4 from 6",
      start: 6,
      target: 2,
      expectedRules: ["FiveComplement"],
      description: "-4 = -5+1, from > 5",
    },
    {
      name: "-3 from 7",
      start: 7,
      target: 4,
      expectedRules: ["FiveComplement"],
      description: "-3 = -5+2, from > 5",
    },
  ],
  "Ten Complement Addition (Carry)": [
    {
      name: "+9 from 1",
      start: 1,
      target: 10,
      expectedRules: ["TenComplement"],
      description: "+9 = +10-1",
    },
    {
      name: "+8 from 2",
      start: 2,
      target: 10,
      expectedRules: ["TenComplement"],
      description: "+8 = +10-2",
    },
    {
      name: "+7 from 5",
      start: 5,
      target: 12,
      expectedRules: ["TenComplement"],
      description: "+7 = +10-3",
    },
    {
      name: "+6 from 6",
      start: 6,
      target: 12,
      expectedRules: ["TenComplement"],
      description: "+6 = +10-4",
    },
    {
      name: "+5 from 5",
      start: 5,
      target: 10,
      expectedRules: ["TenComplement"],
      description: "+5 = +10-5",
    },
    {
      name: "+9 from 5",
      start: 5,
      target: 14,
      expectedRules: ["TenComplement"],
      description: "+9 = +10-1, from 5",
    },
  ],
  "Ten Complement Subtraction (Borrow)": [
    {
      name: "-9 from 10",
      start: 10,
      target: 1,
      expectedRules: ["TenComplement"],
      description: "-9 = +1-10",
    },
    {
      name: "-8 from 10",
      start: 10,
      target: 2,
      expectedRules: ["TenComplement"],
      description: "-8 = +2-10",
    },
    {
      name: "-7 from 10",
      start: 10,
      target: 3,
      expectedRules: ["TenComplement"],
      description: "-7 = +3-10",
    },
    {
      name: "-6 from 10",
      start: 10,
      target: 4,
      expectedRules: ["TenComplement"],
      description: "-6 = +4-10",
    },
    {
      name: "-5 from 10",
      start: 10,
      target: 5,
      expectedRules: ["TenComplement"],
      description: "-5 = +5-10",
    },
    {
      name: "-9 from 13",
      start: 13,
      target: 4,
      expectedRules: ["TenComplement"],
      description: "-9 = +1-10, from 13",
    },
  ],
  "Multi-digit Addition": [
    {
      name: "+10 from 0",
      start: 0,
      target: 10,
      expectedRules: ["Direct"],
      description: "Add one tens bead",
    },
    {
      name: "+25 from 0",
      start: 0,
      target: 25,
      description: "Multiple places",
    },
    { name: "+14 from 3", start: 3, target: 17, description: "Mix of rules" },
    { name: "+99 from 0", start: 0, target: 99, description: "Max two-digit" },
    {
      name: "+45 from 23",
      start: 23,
      target: 68,
      description: "Complex multi-digit",
    },
  ],
  "Multi-digit Subtraction": [
    { name: "-10 from 15", start: 15, target: 5, description: "Subtract tens" },
    {
      name: "-25 from 50",
      start: 50,
      target: 25,
      description: "Multiple places",
    },
    {
      name: "-14 from 30",
      start: 30,
      target: 16,
      description: "With borrowing",
    },
    {
      name: "-37 from 52",
      start: 52,
      target: 15,
      description: "Complex borrowing",
    },
  ],
  "Cascade Cases": [
    { name: "+1 from 9", start: 9, target: 10, description: "Simple cascade" },
    {
      name: "+1 from 99",
      start: 99,
      target: 100,
      description: "Double cascade",
    },
    {
      name: "+1 from 999",
      start: 999,
      target: 1000,
      description: "Triple cascade",
    },
    {
      name: "+2 from 98",
      start: 98,
      target: 100,
      description: "Cascade with +2",
    },
    {
      name: "+11 from 89",
      start: 89,
      target: 100,
      description: "Multi-digit cascade",
    },
  ],
  "Edge Cases": [
    { name: "0 → 0", start: 0, target: 0, description: "No change" },
    { name: "5 → 5", start: 5, target: 5, description: "No change at 5" },
    { name: "+5 from 0", start: 0, target: 5, description: "Add heaven bead" },
    {
      name: "-5 from 5",
      start: 5,
      target: 0,
      description: "Remove heaven bead",
    },
    {
      name: "+5 from 4",
      start: 4,
      target: 9,
      description: "Add 5 when earth full",
    },
    {
      name: "-5 from 9",
      start: 9,
      target: 4,
      description: "Remove 5 when earth full",
    },
  ],
  "Mixed Operations (Practice Session Style)": [
    {
      name: "0 → 5 → 12",
      start: 0,
      target: 5,
      description: "First of a sequence",
    },
    {
      name: "12 → 8",
      start: 12,
      target: 8,
      description: "Subtract in sequence",
    },
    { name: "8 → 15", start: 8, target: 15, description: "Add after subtract" },
    { name: "15 → 6", start: 15, target: 6, description: "Large subtract" },
  ],
};

// Helper to get rule color
function getRuleColor(rule: PedagogicalRule): string {
  switch (rule) {
    case "Direct":
      return "green.100";
    case "FiveComplement":
      return "blue.100";
    case "TenComplement":
      return "purple.100";
    case "Cascade":
      return "orange.100";
    default:
      return "gray.100";
  }
}

function getRuleEmoji(rule: PedagogicalRule): string {
  switch (rule) {
    case "Direct":
      return "✨";
    case "FiveComplement":
      return "🤝";
    case "TenComplement":
      return "🔟";
    case "Cascade":
      return "🌊";
    default:
      return "❓";
  }
}

// Single test case display
function TestCaseDisplay({
  testCase,
  isSelected,
  onClick,
}: {
  testCase: TestCase;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sequence = useMemo(
    () => generateUnifiedInstructionSequence(testCase.start, testCase.target),
    [testCase.start, testCase.target],
  );

  const rules = sequence.segments
    .map((s) => s.plan[0]?.rule)
    .filter(Boolean) as PedagogicalRule[];
  const uniqueRules = [...new Set(rules)];
  const hasIssues = sequence.steps.some((s) => !s.isValid);

  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        display: "block",
        w: "100%",
        textAlign: "left",
        p: "0.5rem",
        borderRadius: "6px",
        border: "2px solid",
        borderColor: isSelected
          ? "blue.500"
          : hasIssues
            ? "red.300"
            : "gray.200",
        bg: isSelected ? "blue.50" : hasIssues ? "red.50" : "white",
        cursor: "pointer",
        transition: "all 0.15s",
        _hover: { borderColor: isSelected ? "blue.600" : "blue.300" },
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <span className={css({ fontWeight: "medium", fontSize: "0.875rem" })}>
          {testCase.name}
        </span>
        <span className={css({ fontSize: "0.75rem", color: "gray.500" })}>
          {testCase.start} → {testCase.target}
        </span>
      </div>
      <div
        className={css({
          display: "flex",
          gap: "0.25rem",
          mt: "0.25rem",
          flexWrap: "wrap",
        })}
      >
        {uniqueRules.map((rule) => (
          <span
            key={rule}
            className={css({
              fontSize: "0.625rem",
              px: "0.375rem",
              py: "0.125rem",
              borderRadius: "4px",
              bg: getRuleColor(rule),
            })}
          >
            {getRuleEmoji(rule)} {rule}
          </span>
        ))}
        {hasIssues && (
          <span
            className={css({
              fontSize: "0.625rem",
              px: "0.375rem",
              py: "0.125rem",
              borderRadius: "4px",
              bg: "red.200",
              color: "red.800",
            })}
          >
            ⚠️ Issues
          </span>
        )}
      </div>
    </button>
  );
}

// Detailed view for selected test case
function DetailedView({ start, target }: { start: number; target: number }) {
  const { sequence, error } = useMemo(() => {
    try {
      return {
        sequence: generateUnifiedInstructionSequence(start, target),
        error: null,
      };
    } catch (e) {
      return {
        sequence: null,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }, [start, target]);
  const [currentStep, setCurrentStep] = useState(0);

  const difference = target - start;
  const operation = difference >= 0 ? "Addition" : "Subtraction";

  // Show error state for unsupported operations
  if (error || !sequence) {
    return (
      <div className={css({ p: "2rem", textAlign: "center" })}>
        <div
          className={css({
            p: "1.5rem",
            bg: "orange.50",
            border: "2px solid",
            borderColor: "orange.300",
            borderRadius: "12px",
            maxWidth: "500px",
            margin: "0 auto",
          })}
        >
          <div className={css({ fontSize: "2rem", mb: "0.5rem" })}>🚧</div>
          <h3
            className={css({
              fontSize: "1.125rem",
              fontWeight: "bold",
              color: "orange.800",
              mb: "0.5rem",
            })}
          >
            {operation} Not Yet Implemented
          </h3>
          <p
            className={css({
              fontSize: "0.875rem",
              color: "orange.700",
              mb: "1rem",
            })}
          >
            {start} → {target} ({difference >= 0 ? "+" : ""}
            {difference})
          </p>
          <p className={css({ fontSize: "0.75rem", color: "gray.600" })}>
            {error ||
              "The decomposition system does not yet support this operation."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      })}
    >
      {/* Header */}
      <div className={css({ p: "1rem", bg: "gray.50", borderRadius: "8px" })}>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <div>
            <h3 className={css({ fontSize: "1.25rem", fontWeight: "bold" })}>
              {start} → {target}
            </h3>
            <p className={css({ fontSize: "0.875rem", color: "gray.600" })}>
              {operation}: {difference >= 0 ? "+" : ""}
              {difference}
            </p>
          </div>
          <div className={css({ textAlign: "right" })}>
            <div className={css({ fontSize: "0.75rem", color: "gray.500" })}>
              {sequence.steps.length} steps, {sequence.segments.length} segments
            </div>
            <div
              className={css({
                fontSize: "0.75rem",
                color: sequence.isMeaningfulDecomposition
                  ? "green.600"
                  : "gray.400",
              })}
            >
              {sequence.isMeaningfulDecomposition
                ? "✓ Meaningful"
                : "○ Trivial"}
            </div>
          </div>
        </div>
      </div>

      {/* Decomposition Display */}
      <div
        className={css({
          p: "1rem",
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          borderRadius: "8px",
        })}
      >
        <h4
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            mb: "0.75rem",
            color: "gray.700",
          })}
        >
          Decomposition
        </h4>
        <DecompositionProvider
          startValue={start}
          targetValue={target}
          currentStepIndex={currentStep}
        >
          <DecompositionDisplay />
        </DecompositionProvider>
        <div
          className={css({
            mt: "0.5rem",
            fontSize: "0.75rem",
            color: "gray.500",
            fontFamily: "monospace",
          })}
        >
          Raw: {sequence.fullDecomposition}
        </div>
      </div>

      {/* Interactive Abacus */}
      <div
        className={css({
          p: "1rem",
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          borderRadius: "8px",
        })}
      >
        <h4
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            mb: "0.75rem",
            color: "gray.700",
          })}
        >
          Interactive Abacus
        </h4>
        <div className={css({ display: "flex", justifyContent: "center" })}>
          <HelpAbacus
            currentValue={start}
            targetValue={target}
            columns={Math.max(
              3,
              Math.ceil(Math.log10(Math.max(start, target, 1) + 1)) + 1,
            )}
            scaleFactor={1.0}
            interactive
          />
        </div>
      </div>

      {/* Segments */}
      <div
        className={css({
          p: "1rem",
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          borderRadius: "8px",
        })}
      >
        <h4
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            mb: "0.75rem",
            color: "gray.700",
          })}
        >
          Pedagogical Segments ({sequence.segments.length})
        </h4>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          })}
        >
          {sequence.segments.map((segment, i) => (
            <SegmentCard key={segment.id} segment={segment} index={i} />
          ))}
        </div>
      </div>

      {/* Steps */}
      <div
        className={css({
          p: "1rem",
          bg: "white",
          border: "1px solid",
          borderColor: "gray.200",
          borderRadius: "8px",
        })}
      >
        <h4
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            mb: "0.75rem",
            color: "gray.700",
          })}
        >
          Steps ({sequence.steps.length})
        </h4>
        <div
          className={css({
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            mb: "0.75rem",
          })}
        >
          {sequence.steps.map((step, i) => (
            <button
              key={step.stepIndex}
              type="button"
              onClick={() => setCurrentStep(i)}
              className={css({
                px: "0.75rem",
                py: "0.375rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor:
                  currentStep === i
                    ? "blue.500"
                    : step.isValid
                      ? "gray.300"
                      : "red.400",
                bg:
                  currentStep === i
                    ? "blue.100"
                    : step.isValid
                      ? "white"
                      : "red.50",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                _hover: { borderColor: "blue.400" },
              })}
            >
              {step.mathematicalTerm}
            </button>
          ))}
        </div>
        {sequence.steps[currentStep] && (
          <StepDetail step={sequence.steps[currentStep]} />
        )}
      </div>

      {/* Debug JSON */}
      <details
        className={css({ p: "1rem", bg: "gray.900", borderRadius: "8px" })}
      >
        <summary
          className={css({
            color: "gray.400",
            cursor: "pointer",
            fontSize: "0.75rem",
          })}
        >
          Raw JSON (click to expand)
        </summary>
        <pre
          className={css({
            mt: "0.5rem",
            fontSize: "0.625rem",
            color: "gray.300",
            overflow: "auto",
            maxH: "400px",
          })}
        >
          {JSON.stringify(sequence, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SegmentCard({
  segment,
  index,
}: {
  segment: PedagogicalSegment;
  index: number;
}) {
  const rule = segment.plan[0]?.rule || "Direct";

  return (
    <div
      className={css({
        p: "0.75rem",
        borderRadius: "6px",
        border: "1px solid",
        borderColor: "gray.200",
        bg: getRuleColor(rule),
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        })}
      >
        <div>
          <div className={css({ fontWeight: "bold", fontSize: "0.875rem" })}>
            {getRuleEmoji(rule)} {segment.readable.title}
          </div>
          {segment.readable.subtitle && (
            <div className={css({ fontSize: "0.75rem", color: "gray.600" })}>
              {segment.readable.subtitle}
            </div>
          )}
        </div>
        <div
          className={css({
            fontSize: "0.625rem",
            color: "gray.500",
            fontFamily: "monospace",
          })}
        >
          {segment.id}
        </div>
      </div>

      <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
        <strong>Summary:</strong> {segment.readable.summary}
      </div>

      <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
        <strong>Goal:</strong> {segment.goal}
      </div>

      <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
        <strong>Expression:</strong> <code>{segment.expression}</code>
      </div>

      <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
        <strong>Value change:</strong> {segment.startValue} → {segment.endValue}
      </div>

      {segment.readable.stepsFriendly.length > 0 && (
        <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
          <strong>Bead moves:</strong>
          <ul className={css({ pl: "1rem", mt: "0.25rem" })}>
            {segment.readable.stepsFriendly.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {segment.readable.why.length > 0 && (
        <div className={css({ mt: "0.5rem", fontSize: "0.75rem" })}>
          <strong>Why:</strong>
          <ul className={css({ pl: "1rem", mt: "0.25rem" })}>
            {segment.readable.why.map((why, i) => (
              <li key={i}>{why}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepDetail({
  step,
}: {
  step: UnifiedInstructionSequence["steps"][0];
}) {
  return (
    <div
      className={css({
        p: "0.75rem",
        bg: "gray.50",
        borderRadius: "6px",
        fontSize: "0.75rem",
      })}
    >
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.5rem 1rem",
        })}
      >
        <span className={css({ fontWeight: "bold" })}>Term:</span>
        <code>{step.mathematicalTerm}</code>

        <span className={css({ fontWeight: "bold" })}>Instruction:</span>
        <span>{step.englishInstruction}</span>

        <span className={css({ fontWeight: "bold" })}>Expected value:</span>
        <span>{step.expectedValue}</span>

        <span className={css({ fontWeight: "bold" })}>Segment:</span>
        <span>{step.segmentId || "(none)"}</span>

        <span className={css({ fontWeight: "bold" })}>Valid:</span>
        <span
          className={css({ color: step.isValid ? "green.600" : "red.600" })}
        >
          {step.isValid
            ? "✓ Yes"
            : `✗ No: ${step.validationIssues?.join(", ")}`}
        </span>

        <span className={css({ fontWeight: "bold" })}>Bead moves:</span>
        <span>{step.beadMovements.length} movements</span>
      </div>

      {step.beadMovements.length > 0 && (
        <div className={css({ mt: "0.5rem" })}>
          <strong>Movements:</strong>
          <ul className={css({ pl: "1rem", mt: "0.25rem" })}>
            {step.beadMovements.map((m, i) => (
              <li key={i}>
                {m.beadType} @ place {m.placeValue}: {m.direction}
                {m.position !== undefined && ` (pos ${m.position})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Custom test input
function CustomTestInput({
  onSelect,
}: {
  onSelect: (start: number, target: number) => void;
}) {
  const [start, setStart] = useState(0);
  const [target, setTarget] = useState(17);

  return (
    <div
      className={css({
        p: "1rem",
        bg: "blue.50",
        borderRadius: "8px",
        mb: "1rem",
      })}
    >
      <h3
        className={css({
          fontSize: "0.875rem",
          fontWeight: "bold",
          mb: "0.75rem",
        })}
      >
        Custom Test
      </h3>
      <div
        className={css({
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-end",
        })}
      >
        <label className={css({ flex: 1 })}>
          <span className={css({ fontSize: "0.75rem", color: "gray.600" })}>
            Start
          </span>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            min={0}
            max={9999}
            className={css({
              w: "100%",
              p: "0.5rem",
              borderRadius: "4px",
              border: "1px solid",
              borderColor: "gray.300",
              fontSize: "1rem",
              fontFamily: "monospace",
            })}
          />
        </label>
        <span className={css({ fontSize: "1.25rem", pb: "0.5rem" })}>→</span>
        <label className={css({ flex: 1 })}>
          <span className={css({ fontSize: "0.75rem", color: "gray.600" })}>
            Target
          </span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            min={0}
            max={9999}
            className={css({
              w: "100%",
              p: "0.5rem",
              borderRadius: "4px",
              border: "1px solid",
              borderColor: "gray.300",
              fontSize: "1rem",
              fontFamily: "monospace",
            })}
          />
        </label>
        <button
          type="button"
          onClick={() => onSelect(start, target)}
          className={css({
            px: "1rem",
            py: "0.5rem",
            bg: "blue.600",
            color: "white",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
            _hover: { bg: "blue.700" },
          })}
        >
          Test
        </button>
      </div>
    </div>
  );
}

// Main audit UI
function DecompositionAuditUI() {
  const [selectedTest, setSelectedTest] = useState<{
    start: number;
    target: number;
  } | null>({
    start: 3,
    target: 17,
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Basic Addition (Direct)"]),
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  return (
    <div
      data-component="decomposition-audit"
      className={css({
        display: "flex",
        h: "100vh",
        bg: "gray.100",
      })}
    >
      {/* Left Panel: Test Cases */}
      <div
        className={css({
          w: "350px",
          bg: "white",
          borderRight: "1px solid",
          borderColor: "gray.200",
          overflow: "auto",
          p: "1rem",
        })}
      >
        <h1
          className={css({
            fontSize: "1.25rem",
            fontWeight: "bold",
            mb: "1rem",
          })}
        >
          Decomposition Audit
        </h1>

        <CustomTestInput
          onSelect={(start, target) => setSelectedTest({ start, target })}
        />

        {Object.entries(TEST_CATEGORIES).map(([category, tests]) => (
          <div key={category} className={css({ mb: "1rem" })}>
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className={css({
                w: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: "0.5rem",
                bg: "gray.100",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "0.875rem",
                cursor: "pointer",
                _hover: { bg: "gray.200" },
              })}
            >
              <span>{category}</span>
              <span>{expandedCategories.has(category) ? "▼" : "▶"}</span>
            </button>

            {expandedCategories.has(category) && (
              <div
                className={css({
                  mt: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                })}
              >
                {tests.map((test) => (
                  <TestCaseDisplay
                    key={`${test.start}-${test.target}`}
                    testCase={test}
                    isSelected={
                      selectedTest?.start === test.start &&
                      selectedTest?.target === test.target
                    }
                    onClick={() =>
                      setSelectedTest({
                        start: test.start,
                        target: test.target,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right Panel: Details */}
      <div className={css({ flex: 1, overflow: "auto", p: "1.5rem" })}>
        {selectedTest ? (
          <DetailedView
            start={selectedTest.start}
            target={selectedTest.target}
          />
        ) : (
          <div
            className={css({
              textAlign: "center",
              py: "4rem",
              color: "gray.500",
            })}
          >
            Select a test case to see details
          </div>
        )}
      </div>
    </div>
  );
}

export const Audit: StoryObj = {
  render: () => <DecompositionAuditUI />,
};
