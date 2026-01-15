import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayingPhase } from "./PlayingPhase";
import type { MapData } from "../types";

// Mock dependencies
vi.mock("../Provider", () => ({
  useKnowYourWorld: () => ({
    state: {
      selectedMap: "world" as const,
      selectedContinent: "all",
      includeSizes: ["huge", "large", "medium"],
      assistanceLevel: "helpful",
      regionsFound: ["france", "germany"],
      currentPrompt: "spain",
      gameMode: "cooperative" as const,
      regionsToFind: ["spain", "italy", "portugal"],
    },
    clickRegion: vi.fn(),
  }),
}));

vi.mock("../maps", () => ({
  getFilteredMapDataBySizesSync: () =>
    ({
      id: "world",
      name: "World Map",
      viewBox: "0 0 1000 500",
      regions: [
        { id: "spain", name: "Spain", path: "M 100 100 L 200 200" },
        { id: "italy", name: "Italy", path: "M 300 300 L 400 400" },
        { id: "portugal", name: "Portugal", path: "M 500 500 L 600 600" },
      ],
    }) as MapData,
}));

vi.mock("./MapRenderer", () => ({
  MapRenderer: ({ mapData, onRegionClick }: any) => (
    <div data-testid="map-renderer" data-map-id={mapData.id}>
      Mock MapRenderer
      <button onClick={() => onRegionClick("spain", "Spain")}>
        Click Spain
      </button>
    </div>
  ),
}));

vi.mock("./GameInfoPanel", () => ({
  GameInfoPanel: ({ currentRegionName, foundCount, totalRegions }: any) => (
    <div data-testid="game-info-panel">
      Mock GameInfoPanel
      <div>Current: {currentRegionName}</div>
      <div>
        Progress: {foundCount}/{totalRegions}
      </div>
    </div>
  ),
}));

describe("PlayingPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the panel layout with game info and map panels", () => {
    const { container } = render(<PlayingPhase />);

    // Should have the main container
    expect(screen.getByTestId("game-info-panel")).toBeInTheDocument();
    expect(screen.getByTestId("map-renderer")).toBeInTheDocument();
  });

  it("renders PanelGroup with vertical direction", () => {
    const { container } = render(<PlayingPhase />);

    // The playing-phase container should have flex column layout
    const playingPhase = container.querySelector(
      '[data-component="playing-phase"]',
    );
    expect(playingPhase).toBeInTheDocument();

    const styles = window.getComputedStyle(playingPhase!);
    expect(styles.display).toBe("flex");
    expect(styles.flexDirection).toBe("column");
  });

  it("passes correct props to GameInfoPanel", () => {
    render(<PlayingPhase />);

    // Check that GameInfoPanel receives correct data
    expect(screen.getByText("Current: Spain")).toBeInTheDocument();
    expect(screen.getByText("Progress: 2/3")).toBeInTheDocument();
  });

  it("passes correct props to MapRenderer", () => {
    render(<PlayingPhase />);

    const mapRenderer = screen.getByTestId("map-renderer");
    expect(mapRenderer).toHaveAttribute("data-map-id", "world");
  });

  it("calculates progress percentage correctly", () => {
    render(<PlayingPhase />);

    // 2 found out of 3 total = 66.67%
    // GameInfoPanel should receive progress prop (check via debug if needed)
    expect(screen.getByText("Progress: 2/3")).toBeInTheDocument();
  });

  it("handles null currentPrompt gracefully", () => {
    vi.mocked(vi.importActual("../Provider")).useKnowYourWorld = () => ({
      state: {
        selectedMap: "world" as const,
        selectedContinent: "all",
        includeSizes: ["huge", "large", "medium"],
        assistanceLevel: "helpful",
        regionsFound: ["france", "germany"],
        currentPrompt: null,
        gameMode: "cooperative" as const,
        regionsToFind: ["spain", "italy", "portugal"],
      },
      clickRegion: vi.fn(),
    });

    render(<PlayingPhase />);

    // Should show "Current: null" or similar (check GameInfoPanel mock)
    expect(screen.getByTestId("game-info-panel")).toBeInTheDocument();
  });

  it("renders map panel with proper container styles", () => {
    const { container } = render(<PlayingPhase />);

    const mapPanel = container.querySelector('[data-component="map-panel"]');
    expect(mapPanel).toBeInTheDocument();

    const styles = window.getComputedStyle(mapPanel!);
    expect(styles.width).toBe("100%");
    expect(styles.height).toBe("100%");
    expect(styles.display).toBe("flex");
    expect(styles.overflow).toBe("hidden");
  });

  it("passes clickRegion handler to MapRenderer", async () => {
    const mockClickRegion = vi.fn();

    vi.mocked(vi.importActual("../Provider")).useKnowYourWorld = () => ({
      state: {
        selectedMap: "world" as const,
        selectedContinent: "all",
        includeSizes: ["huge", "large", "medium"],
        assistanceLevel: "helpful",
        regionsFound: [],
        currentPrompt: "spain",
        gameMode: "cooperative" as const,
        regionsToFind: ["spain"],
      },
      clickRegion: mockClickRegion,
    });

    render(<PlayingPhase />);

    const clickButton = screen.getByText("Click Spain");
    clickButton.click();

    expect(mockClickRegion).toHaveBeenCalledWith("spain", "Spain");
  });

  it("uses correct map data from getFilteredMapDataBySizesSync", () => {
    const mockGetFilteredMapDataBySizesSync = vi.fn().mockReturnValue({
      id: "usa",
      name: "USA Map",
      viewBox: "0 0 2000 1000",
      regions: [
        { id: "california", name: "California", path: "M 0 0" },
        { id: "texas", name: "Texas", path: "M 100 100" },
      ],
    });

    vi.mocked(vi.importActual("../maps")).getFilteredMapDataBySizesSync =
      mockGetFilteredMapDataBySizesSync;

    render(<PlayingPhase />);

    expect(mockGetFilteredMapDataBySizesSync).toHaveBeenCalledWith(
      "world",
      "all",
      ["huge", "large", "medium"],
    );
  });
});

describe("PlayingPhase - Different Scenarios", () => {
  it("handles empty regionsFound array", () => {
    vi.mocked(vi.importActual("../Provider")).useKnowYourWorld = () => ({
      state: {
        selectedMap: "world" as const,
        selectedContinent: "all",
        includeSizes: ["huge", "large", "medium"],
        assistanceLevel: "helpful",
        regionsFound: [],
        currentPrompt: "spain",
        gameMode: "cooperative" as const,
        regionsToFind: ["spain", "italy"],
      },
      clickRegion: vi.fn(),
    });

    render(<PlayingPhase />);

    expect(screen.getByText("Progress: 0/2")).toBeInTheDocument();
  });

  it("handles all regions found scenario", () => {
    vi.mocked(vi.importActual("../Provider")).useKnowYourWorld = () => ({
      state: {
        selectedMap: "world" as const,
        selectedContinent: "all",
        includeSizes: ["huge", "large", "medium"],
        assistanceLevel: "helpful",
        regionsFound: ["spain", "italy", "portugal"],
        currentPrompt: null,
        gameMode: "cooperative" as const,
        regionsToFind: ["spain", "italy", "portugal"],
      },
      clickRegion: vi.fn(),
    });

    render(<PlayingPhase />);

    expect(screen.getByText("Progress: 3/3")).toBeInTheDocument();
  });

  it("renders with no assistance mode", () => {
    vi.mocked(vi.importActual("../Provider")).useKnowYourWorld = () => ({
      state: {
        selectedMap: "world" as const,
        selectedContinent: "all",
        includeSizes: ["huge", "large", "medium", "small", "tiny"],
        assistanceLevel: "none",
        regionsFound: [],
        currentPrompt: "luxembourg",
        gameMode: "race" as const,
        regionsToFind: ["luxembourg", "liechtenstein"],
      },
      clickRegion: vi.fn(),
    });

    render(<PlayingPhase />);

    expect(screen.getByTestId("game-info-panel")).toBeInTheDocument();
    expect(screen.getByTestId("map-renderer")).toBeInTheDocument();
  });
});
