# AI-Powered Mastery Assessment System

## Primary Goal: Close the Mastery Progression Feedback Loop

**See also**:
- [UX_EXECUTIVE_SUMMARY.md](./UX_EXECUTIVE_SUMMARY.md) - **START HERE** - Executive overview of UX/UI
- [UX_UI_PLAN.md](./UX_UI_PLAN.md) - Complete user experience and interface design
- [PROMPTING_STRATEGY.md](./PROMPTING_STRATEGY.md) - Detailed explanation of how we prompt GPT-5 with vision

**The core objective is to enable AI to determine a student's exact position along the mastery progression path** and recommend the precise next step. This creates a complete feedback loop:

1. Student practices on paper worksheet (authentic practice)
2. Teacher uploads photo of completed work
3. AI analyzes performance and maps to specific progression steps
4. System updates mastery profile and suggests next step
5. Teacher generates targeted worksheet for next step
6. **Loop repeats** - each upload refines the student's progression path position

This transforms paper worksheets from static practice into an **adaptive learning system** where AI continuously calibrates difficulty based on demonstrated mastery.

## User Flow

### 1. Student Completes Worksheet
- Prints worksheet from generator
- Solves problems by hand
- Takes photo or scans completed worksheet

### 2. Upload & Processing
```
Student → Upload Photo → OCR Extraction → AI Grading → Mastery Update
```

### 3. Feedback & Next Steps
- Show graded worksheet with corrections
- Highlight error patterns (e.g., "struggling with carrying in tens place")
- Suggest next practice step in progression
- Auto-generate targeted worksheet

## Technical Architecture

### Database Schema Extensions

```sql
-- New table: Individual problem attempts
CREATE TABLE worksheet_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  worksheet_id TEXT, -- Optional: link to generated worksheet
  uploaded_image_url TEXT,
  created_at INTEGER NOT NULL,

  -- Worksheet metadata (from OCR or user input)
  operator TEXT, -- 'addition' | 'subtraction'
  digit_count INTEGER,
  problem_count INTEGER,

  -- Grading results
  grading_status TEXT, -- 'pending' | 'completed' | 'failed'
  graded_at INTEGER,
  total_problems INTEGER,
  correct_count INTEGER,
  accuracy REAL, -- 0.0-1.0

  -- AI analysis
  error_patterns TEXT, -- JSON: ["carries-tens", "borrows-hundreds"]
  suggested_step_id TEXT, -- Progression step recommendation
  ai_feedback TEXT, -- Natural language feedback

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- New table: Per-problem results
CREATE TABLE problem_attempts (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Problem details
  problem_index INTEGER, -- Position on worksheet (0-based)
  operand_a INTEGER,
  operand_b INTEGER,
  operator TEXT,
  correct_answer INTEGER,

  -- Student's work (from OCR)
  student_answer INTEGER,
  student_carry_digits TEXT, -- JSON array of carry digits detected

  -- Grading
  is_correct BOOLEAN,
  error_type TEXT, -- 'computation' | 'carry' | 'borrow' | 'alignment' | null

  -- Metadata
  digit_count INTEGER,
  requires_regrouping BOOLEAN,
  regroups_in_places TEXT, -- JSON: ["ones", "tens"]

  created_at INTEGER NOT NULL,

  FOREIGN KEY (attempt_id) REFERENCES worksheet_attempts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update existing mastery table to track more granular data
ALTER TABLE worksheet_mastery ADD COLUMN
  last_attempt_id TEXT REFERENCES worksheet_attempts(id);

ALTER TABLE worksheet_mastery ADD COLUMN
  total_problems_attempted INTEGER DEFAULT 0;

ALTER TABLE worksheet_mastery ADD COLUMN
  recent_accuracy REAL; -- Rolling average of last 20 problems
```

### API Endpoints

#### 1. Upload Worksheet
```typescript
POST /api/worksheets/upload

Request:
{
  image: File, // Photo of completed worksheet
  worksheetId?: string, // Optional: if generated from our system
  metadata?: {
    operator: 'addition' | 'subtraction',
    digitCount: number,
    problemCount: number
  }
}

Response:
{
  attemptId: string,
  status: 'processing',
  estimatedTime: number // seconds
}
```

#### 2. Get Grading Results
```typescript
GET /api/worksheets/attempts/:attemptId

Response:
{
  attemptId: string,
  status: 'completed' | 'processing' | 'failed',

  // Results
  totalProblems: 20,
  correctCount: 17,
  accuracy: 0.85,

  // Per-problem breakdown
  problems: [
    {
      index: 0,
      problem: "45 + 27",
      correctAnswer: 72,
      studentAnswer: 72,
      isCorrect: true
    },
    {
      index: 3,
      problem: "68 + 45",
      correctAnswer: 113,
      studentAnswer: 103, // Forgot to carry
      isCorrect: false,
      errorType: 'carry'
    }
  ],

  // AI analysis
  errorPatterns: ["carry-tens", "digit-alignment"],
  aiSummary: "Student demonstrates strong addition skills but occasionally forgets to carry when the ones place exceeds 10. Recommend more practice with 2-digit problems requiring carrying in tens place.",

  // Progression recommendation
  currentStepId: "single-carry-2d-minimal",
  suggestedNextStep: "single-carry-2d-full", // Step back for scaffolding
  masteryUpdates: {
    "single-carry-2d-minimal": {
      wasMastered: false,
      nowMastered: false,
      progress: 0.73 // 73% toward mastery
    }
  }
}
```

#### 3. Generate Targeted Worksheet
```typescript
POST /api/worksheets/generate-targeted

Request:
{
  userId: string,
  focusAreas?: string[], // ["carry-tens", "three-digit"]
  stepId?: string // Override progression recommendation
}

Response:
{
  worksheetId: string,
  config: WorksheetConfig,
  pdfUrl: string,
  reasoning: "Generated 20 problems focusing on carrying in tens place based on recent errors."
}
```

### AI Grading Pipeline

**ARCHITECTURE DECISION: Single-Model Vision Approach**

We use **GPT-5 with built-in thinking and vision** (`gpt-5` or `gpt-5-2025-08-07`) in a single pass:
- **Input**: Raw image of worksheet
- **Output**: Complete grading assessment with progression recommendation

**Why GPT-5:**
- ✅ **No information loss** - No OCR handoff, vision model sees handwriting directly
- ✅ **Built-in thinking** - Unified system that knows when to reason deeply
- ✅ **Simpler architecture** - One API call instead of two (OCR + grading)
- ✅ **Deep reasoning** - Analyzes error patterns and determines exact progression placement
- ✅ **Better than o3** - GPT-5 performs better with 50-80% fewer output tokens
- ✅ **Multimodal support** - Native image analysis with text output

**API Details:**
- Model: `gpt-5` (or pinned snapshot `gpt-5-2025-08-07`)
- Reasoning effort: `medium` (default) or `high` for complex worksheets
- Verbosity: `medium` (default) for balanced output length
- Supports PNG, JPEG, GIF image formats

**Deprecated:** ~~OCR (Google Vision) → Parse → Claude grading~~ (two-step approach loses context)

#### Single-Pass Vision Grading (GPT-5)

**CRITICAL**: AI must return a specific `ProgressionStep.id` from the progression path, not generic feedback.

```typescript
import { SINGLE_CARRY_PATH, type ProgressionStep } from '../progressionPath'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Grade worksheet with GPT-5 vision in a single pass
 *
 * Input: Image of completed worksheet
 * Output: Complete assessment with progression recommendation
 */
async function gradeWorksheetWithVision(imageUrl: string) {
  // Build context about available progression steps
  const stepDescriptions = SINGLE_CARRY_PATH.map(step =>
    `- ${step.id}: ${step.name} - ${step.description}`
  ).join('\n')

  const prompt = `You are grading an elementary math worksheet to determine the student's exact position in a mastery progression path.

AVAILABLE PROGRESSION STEPS:
${stepDescriptions}

TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers
3. Grade each problem as correct or incorrect
4. Identify specific error patterns (e.g., "forgets to carry in tens place", "misaligns digits")
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice

Return JSON with this EXACT structure:
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
    },
    // ... more problems
  ],
  "totalProblems": 20,
  "correctCount": 17,
  "accuracy": 0.85,
  "errorPatterns": ["carry-tens", "digit-alignment"],
  "currentStepEstimate": "single-carry-2d-minimal",
  "suggestedStepId": "single-carry-2d-full",
  "reasoning": "Student shows mastery of 1-digit problems but struggles with 2-digit carrying in problems 3, 7, and 15. Recommend returning to full scaffolding at 2-digit level.",
  "feedback": "Great work! You got 17/20 correct. Let's practice 2-digit problems with visual helpers to strengthen your carrying skills."
}

CRITICAL: suggestedStepId MUST be one of: ${SINGLE_CARRY_PATH.map(s => s.id).join(', ')}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-5-2025-08-07',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high' // High detail for handwriting recognition
            }
          }
        ]
      }
    ],
    reasoning_effort: 'high', // Use high reasoning for complex analysis
    verbosity: 'medium',
    response_format: { type: 'json_object' }
  })

  const result = JSON.parse(response.choices[0].message.content)

  // Validate that suggested step exists
  const validStep = SINGLE_CARRY_PATH.find(s => s.id === result.suggestedStepId)
  if (!validStep) {
    console.warn(`AI suggested invalid step: ${result.suggestedStepId}, defaulting to first step`)
    result.suggestedStepId = SINGLE_CARRY_PATH[0].id
  }

  return result
}
```

#### Phase 3: Mastery Profile Update - **CLOSING THE FEEDBACK LOOP**

**This is where the magic happens** - AI grading results directly update the student's position on the progression path.

```typescript
import { getStepById, SINGLE_CARRY_PATH } from '../progressionPath'
import { db } from '@/db'
import { worksheetMastery } from '@/db/schema'

async function updateMasteryProfile(
  userId: string,
  attemptId: string,
  results: GradingResults
) {
  // 1. Store individual problem attempts (already done in processWorksheetAttempt)

  // 2. Get AI's recommended step from grading results
  const suggestedStep = getStepById(results.suggestedStepId, SINGLE_CARRY_PATH)
  if (!suggestedStep) {
    throw new Error(`Invalid step ID from AI: ${results.suggestedStepId}`)
  }

  // 3. Update worksheet_mastery table for the suggested step
  const accuracy = results.correctCount / results.totalProblems

  // Check if mastery record exists
  const [existing] = await db
    .select()
    .from(worksheetMastery)
    .where(
      and(
        eq(worksheetMastery.userId, userId),
        eq(worksheetMastery.stepId, suggestedStep.id)
      )
    )

  if (existing) {
    // Update existing record
    const newAttempts = existing.totalAttempts + 1
    const newCorrect = existing.totalCorrect + results.correctCount
    const newTotal = existing.totalProblems + results.totalProblems
    const newAccuracy = newCorrect / newTotal

    // Check if they've reached mastery threshold
    const isMastered = newAccuracy >= suggestedStep.masteryThreshold &&
                      newAttempts >= suggestedStep.minimumAttempts

    await db.update(worksheetMastery)
      .set({
        totalAttempts: newAttempts,
        totalCorrect: newCorrect,
        totalProblems: newTotal,
        currentAccuracy: newAccuracy,
        isMastered,
        lastAttemptId: attemptId,
        updatedAt: Date.now()
      })
      .where(eq(worksheetMastery.id, existing.id))

    // 4. If mastered, update user's currentStepId to next step
    if (isMastered && suggestedStep.nextStepId) {
      await db.update(users)
        .set({
          currentStepId: suggestedStep.nextStepId  // ← ADVANCE ON PATH!
        })
        .where(eq(users.id, userId))
    }
  } else {
    // Create new mastery record
    await db.insert(worksheetMastery).values({
      id: randomUUID(),
      userId,
      stepId: suggestedStep.id,
      totalAttempts: 1,
      totalCorrect: results.correctCount,
      totalProblems: results.totalProblems,
      currentAccuracy: accuracy,
      isMastered: false,  // First attempt, not mastered yet
      lastAttemptId: attemptId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  // 5. Return what changed for display to teacher
  return {
    suggestedStepId: suggestedStep.id,
    stepName: suggestedStep.name,
    progress: accuracy,
    isMastered: accuracy >= suggestedStep.masteryThreshold,
    nextStepId: suggestedStep.nextStepId
  }
}
```

**Key Points:**

1. **AI recommendation is trusted** - The `suggestedStepId` from AI directly determines which mastery record to update
2. **Mastery tracking is automatic** - System checks if thresholds are met and advances student automatically
3. **Teacher sees clear next steps** - Results show exactly which step to generate next worksheet for
4. **Loop completes** - Next worksheet can be generated for the exact recommended step

### UI Components

#### 1. Upload Modal
```tsx
// src/app/create/worksheets/components/UploadWorksheetModal.tsx

interface UploadWorksheetModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UploadWorksheetModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing'>('idle')

  const handleUpload = async () => {
    if (!file) return

    setStatus('uploading')
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('/api/worksheets/upload', {
      method: 'POST',
      body: formData
    })

    const { attemptId } = await response.json()
    setStatus('processing')

    // Poll for results
    await pollForResults(attemptId)
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <h2>Upload Completed Worksheet</h2>

      {/* File input with drag-and-drop */}
      <FileDropzone
        accept="image/*"
        onFileSelected={setFile}
      />

      {/* Preview */}
      {file && <ImagePreview src={URL.createObjectURL(file)} />}

      {/* Status */}
      {status === 'processing' && (
        <ProcessingIndicator message="AI is grading your work..." />
      )}

      <Button onClick={handleUpload} disabled={!file || status !== 'idle'}>
        Upload & Grade
      </Button>
    </Dialog>
  )
}
```

#### 2. Grading Results View
```tsx
// src/app/worksheets/attempts/[attemptId]/page.tsx

export default function AttemptResultsPage({ params }) {
  const { attemptId } = params
  const { data: results } = useSuspenseQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => fetch(`/api/worksheets/attempts/${attemptId}`).then(r => r.json())
  })

  return (
    <div>
      <h1>Your Results</h1>

      {/* Score Summary */}
      <ScoreCard
        correct={results.correctCount}
        total={results.totalProblems}
        accuracy={results.accuracy}
      />

      {/* AI Feedback */}
      <FeedbackCard
        summary={results.aiSummary}
        errorPatterns={results.errorPatterns}
      />

      {/* Problem-by-Problem Breakdown */}
      <ProblemReview problems={results.problems} />

      {/* Next Steps */}
      <NextStepsCard
        currentStep={results.currentStepId}
        suggestedStep={results.suggestedNextStep}
        onGenerateWorksheet={handleGenerateTargeted}
      />
    </div>
  )
}
```

#### 3. Student Dashboard Enhancement
```tsx
// Add to existing student dashboard

<DashboardSection title="Recent Practice">
  <RecentAttemptsTimeline attempts={recentAttempts} />
</DashboardSection>

<DashboardSection title="Mastery Progress">
  <MasteryProgressChart
    steps={SINGLE_CARRY_PATH}
    masteryStates={masteryStates}
  />
</DashboardSection>

<DashboardSection title="Suggested Practice">
  <SuggestedWorksheetCard
    stepId={suggestedStepId}
    reason="Based on your recent work, more practice with tens place carrying"
    onGenerate={handleGenerate}
  />
</DashboardSection>
```

## Implementation Phases

### Phase 1: Database & API (Week 1)
- [ ] Create database migration for new tables
- [ ] Implement `/api/worksheets/upload` endpoint
- [ ] Implement `/api/worksheets/attempts/:id` endpoint
- [ ] Set up file storage (S3, Cloudflare R2, etc.)

### Phase 2: OCR Integration (Week 1-2)
- [ ] Research OCR services (Google Vision, Azure, Tesseract)
- [ ] Implement worksheet layout detection
- [ ] Implement text extraction and parsing
- [ ] Test accuracy with sample worksheets

### Phase 3: AI Grading (Week 2)
- [ ] Design AI prompts for grading
- [ ] Implement Claude/GPT integration
- [ ] Build error pattern detection
- [ ] Test with various problem types

### Phase 4: UI Components (Week 2-3)
- [ ] Build UploadWorksheetModal
- [ ] Build AttemptResultsPage
- [ ] Build FileDropzone component
- [ ] Build ProblemReview component
- [ ] Enhance student dashboard

### Phase 5: Mastery Profile Integration (Week 3)
- [ ] Update mastery calculation logic
- [ ] Implement targeted worksheet generation
- [ ] Build progress visualization
- [ ] Add adaptive difficulty suggestions

### Phase 6: Testing & Polish (Week 4)
- [ ] Test with real student worksheets
- [ ] Tune AI prompts for accuracy
- [ ] Improve OCR reliability
- [ ] Add parent/teacher reporting

## Cost Considerations

### GPT-5 Vision Costs (Single-Model Approach)
- **GPT-5 with vision**: Input tokens + output tokens
- **Typical worksheet**: ~1000 input tokens (image) + 500 output tokens (JSON response)
- **Estimated cost**: ~$0.01-0.02 per worksheet
- **Per 1,000 worksheets**: ~$10-20

### Storage Costs
- Uploaded images: ~200KB per image
- Cloudflare R2: $0.015 per GB/month
- **Estimate**: $0.15 per 1,000 worksheets stored

### Total Cost Comparison

**Old approach (OCR + Claude):**
- OCR: $1.50 per 1,000
- Claude: $1-3 per 1,000
- **Total**: $2.50-4.50 per 1,000 worksheets

**New approach (GPT-5 vision only):**
- GPT-5: $10-20 per 1,000
- **Total**: $10-20 per 1,000 worksheets

**Trade-off**: Slightly higher cost, but much better accuracy and no information loss from OCR handoff. The improved accuracy and simpler architecture justify the cost.

## Alternative: Interactive Digital Practice

Instead of upload/OCR, could build interactive worksheet:

```tsx
// Student solves problems directly in browser
<InteractiveWorksheet
  problems={problems}
  onSubmit={(answers) => {
    // Instant grading, no OCR needed
    const results = gradeAnswers(answers, problems)
    updateMasteryProfile(userId, results)
  }}
/>
```

**Pros:**
- No OCR complexity
- Instant feedback
- Lower costs
- Can track time per problem
- Capture work steps (carry digits, etc.)

**Cons:**
- Less authentic than paper practice
- Requires digital device
- No handwriting practice
- May feel like "a test" vs practice

## ✅ DECISION: Upload & OCR Approach (Paper Worksheets)

Teachers will upload photos of completed paper worksheets. No interactive digital practice.

## Implementation Plan - Detailed Steps

### Step 1: File Upload API (Week 1, Days 1-2)

**Create**: `src/app/api/worksheets/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { worksheetAttempts } from '@/db/schema'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Generate unique ID
    const attemptId = randomUUID()
    const filename = `${attemptId}.${file.name.split('.').pop()}`

    // Save to local storage (MVP) - move to R2 later
    const uploadDir = join(process.cwd(), 'data', 'uploads')
    const filepath = join(uploadDir, filename)

    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    // Create database record
    const now = Date.now()
    await db.insert(worksheetAttempts).values({
      id: attemptId,
      userId: 'TODO-get-from-session',
      uploadedImageUrl: `/uploads/${filename}`,
      worksheetId: formData.get('worksheetId') as string | null,
      operator: 'addition', // Default, can be from metadata
      digitCount: 2, // Default, OCR will determine actual
      problemCount: 20, // Default
      gradingStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    // Queue for background processing
    await queueGradingJob(attemptId)

    return NextResponse.json({
      attemptId,
      status: 'pending',
      message: 'Upload successful, grading in progress'
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

### Step 2: GPT-5 Vision Integration (Week 1, Days 3-5)

**Create**: `src/lib/ai/gradeWorksheet.ts`

```typescript
import OpenAI from 'openai'
import { SINGLE_CARRY_PATH } from '@/app/create/worksheets/addition/progressionPath'
import { readFile } from 'fs/promises'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface GradingResult {
  problems: Array<{
    index: number
    operandA: number
    operandB: number
    correctAnswer: number
    studentAnswer: number | null
    isCorrect: boolean
    digitCount: number
    requiresRegrouping: boolean
  }>
  totalProblems: number
  correctCount: number
  accuracy: number
  errorPatterns: string[]
  currentStepEstimate: string
  suggestedStepId: string
  reasoning: string
  feedback: string
}

/**
 * Grade worksheet using GPT-5 vision (single-pass, no OCR)
 *
 * @param imagePath - Path to worksheet image file
 * @returns Complete grading assessment with progression recommendation
 */
export async function gradeWorksheetWithVision(imagePath: string): Promise<GradingResult> {
  // Read image file and convert to base64
  const imageBuffer = await readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const dataUrl = `data:${mimeType};base64,${base64Image}`

  // Build context about progression steps
  const stepDescriptions = SINGLE_CARRY_PATH.map(step =>
    `- ${step.id}: ${step.name} - ${step.description}`
  ).join('\n')

  const prompt = `You are grading an elementary math worksheet to determine the student's exact position in a mastery progression path.

AVAILABLE PROGRESSION STEPS:
${stepDescriptions}

TASK:
1. Examine the worksheet image and identify all addition problems
2. Read the student's handwritten answers carefully
3. Grade each problem as correct or incorrect
4. Identify specific error patterns (e.g., "forgets to carry in tens place", "misaligns digits")
5. Determine which progression step ID best matches their current skill level
6. Recommend the EXACT next step ID they should practice

Return JSON with this EXACT structure:
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

CRITICAL: suggestedStepId MUST be one of: ${SINGLE_CARRY_PATH.map(s => s.id).join(', ')}`

  const response = await openai.chat.completions.create({
    model: 'gpt-5-2025-08-07',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: 'high' // High detail for handwriting recognition
            }
          }
        ]
      }
    ],
    reasoning_effort: 'high', // Use deep thinking for complex analysis
    verbosity: 'medium',
    response_format: { type: 'json_object' }
  })

  const result = JSON.parse(response.choices[0].message.content || '{}') as GradingResult

  // Validate that suggested step exists
  const validStep = SINGLE_CARRY_PATH.find(s => s.id === result.suggestedStepId)
  if (!validStep) {
    console.warn(`AI suggested invalid step: ${result.suggestedStepId}, defaulting to first step`)
    result.suggestedStepId = SINGLE_CARRY_PATH[0].id
  }

  return result
}
```

### Step 4: Background Grading Job (Week 2, Day 1)

**Create**: `src/lib/grading/processAttempt.ts`

```typescript
import { db } from '@/db'
import { worksheetAttempts, problemAttempts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { extractWorksheetText, parseWorksheetProblems } from '@/lib/ocr/googleVision'
import { gradeWithAI } from '@/lib/ai/gradeWorksheet'

export async function processWorksheetAttempt(attemptId: string) {
  try {
    // Update status to processing
    await db.update(worksheetAttempts)
      .set({ gradingStatus: 'processing', updatedAt: Date.now() })
      .where(eq(worksheetAttempts.id, attemptId))

    // Get attempt record
    const [attempt] = await db
      .select()
      .from(worksheetAttempts)
      .where(eq(worksheetAttempts.id, attemptId))

    if (!attempt) throw new Error('Attempt not found')

    // 1. OCR: Extract text from image
    const imagePath = join(process.cwd(), 'data', attempt.uploadedImageUrl)
    const ocrResult = await extractWorksheetText(imagePath)

    // 2. Parse: Extract problems and answers
    const parsedProblems = parseWorksheetProblems(ocrResult.fullText)

    // 3. Grade: Check correctness
    const gradedProblems = parsedProblems.map(p => ({
      ...p,
      correctAnswer: p.operandA + p.operandB,
      isCorrect: p.studentAnswer === (p.operandA + p.operandB)
    }))

    // 4. AI Analysis: Get feedback
    const aiAnalysis = await gradeWithAI(gradedProblems)

    // 5. Store individual problem results
    const now = Date.now()
    for (const problem of gradedProblems) {
      await db.insert(problemAttempts).values({
        id: randomUUID(),
        attemptId,
        userId: attempt.userId,
        problemIndex: problem.index,
        operandA: problem.operandA,
        operandB: problem.operandB,
        operator: 'addition',
        correctAnswer: problem.correctAnswer,
        studentAnswer: problem.studentAnswer,
        isCorrect: problem.isCorrect,
        digitCount: Math.max(
          problem.operandA.toString().length,
          problem.operandB.toString().length
        ),
        requiresRegrouping: (problem.operandA % 10 + problem.operandB % 10) >= 10,
        createdAt: now
      })
    }

    // 6. Update attempt with results
    const correctCount = gradedProblems.filter(p => p.isCorrect).length
    await db.update(worksheetAttempts)
      .set({
        gradingStatus: 'completed',
        gradedAt: now,
        totalProblems: gradedProblems.length,
        correctCount,
        accuracy: correctCount / gradedProblems.length,
        errorPatterns: JSON.stringify(aiAnalysis.errorPatterns),
        suggestedStepId: aiAnalysis.suggestedStepId,
        aiFeedback: aiAnalysis.feedback,
        aiResponseRaw: JSON.stringify(aiAnalysis),
        updatedAt: now
      })
      .where(eq(worksheetAttempts.id, attemptId))

    // 7. Update mastery profile
    await updateMasteryFromAttempt(attempt.userId, attemptId, gradedProblems)

    return { success: true }
  } catch (error) {
    console.error('Grading failed:', error)

    // Mark as failed
    await db.update(worksheetAttempts)
      .set({ gradingStatus: 'failed', updatedAt: Date.now() })
      .where(eq(worksheetAttempts.id, attemptId))

    throw error
  }
}
```

### Step 5: Get Results API (Week 2, Day 2)

**Create**: `src/app/api/worksheets/attempts/[attemptId]/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  const { attemptId } = params

  // Get attempt with all problem results
  const [attempt] = await db
    .select()
    .from(worksheetAttempts)
    .where(eq(worksheetAttempts.id, attemptId))

  if (!attempt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const problems = await db
    .select()
    .from(problemAttempts)
    .where(eq(problemAttempts.attemptId, attemptId))
    .orderBy(problemAttempts.problemIndex)

  return NextResponse.json({
    attemptId: attempt.id,
    status: attempt.gradingStatus,
    uploadedAt: attempt.createdAt,
    gradedAt: attempt.gradedAt,
    totalProblems: attempt.totalProblems,
    correctCount: attempt.correctCount,
    accuracy: attempt.accuracy,
    problems: problems.map(p => ({
      index: p.problemIndex,
      problem: `${p.operandA} + ${p.operandB}`,
      correctAnswer: p.correctAnswer,
      studentAnswer: p.studentAnswer,
      isCorrect: p.isCorrect,
      errorType: p.errorType
    })),
    errorPatterns: attempt.errorPatterns ? JSON.parse(attempt.errorPatterns) : [],
    aiSummary: attempt.aiFeedback,
    suggestedStepId: attempt.suggestedStepId
  })
}
```

### Step 6: Upload Modal Component (Week 2, Days 3-4)

**Create**: `src/app/create/worksheets/components/UploadWorksheetModal.tsx`

```typescript
'use client'

import { useState } from 'react'
import { css } from '../../../../styled-system/css'

export function UploadWorksheetModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const [attemptId, setAttemptId] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus('uploading')
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('/api/worksheets/upload', {
      method: 'POST',
      body: formData
    })

    const data = await response.json()
    setAttemptId(data.attemptId)
    setStatus('processing')

    // Poll for results
    pollForResults(data.attemptId)
  }

  const pollForResults = async (id: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/worksheets/attempts/${id}`)
      const data = await response.json()

      if (data.status === 'completed') {
        clearInterval(interval)
        // Navigate to results page
        window.location.href = `/worksheets/attempts/${id}`
      }
    }, 2000) // Poll every 2 seconds
  }

  if (!isOpen) return null

  return (
    <div className={css({ /* Modal styles */ })}>
      <h2>Upload Completed Worksheet</h2>

      {status === 'idle' && (
        <>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {file && <p>Selected: {file.name}</p>}
          <button onClick={handleUpload} disabled={!file}>
            Upload & Grade
          </button>
        </>
      )}

      {status === 'uploading' && <p>Uploading...</p>}

      {status === 'processing' && (
        <div>
          <p>AI is grading your work...</p>
          <p>This usually takes 30-60 seconds</p>
        </div>
      )}
    </div>
  )
}
```

### Step 7: Results Page (Week 2, Days 4-5)

**Create**: `src/app/worksheets/attempts/[attemptId]/page.tsx`

```typescript
export default async function AttemptResultsPage({
  params
}: {
  params: { attemptId: string }
}) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/worksheets/attempts/${params.attemptId}`
  )
  const results = await response.json()

  return (
    <div>
      <h1>Worksheet Results</h1>

      {/* Score */}
      <div>
        <h2>Score: {results.correctCount}/{results.totalProblems}</h2>
        <p>Accuracy: {(results.accuracy * 100).toFixed(0)}%</p>
      </div>

      {/* AI Feedback */}
      <div>
        <h3>Feedback</h3>
        <p>{results.aiSummary}</p>

        {results.errorPatterns.length > 0 && (
          <div>
            <h4>Areas to practice:</h4>
            <ul>
              {results.errorPatterns.map((pattern: string) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Problem Breakdown */}
      <div>
        <h3>Problem-by-Problem</h3>
        {results.problems.map((p: any) => (
          <div key={p.index}>
            {p.index + 1}. {p.problem} = {p.correctAnswer}
            <br />
            Student: {p.studentAnswer ?? 'blank'}
            {p.isCorrect ? ' ✓' : ' ✗'}
          </div>
        ))}
      </div>

      {/* Next Steps */}
      {results.suggestedStepId && (
        <div>
          <h3>Recommended Next Step</h3>
          <p>Practice: {results.suggestedStepId}</p>
          <button>Generate Targeted Worksheet</button>
        </div>
      )}
    </div>
  )
}
```

## Environment Variables Required

```bash
# .env.local

# OpenAI API (GPT-5)
OPENAI_API_KEY=sk-...

# Base URL for API calls
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Database Migration Status

✅ **COMPLETED** - Tables created:
- `worksheet_attempts`
- `problem_attempts`

## Dependencies to Install

```bash
npm install openai
```

## Camera Upload & QR Code Scanning Spec

### Overview

Teachers need flexible upload options:
1. **Desktop**: Direct file upload or camera capture
2. **Smartphone**: Camera capture via QR code URL
3. **Multi-image**: Support multiple worksheet uploads in one session

### Use Cases

**Use Case 1: Desktop Teacher with Built-in Camera**
1. Teacher clicks "Upload Worksheet"
2. Modal offers "Choose File" or "Take Photo"
3. Teacher clicks "Take Photo" → browser camera opens
4. Teacher captures photo → immediately uploaded

**Use Case 2: Teacher with Smartphone**
1. Teacher opens app on desktop
2. Clicks "Upload Worksheet" → modal shows QR code
3. Teacher scans QR code with smartphone
4. Smartphone opens camera page instantly
5. Teacher takes photos (can take multiple)
6. Each photo uploads immediately to desktop session
7. Desktop sees real-time updates as photos arrive

**Use Case 3: Batch Upload from Phone**
1. Teacher has 5 students' worksheets to grade
2. Scans one QR code
3. Takes 5 photos in succession
4. All 5 worksheets uploaded to same grading session

### Technical Implementation

#### Upload Modal with Camera Support

```typescript
// src/app/create/worksheets/components/UploadWorksheetModal.tsx

interface UploadMode {
  mode: 'file' | 'camera' | 'qr-scan'
}

export function UploadWorksheetModal({ isOpen, onClose }: Props) {
  const [uploadMode, setUploadMode] = useState<UploadMode['mode']>('file')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Array<{ attemptId: string; status: string }>>([])

  // Generate QR code URL for smartphone upload
  const handleGenerateQRCode = async () => {
    const session = randomUUID()
    setSessionId(session)

    // Generate URL that opens camera page on smartphone
    const uploadUrl = `${window.location.origin}/upload/${session}/camera`
    setQrCodeUrl(uploadUrl)

    // Start polling for uploads to this session
    pollForSessionUploads(session)
  }

  // Poll for new uploads in this session
  const pollForSessionUploads = (session: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/worksheets/sessions/${session}/uploads`)
      const data = await response.json()
      setUploads(data.uploads)
    }, 2000)

    return () => clearInterval(interval)
  }

  // Camera capture (desktop)
  const handleCameraCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    // Show camera preview, capture, upload
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <h2>Upload Worksheet</h2>

      {/* Mode selector */}
      <div>
        <button onClick={() => setUploadMode('file')}>
          Choose File
        </button>
        <button onClick={() => setUploadMode('camera')}>
          Take Photo
        </button>
        <button onClick={() => setUploadMode('qr-scan')}>
          Scan with Phone
        </button>
      </div>

      {/* File upload */}
      {uploadMode === 'file' && (
        <FileDropzone accept="image/*" onFileSelected={handleFileUpload} />
      )}

      {/* Camera capture */}
      {uploadMode === 'camera' && (
        <CameraCapture onCapture={handleCameraUpload} />
      )}

      {/* QR code for smartphone */}
      {uploadMode === 'qr-scan' && (
        <div>
          <p>Scan this QR code with your smartphone to upload photos</p>
          {qrCodeUrl && <QRCodeDisplay url={qrCodeUrl} />}

          <p>Uploaded worksheets ({uploads.length}):</p>
          <ul>
            {uploads.map(u => (
              <li key={u.attemptId}>
                Worksheet {u.attemptId} - {u.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  )
}
```

#### Smartphone Camera Upload Page

```typescript
// src/app/upload/[sessionId]/camera/page.tsx

'use client'

export default function SmartphoneCameraUploadPage({
  params
}: {
  params: { sessionId: string }
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)

  // Immediately request camera access on page load
  useEffect(() => {
    requestCameraAccess()
  }, [])

  const handleCapture = async (imageDataUrl: string) => {
    setUploading(true)

    // Convert data URL to blob
    const blob = await fetch(imageDataUrl).then(r => r.blob())

    // Upload to session
    const formData = new FormData()
    formData.append('image', blob, `worksheet-${Date.now()}.jpg`)
    formData.append('sessionId', params.sessionId)

    await fetch('/api/worksheets/upload', {
      method: 'POST',
      body: formData
    })

    setUploadCount(prev => prev + 1)
    setUploading(false)

    // Show success, allow another capture
  }

  return (
    <div>
      <h1>Upload Worksheets</h1>
      <p>Photos uploaded: {uploadCount}</p>

      <CameraCapture
        onCapture={handleCapture}
        disabled={uploading}
        autoFocus={true}
      />

      <p>{uploading ? 'Uploading...' : 'Tap to capture another photo'}</p>
    </div>
  )
}
```

#### Session Tracking API

```typescript
// src/app/api/worksheets/sessions/[sessionId]/uploads/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params

  // Get all uploads for this session
  const uploads = await db
    .select()
    .from(worksheetAttempts)
    .where(eq(worksheetAttempts.sessionId, sessionId))
    .orderBy(worksheetAttempts.createdAt)

  return NextResponse.json({
    sessionId,
    uploads: uploads.map(u => ({
      attemptId: u.id,
      status: u.gradingStatus,
      uploadedAt: u.createdAt
    }))
  })
}
```

#### Database Schema Update

Add `sessionId` to `worksheet_attempts` table:

```sql
ALTER TABLE `worksheet_attempts` ADD COLUMN `session_id` text;
CREATE INDEX `worksheet_attempts_session_idx` ON `worksheet_attempts` (`session_id`);
```

### Camera Capture Component

```typescript
// src/components/CameraCapture.tsx

export function CameraCapture({
  onCapture,
  disabled = false,
  autoFocus = false
}: {
  onCapture: (imageDataUrl: string) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasCamera, setHasCamera] = useState(false)

  useEffect(() => {
    startCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasCamera(true)
      }
    } catch (error) {
      console.error('Camera access denied:', error)
    }
  }

  const capturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0)

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    onCapture(imageDataUrl)
  }

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: '600px' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <button onClick={capturePhoto} disabled={disabled || !hasCamera}>
        {disabled ? 'Uploading...' : 'Capture Photo'}
      </button>
    </div>
  )
}
```

### QR Code Generation

```typescript
// src/components/QRCodeDisplay.tsx

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QRCodeDisplay({ url }: { url: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 300,
      margin: 2
    }).then(setQrDataUrl)
  }, [url])

  return (
    <div>
      {qrDataUrl && <img src={qrDataUrl} alt="QR Code" />}
      <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{url}</p>
    </div>
  )
}
```

### User Flow Summary

**Desktop Teacher:**
1. Opens upload modal
2. Clicks "Scan with Phone"
3. QR code appears instantly
4. Waits for photos to arrive from phone
5. Sees real-time list of uploaded worksheets
6. Can view grading results as they complete

**Smartphone User:**
1. Scans QR code → opens camera page immediately
2. No login required, no navigation
3. Camera opens automatically
4. Take photo → uploads instantly
5. Can take more photos (batch upload)
6. Each upload shows success confirmation

### Dependencies

```bash
npm install qrcode @types/qrcode
```

### Security Considerations

**Session expiration:**
- Sessions expire after 1 hour
- Only allow uploads, not access to results
- Rate limit per session (max 50 uploads)

**Validation:**
- Check file types (images only)
- Limit file size (max 10MB per image)
- Validate session exists before upload

## Testing Checklist

- [ ] Upload endpoint accepts images
- [ ] Desktop camera capture works
- [ ] Smartphone camera page opens from QR code
- [ ] Multiple photos upload to same session
- [ ] Real-time updates on desktop as photos arrive
- [ ] GPT-5 vision grading works correctly
- [ ] AI grading provides useful feedback with progression steps
- [ ] Results stored in database
- [ ] Results API returns complete data
- [ ] UI polling works correctly
- [ ] Mastery profile updates with progression advancement

## Known Limitations & Future Improvements

### MVP Limitations:
- Local file storage (not scalable)
- Synchronous processing (slow for large uploads)
- Simple OCR parsing (may miss complex layouts)
- English text only

### Future Enhancements:
- Cloudflare R2 for image storage
- Background queue (Redis/BullMQ)
- Advanced layout detection
- Multi-language support
- Batch upload for classes
- OCR confidence scores
- Manual correction UI

## Cost Breakdown

### Per Worksheet:
- **OCR**: $0.0015 (Google Vision)
- **AI Grading**: $0.002 (Claude Haiku)
- **Storage**: $0.0001 (local/R2)
- **Total**: ~$0.0036 per worksheet

### Monthly (1,000 worksheets):
- **Total**: ~$3.60/month

**Extremely affordable for automated grading!**
