import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AbacusReact } from '../AbacusReact';

describe('Gesture and Input Functionality', () => {
  describe('Gesture Support', () => {
    it('should handle heaven bead gesture activation', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={0}
          columns={2}
          interactive={true}
          gestures={true}
          onValueChange={onValueChange}
        />
      );

      // Find a heaven bead in place 0 (ones place)
      const heavenBead = container.querySelector('[data-testid="bead-place-0-heaven"]');
      expect(heavenBead).toBeTruthy();

      // Simulate gesture activation (would normally be a drag gesture)
      // We'll simulate by finding the bead component and calling its gesture handler
      const beadElement = heavenBead as HTMLElement;

      // Simulate a drag gesture to activate the heaven bead (drag up)
      fireEvent.mouseDown(beadElement, { clientY: 100 });
      fireEvent.mouseMove(beadElement, { clientY: 80, buttons: 1 }); // Move up while dragging
      fireEvent.mouseUp(beadElement, { clientY: 80 });

      // The value should change from 0 to 5 (heaven bead activated)
      expect(onValueChange).toHaveBeenCalledWith(5);
    });

    it('should handle earth bead gesture activation', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={0}
          columns={2}
          interactive={true}
          gestures={true}
          onValueChange={onValueChange}
        />
      );

      // Find the first earth bead in place 0 (ones place)
      const earthBead = container.querySelector('[data-testid="bead-place-0-earth-pos-0"]');
      expect(earthBead).toBeTruthy();

      const beadElement = earthBead as HTMLElement;

      // Simulate a drag gesture to activate the earth bead (drag up)
      fireEvent.mouseDown(beadElement, { clientY: 150 });
      fireEvent.mouseMove(beadElement, { clientY: 130, buttons: 1 }); // Move up while dragging
      fireEvent.mouseUp(beadElement, { clientY: 130 });

      // The value should change from 0 to 1 (first earth bead activated)
      expect(onValueChange).toHaveBeenCalledWith(1);
    });

    it('should handle gesture deactivation', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={5}
          columns={2}
          interactive={true}
          gestures={true}
          onValueChange={onValueChange}
        />
      );

      // Find the active heaven bead in place 0
      const heavenBead = container.querySelector('[data-testid="bead-place-0-heaven"].active');
      expect(heavenBead).toBeTruthy();

      const beadElement = heavenBead as HTMLElement;

      // Simulate a drag gesture to deactivate the heaven bead (drag down)
      fireEvent.mouseDown(beadElement, { clientY: 80 });
      fireEvent.mouseMove(beadElement, { clientY: 100, buttons: 1 }); // Move down while dragging
      fireEvent.mouseUp(beadElement, { clientY: 100 });

      // The value should change from 5 to 0 (heaven bead deactivated)
      expect(onValueChange).toHaveBeenCalledWith(0);
    });
  });

  describe('Numeral Input', () => {
    it('should allow typing digits to change values', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={0}
          columns={3}
          interactive={true}
          showNumbers={true}
          onValueChange={onValueChange}
        />
      );

      // Find the abacus container (should be focusable for keyboard input)
      const abacusContainer = container.querySelector('.abacus-container');
      expect(abacusContainer).toBeTruthy();

      // Focus the abacus and type a digit
      fireEvent.focus(abacusContainer!);
      fireEvent.keyDown(abacusContainer!, { key: '7' });

      // The value should change to 7 in the ones place
      expect(onValueChange).toHaveBeenCalledWith(7);
    });

    it('should allow navigating between columns with Tab', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={0}
          columns={3}
          interactive={true}
          showNumbers={true}
          onValueChange={onValueChange}
        />
      );

      const abacusContainer = container.querySelector('.abacus-container');
      expect(abacusContainer).toBeTruthy();

      // Focus and type in ones place
      fireEvent.focus(abacusContainer!);
      fireEvent.keyDown(abacusContainer!, { key: '3' });
      expect(onValueChange).toHaveBeenLastCalledWith(3);

      // Move to tens place with Tab
      fireEvent.keyDown(abacusContainer!, { key: 'Tab' });
      fireEvent.keyDown(abacusContainer!, { key: '2' });
      expect(onValueChange).toHaveBeenLastCalledWith(23);

      // Move to hundreds place with Tab
      fireEvent.keyDown(abacusContainer!, { key: 'Tab' });
      fireEvent.keyDown(abacusContainer!, { key: '1' });
      expect(onValueChange).toHaveBeenLastCalledWith(123);
    });

    it('should allow navigating backwards with Shift+Tab', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={123}
          columns={3}
          interactive={true}
          showNumbers={true}
          onValueChange={onValueChange}
        />
      );

      const abacusContainer = container.querySelector('.abacus-container');
      expect(abacusContainer).toBeTruthy();

      // Focus the abacus (should start at rightmost/ones place)
      fireEvent.focus(abacusContainer!);

      // Move left to tens place
      fireEvent.keyDown(abacusContainer!, { key: 'Tab', shiftKey: true });
      fireEvent.keyDown(abacusContainer!, { key: '5' });
      expect(onValueChange).toHaveBeenLastCalledWith(153);

      // Move left to hundreds place
      fireEvent.keyDown(abacusContainer!, { key: 'Tab', shiftKey: true });
      fireEvent.keyDown(abacusContainer!, { key: '9' });
      expect(onValueChange).toHaveBeenLastCalledWith(953);
    });

    it('should use Backspace to clear current column and move left', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={123}
          columns={3}
          interactive={true}
          showNumbers={true}
          onValueChange={onValueChange}
        />
      );

      const abacusContainer = container.querySelector('.abacus-container');
      expect(abacusContainer).toBeTruthy();

      // Focus the abacus (should start at rightmost/ones place with value 3)
      fireEvent.focus(abacusContainer!);

      // Backspace should clear ones place (3 -> 0) and move to tens
      fireEvent.keyDown(abacusContainer!, { key: 'Backspace' });
      expect(onValueChange).toHaveBeenLastCalledWith(120);

      // Next digit should go in tens place
      fireEvent.keyDown(abacusContainer!, { key: '4' });
      expect(onValueChange).toHaveBeenLastCalledWith(140);
    });
  });

  describe('Integration Tests', () => {
    it('should work with both gestures and numeral input on same abacus', () => {
      const onValueChange = vi.fn();

      const { container } = render(
        <AbacusReact
          value={0}
          columns={2}
          interactive={true}
          gestures={true}
          showNumbers={true}
          onValueChange={onValueChange}
        />
      );

      // First use numeral input
      const abacusContainer = container.querySelector('.abacus-container');
      fireEvent.focus(abacusContainer!);
      fireEvent.keyDown(abacusContainer!, { key: '3' });
      expect(onValueChange).toHaveBeenLastCalledWith(3);

      // Then use gesture to modify tens place
      fireEvent.keyDown(abacusContainer!, { key: 'Tab' }); // Move to tens
      const heavenBead = container.querySelector('[data-testid="bead-place-1-heaven"]');
      expect(heavenBead).toBeTruthy();

      const beadElement = heavenBead as HTMLElement;
      fireEvent.mouseDown(beadElement, { clientY: 100 });
      fireEvent.mouseMove(beadElement, { clientY: 80, buttons: 1 }); // Drag up to activate
      fireEvent.mouseUp(beadElement, { clientY: 80 });

      // Should now have 50 + 3 = 53
      expect(onValueChange).toHaveBeenLastCalledWith(53);
    });
  });
});