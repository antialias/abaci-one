import type { StreamMiddleware } from "../middleware";
import type { StreamEvent } from "../types";

/**
 * Options for the persistence middleware.
 */
export interface PersistenceOptions {
	/**
	 * Interval between snapshots in milliseconds.
	 * @default 3000
	 */
	snapshotIntervalMs?: number;

	/**
	 * Called on each reasoning event (for transient emission).
	 * @param text - The reasoning text (delta or full)
	 * @param isDelta - Whether this is a delta (partial) or complete text
	 * @param accumulated - The full accumulated reasoning text so far
	 */
	onReasoning?: (text: string, isDelta: boolean, accumulated: string) => void;

	/**
	 * Called on each output_delta event (for transient emission).
	 * @param text - The output delta text
	 * @param accumulated - The full accumulated output text so far
	 */
	onOutputDelta?: (text: string, accumulated: string) => void;

	/**
	 * Called periodically with accumulated reasoning (for persistence).
	 * @param text - The full accumulated reasoning text
	 */
	onReasoningSnapshot?: (text: string) => void | Promise<void>;

	/**
	 * Called periodically with accumulated output (for persistence).
	 * @param text - The full accumulated output text
	 */
	onOutputSnapshot?: (text: string) => void | Promise<void>;
}

/**
 * Create a middleware that accumulates streaming text and triggers callbacks.
 *
 * This middleware:
 * - Accumulates reasoning and output text as events flow through
 * - Calls per-event callbacks (for transient Socket.IO emission)
 * - Periodically calls snapshot callbacks (for DB persistence)
 * - Calls final snapshot on stream completion
 *
 * @example
 * ```typescript
 * const middleware = createPersistenceMiddleware({
 *   snapshotIntervalMs: 3000,
 *   onReasoning: (text, isDelta, accumulated) => {
 *     socket.emit('reasoning', { text, isDelta })
 *   },
 *   onReasoningSnapshot: async (text) => {
 *     await db.update({ reasoningText: text })
 *   },
 * })
 *
 * const clientWithPersistence = client.with(middleware)
 * ```
 */
export function createPersistenceMiddleware(
	options: PersistenceOptions,
): StreamMiddleware {
	return {
		async *wrap<T>(
			stream: AsyncGenerator<StreamEvent<T>, void, unknown>,
		): AsyncGenerator<StreamEvent<T>, void, unknown> {
			let reasoningText = "";
			let outputText = "";
			let lastSnapshotTime = Date.now();
			let lastReasoningSnapshot = "";
			let lastOutputSnapshot = "";
			const interval = options.snapshotIntervalMs ?? 3000;

			const maybeSnapshot = async () => {
				const now = Date.now();
				if (now - lastSnapshotTime >= interval) {
					lastSnapshotTime = now;
					if (reasoningText && reasoningText !== lastReasoningSnapshot) {
						lastReasoningSnapshot = reasoningText;
						await options.onReasoningSnapshot?.(reasoningText);
					}
					if (outputText && outputText !== lastOutputSnapshot) {
						lastOutputSnapshot = outputText;
						await options.onOutputSnapshot?.(outputText);
					}
				}
			};

			try {
				for await (const event of stream) {
					if (event.type === "reasoning") {
						const delta = event.text;
						reasoningText = event.isDelta ? reasoningText + delta : delta;
						options.onReasoning?.(delta, event.isDelta, reasoningText);
						await maybeSnapshot();
					} else if (event.type === "output_delta") {
						outputText += event.text;
						options.onOutputDelta?.(event.text, outputText);
						await maybeSnapshot();
					}
					yield event;
				}
			} finally {
				// Final snapshot on stream end (success, error, or cancellation)
				if (reasoningText && reasoningText !== lastReasoningSnapshot) {
					await options.onReasoningSnapshot?.(reasoningText);
				}
				if (outputText && outputText !== lastOutputSnapshot) {
					await options.onOutputSnapshot?.(outputText);
				}
			}
		},
	};
}
