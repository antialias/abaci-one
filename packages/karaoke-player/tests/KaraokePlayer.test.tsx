import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KaraokePlayer } from "../src/KaraokePlayer";

const lyrics = [
  { name: "Hook", lines: ["The circuit remembers"], durationMs: 2000 },
];
const alignment = {
  words_timestamps: [
    { word: "The", start_ms: 100, end_ms: 400 },
    { word: "circuit", start_ms: 500, end_ms: 900 },
    { word: "remembers", start_ms: 1000, end_ms: 1800 },
  ],
};

describe("KaraokePlayer", () => {
  it("renders host-provided lyrics and alignment without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <KaraokePlayer
        audioSrc="/track.mp3"
        title="The Circuit Remembers"
        lyrics={lyrics}
        alignment={alignment}
        variant="full"
      />,
    );

    expect(screen.getByText("The Circuit Remembers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "circuit" })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-has-alignment="true"]'),
    ).toBeInTheDocument();
  });

  it("plays, pauses, and fires onFirstPlay once", async () => {
    const onFirstPlay = vi.fn();
    render(
      <KaraokePlayer
        audioSrc="/track.mp3"
        lyrics={lyrics}
        alignment={alignment}
        onFirstPlay={onFirstPlay}
      />,
    );

    const play = screen.getByRole("button", { name: "Play song" });
    fireEvent.click(play);
    expect(
      await screen.findByRole("button", { name: "Pause song" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause song" }));
    fireEvent.click(screen.getByRole("button", { name: "Play song" }));
    expect(onFirstPlay).toHaveBeenCalledTimes(1);
  });

  it("collapses and expands the row variant", () => {
    render(
      <KaraokePlayer
        audioSrc="/track.mp3"
        title="Row track"
        lyrics={lyrics}
        variant="row"
      />,
    );

    const title = screen.getByRole("button", { name: "Row track" });
    expect(title).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "true");
  });

  it("labels lyric-free songs as instrumental", () => {
    render(
      <KaraokePlayer audioSrc="/instrumental.mp3" lyrics={[]} variant="full" />,
    );
    expect(
      screen.getByText("Instrumental track — no lyrics"),
    ).toBeInTheDocument();
  });
});
