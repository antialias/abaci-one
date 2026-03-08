/**
 * Subtask: LLM vision review of a generated postcard image.
 *
 * Uses createTaskLLM for streaming reasoning visibility in admin.
 * Reviews the image against configurable criteria and returns
 * per-criterion pass/fail results.
 */

import { z } from 'zod'
import { createTask, createChildTask, type TaskHandle } from '../task-manager'
import { createTaskLLM } from '../llm'
import { readPersistentImage } from '../image-storage'
import { createUsageRecordingMiddleware } from '@/lib/ai-usage/llm-middleware'
import type { PostcardReviewEvent } from './events'
import type { PostcardManifest } from '@/db/schema/number-line-postcards'

// ── Criteria definition ──

export interface ReviewCriterion {
  id: string
  name: string
  prompt: string
}

const DEFAULT_CRITERIA: ReviewCriterion[] = [
  {
    id: 'math_accuracy',
    name: 'Mathematical accuracy',
    prompt:
      'Check any visible numbers, equations, or number line markings. Are they mathematically correct? Flag incorrect arithmetic, misplaced numbers, or wrong values.',
  },
  {
    id: 'number_identity',
    name: 'Number identity',
    prompt:
      'The postcard should prominently feature the caller number. Verify the featured number matches the expected caller number from the manifest.',
  },
  {
    id: 'screenshot_incorporation',
    name: 'Screenshot incorporation',
    prompt:
      'If reference screenshots were provided, they should be visible as "photos" in the postcard (framed, pinned, taped — like a scrapbook). Check that the screenshot content is recognizable and not distorted beyond recognition.',
  },
  {
    id: 'appropriateness',
    name: 'Child-appropriate content',
    prompt:
      'This postcard is for a child. Flag anything inappropriate, disturbing, or unsuitable for a young audience.',
  },
]

// ── Result types ──

export interface CriterionResult {
  id: string
  pass: boolean
  issues: string[]
}

export interface PostcardReviewInput {
  postcardId: string
  /** Storage path: category/filename for the image to review */
  imagePath: string
  manifest: PostcardManifest
  hasReferenceScreenshots: boolean
  previousFeedback?: string
  criteria?: ReviewCriterion[]
  /** User who triggered this review — for usage tracking */
  _userId?: string
}

export interface PostcardReviewOutput {
  postcardId: string
  pass: boolean
  criteriaResults: CriterionResult[]
  suggestions: string[]
  /** Pre-formatted feedback string for regeneration prompts */
  feedback: string
}

// ── Schema for structured LLM output ──

function buildReviewSchema(criteria: ReviewCriterion[]) {
  return z.object({
    criteria: z.array(
      z.object({
        id: z.enum(criteria.map((c) => c.id) as [string, ...string[]]),
        pass: z.boolean(),
        issues: z.array(z.string()),
      })
    ),
    suggestions: z.array(z.string()),
  })
}

// ── Task handler ──

type ReviewHandler = (
  handle: TaskHandle<PostcardReviewOutput, PostcardReviewEvent>,
  input: PostcardReviewInput
) => Promise<void>

const handler: ReviewHandler = async (handle, config) => {
  const {
    postcardId,
    imagePath,
    manifest,
    hasReferenceScreenshots,
    previousFeedback,
    criteria: customCriteria,
  } = config

  const criteria = customCriteria ?? DEFAULT_CRITERIA

  // Filter out screenshot criterion if no references were provided
  const activeCriteria = hasReferenceScreenshots
    ? criteria
    : criteria.filter((c) => c.id !== 'screenshot_incorporation')

  handle.emit({ type: 'review_analyzing', postcardId, criteriaCount: activeCriteria.length })
  handle.setProgress(10, 'Loading image for review...')

  // Load the draft image
  const [category, filename] = imagePath.split('/')
  const imageData = await readPersistentImage(category, filename)
  if (!imageData) {
    handle.fail(`Image not found at ${imagePath}`)
    return
  }

  const imageDataUrl = `data:image/png;base64,${imageData.buffer.toString('base64')}`

  // Build review prompt
  const callerNum = manifest.callerNumber
  const displayNum = Number.isInteger(callerNum) ? callerNum.toString() : callerNum.toPrecision(6)

  const criteriaBlock = activeCriteria
    .map((c, i) => `${i + 1}. **${c.name}** (id: "${c.id}")\n   ${c.prompt}`)
    .join('\n\n')

  const prompt = [
    `You are reviewing a generated postcard image for quality before it is delivered to a child.`,
    ``,
    `## Context`,
    `- Caller number: ${displayNum}`,
    `- Child's name: ${manifest.childName}`,
    manifest.childAge ? `- Child's age: ${manifest.childAge}` : '',
    `- Number personality: ${manifest.callerPersonality}`,
    `- Reference screenshots provided: ${hasReferenceScreenshots ? 'yes' : 'no'}`,
    ``,
    `## Review Criteria`,
    `Evaluate the image against each criterion below. For each, determine pass/fail and list specific issues found.`,
    ``,
    criteriaBlock,
    ``,
    previousFeedback
      ? `## Previous Feedback\nThis is a regeneration attempt. The previous version had these issues:\n${previousFeedback}\n\nCheck whether these issues have been resolved.\n`
      : '',
    `## Output`,
    `For each criterion, provide:`,
    `- "id": the criterion id`,
    `- "pass": true if no issues, false if issues found`,
    `- "issues": array of specific issues (empty if pass)`,
    ``,
    `Also provide "suggestions": actionable feedback for regeneration if any criteria fail.`,
  ]
    .filter(Boolean)
    .join('\n')

  handle.setProgress(20, 'Analyzing image...')

  // Use streaming LLM via createTaskLLM for admin visibility
  const taskLLM = createTaskLLM(
    handle as TaskHandle<PostcardReviewOutput, PostcardReviewEvent>,
    config._userId
      ? createUsageRecordingMiddleware({
          userId: config._userId,
          feature: 'postcard:review',
          backgroundTaskId: handle.id,
        })
      : undefined
  )
  const schema = buildReviewSchema(activeCriteria)

  let reviewData: z.infer<typeof schema> | undefined

  for await (const event of taskLLM.stream({
    prompt,
    images: [imageDataUrl],
    schema,
    provider: 'openai',
    model: 'gpt-5.4',
    reasoning: { effort: 'medium', summary: 'auto' },
  })) {
    if (event.type === 'complete') {
      reviewData = event.data
    } else if (event.type === 'error') {
      handle.fail(`Review LLM error: ${event.message}`)
      return
    }
  }

  if (!reviewData) {
    handle.fail('Review produced no output')
    return
  }

  handle.setProgress(80, 'Processing review results...')

  // Map results, filling in any missing criteria
  const criteriaResults: CriterionResult[] = activeCriteria.map((c) => {
    const found = reviewData!.criteria.find((r) => r.id === c.id)
    return found ?? { id: c.id, pass: true, issues: [] }
  })

  // Emit per-criterion results
  for (const result of criteriaResults) {
    handle.emit({
      type: 'review_criterion_result',
      postcardId,
      criterionId: result.id,
      pass: result.pass,
      issues: result.issues,
    })
  }

  const pass = criteriaResults.every((r) => r.pass)
  const allIssues = criteriaResults.flatMap((r) => r.issues)

  handle.emit({
    type: 'review_complete',
    postcardId,
    pass,
    issueCount: allIssues.length,
  })

  // Build feedback string for regeneration
  const feedback = formatReviewFeedback(criteriaResults, reviewData.suggestions)

  handle.complete({
    postcardId,
    pass,
    criteriaResults,
    suggestions: reviewData.suggestions,
    feedback,
  })
}

export async function startPostcardReview(
  input: PostcardReviewInput,
  userId?: string,
  parentTaskId?: string
): Promise<string> {
  if (parentTaskId) {
    return createChildTask<PostcardReviewInput, PostcardReviewOutput, PostcardReviewEvent>(
      parentTaskId,
      'postcard-review',
      input,
      handler,
      userId
    )
  }
  return createTask<PostcardReviewInput, PostcardReviewOutput, PostcardReviewEvent>(
    'postcard-review',
    input,
    handler,
    userId
  )
}

function formatReviewFeedback(criteriaResults: CriterionResult[], suggestions: string[]): string {
  const failedCriteria = criteriaResults.filter((r) => !r.pass)
  if (failedCriteria.length === 0) return ''

  const issueLines = failedCriteria.map((r) => `- ${r.id}: ${r.issues.join('; ')}`).join('\n')

  const suggestionLines =
    suggestions.length > 0 ? `\nSuggestions:\n${suggestions.map((s) => `- ${s}`).join('\n')}` : ''

  return `Issues found in previous generation:\n${issueLines}${suggestionLines}\n\nPlease fix these issues in the new image.`
}
