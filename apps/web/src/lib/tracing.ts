/**
 * OpenTelemetry Tracing Utilities
 *
 * This file exports helper functions for working with traces in the application.
 * The OpenTelemetry SDK is initialized via instrumentation.js (loaded with --require).
 *
 * IMPORTANT: @opentelemetry/api is imported lazily (inside functions) to avoid
 * pulling it into the Next.js vendor chunk graph at module scope, which causes
 * "Cannot find module './vendor-chunks/@opentelemetry+api@..." errors in dev.
 *
 * Usage:
 *   import { getCurrentTraceId, recordError } from '@/lib/tracing'
 *
 *   // In error handlers:
 *   const traceId = getCurrentTraceId()
 *   return NextResponse.json({ error: 'Something failed', traceId }, { status: 500 })
 */

type OtelApi = typeof import('@opentelemetry/api')

function getOtel(): OtelApi {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@opentelemetry/api')
}

/**
 * Get the current trace ID (useful for error responses)
 */
export function getCurrentTraceId(): string | null {
  const { trace } = getOtel()
  const span = trace.getActiveSpan()
  if (!span) return null
  return span.spanContext().traceId
}

/**
 * Get the current span context for logging
 */
export function getTraceContext(): { traceId: string; spanId: string } | null {
  const { trace } = getOtel()
  const span = trace.getActiveSpan()
  if (!span) return null
  const ctx = span.spanContext()
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
  }
}

/**
 * Add an error to the current span
 */
export function recordError(error: Error, attributes?: Record<string, string>): void {
  const { trace, SpanStatusCode } = getOtel()
  const span = trace.getActiveSpan()
  if (!span) return
  span.recordException(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  if (attributes) {
    span.setAttributes(attributes)
  }
}

/**
 * Create a custom span for tracing a specific operation
 */
export function withSpan<T>(name: string, fn: () => T, attributes?: Record<string, string>): T {
  const { trace, SpanStatusCode } = getOtel()
  const tracer = trace.getTracer('abaci-app')
  return tracer.startActiveSpan(name, (span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes)
      }
      const result = fn()
      span.end()
      return result
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      }
      span.end()
      throw error
    }
  })
}

/**
 * Create a custom span for tracing an async operation
 */
export async function withSpanAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> {
  const { trace, SpanStatusCode } = getOtel()
  const tracer = trace.getTracer('abaci-app')
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes)
      }
      const result = await fn()
      span.end()
      return result
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      }
      span.end()
      throw error
    }
  })
}
