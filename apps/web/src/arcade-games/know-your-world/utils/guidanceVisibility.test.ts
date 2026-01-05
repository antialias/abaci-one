import { describe, it, expect } from "vitest";
import { ASSISTANCE_LEVELS } from "../maps";
import {
  shouldShowGuidanceDropdown,
  shouldShowAutoHintToggle,
  shouldShowAutoSpeakToggle,
  shouldShowHotColdToggle,
  getFeatureBadges,
} from "./guidanceVisibility";

describe("Guidance Visibility - shouldShowGuidanceDropdown", () => {
  it("shows dropdown for Learning level (has hints and hot/cold)", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    expect(shouldShowGuidanceDropdown(learning)).toBe(true);
  });

  it("shows dropdown for Guided level (has hints and hot/cold)", () => {
    const guided = ASSISTANCE_LEVELS.find((l) => l.id === "guided")!;
    expect(shouldShowGuidanceDropdown(guided)).toBe(true);
  });

  it("shows dropdown for Helpful level (has hints and hot/cold)", () => {
    const helpful = ASSISTANCE_LEVELS.find((l) => l.id === "helpful")!;
    expect(shouldShowGuidanceDropdown(helpful)).toBe(true);
  });

  it("shows dropdown for Standard level (has limited hints)", () => {
    const standard = ASSISTANCE_LEVELS.find((l) => l.id === "standard")!;
    expect(shouldShowGuidanceDropdown(standard)).toBe(true);
  });

  it("hides dropdown for No Assistance level (no hints, no hot/cold)", () => {
    const none = ASSISTANCE_LEVELS.find((l) => l.id === "none")!;
    expect(shouldShowGuidanceDropdown(none)).toBe(false);
  });
});

describe("Guidance Visibility - shouldShowAutoHintToggle", () => {
  it("shows toggle for Learning level (hintsMode: onRequest)", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    expect(shouldShowAutoHintToggle(learning)).toBe(true);
  });

  it("shows toggle for Guided level (hintsMode: onRequest)", () => {
    const guided = ASSISTANCE_LEVELS.find((l) => l.id === "guided")!;
    expect(shouldShowAutoHintToggle(guided)).toBe(true);
  });

  it("shows toggle for Helpful level (hintsMode: onRequest)", () => {
    const helpful = ASSISTANCE_LEVELS.find((l) => l.id === "helpful")!;
    expect(shouldShowAutoHintToggle(helpful)).toBe(true);
  });

  it("shows toggle for Standard level (hintsMode: limited)", () => {
    const standard = ASSISTANCE_LEVELS.find((l) => l.id === "standard")!;
    expect(shouldShowAutoHintToggle(standard)).toBe(true);
  });

  it("hides toggle for No Assistance level (hintsMode: none)", () => {
    const none = ASSISTANCE_LEVELS.find((l) => l.id === "none")!;
    expect(shouldShowAutoHintToggle(none)).toBe(false);
  });
});

describe("Guidance Visibility - shouldShowAutoSpeakToggle", () => {
  it("shows toggle for Learning level (hints available)", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    expect(shouldShowAutoSpeakToggle(learning)).toBe(true);
  });

  it("shows toggle for Standard level (limited hints available)", () => {
    const standard = ASSISTANCE_LEVELS.find((l) => l.id === "standard")!;
    expect(shouldShowAutoSpeakToggle(standard)).toBe(true);
  });

  it("hides toggle for No Assistance level (no hints)", () => {
    const none = ASSISTANCE_LEVELS.find((l) => l.id === "none")!;
    expect(shouldShowAutoSpeakToggle(none)).toBe(false);
  });
});

describe("Guidance Visibility - shouldShowHotColdToggle", () => {
  it("shows toggle for Learning level (hotColdEnabled: true)", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    expect(shouldShowHotColdToggle(learning)).toBe(true);
  });

  it("shows toggle for Guided level (hotColdEnabled: true)", () => {
    const guided = ASSISTANCE_LEVELS.find((l) => l.id === "guided")!;
    expect(shouldShowHotColdToggle(guided)).toBe(true);
  });

  it("shows toggle for Helpful level (hotColdEnabled: true)", () => {
    const helpful = ASSISTANCE_LEVELS.find((l) => l.id === "helpful")!;
    expect(shouldShowHotColdToggle(helpful)).toBe(true);
  });

  it("hides toggle for Standard level (hotColdEnabled: false)", () => {
    const standard = ASSISTANCE_LEVELS.find((l) => l.id === "standard")!;
    expect(shouldShowHotColdToggle(standard)).toBe(false);
  });

  it("hides toggle for No Assistance level (hotColdEnabled: false)", () => {
    const none = ASSISTANCE_LEVELS.find((l) => l.id === "none")!;
    expect(shouldShowHotColdToggle(none)).toBe(false);
  });
});

describe("Feature Badges - getFeatureBadges", () => {
  it("generates correct badges for Learning level", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    const badges = getFeatureBadges(learning);

    const labels = badges.map((b) => b.label);
    expect(labels).toContain("Type to unlock");
    expect(labels).toContain("Hot/cold");
    expect(labels).toContain("Auto-hints");
    expect(labels).toContain("Shows names");
  });

  it("generates correct badges for Guided level", () => {
    const guided = ASSISTANCE_LEVELS.find((l) => l.id === "guided")!;
    const badges = getFeatureBadges(guided);

    const labels = badges.map((b) => b.label);
    expect(labels).not.toContain("Type to unlock"); // No name confirmation
    expect(labels).toContain("Hot/cold");
    expect(labels).toContain("Auto-hints");
    expect(labels).toContain("Shows names");
  });

  it("generates correct badges for Helpful level", () => {
    const helpful = ASSISTANCE_LEVELS.find((l) => l.id === "helpful")!;
    const badges = getFeatureBadges(helpful);

    const labels = badges.map((b) => b.label);
    expect(labels).toContain("Hot/cold");
    expect(labels).toContain("Hints"); // Not auto-hints
    expect(labels).not.toContain("Auto-hints");
    expect(labels).toContain("Shows names");
  });

  it("generates correct badges for Standard level", () => {
    const standard = ASSISTANCE_LEVELS.find((l) => l.id === "standard")!;
    const badges = getFeatureBadges(standard);

    const labels = badges.map((b) => b.label);
    expect(labels).not.toContain("Hot/cold");
    expect(labels).toContain("3 hints"); // Limited hints
    expect(labels).not.toContain("Shows names"); // wrongClickShowsName: false
  });

  it("generates no badges for No Assistance level", () => {
    const none = ASSISTANCE_LEVELS.find((l) => l.id === "none")!;
    const badges = getFeatureBadges(none);

    expect(badges).toHaveLength(0);
  });

  it("badges have correct icons", () => {
    const learning = ASSISTANCE_LEVELS.find((l) => l.id === "learning")!;
    const badges = getFeatureBadges(learning);

    const typeToUnlock = badges.find((b) => b.label === "Type to unlock");
    expect(typeToUnlock?.icon).toBe("⌨️");

    const hotCold = badges.find((b) => b.label === "Hot/cold");
    expect(hotCold?.icon).toBe("🔥");

    const autoHints = badges.find((b) => b.label === "Auto-hints");
    expect(autoHints?.icon).toBe("💡");

    const showsNames = badges.find((b) => b.label === "Shows names");
    expect(showsNames?.icon).toBe("👁️");
  });
});

describe("Assistance Level Configuration Consistency", () => {
  it("all 5 levels are defined", () => {
    expect(ASSISTANCE_LEVELS).toHaveLength(5);
  });

  it("levels have required properties", () => {
    for (const level of ASSISTANCE_LEVELS) {
      expect(level.id).toBeDefined();
      expect(level.label).toBeDefined();
      expect(level.emoji).toBeDefined();
      expect(level.description).toBeDefined();
      expect(typeof level.hotColdEnabled).toBe("boolean");
      expect(["onRequest", "limited", "none"]).toContain(level.hintsMode);
      expect(typeof level.autoHintDefault).toBe("boolean");
      expect(typeof level.wrongClickShowsName).toBe("boolean");
    }
  });

  it("levels are ordered from most to least assistance", () => {
    const ids = ASSISTANCE_LEVELS.map((l) => l.id);
    expect(ids).toEqual(["learning", "guided", "helpful", "standard", "none"]);
  });

  it("only Learning level has nameConfirmationLetters", () => {
    const levelsWithConfirmation = ASSISTANCE_LEVELS.filter(
      (l) =>
        l.nameConfirmationLetters !== undefined &&
        l.nameConfirmationLetters > 0,
    );
    expect(levelsWithConfirmation).toHaveLength(1);
    expect(levelsWithConfirmation[0].id).toBe("learning");
  });

  it("only Standard level has limited hints", () => {
    const levelsWithLimitedHints = ASSISTANCE_LEVELS.filter(
      (l) => l.hintsMode === "limited",
    );
    expect(levelsWithLimitedHints).toHaveLength(1);
    expect(levelsWithLimitedHints[0].id).toBe("standard");
    expect(levelsWithLimitedHints[0].hintLimit).toBe(3);
  });

  it("only No Assistance level has hintsMode: none", () => {
    const levelsWithNoHints = ASSISTANCE_LEVELS.filter(
      (l) => l.hintsMode === "none",
    );
    expect(levelsWithNoHints).toHaveLength(1);
    expect(levelsWithNoHints[0].id).toBe("none");
  });
});
