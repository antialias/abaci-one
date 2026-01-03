import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createBasicSkillSet } from "@/types/tutorial";
import {
  generateSingleProblem,
  type ProblemConstraints,
} from "@/utils/problemGenerator";
import { css } from "../../../styled-system/css";
import { VerticalProblem } from "./VerticalProblem";

const meta: Meta<typeof VerticalProblem> = {
  title: "Practice/VerticalProblem",
  component: VerticalProblem,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof VerticalProblem>;

/**
 * Generate a problem using the actual skill-based algorithm
 */
function generateProblem(skillConfig?: {
  basic?: boolean;
  fiveComplements?: boolean;
  tenComplements?: boolean;
}): { terms: number[]; answer: number } {
  const baseSkills = createBasicSkillSet();

  // Enable requested skills
  if (skillConfig?.basic !== false) {
    baseSkills.basic.directAddition = true;
    baseSkills.basic.heavenBead = true;
    baseSkills.basic.simpleCombinations = true;
  }

  if (skillConfig?.fiveComplements) {
    baseSkills.fiveComplements["4=5-1"] = true;
    baseSkills.fiveComplements["3=5-2"] = true;
    baseSkills.fiveComplements["2=5-3"] = true;
    baseSkills.fiveComplements["1=5-4"] = true;
  }

  if (skillConfig?.tenComplements) {
    baseSkills.tenComplements["9=10-1"] = true;
    baseSkills.tenComplements["8=10-2"] = true;
    baseSkills.tenComplements["7=10-3"] = true;
    baseSkills.tenComplements["6=10-4"] = true;
    baseSkills.tenComplements["5=10-5"] = true;
  }

  const constraints: ProblemConstraints = {
    numberRange: { min: 1, max: skillConfig?.tenComplements ? 99 : 9 },
    maxTerms: 4,
    problemCount: 1,
  };

  const problem = generateSingleProblem(constraints, baseSkills);

  if (problem) {
    return { terms: problem.terms, answer: problem.answer };
  }

  // Fallback
  return { terms: [3, 4, 2], answer: 9 };
}

/**
 * Interactive demo allowing input
 */
function InteractiveProblemDemo() {
  const [problem] = useState(() => generateProblem({ basic: true }));
  const [userAnswer, setUserAnswer] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompleted) return;

    if (/^[0-9]$/.test(e.key)) {
      setUserAnswer((prev) => prev + e.key);
    } else if (e.key === "Backspace") {
      setUserAnswer((prev) => prev.slice(0, -1));
    } else if (e.key === "Enter" && userAnswer) {
      setIsCompleted(true);
    }
  };

  const handleReset = () => {
    setUserAnswer("");
    setIsCompleted(false);
  };

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        padding: "2rem",
      })}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Interactive demo needs keyboard focus
      tabIndex={0}
    >
      <VerticalProblem
        terms={problem.terms}
        userAnswer={userAnswer}
        isFocused={!isCompleted}
        isCompleted={isCompleted}
        correctAnswer={problem.answer}
        size="large"
      />

      <div
        className={css({
          fontSize: "0.875rem",
          color: "gray.500",
          textAlign: "center",
        })}
      >
        {isCompleted ? (
          <button
            onClick={handleReset}
            className={css({
              padding: "0.5rem 1rem",
              backgroundColor: "blue.500",
              color: "white",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            })}
          >
            Try Again
          </button>
        ) : (
          "Type numbers and press Enter to submit"
        )}
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveProblemDemo />,
};

// Static examples with skill-appropriate problems
const basicProblem = generateProblem({ basic: true });
const fiveComplementProblem = generateProblem({
  basic: true,
  fiveComplements: true,
});
const tenComplementProblem = generateProblem({
  basic: true,
  fiveComplements: true,
  tenComplements: true,
});

export const BasicAddition: Story = {
  args: {
    terms: basicProblem.terms,
    userAnswer: "",
    isFocused: true,
    isCompleted: false,
    correctAnswer: basicProblem.answer,
    size: "normal",
  },
};

export const WithFiveComplements: Story = {
  args: {
    terms: fiveComplementProblem.terms,
    userAnswer: "",
    isFocused: true,
    isCompleted: false,
    correctAnswer: fiveComplementProblem.answer,
    size: "normal",
  },
};

export const WithTenComplements: Story = {
  args: {
    terms: tenComplementProblem.terms,
    userAnswer: "",
    isFocused: true,
    isCompleted: false,
    correctAnswer: tenComplementProblem.answer,
    size: "large",
  },
};

export const PartialAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: "1",
    isFocused: true,
    isCompleted: false,
    correctAnswer: 10,
    size: "normal",
  },
};

export const CorrectAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: "10",
    isFocused: false,
    isCompleted: true,
    correctAnswer: 10,
    size: "normal",
  },
};

export const IncorrectAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: "9",
    isFocused: false,
    isCompleted: true,
    correctAnswer: 10,
    size: "normal",
  },
};

export const LargeSize: Story = {
  args: {
    terms: [45, 27, 18],
    userAnswer: "90",
    isFocused: false,
    isCompleted: true,
    correctAnswer: 90,
    size: "large",
  },
};

export const MixedOperations: Story = {
  args: {
    terms: [25, -8, 13],
    userAnswer: "",
    isFocused: true,
    isCompleted: false,
    correctAnswer: 30,
    size: "normal",
  },
};

/**
 * Gallery showing multiple problems at different states
 */
function ProblemGallery() {
  const problems = [
    generateProblem({ basic: true }),
    generateProblem({ basic: true, fiveComplements: true }),
    generateProblem({
      basic: true,
      fiveComplements: true,
      tenComplements: true,
    }),
  ];

  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "repeat(3, auto)",
        gap: "2rem",
        padding: "2rem",
      })}
    >
      {problems.map((p, i) => (
        <div key={i} className={css({ textAlign: "center" })}>
          <div
            className={css({
              fontSize: "0.75rem",
              color: "gray.500",
              marginBottom: "0.5rem",
            })}
          >
            {i === 0
              ? "Basic"
              : i === 1
                ? "Five Complements"
                : "Ten Complements"}
          </div>
          <VerticalProblem
            terms={p.terms}
            userAnswer=""
            isFocused={i === 1}
            isCompleted={false}
            correctAnswer={p.answer}
            size="normal"
          />
        </div>
      ))}
    </div>
  );
}

export const Gallery: Story = {
  render: () => <ProblemGallery />,
};

/**
 * Parse a string of terms into an array of numbers
 * Handles formats like: "50, -30, 20" or "50 -30 20" or "50+-30+20"
 */
function parseTerms(input: string): number[] {
  // Replace multiple spaces/commas with single space, trim
  const cleaned = input.trim().replace(/[,\s]+/g, " ");
  if (!cleaned) return [];

  // Split on spaces, but keep negative signs attached to numbers
  // Handle cases like "50 -30" and "50-30" and "50 + -30"
  const terms: number[] = [];
  let currentNum = "";

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === " " || char === "+") {
      // Space or plus - finish current number if any
      if (currentNum) {
        const num = parseInt(currentNum, 10);
        if (!Number.isNaN(num)) terms.push(num);
        currentNum = "";
      }
    } else if (char === "-") {
      // Minus sign - could be subtraction or negative
      if (currentNum) {
        // Finish previous number
        const num = parseInt(currentNum, 10);
        if (!Number.isNaN(num)) terms.push(num);
        currentNum = "-";
      } else {
        // Start of negative number
        currentNum = "-";
      }
    } else if (/[0-9]/.test(char)) {
      currentNum += char;
    }
  }

  // Don't forget the last number
  if (currentNum && currentNum !== "-") {
    const num = parseInt(currentNum, 10);
    if (!Number.isNaN(num)) terms.push(num);
  }

  return terms;
}

export const Playground: Story = {
  render: () => <TermsPlayground />,
};

// Import the interaction hook and help components
import {
  useInteractionPhase,
  computePrefixSums,
} from "./hooks/useInteractionPhase";
import { HelpAbacus } from "./HelpAbacus";
import type { GeneratedProblem } from "@/db/schema/session-plans";

/**
 * Interactive playground to test any sequence of terms WITH full help detection
 */
function TermsPlayground() {
  const [termsInput, setTermsInput] = useState("100, -37, -25");
  const [problemKey, setProblemKey] = useState(0); // Force re-init when terms change

  const terms = parseTerms(termsInput);
  const correctAnswer = terms.reduce((sum, t) => sum + t, 0);

  // Create a GeneratedProblem from parsed terms
  const problem: GeneratedProblem | null =
    terms.length > 0
      ? {
          terms,
          answer: correctAnswer,
          skillsRequired: [],
        }
      : null;

  // Use the real interaction phase hook for full help detection
  const interaction = useInteractionPhase({
    initialProblem: problem
      ? {
          problem,
          slotIndex: 0,
          partIndex: 0,
        }
      : undefined,
  });

  // Re-initialize when terms change
  const handleTermsChange = (newInput: string) => {
    setTermsInput(newInput);
    const newTerms = parseTerms(newInput);
    const newAnswer = newTerms.reduce((sum, t) => sum + t, 0);
    if (newTerms.length > 0) {
      interaction.loadProblem(
        { terms: newTerms, answer: newAnswer, skillsRequired: [] },
        0,
        problemKey + 1,
      );
      setProblemKey((k) => k + 1);
    }
  };

  // Calculate prefix sums for display
  const prefixSums = terms.length > 0 ? computePrefixSums(terms) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't capture if we're typing in textarea
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;

    if (interaction.showAsCompleted) return;

    if (/^[0-9]$/.test(e.key)) {
      interaction.handleDigit(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      interaction.handleBackspace();
    } else if (e.key === "Enter" && interaction.canSubmit) {
      interaction.startSubmit();
      // Simulate submit completion
      setTimeout(() => {
        const userNum = parseInt(interaction.attempt?.userAnswer || "", 10);
        const result = userNum === correctAnswer ? "correct" : "incorrect";
        interaction.completeSubmit(result);
      }, 100);
    }
  };

  const handleReset = () => {
    if (terms.length > 0) {
      interaction.loadProblem(
        { terms, answer: correctAnswer, skillsRequired: [] },
        0,
        problemKey + 1,
      );
      setProblemKey((k) => k + 1);
    }
  };

  // Build help overlay if in help mode
  const helpOverlay = interaction.helpContext ? (
    <div className={css({ padding: "0.5rem" })}>
      <HelpAbacus
        currentValue={interaction.helpContext.currentValue}
        targetValue={interaction.helpContext.targetValue}
        columns={Math.max(
          3,
          Math.ceil(Math.log10(Math.max(correctAnswer, 1) + 1)) + 1,
        )}
        scaleFactor={0.8}
        interactive
        onTargetReached={() => {
          interaction.exitHelpMode();
        }}
      />
    </div>
  ) : undefined;

  // Current phase display
  const phaseDisplay = (() => {
    const p = interaction.phase;
    switch (p.phase) {
      case "inputting":
        return "📝 Inputting";
      case "awaitingDisambiguation":
        return "⏳ Awaiting Disambiguation (help prompt showing)";
      case "helpMode":
        return `🆘 Help Mode (term ${interaction.helpContext?.termIndex})`;
      case "submitting":
        return "⏳ Submitting...";
      case "showingFeedback":
        return p.result === "correct" ? "✅ Correct!" : "❌ Incorrect";
      default:
        return p.phase;
    }
  })();

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "2rem",
        maxWidth: "700px",
      })}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Interactive demo needs keyboard focus
      tabIndex={0}
    >
      {/* Terms input */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        })}
      >
        <label
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            color: "gray.700",
          })}
        >
          Enter terms (comma or space separated, use - for negatives):
        </label>
        <textarea
          value={termsInput}
          onChange={(e) => handleTermsChange(e.target.value)}
          placeholder="e.g., 50, -30, 20 or 100 -37 -25"
          className={css({
            padding: "0.75rem",
            borderRadius: "8px",
            border: "2px solid",
            borderColor: "gray.300",
            fontSize: "1rem",
            fontFamily: "monospace",
            minHeight: "60px",
            resize: "vertical",
            _focus: {
              borderColor: "blue.400",
              outline: "none",
            },
          })}
        />
        <div className={css({ fontSize: "0.75rem", color: "gray.500" })}>
          Parsed: [{terms.join(", ")}] = {correctAnswer}
        </div>
      </div>

      {/* Prefix sums info */}
      <div
        className={css({
          padding: "0.75rem",
          backgroundColor: "blue.50",
          borderRadius: "8px",
          fontSize: "0.8125rem",
        })}
      >
        <div
          className={css({
            fontWeight: "bold",
            marginBottom: "0.25rem",
            color: "blue.800",
          })}
        >
          Prefix sums (intermediate values):
        </div>
        <div className={css({ fontFamily: "monospace", color: "blue.700" })}>
          {prefixSums.map((sum, i) => (
            <span key={i}>
              {i > 0 && " → "}
              <span
                className={css({
                  backgroundColor:
                    interaction.ambiguousHelpTermIndex === i + 1
                      ? "yellow.200"
                      : "blue.100",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "4px",
                  border:
                    interaction.ambiguousHelpTermIndex === i + 1
                      ? "2px solid"
                      : "1px solid",
                  borderColor:
                    interaction.ambiguousHelpTermIndex === i + 1
                      ? "yellow.500"
                      : "transparent",
                })}
              >
                {sum}
              </span>
            </span>
          ))}
        </div>
        <div
          className={css({
            marginTop: "0.5rem",
            color: "blue.600",
            fontSize: "0.75rem",
          })}
        >
          Max digits needed:{" "}
          {Math.max(
            ...terms.map((t) => Math.abs(t).toString().length),
            ...prefixSums.map((s) => Math.abs(s).toString().length),
            1,
          )}
        </div>
      </div>

      {/* Phase indicator */}
      <div
        className={css({
          padding: "0.5rem 0.75rem",
          backgroundColor: "gray.100",
          borderRadius: "6px",
          fontSize: "0.75rem",
          fontFamily: "monospace",
        })}
      >
        <strong>Phase:</strong> {phaseDisplay}
        {interaction.attempt && (
          <>
            {" "}
            | <strong>Answer:</strong> "{interaction.attempt.userAnswer}"
          </>
        )}
        {interaction.ambiguousHelpTermIndex >= 0 && (
          <>
            {" "}
            | <strong>Help prompt for term:</strong>{" "}
            {interaction.ambiguousHelpTermIndex}
          </>
        )}
      </div>

      {/* Problem display */}
      {terms.length > 0 && interaction.attempt && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          })}
        >
          <VerticalProblem
            terms={terms}
            userAnswer={interaction.attempt.userAnswer}
            isFocused={interaction.inputIsFocused}
            isCompleted={interaction.showAsCompleted}
            correctAnswer={correctAnswer}
            size="large"
            currentHelpTermIndex={interaction.helpContext?.termIndex}
            needHelpTermIndex={
              interaction.ambiguousHelpTermIndex >= 0
                ? interaction.ambiguousHelpTermIndex
                : undefined
            }
            rejectedDigit={interaction.attempt.rejectedDigit}
            helpOverlay={helpOverlay}
          />

          <div
            className={css({
              fontSize: "0.875rem",
              color: "gray.500",
              textAlign: "center",
            })}
          >
            {interaction.showAsCompleted ? (
              <button
                type="button"
                onClick={handleReset}
                className={css({
                  padding: "0.5rem 1rem",
                  backgroundColor: "blue.500",
                  color: "white",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  _hover: { backgroundColor: "blue.600" },
                })}
              >
                Try Again
              </button>
            ) : (
              <span>
                Type numbers to answer. Enter a prefix sum (e.g.,{" "}
                {prefixSums[0]}) to see help!
              </span>
            )}
          </div>
        </div>
      )}

      {terms.length === 0 && (
        <div
          className={css({
            textAlign: "center",
            color: "gray.400",
            padding: "2rem",
          })}
        >
          Enter some terms above to see the problem
        </div>
      )}

      {/* Instructions */}
      <div
        className={css({
          padding: "1rem",
          backgroundColor: "green.50",
          borderRadius: "8px",
          fontSize: "0.8125rem",
          color: "green.800",
        })}
      >
        <strong>How to test help detection:</strong>
        <ul className={css({ marginTop: "0.5rem", paddingLeft: "1.25rem" })}>
          <li>
            Type a prefix sum value (e.g., "100" for the first term) to trigger
            disambiguation
          </li>
          <li>
            Wait 4 seconds for auto-help, or keep typing to continue to final
            answer
          </li>
          <li>
            Type with leading zero (e.g., "0100" or "063") to{" "}
            <em>immediately</em> request help
          </li>
          <li>The "need help?" prompt appears during ambiguous state</li>
          <li>Help overlay shows the HelpAbacus for the next term to add</li>
        </ul>
      </div>
    </div>
  );
}
