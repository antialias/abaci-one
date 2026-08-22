import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncedLyricsPlayer } from "../SyncedLyricsPlayer";

const useSongAlignment = vi.fn();

vi.mock("@/hooks/useSongAlignment", () => ({
  useSongAlignment: (path: string | null) => useSongAlignment(path),
}));

describe("SyncedLyricsPlayer adapter", () => {
  beforeEach(() => {
    useSongAlignment.mockReturnValue({
      data: {
        words_timestamps: [
          { word: "The", start_ms: 100, end_ms: 300 },
          { word: "wire", start_ms: 350, end_ms: 700 },
          { word: "remembers", start_ms: 750, end_ms: 1200 },
        ],
      },
    });
  });

  it("keeps Abaci fetching while the package owns rendering and sync", () => {
    render(
      <SyncedLyricsPlayer
        audioPath="/api/audio/songs/arrival"
        alignmentPath="/api/audio/songs/arrival/alignment"
        title="Arrival"
        variant="full"
        lyrics={[
          { name: "Verse 1", lines: ["The wire remembers"], durationMs: 1400 },
        ]}
      />,
    );

    expect(useSongAlignment).toHaveBeenCalledWith(
      "/api/audio/songs/arrival/alignment",
    );
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(
      document.querySelector('[data-component="karaoke-player"]'),
    ).toHaveAttribute("data-has-alignment", "true");
  });
});
