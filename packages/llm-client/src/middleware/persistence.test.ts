import { describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "../types";
import { createPersistenceMiddleware } from "./persistence";

async function* events(
	list: StreamEvent<unknown>[],
): AsyncGenerator<StreamEvent<unknown>, void, unknown> {
	yield* list;
}

describe("createPersistenceMiddleware", () => {
	it("clears the accumulated output on output_reset", async () => {
		const onOutputDelta = vi.fn();
		const onOutputReset = vi.fn();
		const onOutputSnapshot = vi.fn();
		const mw = createPersistenceMiddleware({
			snapshotIntervalMs: 0,
			onOutputDelta,
			onOutputReset,
			onOutputSnapshot,
		});
		const seen: string[] = [];
		for await (const event of mw.wrap(
			events([
				{ type: "output_delta", text: '{"a":', outputIndex: 0 },
				{ type: "output_reset" },
				{ type: "output_delta", text: '{"b":1}', outputIndex: 0 },
			]),
		)) {
			seen.push(event.type);
		}
		expect(seen).toEqual(["output_delta", "output_reset", "output_delta"]);
		expect(onOutputReset).toHaveBeenCalledTimes(1);
		expect(onOutputDelta).toHaveBeenLastCalledWith('{"b":1}', '{"b":1}');
		// The voided answer's snapshot is replaced, never left for a reload.
		expect(onOutputSnapshot.mock.calls.map((c) => c[0])).toEqual([
			'{"a":',
			"",
			'{"b":1}',
		]);
	});
});
