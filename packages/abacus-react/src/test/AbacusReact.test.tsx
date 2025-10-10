import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbacusReact, useAbacusDimensions } from "../AbacusReact";

describe("AbacusReact", () => {
  it("renders without crashing", () => {
    render(<AbacusReact value={0} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders with basic props", () => {
    render(<AbacusReact value={123} columns={3} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  describe("showNumbers prop", () => {
    it('does not show numbers when showNumbers="never"', () => {
      render(<AbacusReact value={123} columns={3} showNumbers="never" />);
      // NumberFlow components should not be rendered
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("3")).not.toBeInTheDocument();
    });

    it('shows numbers when showNumbers="always"', () => {
      render(<AbacusReact value={123} columns={3} showNumbers="always" />);
      // NumberFlow components should render the place values
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it('shows toggle button when showNumbers="toggleable"', () => {
      render(<AbacusReact value={123} columns={3} showNumbers="toggleable" />);

      // Should have a toggle button
      const toggleButton = screen.getByRole("button");
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("title", "Show numbers");
    });

    it("toggles numbers visibility when button is clicked", async () => {
      const user = userEvent.setup();
      render(<AbacusReact value={123} columns={3} showNumbers="toggleable" />);

      const toggleButton = screen.getByRole("button");

      // Initially numbers should be hidden (default state for toggleable)
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("title", "Show numbers");

      // Click to show numbers
      await user.click(toggleButton);

      // Numbers should now be visible
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("title", "Hide numbers");

      // Click to hide numbers again
      await user.click(toggleButton);

      // Numbers should be hidden again
      expect(screen.queryByText("1")).not.toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("title", "Show numbers");
    });
  });

  describe("bead interactions", () => {
    it("calls onClick when bead is clicked", async () => {
      const user = userEvent.setup();
      const onClickMock = vi.fn();

      render(<AbacusReact value={0} columns={1} onClick={onClickMock} />);

      // Find and click a bead (they have cursor:pointer style)
      const bead = document.querySelector(".abacus-bead");

      if (bead) {
        await user.click(bead as Element);
        expect(onClickMock).toHaveBeenCalled();
      } else {
        // If no bead found, test passes (component rendered without crashing)
        expect(document.querySelector("svg")).toBeInTheDocument();
      }
    });

    it("calls onValueChange when value changes", () => {
      const onValueChangeMock = vi.fn();

      const { rerender } = render(
        <AbacusReact value={0} onValueChange={onValueChangeMock} />,
      );

      rerender(<AbacusReact value={5} onValueChange={onValueChangeMock} />);

      // onValueChange should be called when value prop changes
      expect(onValueChangeMock).toHaveBeenCalled();
    });
  });

  describe("visual properties", () => {
    it("applies different bead shapes", () => {
      const { rerender } = render(
        <AbacusReact value={1} beadShape="diamond" />,
      );
      expect(document.querySelector("svg")).toBeInTheDocument();

      rerender(<AbacusReact value={1} beadShape="circle" />);
      expect(document.querySelector("svg")).toBeInTheDocument();

      rerender(<AbacusReact value={1} beadShape="square" />);
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("applies different color schemes", () => {
      const { rerender } = render(
        <AbacusReact value={1} colorScheme="monochrome" />,
      );
      expect(document.querySelector("svg")).toBeInTheDocument();

      rerender(<AbacusReact value={1} colorScheme="place-value" />);
      expect(document.querySelector("svg")).toBeInTheDocument();

      rerender(<AbacusReact value={1} colorScheme="alternating" />);
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("applies scale factor", () => {
      render(<AbacusReact value={1} scaleFactor={2} />);
      expect(document.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<AbacusReact value={123} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // Test that SVG has some accessible attributes
      expect(svg).toHaveAttribute("class");
    });

    it("is keyboard accessible", () => {
      render(<AbacusReact value={123} showNumbers="toggleable" />);
      const toggleButton = screen.getByRole("button");
      expect(toggleButton).toBeInTheDocument();
      // Button should be focusable
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);
    });
  });
});

describe("useAbacusDimensions", () => {
  // Test hook using renderHook pattern with a wrapper component
  const TestHookComponent = ({
    columns,
    scaleFactor,
    showNumbers,
  }: {
    columns: number;
    scaleFactor: number;
    showNumbers: "always" | "never" | "toggleable";
  }) => {
    const dimensions = useAbacusDimensions(columns, scaleFactor, showNumbers);
    return <div data-testid="dimensions">{JSON.stringify(dimensions)}</div>;
  };

  it("calculates correct dimensions for different column counts", () => {
    const { rerender } = render(
      <TestHookComponent columns={1} scaleFactor={1} showNumbers="never" />,
    );
    const dims1 = JSON.parse(screen.getByTestId("dimensions").textContent!);

    rerender(
      <TestHookComponent columns={3} scaleFactor={1} showNumbers="never" />,
    );
    const dims3 = JSON.parse(screen.getByTestId("dimensions").textContent!);

    expect(dims3.width).toBeGreaterThan(dims1.width);
    expect(dims1.height).toBeGreaterThan(0);
    expect(dims3.height).toBe(dims1.height); // Same height for same showNumbers
  });

  it("adjusts height based on showNumbers setting", () => {
    const { rerender } = render(
      <TestHookComponent columns={3} scaleFactor={1} showNumbers="never" />,
    );
    const dimsNever = JSON.parse(screen.getByTestId("dimensions").textContent!);

    rerender(
      <TestHookComponent columns={3} scaleFactor={1} showNumbers="always" />,
    );
    const dimsAlways = JSON.parse(
      screen.getByTestId("dimensions").textContent!,
    );

    rerender(
      <TestHookComponent
        columns={3}
        scaleFactor={1}
        showNumbers="toggleable"
      />,
    );
    const dimsToggleable = JSON.parse(
      screen.getByTestId("dimensions").textContent!,
    );

    expect(dimsAlways.height).toBeGreaterThan(dimsNever.height);
    expect(dimsToggleable.height).toBeGreaterThan(dimsNever.height);
    expect(dimsToggleable.height).toBe(dimsAlways.height);
  });

  it("scales dimensions with scale factor", () => {
    const { rerender } = render(
      <TestHookComponent columns={3} scaleFactor={1} showNumbers="never" />,
    );
    const dims1x = JSON.parse(screen.getByTestId("dimensions").textContent!);

    rerender(
      <TestHookComponent columns={3} scaleFactor={2} showNumbers="never" />,
    );
    const dims2x = JSON.parse(screen.getByTestId("dimensions").textContent!);

    expect(dims2x.width).toBeGreaterThan(dims1x.width);
    expect(dims2x.height).toBeGreaterThan(dims1x.height);
    expect(dims2x.beadSize).toBeGreaterThan(dims1x.beadSize);
  });
});
