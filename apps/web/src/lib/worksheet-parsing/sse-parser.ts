/**
 * Shared SSE (Server-Sent Events) Parser
 *
 * Provides a unified utility for parsing SSE streams from worksheet parsing endpoints.
 * Used by both initial parse and selective re-parse operations.
 */

import type { WorksheetParsingResult, BoundingBox } from "./schemas";
import type { ParsingStats, CompletedProblem } from "./state-machine";

// ============================================================================
// Types
// ============================================================================

/**
 * Callbacks for SSE stream events
 *
 * Each callback is optional - only provide the ones you need
 */
export interface SSECallbacks {
  /** Called when the response is created (initial connection established) */
  onStarted?: (responseId: string) => void;

  /** Called with reasoning text (model's thinking process) */
  onReasoning?: (text: string, isDelta: boolean, summaryIndex?: number) => void;

  /** Called with output deltas (partial JSON being generated) */
  onOutputDelta?: (text: string, outputIndex?: number) => void;

  /** Called when a problem parsing starts (re-parse only) */
  onProblemStart?: (
    problemIndex: number,
    problemNumber: number,
    currentIndex: number,
    totalProblems: number,
  ) => void;

  /** Called when a problem is fully parsed */
  onProblemComplete?: (
    problemIndex: number,
    problemNumber: number,
    result: unknown,
    currentIndex: number,
    totalProblems: number,
  ) => void;

  /** Called when a specific problem fails (re-parse only) */
  onProblemError?: (problemIndex: number, message: string) => void;

  /** Called when the entire operation completes successfully */
  onComplete?: (
    result: WorksheetParsingResult,
    stats?: ParsingStats,
    status?: string,
  ) => void;

  /** Called when the operation fails */
  onError?: (message: string, code?: string) => void;

  /** Called when the operation is cancelled */
  onCancelled?: () => void;

  /** Called with progress messages */
  onProgress?: (message: string) => void;
}

/**
 * Parse result event from SSE stream
 */
interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parse an SSE stream from a worksheet parsing endpoint
 *
 * Handles both:
 * - Initial parse streams (/parse/stream)
 * - Selective re-parse streams (/parse-selected/stream)
 *
 * @param response - The fetch Response with SSE body
 * @param callbacks - Event callbacks to invoke
 * @param signal - Optional AbortSignal for cancellation
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/.../parse/stream', { method: 'POST', signal })
 * await parseSSEStream(response, {
 *   onReasoning: (text) => setReasoningText(prev => prev + text),
 *   onComplete: (result) => dispatch({ type: 'PARSE_COMPLETE', result }),
 *   onError: (message) => dispatch({ type: 'PARSE_FAILED', error: message }),
 * }, signal)
 * ```
 */
export async function parseSSEStream(
  response: Response,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;

  try {
    while (true) {
      // Check for cancellation
      if (signal?.aborted) {
        callbacks.onCancelled?.();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        // Event type line
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }

        // Data line
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          // Skip [DONE] marker
          if (data === "[DONE]") {
            currentEvent = null;
            continue;
          }

          try {
            const event = JSON.parse(data) as SSEEvent;
            const eventType = currentEvent ?? event.type;

            handleSSEEvent(eventType, event, callbacks);
          } catch {
            // Ignore malformed JSON
          }

          currentEvent = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle a single SSE event by invoking the appropriate callback
 */
function handleSSEEvent(
  eventType: string,
  event: SSEEvent,
  callbacks: SSECallbacks,
): void {
  switch (eventType) {
    // Connection established
    case "started":
    case "response.created": {
      const response = event.response as { id?: string } | undefined;
      callbacks.onStarted?.(String(event.responseId ?? response?.id ?? ""));
      break;
    }

    // Progress updates
    case "progress":
      callbacks.onProgress?.(String(event.message ?? ""));
      break;

    // Reasoning text
    case "reasoning":
      callbacks.onReasoning?.(
        String(event.text ?? ""),
        Boolean(event.isDelta),
        typeof event.summaryIndex === "number" ? event.summaryIndex : undefined,
      );
      break;

    // Output delta (partial JSON)
    case "output_delta":
      callbacks.onOutputDelta?.(
        String(event.text ?? event.delta ?? ""),
        typeof event.outputIndex === "number" ? event.outputIndex : undefined,
      );
      break;

    // Problem parsing started (re-parse only)
    case "problem_start":
      callbacks.onProblemStart?.(
        Number(event.problemIndex ?? 0),
        Number(event.problemNumber ?? 0),
        Number(event.currentIndex ?? 0),
        Number(event.totalProblems ?? 0),
      );
      break;

    // Problem parsing completed
    case "problem_complete":
      callbacks.onProblemComplete?.(
        Number(event.problemIndex ?? 0),
        Number(event.problemNumber ?? 0),
        event.result,
        Number(event.currentIndex ?? 0),
        Number(event.totalProblems ?? 0),
      );
      break;

    // Individual problem error (re-parse only)
    case "problem_error":
      callbacks.onProblemError?.(
        Number(event.problemIndex ?? 0),
        String(event.message ?? "Unknown error"),
      );
      break;

    // Operation completed successfully
    case "complete": {
      // Handle both initial parse and re-parse complete events
      const result = (event.result ??
        event.updatedResult) as WorksheetParsingResult;
      const stats = event.stats as ParsingStats | undefined;
      const status = String(event.status ?? "");
      callbacks.onComplete?.(result, stats, status);
      break;
    }

    // Operation cancelled
    case "cancelled":
      callbacks.onCancelled?.();
      break;

    // Error occurred
    case "error":
      callbacks.onError?.(
        String(event.message ?? "Unknown error"),
        String(event.code ?? ""),
      );
      break;
  }
}

// ============================================================================
// Helper: Extract Completed Problems from Partial JSON
// ============================================================================

/**
 * Extract completed problems from partial JSON output for progressive highlighting
 *
 * This parses incomplete JSON to find fully-formed problem objects within
 * the "problems" array. Used to highlight problems as they're streamed.
 *
 * @param partialJson - Incomplete JSON string from streaming output
 * @returns Array of completed problems with their bounding boxes
 */
export function extractCompletedProblemsFromPartialJson(
  partialJson: string,
): CompletedProblem[] {
  const problems: CompletedProblem[] = [];

  // Find the problems array start
  const problemsMatch = partialJson.match(/"problems"\s*:\s*\[/);
  if (!problemsMatch) return problems;

  const startIndex = problemsMatch.index! + problemsMatch[0].length;
  let depth = 1; // We're inside the array
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < partialJson.length; i++) {
    const char = partialJson[i];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    // Handle string boundaries
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Skip characters inside strings
    if (inString) continue;

    // Track brace depth
    if (char === "{") {
      if (depth === 1 && objectStart === -1) {
        objectStart = i;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 1 && objectStart !== -1) {
        // We've found a complete object
        const objectStr = partialJson.slice(objectStart, i + 1);
        objectStart = -1;

        try {
          const obj = JSON.parse(objectStr);
          if (
            typeof obj.problemNumber === "number" &&
            obj.problemBoundingBox &&
            typeof obj.problemBoundingBox.x === "number"
          ) {
            problems.push({
              problemNumber: obj.problemNumber,
              problemBoundingBox: obj.problemBoundingBox as BoundingBox,
            });
          }
        } catch {
          // Not a valid JSON object yet
        }
      }
    } else if (char === "]" && depth === 1) {
      // End of problems array
      break;
    }
  }

  return problems;
}
