"use client";

import * as Progress from "@radix-ui/react-progress";
import { CheckCircle, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { FlashcardFormState } from "@/app/create/page";
import { css } from "../../styled-system/css";
import { hstack, stack } from "../../styled-system/patterns";

interface GenerationProgressProps {
  config: FlashcardFormState;
}

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "active" | "complete";
}

export function GenerationProgress({ config }: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<ProgressStep[]>([]);

  useEffect(() => {
    // Initialize steps based on config
    const generationSteps: ProgressStep[] = [
      {
        id: "validate",
        label: "Validating Configuration",
        description: "Checking parameters and dependencies",
        icon: <CheckCircle size={20} />,
        status: "pending",
      },
      {
        id: "generate",
        label: "Generating Soroban Patterns",
        description: `Creating ${getEstimatedCardCount(config)} flashcard patterns`,
        icon: <Sparkles size={20} />,
        status: "pending",
      },
      {
        id: "render",
        label: `Rendering ${config.format?.toUpperCase() || "PDF"}`,
        description: "Converting to your chosen format",
        icon: <Zap size={20} />,
        status: "pending",
      },
      {
        id: "finalize",
        label: "Finalizing Download",
        description: "Preparing your flashcards for download",
        icon: <CheckCircle size={20} />,
        status: "pending",
      },
    ];

    setSteps(generationSteps);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = Math.min(prev + Math.random() * 15, 95);

        // Update current step based on progress
        const stepIndex = Math.floor(
          (newProgress / 100) * generationSteps.length,
        );
        setCurrentStep(stepIndex);

        return newProgress;
      });
    }, 500);

    return () => clearInterval(progressInterval);
  }, [config]);

  useEffect(() => {
    // Update step statuses based on current step
    setSteps((prevSteps) =>
      prevSteps.map((step, index) => ({
        ...step,
        status:
          index < currentStep
            ? "complete"
            : index === currentStep
              ? "active"
              : "pending",
      })),
    );
  }, [currentStep]);

  const estimatedTime = getEstimatedTime(config);
  const currentStepData = steps[currentStep];

  return (
    <div className={stack({ gap: "6" })}>
      <div className={stack({ gap: "2" })}>
        <div
          className={hstack({ justify: "space-between", alignItems: "center" })}
        >
          <h3
            className={css({
              fontSize: "xl",
              fontWeight: "bold",
              color: "gray.900",
            })}
          >
            Generating Your Flashcards
          </h3>
          <div
            className={css({
              fontSize: "sm",
              color: "brand.600",
              fontWeight: "medium",
            })}
          >
            ~{estimatedTime} seconds
          </div>
        </div>

        {/* Current Step Indicator */}
        {currentStepData && (
          <div className={hstack({ gap: "3", alignItems: "center", py: "2" })}>
            <div
              className={css({
                color: "brand.600",
                display: "flex",
                alignItems: "center",
              })}
            >
              {currentStepData.icon}
            </div>
            <div className={stack({ gap: "0" })}>
              <div
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "gray.900",
                })}
              >
                {currentStepData.label}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color: "gray.600",
                })}
              >
                {currentStepData.description}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className={stack({ gap: "3" })}>
        <Progress.Root
          value={progress}
          max={100}
          className={css({
            position: "relative",
            overflow: "hidden",
            bg: "gray.200",
            rounded: "full",
            w: "full",
            h: "3",
            transform: "translateZ(0)",
          })}
        >
          <Progress.Indicator
            className={css({
              bg: "gradient-to-r from-brand.500 to-brand.600",
              w: "full",
              h: "full",
              transition: "transform 0.3s cubic-bezier(0.65, 0, 0.35, 1)",
              transformOrigin: "left",
            })}
            style={{ transform: `translateX(-${100 - progress}%)` }}
          />
        </Progress.Root>

        <div className={hstack({ justify: "space-between" })}>
          <span
            className={css({
              fontSize: "sm",
              color: "gray.600",
            })}
          >
            {Math.round(progress)}% complete
          </span>
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
              color: "brand.600",
            })}
          >
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
      </div>

      {/* Steps List */}
      <div className={stack({ gap: "3" })}>
        {steps.map((step, _index) => (
          <div
            key={step.id}
            className={hstack({ gap: "3", alignItems: "center", py: "2" })}
          >
            <div
              className={css({
                w: "8",
                h: "8",
                rounded: "full",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid",
                borderColor:
                  step.status === "complete"
                    ? "green.500"
                    : step.status === "active"
                      ? "brand.500"
                      : "gray.300",
                bg:
                  step.status === "complete"
                    ? "green.50"
                    : step.status === "active"
                      ? "brand.50"
                      : "white",
                color:
                  step.status === "complete"
                    ? "green.600"
                    : step.status === "active"
                      ? "brand.600"
                      : "gray.400",
                transition: "all",
              })}
            >
              {step.status === "complete" ? (
                <CheckCircle size={16} />
              ) : step.status === "active" ? (
                <div
                  className={css({
                    w: "3",
                    h: "3",
                    bg: "brand.600",
                    rounded: "full",
                    animation: "pulse",
                  })}
                />
              ) : (
                <div
                  className={css({
                    w: "2",
                    h: "2",
                    bg: "gray.400",
                    rounded: "full",
                  })}
                />
              )}
            </div>

            <div className={stack({ gap: "0", flex: 1 })}>
              <div
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color:
                    step.status === "complete"
                      ? "green.800"
                      : step.status === "active"
                        ? "gray.900"
                        : "gray.600",
                })}
              >
                {step.label}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color:
                    step.status === "complete"
                      ? "green.600"
                      : step.status === "active"
                        ? "gray.600"
                        : "gray.500",
                })}
              >
                {step.description}
              </div>
            </div>

            {step.status === "complete" && (
              <CheckCircle size={16} className={css({ color: "green.600" })} />
            )}
          </div>
        ))}
      </div>

      {/* Fun Facts */}
      <div
        className={css({
          p: "4",
          bg: "blue.50",
          border: "1px solid",
          borderColor: "blue.200",
          rounded: "xl",
        })}
      >
        <h4
          className={css({
            fontSize: "sm",
            fontWeight: "semibold",
            color: "blue.800",
            mb: "2",
          })}
        >
          💡 Did you know?
        </h4>
        <p
          className={css({
            fontSize: "sm",
            color: "blue.700",
            lineHeight: "relaxed",
          })}
        >
          {getFunFact(config)}
        </p>
      </div>
    </div>
  );
}

// Helper functions
function getEstimatedCardCount(config: FlashcardFormState): number {
  const range = config.range || "0-99"; // Safe default for form state

  if (range.includes("-")) {
    const [start, end] = range.split("-").map((n) => parseInt(n, 10) || 0);
    return Math.floor((end - start + 1) / (config.step || 1));
  }

  if (range.includes(",")) {
    return range.split(",").length;
  }

  return 1;
}

function getEstimatedTime(config: FlashcardFormState): number {
  const cardCount = getEstimatedCardCount(config);
  const baseTime = 3; // Base generation time
  const cardTime = Math.max(cardCount * 0.1, 1);
  const formatMultiplier =
    {
      pdf: 1,
      html: 1.2,
      svg: 1.5,
      png: 2,
    }[config.format || "pdf"] || 1;

  return Math.round((baseTime + cardTime) * formatMultiplier);
}

function getFunFact(_config: FlashcardFormState): string {
  const facts = [
    "The soroban is a Japanese counting tool that dates back over 400 years!",
    "Master soroban users can calculate faster than electronic calculators.",
    "Each bead position on a soroban represents a specific numeric value.",
    'The word "soroban" comes from ancient Chinese "suanpan" (counting board).',
    "Soroban training improves mathematical intuition and mental calculation speed.",
    "Modern soroban competitions feature lightning-fast calculations.",
    "The soroban method strengthens both logical and creative thinking.",
    "Japanese students often learn soroban alongside traditional mathematics.",
  ];

  return facts[Math.floor(Math.random() * facts.length)];
}
