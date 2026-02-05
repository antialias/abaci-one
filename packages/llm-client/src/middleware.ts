import type { StreamEvent } from "./types";

/**
 * Middleware wraps an async generator stream, allowing interception,
 * accumulation, and transformation of events.
 *
 * Middleware is applied in order: first middleware wraps raw stream,
 * second wraps first's output, etc.
 *
 * ```
 * Raw Stream → Middleware1.wrap() → Middleware2.wrap() → Consumer
 * ```
 *
 * @example
 * ```typescript
 * const loggingMiddleware: StreamMiddleware = {
 *   async *wrap(stream) {
 *     for await (const event of stream) {
 *       console.log('Event:', event.type)
 *       yield event
 *     }
 *   }
 * }
 * ```
 */
export interface StreamMiddleware {
	/**
	 * Wrap the stream. Can:
	 * - Pass events through unchanged
	 * - Transform events
	 * - Emit additional events
	 * - Accumulate state and trigger side effects
	 *
	 * @param stream - The upstream stream to wrap
	 * @returns A new async generator that yields (possibly transformed) events
	 */
	wrap<T>(
		stream: AsyncGenerator<StreamEvent<T>, void, unknown>,
	): AsyncGenerator<StreamEvent<T>, void, unknown>;
}
