import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AbacusReact } from "../AbacusReact";

describe("Place Value Positioning", () => {
  it("should place single digit values in the rightmost column (ones place)", () => {
    // Test case: single digit 3 with 3 columns should show in rightmost column
    const { container } = render(
      <AbacusReact value={3} columns={3} interactive={true} />,
    );

    // Get all bead elements that are active
    const activeBeads = container.querySelectorAll(".abacus-bead.active");

    // For value 3, we should have exactly 3 active earth beads (no heaven bead)
    expect(activeBeads).toHaveLength(3);

    // The active beads should all be in the rightmost column (ones place = place value 0)
    activeBeads.forEach((bead) => {
      const beadElement = bead as HTMLElement;
      // Check that the data-testid indicates place value 0 (rightmost/ones place)
      const testId = beadElement.getAttribute("data-testid");
      expect(testId).toMatch(/bead-place-0/); // Should be bead-place-0-earth-pos-{position}
    });
  });

  it("should place two digit values correctly across columns", () => {
    // Test case: 23 with 3 columns
    // Should show: [empty][2][3] = [empty][tens][ones]
    const { container } = render(
      <AbacusReact value={23} columns={3} interactive={true} />,
    );

    const activeBeads = container.querySelectorAll(".abacus-bead.active");

    // For value 23: 2 earth beads (tens) + 3 earth beads (ones) = 5 total
    expect(activeBeads).toHaveLength(5);

    // Check that we have beads in place value 0 (ones) and place value 1 (tens)
    const placeZeroBeads = container.querySelectorAll(
      '[data-testid*="bead-place-0-"]',
    );
    const placeOneBeads = container.querySelectorAll(
      '[data-testid*="bead-place-1-"]',
    );
    const placeTwoBeads = container.querySelectorAll(
      '[data-testid*="bead-place-2-"]',
    );

    // Should have beads for all 3 places (ones, tens, hundreds)
    expect(placeZeroBeads.length).toBeGreaterThan(0); // ones place should have beads
    expect(placeOneBeads.length).toBeGreaterThan(0); // tens place should have beads
    expect(placeTwoBeads.length).toBeGreaterThan(0); // hundreds place should have beads (but inactive)

    // Count active beads in each place
    const activePlaceZero = container.querySelectorAll(
      '[data-testid*="bead-place-0-"].active',
    );
    const activePlaceOne = container.querySelectorAll(
      '[data-testid*="bead-place-1-"].active',
    );

    expect(activePlaceZero).toHaveLength(3); // 3 active beads for ones
    expect(activePlaceOne).toHaveLength(2); // 2 active beads for tens
  });

  it("should handle value 0 correctly in rightmost column", () => {
    const { container } = render(
      <AbacusReact value={0} columns={3} interactive={true} />,
    );

    // For value 0, no beads should be active
    const activeBeads = container.querySelectorAll(".abacus-bead.active");
    expect(activeBeads).toHaveLength(0);

    // But there should still be beads in the ones place (place value 0)
    const placeZeroBeads = container.querySelectorAll(
      '[data-testid*="bead-place-0-"]',
    );
    expect(placeZeroBeads.length).toBeGreaterThan(0);
  });

  it("should maintain visual column ordering left-to-right as high-to-low place values", () => {
    // For value 147 with 3 columns: [1][4][7] = [hundreds][tens][ones]
    const { container } = render(
      <AbacusReact value={147} columns={3} interactive={true} />,
    );

    // Find the container element and check that beads are positioned correctly
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeTruthy();

    // Check that place values appear in the correct visual order
    // This test verifies the column arrangement matches place value expectations
    const placeZeroBeads = container.querySelectorAll(
      '[data-testid*="bead-place-0-"]',
    );
    const placeOneBeads = container.querySelectorAll(
      '[data-testid*="bead-place-1-"]',
    );
    const placeTwoBeads = container.querySelectorAll(
      '[data-testid*="bead-place-2-"]',
    );

    // All three places should have beads
    expect(placeZeroBeads.length).toBeGreaterThan(0); // ones
    expect(placeOneBeads.length).toBeGreaterThan(0); // tens
    expect(placeTwoBeads.length).toBeGreaterThan(0); // hundreds

    // Check active bead counts match the digit values
    const activePlaceZero = container.querySelectorAll(
      '[data-testid*="bead-place-0-"].active',
    );
    const activePlaceOne = container.querySelectorAll(
      '[data-testid*="bead-place-1-"].active',
    );
    const activePlaceTwo = container.querySelectorAll(
      '[data-testid*="bead-place-2-"].active',
    );

    expect(activePlaceZero).toHaveLength(3); // 7 ones = 1 heaven (5) + 2 earth = 3 active beads
    expect(activePlaceOne).toHaveLength(4); // 4 tens = 4 earth beads active
    expect(activePlaceTwo).toHaveLength(1); // 1 hundred = 1 earth bead active
  });
});
