/**
 * Prompt Builder for Worksheet Parsing
 *
 * Constructs the prompt used to parse abacus workbook pages.
 * The prompt provides context about worksheet formats and
 * guides the LLM on how to extract problem data.
 */

/**
 * Options for customizing the parsing prompt
 */
export interface PromptOptions {
  /** Additional context from a previous parse attempt (for re-parsing) */
  additionalContext?: string;
  /** Specific problem numbers to focus on (for re-parsing) */
  focusProblemNumbers?: number[];
  /** Hint about expected format if known */
  expectedFormat?: "vertical" | "linear" | "mixed";
  /** Expected number of problems (if known from worksheet metadata) */
  expectedProblemCount?: number;
}

/**
 * Build the main worksheet parsing prompt
 *
 * This prompt is designed to guide the LLM in extracting
 * structured data from abacus workbook page images.
 */
export function buildWorksheetParsingPrompt(
  options: PromptOptions = {},
): string {
  const parts: string[] = [];

  // Main task description with strong anti-sycophancy framing
  parts.push(`You are a precise OCR system analyzing an image of an abacus workbook page. Your task is pure TRANSCRIPTION - you must extract exactly what is printed and written on the page, with no interpretation or correction.

## CRITICAL: Transcription Rules

**YOU ARE A TRANSCRIBER, NOT AN EVALUATOR.**

1. **Read the PRINTED problem terms FIRST** - these are typeset/printed numbers, completely independent of any handwriting
2. **Read the HANDWRITTEN student answer SEPARATELY** - this is in the answer box, written by a child
3. **NEVER let the student's answer influence how you read the printed terms**
4. **Students make mistakes - that is EXPECTED and VALUABLE data**

⚠️ **ANTI-SYCOPHANCY WARNING**: Do NOT reverse-engineer problem terms from student answers. If a student wrote "42" but the printed problem is "35 + 12 = ___" (correct answer 47), you MUST report:
- terms: [35, 12]
- correctAnswer: 47
- studentAnswer: 42

The student got it WRONG. Report the mistake. We NEED this data to help them improve.

## Worksheet Context

This is a Japanese soroban (abacus) practice worksheet. These worksheets typically contain:
- 1-4 rows of problems
- 8-10 problems per row (32-40 problems on a full page)
- Each problem has 2-7 terms (numbers to add or subtract)
- Problems are either VERTICAL format (stacked columns) or LINEAR format (horizontal equations)

## Problem Format Recognition

**VERTICAL FORMAT:**
Problems are arranged in columns with numbers stacked vertically. Addition is implied between numbers. Subtraction is indicated by a minus sign. The answer box is at the bottom.

⚠️ **CRITICAL: MINUS SIGN DETECTION** ⚠️

Minus signs in vertical problems are SMALL but EXTREMELY IMPORTANT. Missing a minus sign completely changes the answer!

**How minus signs appear:**
- A small horizontal dash/line to the LEFT of a number
- May appear as: − (minus), - (hyphen), or a short horizontal stroke
- Often smaller than you expect - look carefully!
- Sometimes positioned slightly above or below the number's vertical center

**Examples:**

ADDITION problem (NO minus signs):
    45
    17      ← no symbol = add this number
     8      ← no symbol = add this number
  ----
  [70]     terms = [45, 17, 8], correctAnswer = 70

SUBTRACTION problem (HAS minus sign):
    45
   -17      ← small minus sign before 17 = SUBTRACT
     8
  ----
  [36]     terms = [45, -17, 8], correctAnswer = 36

CRITICAL DIFFERENCE: The ONLY visual difference is that tiny minus sign, but:
- Without minus: 45 + 17 + 8 = 70
- With minus: 45 - 17 + 8 = 36

**You MUST look carefully at the LEFT side of each number for minus signs!**

If student wrote "36": terms = [45, -17, 8], correctAnswer = 36, studentAnswer = 36 ✓
If student wrote "38": terms = [45, -17, 8], correctAnswer = 36, studentAnswer = 38 ✗ (WRONG - report it!)
If student wrote nothing: terms = [45, -17, 8], correctAnswer = 36, studentAnswer = null

**LINEAR FORMAT:**
Problems are written as horizontal equations with operators between numbers.

Example: 45 - 17 + 8 = [___]

Same rules apply - read printed terms independently from handwritten answer.

## Student Answer Reading

- Look carefully at the answer boxes/spaces for student handwriting
- Student handwriting may be messy - try to interpret digits carefully
- If an answer is empty, set studentAnswer to null
- If you cannot confidently read the answer, set studentAnswer to null and lower studentAnswerConfidence
- Common handwriting confusions to watch for:
  - 1 vs 7 (some students cross their 7s)
  - 4 vs 9
  - 5 vs 6
  - 0 vs 6

**REMEMBER**: A student getting a problem wrong is NORMAL and EXPECTED. Do not "help" them by changing the problem terms.

## Bounding Boxes

Provide bounding boxes in normalized coordinates where (0,0) is the TOP-LEFT corner of the image and (1,1) is the BOTTOM-RIGHT corner.

- x: distance from LEFT edge (0.0 = left edge, 0.5 = middle, 1.0 = right edge)
- y: distance from TOP edge (0.0 = top edge, 0.5 = middle, 1.0 = bottom edge)
- width: horizontal size as fraction of image width
- height: vertical size as fraction of image height

**Example coordinates for a 4x8 grid of problems:**
- Top-left problem (#1): x ≈ 0.02-0.10, y ≈ 0.05-0.15
- Top-right problem (#8): x ≈ 0.85-0.95, y ≈ 0.05-0.15
- Bottom-left problem (#25): x ≈ 0.02-0.10, y ≈ 0.75-0.85
- Bottom-right problem (#32): x ≈ 0.85-0.95, y ≈ 0.75-0.85

The problemBoundingBox should encompass the entire problem including all terms and the answer area.
The answerBoundingBox should tightly surround just the answer box/area.

**Be precise with coordinates** - they are used to highlight problems in the UI for human review.`);

  // Add expected format hint if provided
  if (options.expectedFormat) {
    parts.push(`

## Format Hint
The problems on this page are expected to be in ${options.expectedFormat.toUpperCase()} format.`);
  }

  // Add expected count if provided
  if (options.expectedProblemCount) {
    parts.push(`

## Expected Problem Count
This worksheet should contain approximately ${options.expectedProblemCount} problems. If you detect significantly more or fewer, double-check for missed or duplicate problems.`);
  }

  // Add focus problems for re-parsing
  if (options.focusProblemNumbers && options.focusProblemNumbers.length > 0) {
    parts.push(`

## Focus Problems
Pay special attention to problems: ${options.focusProblemNumbers.join(", ")}. The previous parsing attempt had issues with these problems.`);
  }

  // Add additional context from user
  if (options.additionalContext) {
    parts.push(`

## Additional Context from User
${options.additionalContext}`);
  }

  // Final instructions
  parts.push(`

## Important Notes

1. **Reading Order**: Extract problems in reading order (left to right, top to bottom)
2. **Problem Numbers**: Use the printed problem numbers on the worksheet (1, 2, 3, etc.)
3. **Term Signs**: First term is always positive. Subsequent terms are positive for addition, negative for subtraction
4. **⚠️ MINUS SIGNS**: Look VERY carefully for small minus signs to the left of numbers - they are small but critical!
5. **Confidence Scores**: Be honest about confidence - lower scores help identify problems needing review
6. **Warnings**: Include any issues you notice (cropped problems, smudges, unclear digits)
7. **needsReview**: Set to true if any problem has confidence below 0.7 or significant warnings

Now analyze the worksheet image and extract all problems.`);

  return parts.join("");
}

/**
 * Build a prompt for re-parsing specific problems with additional context
 */
export function buildReparsePrompt(
  problemNumbers: number[],
  additionalContext: string,
  originalWarnings: string[],
): string {
  return buildWorksheetParsingPrompt({
    focusProblemNumbers: problemNumbers,
    additionalContext: `${additionalContext}

Previous warnings for these problems:
${originalWarnings.map((w) => `- ${w}`).join("\n")}`,
  });
}
