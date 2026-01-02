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
  additionalContext?: string
  /** Specific problem numbers to focus on (for re-parsing) */
  focusProblemNumbers?: number[]
  /** Hint about expected format if known */
  expectedFormat?: 'vertical' | 'linear' | 'mixed'
  /** Expected number of problems (if known from worksheet metadata) */
  expectedProblemCount?: number
}

/**
 * Build the main worksheet parsing prompt
 *
 * This prompt is designed to guide the LLM in extracting
 * structured data from abacus workbook page images.
 */
export function buildWorksheetParsingPrompt(options: PromptOptions = {}): string {
  const parts: string[] = []

  // Main task description
  parts.push(`You are analyzing an image of an abacus workbook page. Your task is to extract all arithmetic problems from the page along with any student answers written in the answer boxes.

## Worksheet Context

This is a Japanese soroban (abacus) practice worksheet. These worksheets typically contain:
- 1-4 rows of problems
- 8-10 problems per row (32-40 problems on a full page)
- Each problem has 2-7 terms (numbers to add or subtract)
- Problems are either VERTICAL format (stacked columns) or LINEAR format (horizontal equations)

## Problem Format Recognition

**VERTICAL FORMAT:**
Problems are arranged in columns with numbers stacked vertically. Addition is implied between numbers. Subtraction is indicated by a minus sign or horizontal line. The answer box is at the bottom.

Example:
    45
   -17
   + 8
  ----
  [36]  ← answer box

In this case: terms = [45, -17, 8], correctAnswer = 36

**LINEAR FORMAT:**
Problems are written as horizontal equations with operators between numbers.

Example: 45 - 17 + 8 = [36]

In this case: terms = [45, -17, 8], correctAnswer = 36

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

## Bounding Boxes

For each problem, provide bounding boxes in normalized coordinates (0-1):
- x, y: top-left corner as fraction of image dimensions
- width, height: size as fraction of image dimensions

The problemBoundingBox should encompass the entire problem including terms and answer area.
The answerBoundingBox should tightly surround just the answer area.`)

  // Add expected format hint if provided
  if (options.expectedFormat) {
    parts.push(`

## Format Hint
The problems on this page are expected to be in ${options.expectedFormat.toUpperCase()} format.`)
  }

  // Add expected count if provided
  if (options.expectedProblemCount) {
    parts.push(`

## Expected Problem Count
This worksheet should contain approximately ${options.expectedProblemCount} problems. If you detect significantly more or fewer, double-check for missed or duplicate problems.`)
  }

  // Add focus problems for re-parsing
  if (options.focusProblemNumbers && options.focusProblemNumbers.length > 0) {
    parts.push(`

## Focus Problems
Pay special attention to problems: ${options.focusProblemNumbers.join(', ')}. The previous parsing attempt had issues with these problems.`)
  }

  // Add additional context from user
  if (options.additionalContext) {
    parts.push(`

## Additional Context from User
${options.additionalContext}`)
  }

  // Final instructions
  parts.push(`

## Important Notes

1. **Reading Order**: Extract problems in reading order (left to right, top to bottom)
2. **Problem Numbers**: Use the printed problem numbers on the worksheet (1, 2, 3, etc.)
3. **Term Signs**: First term is always positive. Subsequent terms are positive for addition, negative for subtraction
4. **Confidence Scores**: Be honest about confidence - lower scores help identify problems needing review
5. **Warnings**: Include any issues you notice (cropped problems, smudges, unclear digits)
6. **needsReview**: Set to true if any problem has confidence below 0.7 or significant warnings

Now analyze the worksheet image and extract all problems.`)

  return parts.join('')
}

/**
 * Build a prompt for re-parsing specific problems with additional context
 */
export function buildReparsePrompt(
  problemNumbers: number[],
  additionalContext: string,
  originalWarnings: string[]
): string {
  return buildWorksheetParsingPrompt({
    focusProblemNumbers: problemNumbers,
    additionalContext: `${additionalContext}

Previous warnings for these problems:
${originalWarnings.map((w) => `- ${w}`).join('\n')}`,
  })
}
