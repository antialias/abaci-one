import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AbacusReact } from '../AbacusReact';

describe('Debug Columns Test', () => {
  it('should render value=3 with columns=3 correctly', () => {
    const { container } = render(
      <AbacusReact value={3} columns={3} interactive={true} />
    );

    // Debug: log all testids to see what's happening
    const allBeads = container.querySelectorAll('[data-testid]');
    console.log('All bead testids:');
    allBeads.forEach(bead => {
      const testId = bead.getAttribute('data-testid');
      const isActive = bead.classList.contains('active');
      console.log(`  ${testId} - active: ${isActive}`);
    });

    // Check that we have beads in all 3 places
    const place0Beads = container.querySelectorAll('[data-testid*="bead-place-0-"]');
    const place1Beads = container.querySelectorAll('[data-testid*="bead-place-1-"]');
    const place2Beads = container.querySelectorAll('[data-testid*="bead-place-2-"]');

    console.log(`Place 0 beads: ${place0Beads.length}`);
    console.log(`Place 1 beads: ${place1Beads.length}`);
    console.log(`Place 2 beads: ${place2Beads.length}`);

    // For value 3 with 3 columns, we should have:
    // - Place 0 (ones): 3 active earth beads
    // - Place 1 (tens): all inactive (no beads needed for tens place)
    // - Place 2 (hundreds): all inactive (no beads needed for hundreds place)

    // We should have beads in all 3 places
    expect(place0Beads.length).toBeGreaterThan(0); // ones place
    expect(place1Beads.length).toBeGreaterThan(0); // tens place
    expect(place2Beads.length).toBeGreaterThan(0); // hundreds place

    // Check active beads - only place 0 should have active beads
    const activePlaceZero = container.querySelectorAll('[data-testid*="bead-place-0-"].active');
    const activePlaceOne = container.querySelectorAll('[data-testid*="bead-place-1-"].active');
    const activePlaceTwo = container.querySelectorAll('[data-testid*="bead-place-2-"].active');

    expect(activePlaceZero).toHaveLength(3); // 3 active earth beads for ones
    expect(activePlaceOne).toHaveLength(0);  // no active beads for tens
    expect(activePlaceTwo).toHaveLength(0);  // no active beads for hundreds
  });
});