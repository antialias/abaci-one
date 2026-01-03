import { readFile } from "fs/promises";
import { SINGLE_CARRY_PATH } from "@/app/create/worksheets/progressionPath";

/**
 * Grading result structure returned by GPT-5
 */
export interface GradingResult {
  problems: Array<{
    index: number;
    operandA: number;
    operandB: number;
    correctAnswer: number;
    studentAnswer: number | null;
    isCorrect: boolean;
    digitCount: number;
    requiresRegrouping: boolean;
  }>;
  totalProblems: number;
  correctCount: number;
  accuracy: number;
  errorPatterns: string[];
  currentStepEstimate: string;
  suggestedStepId: string;
  reasoning: string;
  feedback: string;
}

/**
 * Validation error structure for retry prompts
 */
interface ValidationError {
  field: string;
  value?: any;
  error: string;
  validOptions?: string[];
  expected?: any;
}

/**
 * JSON schema for GPT-5 strict mode
 */
const gradingSchema = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          operandA: { type: "integer" },
          operandB: { type: "integer" },
          correctAnswer: { type: "integer" },
          studentAnswer: { type: ["integer", "null"] },
          isCorrect: { type: "boolean" },
          digitCount: { type: "integer" },
          requiresRegrouping: { type: "boolean" },
        },
        required: [
          "index",
          "operandA",
          "operandB",
          "correctAnswer",
          "studentAnswer",
          "isCorrect",
          "digitCount",
          "requiresRegrouping",
        ],
        additionalProperties: false,
      },
    },
    totalProblems: { type: "integer" },
    correctCount: { type: "integer" },
    accuracy: { type: "number" },
    errorPatterns: {
      type: "array",
      items: { type: "string" },
    },
    currentStepEstimate: { type: "string" },
    suggestedStepId: { type: "string" },
    reasoning: { type: "string" },
    feedback: { type: "string" },
  },
  required: [
    "problems",
    "totalProblems",
    "correctCount",
    "accuracy",
    "errorPatterns",
    "currentStepEstimate",
    "suggestedStepId",
    "reasoning",
    "feedback",
  ],
  additionalProperties: false,
};

/**
 * Build the grading prompt with progression context
 */
function buildGradingPrompt(validationError?: ValidationError): string {
  const stepDescriptions = SINGLE_CARRY_PATH.map(
    (step) => `- ${step.id}: ${step.name} - ${step.description}`,
  ).join("\n");

  const validStepIds = SINGLE_CARRY_PATH.map((s) => s.id).join(", ");

  let prompt = `You are grading an elementary math worksheet to determine the student's exact position in a mastery progression path.

AVAILABLE PROGRESSION STEPS:
${stepDescriptions}
`;

  // Add validation error feedback if this is a retry
  if (validationError) {
    prompt += `

PREVIOUS ATTEMPT HAD VALIDATION ERROR:
Field: ${validationError.field}
Error: ${validationError.error}
${validationError.validOptions ? `Valid options: ${validationError.validOptions.join(", ")}` : ""}
${validationError.expected !== undefined ? `Expected value: ${validationError.expected}` : ""}

Please correct this error and try again.
`;
  }

  prompt += `

TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers carefully
3. Grade each problem as correct or incorrect
4. Identify specific error patterns (e.g., "forgets to carry in tens place", "misaligns digits")
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice

Return JSON matching the schema exactly.

CRITICAL: suggestedStepId MUST be one of: ${validStepIds}`;

  return prompt;
}

/**
 * Call GPT-5 Responses API with vision
 */
async function callGPT5Vision(
  imageDataUrl: string,
  prompt: string,
): Promise<GradingResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-2025-08-07",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high", // High detail for handwriting recognition
            },
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      reasoning: {
        effort: "high", // Use deep thinking for analysis
      },
      max_output_tokens: 4000, // Enough for 20 problems + analysis
      text: {
        verbosity: "medium", // Balanced output
        format: {
          type: "json_schema",
          name: "worksheet_grading",
          schema: gradingSchema,
          strict: true, // Enforce schema strictly
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const apiResponse = await response.json();

  // Check for API errors
  if (apiResponse.error) {
    throw new Error(`OpenAI API error: ${apiResponse.error.message}`);
  }

  // Extract the grading result (already parsed JSON due to schema)
  return apiResponse.output[0].content[0].text as GradingResult;
}

/**
 * Validate grading result and return errors if any
 */
function validateGradingResult(result: GradingResult): ValidationError | null {
  // Validate step ID
  const validStep = SINGLE_CARRY_PATH.find(
    (s) => s.id === result.suggestedStepId,
  );
  if (!validStep) {
    return {
      field: "suggestedStepId",
      value: result.suggestedStepId,
      error: `Invalid step ID. Must be one of the provided progression steps.`,
      validOptions: SINGLE_CARRY_PATH.map((s) => s.id),
    };
  }

  // Validate problem count
  if (result.totalProblems !== result.problems.length) {
    return {
      field: "totalProblems",
      error: `totalProblems (${result.totalProblems}) doesn't match problems array length (${result.problems.length})`,
      expected: result.problems.length,
    };
  }

  // Validate accuracy calculation
  const expectedAccuracy = result.correctCount / result.totalProblems;
  if (Math.abs(result.accuracy - expectedAccuracy) > 0.01) {
    return {
      field: "accuracy",
      error: `Accuracy ${result.accuracy} doesn't match correctCount/totalProblems = ${expectedAccuracy}`,
      expected: expectedAccuracy,
    };
  }

  return null;
}

/**
 * Grade worksheet with GPT-5 vision and retry logic
 *
 * @param imagePath - Path to worksheet image file
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Complete grading assessment with progression recommendation
 */
export async function gradeWorksheetWithVision(
  imagePath: string,
  maxRetries = 2,
): Promise<GradingResult> {
  // Read and encode image
  const imageBuffer = await readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  let lastError: Error | null = null;
  let validationError: ValidationError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build prompt (includes validation error if retry)
      const prompt = buildGradingPrompt(validationError);

      // Call GPT-5
      const result = await callGPT5Vision(dataUrl, prompt);

      // Validate result
      const error = validateGradingResult(result);

      if (error) {
        if (attempt < maxRetries) {
          // Retry with validation error
          console.warn(
            `Retry ${attempt + 1}: Validation error in ${error.field} - ${error.error}`,
          );
          validationError = error;
          continue;
        }

        // Out of retries, apply fallback fixes
        console.error(`All retries exhausted. Applying fallback fixes.`);

        if (error.field === "suggestedStepId") {
          result.suggestedStepId = SINGLE_CARRY_PATH[0].id;
        } else if (error.field === "totalProblems") {
          result.totalProblems = result.problems.length;
        } else if (error.field === "accuracy") {
          result.accuracy = result.correctCount / result.totalProblems;
        }

        return result;
      }

      // All validations passed
      return result;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}: ${lastError.message}`);
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
      }
    }
  }

  throw lastError || new Error("Grading failed after all retries");
}
