# GPT-5 Vision Prompting Strategy for Worksheet Grading

## Overview

This document describes how we prompt GPT-5 with vision to grade student worksheets and recommend progression steps in a single API call.

## The Core Challenge

**Input**: Photo of a handwritten math worksheet (potentially messy handwriting, varied layouts)
**Output**: Complete grading assessment with exact progression step recommendation

**Why this is hard**:
- Must read handwritten numbers accurately
- Must identify the problems (operands, operators)
- Must detect student's answers (including wrong answers)
- Must analyze error patterns (not just count correct/incorrect)
- Must map performance to exact `ProgressionStep.id` from our progression system
- Must provide actionable feedback for teachers

## Prompting Architecture

### 1. Context Establishment

We provide GPT-5 with **three layers of context**:

#### Layer 1: Role & Mission
```
You are grading an elementary math worksheet to determine the student's
exact position in a mastery progression path.
```

**Purpose**: Sets the AI's role as an educational assessor, not just a grader.

#### Layer 2: The Progression System
```typescript
AVAILABLE PROGRESSION STEPS:
${stepDescriptions}

// Where stepDescriptions is built from:
const stepDescriptions = SINGLE_CARRY_PATH.map(step =>
  `- ${step.id}: ${step.name} - ${step.description}`
).join('\n')

// Example output:
- single-carry-1d-full: 1-Digit Single Carry (Full Scaffolding) - Practice carrying with ones digit, using ten-frames and carry boxes
- single-carry-1d-minimal: 1-Digit Single Carry (Minimal Scaffolding) - Practice carrying with ones digit, minimal visual support
- single-carry-2d-full: 2-Digit Single Carry (Full Scaffolding) - Practice carrying with two-digit problems, using ten-frames and carry boxes
// ... etc
```

**Purpose**:
- Gives AI the complete vocabulary of step IDs
- Explains what each step focuses on
- Shows the progression structure (1-digit → 2-digit → 3-digit, full → minimal)
- Prevents AI from inventing its own step IDs

**Why this works**:
- GPT-5 with thinking can analyze the student's performance
- Reason about which step matches their skill level
- Choose from the provided list (not hallucinate)

#### Layer 3: The Task Breakdown
```
TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers carefully
3. Grade each problem as correct or incorrect
4. Identify specific error patterns (e.g., "forgets to carry in tens place", "misaligns digits")
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice
```

**Purpose**:
- Clear sequential steps
- Emphasizes careful reading of handwriting
- Focuses AI on error patterns (not just score)
- Demands specific step ID (not generic advice)

### 2. Response Format Specification

We use **structured JSON output** with `response_format: { type: 'json_object' }`:

```json
{
  "problems": [
    {
      "index": 0,
      "operandA": 45,
      "operandB": 27,
      "correctAnswer": 72,
      "studentAnswer": 72,
      "isCorrect": true,
      "digitCount": 2,
      "requiresRegrouping": true
    }
    // ... more problems
  ],
  "totalProblems": 20,
  "correctCount": 17,
  "accuracy": 0.85,
  "errorPatterns": ["carry-tens"],
  "currentStepEstimate": "single-carry-2d-minimal",
  "suggestedStepId": "single-carry-2d-full",
  "reasoning": "Student shows good understanding but struggles with carrying in tens place. Recommend full scaffolding.",
  "feedback": "Great work! You got 17/20 correct. Let's practice with visual helpers."
}
```

**Why JSON?**
- Structured, parseable output
- No regex parsing needed
- Clear field definitions
- Easy to validate

**Key fields explained**:

**`problems[]`** - Per-problem breakdown:
- `operandA`, `operandB` - The numbers in the problem (AI reads from image)
- `correctAnswer` - What the answer should be (AI calculates)
- `studentAnswer` - What the student wrote (AI reads from image)
- `isCorrect` - Boolean comparison
- `digitCount`, `requiresRegrouping` - Problem characteristics for analysis

**`errorPatterns[]`** - Specific mistake types:
- Examples: `"carry-tens"`, `"borrow-hundreds"`, `"digit-alignment"`
- Not generic errors - specific to math operations
- Used to inform progression recommendation

**`currentStepEstimate`** - AI's assessment of where student is now

**`suggestedStepId`** - **CRITICAL FIELD** - The exact next step:
- Must be a valid step ID from the progression path
- This drives the mastery feedback loop
- Validated after API response

**`reasoning`** - AI's explanation of its recommendation

**`feedback`** - Encouraging message for student

### 3. Constraint Enforcement

```
CRITICAL: suggestedStepId MUST be one of:
${SINGLE_CARRY_PATH.map(s => s.id).join(', ')}
```

**Purpose**:
- Prevents hallucination
- Forces AI to choose from valid steps
- Shows AI the complete list at the end (reinforcement)

Example:
```
CRITICAL: suggestedStepId MUST be one of:
single-carry-1d-full, single-carry-1d-minimal, single-carry-2d-full,
single-carry-2d-minimal, single-carry-3d-full, single-carry-3d-minimal
```

## API Call Configuration

**IMPORTANT**: Use the **Responses API** (not Chat Completions API) for GPT-5:

```typescript
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-5-2025-08-07',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            image_url: dataUrl,  // base64 data URL or https URL
            detail: 'high'       // HIGH DETAIL for handwriting
          },
          {
            type: 'input_text',
            text: prompt         // The prompt with progression context
          }
        ]
      }
    ],
    reasoning: { effort: 'high' },      // Deep thinking for analysis
    verbosity: 'medium',           // Balanced output length
    max_output_tokens: 4000,       // Enough for 20 problems + analysis
    text: {
      format: {
        type: 'json_schema',
        name: 'worksheet_grading',
        schema: gradingSchema,     // Strict JSON schema (see below)
        strict: true               // Enforce schema strictly
      }
    }
  })
})

const result = await response.json()
```

**Key parameters**:

**`detail: 'high'`**
- Enables high-resolution image analysis
- Critical for reading handwritten numbers
- More expensive but necessary for accuracy

**`reasoning: { effort: 'high' }`**
- Activates GPT-5's thinking mode
- AI reasons through error patterns
- Better at comparing student work to progression steps
- Worth the extra cost for accuracy

**`verbosity: 'medium'`**
- Balanced output length
- Not too terse, not too verbose
- Good for feedback and reasoning fields

**`response_format: { type: 'json_object' }`**
- Guarantees valid JSON response
- No need for regex extraction
- Can directly `JSON.parse()`

## JSON Schema Definition

Define strict schema for GPT-5 to enforce:

```typescript
const gradingSchema = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          operandA: { type: 'integer' },
          operandB: { type: 'integer' },
          correctAnswer: { type: 'integer' },
          studentAnswer: { type: ['integer', 'null'] },
          isCorrect: { type: 'boolean' },
          digitCount: { type: 'integer' },
          requiresRegrouping: { type: 'boolean' }
        },
        required: ['index', 'operandA', 'operandB', 'correctAnswer', 'studentAnswer', 'isCorrect', 'digitCount', 'requiresRegrouping'],
        additionalProperties: false
      }
    },
    totalProblems: { type: 'integer' },
    correctCount: { type: 'integer' },
    accuracy: { type: 'number' },
    errorPatterns: {
      type: 'array',
      items: { type: 'string' }
    },
    currentStepEstimate: { type: 'string' },
    suggestedStepId: { type: 'string' },
    reasoning: { type: 'string' },
    feedback: { type: 'string' }
  },
  required: ['problems', 'totalProblems', 'correctCount', 'accuracy', 'errorPatterns', 'suggestedStepId', 'reasoning', 'feedback'],
  additionalProperties: false
}
```

**Why strict schema?**
- GPT-5 with `strict: true` guarantees valid JSON
- No missing fields
- Correct types (integer vs string)
- No extra fields

## Response Parsing & Validation with Retry Logic

### Step 1: Parse API Response

```typescript
const apiResponse = await response.json()

// Check for API errors
if (apiResponse.error) {
  throw new Error(`OpenAI API error: ${apiResponse.error.message}`)
}

// Extract the grading result
const result = apiResponse.output[0].content[0].text
```

**Note**: Responses API returns `output[0].content[0].text` (already parsed JSON due to schema)

### Step 2: Validate Step ID with Retry

```typescript
async function gradeWorksheetWithRetry(
  imagePath: string,
  maxRetries = 2
): Promise<GradingResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await gradeWorksheet(imagePath)

      // Validate step ID
      const validStep = SINGLE_CARRY_PATH.find(
        s => s.id === result.suggestedStepId
      )

      if (!validStep) {
        // Invalid step ID - surface to LLM for retry
        const validationError = {
          field: 'suggestedStepId',
          value: result.suggestedStepId,
          error: `Invalid step ID. Must be one of: ${SINGLE_CARRY_PATH.map(s => s.id).join(', ')}`,
          validOptions: SINGLE_CARRY_PATH.map(s => s.id)
        }

        if (attempt < maxRetries) {
          console.warn(`Retry ${attempt + 1}: Invalid step ID "${result.suggestedStepId}"`)
          // Retry with validation error in prompt
          return await gradeWorksheetWithValidationFeedback(
            imagePath,
            validationError,
            maxRetries - attempt - 1
          )
        } else {
          // Out of retries, use fallback
          console.error(`All retries exhausted. Defaulting to first step.`)
          result.suggestedStepId = SINGLE_CARRY_PATH[0].id
          return result
        }
      }

      // Validate problem count makes sense
      if (result.totalProblems !== result.problems.length) {
        const validationError = {
          field: 'totalProblems',
          error: `totalProblems (${result.totalProblems}) doesn't match problems array length (${result.problems.length})`,
          expected: result.problems.length
        }

        if (attempt < maxRetries) {
          console.warn(`Retry ${attempt + 1}: Problem count mismatch`)
          return await gradeWorksheetWithValidationFeedback(
            imagePath,
            validationError,
            maxRetries - attempt - 1
          )
        } else {
          // Fix it ourselves
          result.totalProblems = result.problems.length
        }
      }

      // Validate accuracy calculation
      const expectedAccuracy = result.correctCount / result.totalProblems
      if (Math.abs(result.accuracy - expectedAccuracy) > 0.01) {
        const validationError = {
          field: 'accuracy',
          error: `Accuracy ${result.accuracy} doesn't match correctCount/totalProblems = ${expectedAccuracy}`,
          expected: expectedAccuracy
        }

        if (attempt < maxRetries) {
          console.warn(`Retry ${attempt + 1}: Accuracy calculation error`)
          return await gradeWorksheetWithValidationFeedback(
            imagePath,
            validationError,
            maxRetries - attempt - 1
          )
        } else {
          // Fix it ourselves
          result.accuracy = expectedAccuracy
        }
      }

      // All validations passed
      return result

    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}: ${error.message}`)
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError || new Error('Grading failed after all retries')
}
```

**Validation errors we catch**:
1. **Invalid step ID** - Not in `SINGLE_CARRY_PATH`
2. **Problem count mismatch** - `totalProblems` doesn't match array length
3. **Accuracy calculation error** - Math doesn't add up
4. **API errors** - Network failures, rate limits

**Retry strategy**:
- Surface validation error back to LLM
- Give LLM chance to correct itself
- Max 2 retries
- Exponential backoff for network errors
- Fallback to safe defaults if all retries fail

### Retry with Validation Feedback

When validation fails, we include the error in a retry request to the LLM:

```typescript
async function gradeWorksheetWithValidationFeedback(
  imagePath: string,
  validationError: any,
  retriesLeft: number
): Promise<GradingResult> {
  const imageBuffer = await readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const dataUrl = `data:${mimeType};base64,${base64Image}`

  // Build context about progression steps
  const stepDescriptions = SINGLE_CARRY_PATH.map(step =>
    `- ${step.id}: ${step.name} - ${step.description}`
  ).join('\n')

  // Original prompt + validation feedback
  const prompt = `You are grading an elementary math worksheet to determine the student's exact position in a mastery progression path.

AVAILABLE PROGRESSION STEPS:
${stepDescriptions}

PREVIOUS ATTEMPT HAD VALIDATION ERROR:
Field: ${validationError.field}
Error: ${validationError.error}
${validationError.validOptions ? `Valid options: ${validationError.validOptions.join(', ')}` : ''}
${validationError.expected !== undefined ? `Expected value: ${validationError.expected}` : ''}

Please correct this error and try again.

TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers carefully
3. Grade each problem as correct or incorrect
4. Identify specific error patterns
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice

Return JSON matching the schema exactly.

CRITICAL: suggestedStepId MUST be one of: ${SINGLE_CARRY_PATH.map(s => s.id).join(', ')}`

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: dataUrl,
              detail: 'high'
            },
            {
              type: 'input_text',
              text: prompt
            }
          ]
        }
      ],
      reasoning: { effort: 'high' },
      verbosity: 'medium',
      max_output_tokens: 4000,
      text: {
        format: {
          type: 'json_schema',
          name: 'worksheet_grading',
          schema: gradingSchema,
          strict: true
        }
      }
    })
  })

  const apiResponse = await response.json()

  if (apiResponse.error) {
    throw new Error(`OpenAI API error: ${apiResponse.error.message}`)
  }

  return apiResponse.output[0].content[0].text
}
```

**How this works**:
1. First attempt fails validation (e.g., invalid step ID)
2. We call LLM again with **same image** + **validation error details**
3. Prompt explicitly says: "PREVIOUS ATTEMPT HAD VALIDATION ERROR"
4. Shows exactly what went wrong and what's valid
5. LLM can correct its mistake
6. If retry also fails, we fallback to safe defaults

**Example validation feedback**:
```
PREVIOUS ATTEMPT HAD VALIDATION ERROR:
Field: suggestedStepId
Error: Invalid step ID. Must be one of: single-carry-1d-full, single-carry-1d-minimal, ...
Valid options: single-carry-1d-full, single-carry-1d-minimal, single-carry-2d-full, ...
```

### Step 3: Store in Database

```typescript
// Store individual problems
for (const problem of result.problems) {
  await db.insert(problemAttempts).values({
    id: randomUUID(),
    attemptId,
    userId: attempt.userId,
    problemIndex: problem.index,
    operandA: problem.operandA,
    operandB: problem.operandB,
    correctAnswer: problem.correctAnswer,
    studentAnswer: problem.studentAnswer,
    isCorrect: problem.isCorrect,
    digitCount: problem.digitCount,
    requiresRegrouping: problem.requiresRegrouping,
    // ...
  })
}

// Store aggregate results
await db.update(worksheetAttempts).set({
  gradingStatus: 'completed',
  totalProblems: result.totalProblems,
  correctCount: result.correctCount,
  accuracy: result.accuracy,
  errorPatterns: JSON.stringify(result.errorPatterns),
  suggestedStepId: result.suggestedStepId,  // ← THE KEY FIELD
  aiFeedback: result.feedback,
  aiResponseRaw: JSON.stringify(result),
  gradedAt: new Date(),
})
```

## Why This Prompting Strategy Works

### 1. **Context-Rich Prompting**
- AI knows its role (educational assessor)
- AI has the progression vocabulary
- AI understands the mastery path structure

### 2. **Structured Output**
- JSON prevents parsing errors
- Clear field definitions
- Easy validation

### 3. **Constraint Enforcement**
- Step IDs provided upfront
- Repeated at the end
- Validated after response

### 4. **High-Fidelity Vision**
- `detail: 'high'` for handwriting
- `reasoning: { effort: 'high' }` for analysis
- Worth the cost for accuracy

### 5. **Error Pattern Focus**
- Not just "16/20 correct"
- Identifies specific mistakes
- Informs progression recommendation

## Example Prompt Flow

**Input**: Photo of worksheet with 20 problems, student got 17/20 correct

**GPT-5 sees**:
1. Role: "You are grading to determine progression position"
2. Progression steps: List of 6 step IDs with descriptions
3. Task: 6-step analysis process
4. Image: Worksheet with handwriting
5. Format: Exact JSON structure expected
6. Constraint: Step ID must be from the list

**GPT-5 thinks** (reasoning mode):
- Reads each problem: "45 + 27"
- Reads student answer: "72"
- Checks: 45 + 27 = 72 ✓
- Problem 7: "68 + 45", student wrote "103" → Wrong! Should be 113
- Pattern: Student forgot to carry the 1 from ones to tens
- More wrong answers also show carrying errors
- Conclusion: Student needs 2-digit carrying practice with scaffolding

**GPT-5 outputs**:
```json
{
  "suggestedStepId": "single-carry-2d-full",
  "reasoning": "Student shows mastery of 1-digit problems but struggles with carrying in tens place on 2-digit problems. Recommend returning to full scaffolding.",
  "errorPatterns": ["carry-tens"],
  // ... complete JSON
}
```

**We validate**:
- Check `suggestedStepId` exists in `SINGLE_CARRY_PATH` ✓
- Store results in database
- Update mastery profile
- Teacher sees: "Recommend: single-carry-2d-full"

## Potential Improvements

### 1. **Few-Shot Examples**
Add example worksheet analyses to prompt:
```
EXAMPLE 1:
Worksheet with problems: [examples]
Student answers: [examples]
Correct assessment: {
  "suggestedStepId": "single-carry-2d-full",
  "reasoning": "..."
}
```

**Benefit**: Shows AI the desired analysis style

### 2. **Confidence Scores**
Request AI to include confidence per problem:
```json
{
  "studentAnswer": 72,
  "confidence": 0.95  // How sure AI is about reading "72"
}
```

**Benefit**: Flag uncertain readings for manual review

### 3. **OCR Verification Mode**
For low-confidence readings, ask AI to describe what it sees:
```json
{
  "studentAnswer": null,
  "ocrNote": "Handwriting unclear, appears to be '72' or '77'"
}
```

**Benefit**: Teacher can manually correct ambiguous cases

### 4. **Contextual Step Recommendation**
Include recent mastery history:
```
STUDENT'S RECENT HISTORY:
- Previously mastered: single-carry-1d-minimal (3 attempts, 92% accuracy)
- Currently practicing: single-carry-2d-full (2 attempts, 78% accuracy)
```

**Benefit**: AI makes more informed progression decisions

### 5. **Multi-Turn Reasoning**
For complex error patterns, use chain-of-thought:
```
First, analyze each problem...
Then, identify error patterns...
Finally, recommend progression step...
```

**Benefit**: More accurate analysis for borderline cases

## Cost Analysis

### Per Worksheet Estimate

**Typical worksheet**:
- Image: ~1920×1080 pixels (~1000 input tokens)
- Prompt text: ~500 input tokens
- JSON response: ~500 output tokens

**GPT-5 pricing** (estimated):
- Input: $0.015 per 1K tokens
- Output: $0.060 per 1K tokens

**Cost per worksheet**:
- Input: 1500 tokens × $0.015 = $0.0225
- Output: 500 tokens × $0.060 = $0.0300
- **Total**: ~$0.05 per worksheet

**With reasoning: { effort: 'high' }**:
- May increase output tokens by 2-3x
- **Total**: ~$0.10-0.15 per worksheet

**For 1,000 worksheets**: ~$50-150/month

**Trade-off**: Higher cost, but eliminates:
- OCR service costs
- Claude grading costs
- OCR error corrections
- Information loss between models

## Summary

**Prompting strategy**:
1. Establish role & progression context
2. Provide step-by-step task breakdown
3. Show exact JSON structure expected
4. Constrain step ID to valid values
5. Use high-detail vision mode
6. Enable deep reasoning
7. Parse JSON response
8. Validate step ID
9. Store results

**Key insight**: The prompt is doing triple duty:
- OCR (reading handwriting)
- Grading (checking correctness)
- Assessment (recommending progression)

All in one API call, with GPT-5's thinking mode ensuring deep analysis.
