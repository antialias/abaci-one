import { describe, expect, it } from "vitest";
import {
  buildSyncedLyricsModel,
  findActiveLocation,
  type SongLyricsSection,
} from "../src/alignment";

const sections: SongLyricsSection[] = [
  { name: "Verse 1", lines: ["Detective Fern on the case"], durationMs: 5000 },
];

describe("buildSyncedLyricsModel", () => {
  it("parses ElevenLabs detailed words_timestamps in milliseconds", () => {
    const model = buildSyncedLyricsModel(sections, {
      words_timestamps: [
        { word: "Detective", start_ms: 4360, end_ms: 4899 },
        { word: "Fern", start_ms: 4960, end_ms: 5319 },
        { word: "on", start_ms: 5380, end_ms: 5559 },
        { word: "the", start_ms: 5619, end_ms: 5899 },
        { word: "case", start_ms: 5920, end_ms: 6500 },
      ],
    });

    expect(model.hasAlignment).toBe(true);
    expect(model.sections[0].lines[0].words?.[0]).toEqual({
      text: "Detective",
      startMs: 4360,
      endMs: 4899,
    });
    expect(model.totalDurationMs).toBe(6500);
  });

  it("parses parallel-array alignment in seconds", () => {
    const model = buildSyncedLyricsModel(sections, {
      words: ["Detective", "Fern", "on", "the", "case"],
      word_start_times_seconds: [4.36, 4.96, 5.38, 5.619, 5.92],
      word_end_times_seconds: [4.899, 5.319, 5.559, 5.899, 6.5],
    });

    expect(model.sections[0].lines[0].words?.[0]?.startMs).toBe(4360);
    expect(model.totalDurationMs).toBe(6500);
  });

  it("accepts alignment nested under metadata and preserves canonical punctuation", () => {
    const punctuated = [
      { name: "Hook", lines: ["Hello, wire!"], durationMs: 1200 },
    ];
    const model = buildSyncedLyricsModel(punctuated, {
      metadata: {
        words: [
          { text: "Hello", start_seconds: 0.1, end_seconds: 0.5 },
          { text: "wire", start_seconds: 0.6, end_seconds: 1.1 },
        ],
      },
    });

    expect(model.sections[0].lines[0].words?.map((word) => word.text)).toEqual([
      "Hello,",
      "wire!",
    ]);
  });

  it("falls back to static lyrics and plan duration without alignment", () => {
    const model = buildSyncedLyricsModel(sections, null);
    expect(model).toMatchObject({ hasAlignment: false, totalDurationMs: 5000 });
    expect(model.sections[0].lines[0]).toMatchObject({
      rawText: "Detective Fern on the case",
      words: null,
    });
  });
});

describe("findActiveLocation", () => {
  it("returns the latest word whose start time has passed", () => {
    const model = buildSyncedLyricsModel(sections, {
      words_timestamps: [
        { word: "Detective", start_ms: 100, end_ms: 200 },
        { word: "Fern", start_ms: 300, end_ms: 400 },
        { word: "on", start_ms: 500, end_ms: 600 },
        { word: "the", start_ms: 700, end_ms: 800 },
        { word: "case", start_ms: 900, end_ms: 1000 },
      ],
    });

    expect(findActiveLocation(model, 50)).toBeNull();
    expect(findActiveLocation(model, 550)).toEqual({
      sectionIndex: 0,
      lineIndex: 0,
      wordIndex: 2,
    });
  });
});
