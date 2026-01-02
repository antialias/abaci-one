import type { LLMProgress, ValidationFeedback } from './types'
import {
  LLMValidationError,
  LLMApiError,
  LLMTruncationError,
  LLMContentFilterError,
  LLMJsonParseError,
} from './types'

/**
 * Options for retry execution
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Progress callback */
  onProgress?: (progress: LLMProgress) => void
  /** Base delay for exponential backoff (ms) */
  baseDelayMs?: number
  /** Maximum delay cap (ms) */
  maxDelayMs?: number
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Content filter errors are never retryable - the model refused
  if (error instanceof LLMContentFilterError) {
    return false
  }

  // Truncation errors might be retryable with a shorter prompt, but not automatically
  if (error instanceof LLMTruncationError) {
    return false
  }

  // Validation errors are retryable - we feed back the error to the LLM
  if (error instanceof LLMValidationError) {
    return true
  }

  // JSON parse errors are retryable - LLM might return valid JSON next time
  if (error instanceof LLMJsonParseError) {
    return true
  }

  // API errors: rate limits and server errors are retryable, client errors are not
  if (error instanceof LLMApiError) {
    return error.isRateLimited() || error.isServerError()
  }

  // Generic errors (network issues, etc.) are retryable
  return true
}

/**
 * Get the delay before retrying an error
 */
export function getRetryDelay(
  error: unknown,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // If it's a rate limit with Retry-After, use that
  if (error instanceof LLMApiError && error.retryAfterMs) {
    return Math.min(error.retryAfterMs, maxDelayMs)
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

/**
 * Execute a function with retry logic and validation feedback
 *
 * On validation failure, the function is called again with the validation
 * error included, allowing the LLM to correct its response.
 *
 * Error handling:
 * - LLMValidationError: Retried with feedback in prompt
 * - LLMJsonParseError: Retried (LLM may return valid JSON)
 * - LLMApiError (429): Retried with Retry-After delay
 * - LLMApiError (5xx): Retried with exponential backoff
 * - LLMApiError (4xx): NOT retried (client error)
 * - LLMContentFilterError: NOT retried (model refused)
 * - LLMTruncationError: NOT retried (need shorter prompt)
 *
 * @param fn - Function to execute, receives validation feedback on retry
 * @param validate - Validation function, returns error or null if valid
 * @param options - Retry options
 */
export async function executeWithRetry<T>(
  fn: (feedback?: ValidationFeedback) => Promise<T>,
  validate: (result: T) => ValidationFeedback | null,
  options: RetryOptions
): Promise<{ result: T; attempts: number }> {
  const {
    maxRetries,
    onProgress,
    baseDelayMs = 1000,
    maxDelayMs = 60000,
  } = options
  const maxAttempts = maxRetries + 1

  let lastFeedback: ValidationFeedback | undefined
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Report progress
    onProgress?.({
      stage: attempt === 1 ? 'calling' : 'retrying',
      attempt,
      maxAttempts,
      message:
        attempt === 1
          ? 'Calling LLM...'
          : `Retry ${attempt - 1}/${maxRetries}: fixing ${lastFeedback?.field ?? 'error'}`,
      validationError: lastFeedback,
    })

    try {
      // Call the function (with feedback on retry)
      const result = await fn(lastFeedback)

      // Report validation stage
      onProgress?.({
        stage: 'validating',
        attempt,
        maxAttempts,
        message: 'Validating response...',
      })

      // Validate the result
      const error = validate(result)

      if (!error) {
        // Success!
        return { result, attempts: attempt }
      }

      // Validation failed
      if (attempt < maxAttempts) {
        // Store feedback for next attempt
        lastFeedback = error

        // Backoff before retry
        const delayMs = getRetryDelay(null, attempt, baseDelayMs, maxDelayMs)
        await sleep(delayMs)
      } else {
        // Out of retries
        throw new LLMValidationError(error)
      }
    } catch (error) {
      // Re-throw validation errors from final attempt
      if (error instanceof LLMValidationError) {
        throw error
      }

      // Check if this error is retryable
      if (!isRetryableError(error)) {
        throw error
      }

      // Store for potential re-throw
      lastError = error as Error

      if (attempt < maxAttempts) {
        // Calculate delay based on error type
        const delayMs = getRetryDelay(error, attempt, baseDelayMs, maxDelayMs)

        // For JSON parse errors, convert to validation feedback for next attempt
        if (error instanceof LLMJsonParseError) {
          lastFeedback = {
            field: 'root',
            error: 'Response was not valid JSON',
            received: error.rawContent.substring(0, 500),
          }
        }

        await sleep(delayMs)
      } else {
        throw lastError
      }
    }
  }

  // Should never reach here
  throw lastError ?? new Error('Retry logic failed unexpectedly')
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build validation feedback message for inclusion in retry prompt
 */
export function buildFeedbackPrompt(feedback: ValidationFeedback): string {
  let prompt = '\n\nPREVIOUS ATTEMPT HAD VALIDATION ERROR:\n'
  prompt += `Field: ${feedback.field}\n`
  prompt += `Error: ${feedback.error}\n`

  if (feedback.received !== undefined) {
    prompt += `Received: ${JSON.stringify(feedback.received)}\n`
  }

  if (feedback.expected !== undefined) {
    prompt += `Expected: ${JSON.stringify(feedback.expected)}\n`
  }

  if (feedback.validOptions && feedback.validOptions.length > 0) {
    prompt += `Valid options: ${feedback.validOptions.join(', ')}\n`
  }

  prompt += '\nPlease correct this error and provide a valid response.'

  return prompt
}
