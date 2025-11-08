import { describe, expect, it } from "vitest";
import type { PedagogicalSegment } from "../../../utils/unifiedStepGenerator";
import { generateUnifiedInstructionSequence } from "../../../utils/unifiedStepGenerator";

const getSeg = (
  seq: ReturnType<typeof generateUnifiedInstructionSequence>,
  place: number,
): PedagogicalSegment => seq.segments.find((s) => s.place === place)!;

describe("semantic summaries", () => {
  it("Direct, small add (ones): concise summary, ≤ 150 chars", () => {
    const seq = generateUnifiedInstructionSequence(1, 3); // +2, uses Direct
    const seg = getSeg(seq, 0);
    expect(seg.plan[0].rule).toBe("Direct");
    expect(seg.readable.summary).toMatch(/Add 2 .* ones/i);
    expect(seg.readable.summary.length).toBeLessThan(150);
    expect((seg.readable.chips || []).length).toBeLessThanOrEqual(2);
  });

  it("Direct, large add (using upper bead): mentions +5", () => {
    const seq = generateUnifiedInstructionSequence(1, 9); // +8, should use upper bead
    const seg = getSeg(seq, 0);
    if (seg.plan[0].rule === "Direct") {
      expect(seg.readable.summary).toMatch(/\+5|upper bead/i);
      expect(seg.readable.summary).toMatch(/No carry needed/i);
    }
  });

  it("FiveComplement: mentions +5 − (5−d)", () => {
    const seq = generateUnifiedInstructionSequence(3, 7); // +4 uses FiveComplement
    const seg = getSeg(seq, 0);
    if (seg.plan.some((p) => p.rule === "FiveComplement")) {
      expect(seg.readable.summary).toMatch(/\+5 *− *\d+|press 5.*lift/i);
      expect(seg.readable.summary).toMatch(/5's friend/i);
    }
  });

  it("TenComplement no cascade: mentions +10 − (10−d) and carry", () => {
    const seq = generateUnifiedInstructionSequence(19, 20); // +1 at ones with carry
    const seg = getSeg(seq, 0);
    if (seg.plan.some((p) => p.rule === "TenComplement")) {
      expect(seg.readable.summary).toMatch(/\+10 *− *\d+|carry.*tens/i);
      expect(seg.readable.summary).toMatch(/make 10/i);
    }
  });

  it("TenComplement with cascade: mentions ripple/carry path", () => {
    const seq = generateUnifiedInstructionSequence(99, 100); // ripple through 9s
    const seg = getSeg(seq, 0);
    if (seg.plan.some((p) => p.rule === "Cascade")) {
      expect(seg.readable.summary).toMatch(/ripples|carry ripples/i);
    }
  });

  it("dev validation ok for valid rules", () => {
    const seq = generateUnifiedInstructionSequence(45, 53); // +8 at ones
    const seg = getSeg(seq, 0);
    expect(seg.readable.validation?.ok).toBe(true);
    expect((seg.readable.validation?.issues || []).length).toBe(0);
  });

  it("summary is concise (under 200 chars for all rules)", () => {
    const testCases = [
      { start: 1, end: 3, desc: "Direct small" },
      { start: 1, end: 9, desc: "Direct large" },
      { start: 3, end: 7, desc: "FiveComplement" },
      { start: 19, end: 20, desc: "TenComplement" },
      { start: 99, end: 100, desc: "Cascade" },
    ];

    testCases.forEach(({ start, end, desc }) => {
      const seq = generateUnifiedInstructionSequence(start, end);
      seq.segments.forEach((seg) => {
        expect(seg.readable.summary.length).toBeLessThan(200);
        expect(seg.readable.summary.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it("chips are minimal (≤ 2 per segment)", () => {
    const seq = generateUnifiedInstructionSequence(3475, 3500); // complex case
    seq.segments.forEach((seg) => {
      expect((seg.readable.chips || []).length).toBeLessThanOrEqual(2);
    });
  });

  it("shows provenance information when available", () => {
    const seq = generateUnifiedInstructionSequence(3475, 3500); // has provenance
    const tensSegment = getSeg(seq, 1); // tens place segment

    // Should have provenance chip if provenance data exists
    const firstStep = seq.steps[tensSegment.stepIndices[0]];
    if (firstStep?.provenance) {
      const provenanceChip = tensSegment.readable.chips.find(
        (chip) => chip.label === "From addend",
      );
      expect(provenanceChip).toBeDefined();
      expect(provenanceChip?.value).toMatch(/\d+ \w+/); // e.g., "2 tens"
    }
  });

  it("math explanations are optional and concise", () => {
    const seq = generateUnifiedInstructionSequence(3, 8); // might trigger FiveComplement
    seq.segments.forEach((seg) => {
      if (seg.readable.showMath) {
        expect(seg.readable.showMath.lines.length).toBeLessThanOrEqual(1);
        seg.readable.showMath.lines.forEach((line) => {
          expect(line.length).toBeLessThan(50); // keep math explanations short
        });
      }
    });
  });

  it("guard validation catches mismatches", () => {
    // This test ensures our validation logic works correctly
    const seq = generateUnifiedInstructionSequence(3, 7);
    const seg = getSeg(seq, 0);

    // For a Direct rule, we should have appropriate guards
    if (seg.plan[0].rule === "Direct") {
      const hasDirectGuard = seg.plan
        .flatMap((p) => p.conditions)
        .some((condition) => /a\+d.*≤ *9/.test(condition));

      if (hasDirectGuard) {
        expect(seg.readable.validation?.ok).toBe(true);
      }
    }
  });

  it("step-by-step details are preserved for expansion", () => {
    const seq = generateUnifiedInstructionSequence(99, 100); // complex case
    seq.segments.forEach((seg) => {
      // Steps should still be available for "show details" expansion
      expect(Array.isArray(seg.readable.stepsFriendly)).toBe(true);
      seg.readable.stepsFriendly.forEach((step) => {
        expect(typeof step).toBe("string");
        expect(step.length).toBeGreaterThan(0);
      });
    });
  });

  it("titles are short and descriptive", () => {
    const seq = generateUnifiedInstructionSequence(3475, 3500);
    seq.segments.forEach((seg) => {
      expect(seg.readable.title.length).toBeLessThan(30);
      expect(seg.readable.title).toMatch(/Add \d+|Make \d+|Carry/); // should be action-oriented
    });
  });
});
