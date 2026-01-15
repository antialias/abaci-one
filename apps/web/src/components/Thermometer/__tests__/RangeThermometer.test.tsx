import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RangeThermometer } from "../RangeThermometer";
import type { ThermometerOption } from "../types";

// Mock Panda CSS
vi.mock("@styled/css", () => ({
  css: vi.fn(() => "mocked-css-class"),
}));

// Mock Radix UI components
vi.mock("@radix-ui/react-slider", () => ({
  Root: ({ children, onValueChange, value }: any) => (
    <div data-testid="slider-root" data-value={JSON.stringify(value)}>
      {children}
      <button
        data-testid="slider-change"
        onClick={() => onValueChange?.([0, 2])}
      >
        Change
      </button>
    </div>
  ),
  Track: ({ children }: any) => (
    <div data-testid="slider-track">{children}</div>
  ),
  Range: () => <div data-testid="slider-range" />,
  Thumb: ({ "data-handle": handle }: any) => (
    <div data-testid={`slider-thumb-${handle}`} />
  ),
}));

vi.mock("@radix-ui/react-tooltip", () => ({
  Provider: ({ children }: any) => <div>{children}</div>,
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Arrow: () => null,
}));

vi.mock("@radix-ui/react-popover", () => ({
  Root: ({ children }: any) => <div data-testid="popover-root">{children}</div>,
  Trigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  Portal: ({ children }: any) => (
    <div data-testid="popover-portal">{children}</div>
  ),
  Content: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
  Arrow: () => null,
}));

type TestSize = "small" | "medium" | "large";

const testOptions: ThermometerOption<TestSize>[] = [
  { value: "small", label: "Small", emoji: "🔹" },
  { value: "medium", label: "Medium", emoji: "🔸" },
  { value: "large", label: "Large", emoji: "🔶" },
];

describe("RangeThermometer", () => {
  const defaultProps = {
    options: testOptions,
    minValue: "small" as TestSize,
    maxValue: "large" as TestSize,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all options", () => {
      render(<RangeThermometer {...defaultProps} />);

      expect(screen.getByText("Small")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("Large")).toBeInTheDocument();
    });

    it("renders emojis for options", () => {
      render(<RangeThermometer {...defaultProps} />);

      expect(screen.getByText("🔹")).toBeInTheDocument();
      expect(screen.getByText("🔸")).toBeInTheDocument();
      expect(screen.getByText("🔶")).toBeInTheDocument();
    });

    it("renders label when provided", () => {
      render(<RangeThermometer {...defaultProps} label="Size Range" />);

      expect(screen.getByText("Size Range")).toBeInTheDocument();
    });

    it("renders description when provided", () => {
      render(
        <RangeThermometer
          {...defaultProps}
          description="Select a size range"
        />,
      );

      expect(screen.getByText("Select a size range")).toBeInTheDocument();
    });
  });

  describe("counts", () => {
    it("renders count badges when counts provided", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(<RangeThermometer {...defaultProps} counts={counts} />);

      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("calculates total count for selected range", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(
        <RangeThermometer
          {...defaultProps}
          counts={counts}
          showTotalCount={true}
        />,
      );

      // Total should be 5 + 10 + 3 = 18
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("regions")).toBeInTheDocument();
    });

    it("calculates total count for partial range", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(
        <RangeThermometer
          {...defaultProps}
          minValue="small"
          maxValue="medium"
          counts={counts}
          showTotalCount={true}
        />,
      );

      // Total should be 5 + 10 = 15
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("hides total count when showTotalCount is false", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(
        <RangeThermometer
          {...defaultProps}
          counts={counts}
          showTotalCount={false}
        />,
      );

      expect(screen.queryByText("regions")).not.toBeInTheDocument();
    });
  });

  describe("hideCountOnMd", () => {
    it("renders total count container when hideCountOnMd is false", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(
        <RangeThermometer
          {...defaultProps}
          counts={counts}
          showTotalCount={true}
          hideCountOnMd={false}
        />,
      );

      expect(screen.getByText("regions")).toBeInTheDocument();
    });

    it("renders total count container when hideCountOnMd is true (CSS hides it)", () => {
      const counts = { small: 5, medium: 10, large: 3 };
      render(
        <RangeThermometer
          {...defaultProps}
          counts={counts}
          showTotalCount={true}
          hideCountOnMd={true}
        />,
      );

      // The element is still rendered, CSS handles hiding on md+
      expect(screen.getByText("regions")).toBeInTheDocument();
    });
  });

  describe("onChange", () => {
    it("calls onChange when option is clicked to change range", () => {
      const onChange = vi.fn();
      // Start with medium-large range
      render(
        <RangeThermometer
          {...defaultProps}
          minValue="medium"
          maxValue="large"
          onChange={onChange}
        />,
      );

      // Click on 'Small' option - should move min handle to small
      const smallButton = screen.getByText("Small").closest("button");
      fireEvent.click(smallButton!);

      expect(onChange).toHaveBeenCalledWith("small", "large");
    });

    it("moves max handle when clicking option closer to max", () => {
      const onChange = vi.fn();
      render(
        <RangeThermometer
          {...defaultProps}
          minValue="small"
          maxValue="medium"
          onChange={onChange}
        />,
      );

      // Click on 'Large' option - should move max handle since it's closer
      const largeButton = screen.getByText("Large").closest("button");
      fireEvent.click(largeButton!);

      expect(onChange).toHaveBeenCalledWith("small", "large");
    });
  });

  describe("hover preview", () => {
    it("calls onHoverPreview when hovering over option", () => {
      const onHoverPreview = vi.fn();
      render(
        <RangeThermometer
          {...defaultProps}
          minValue="medium"
          maxValue="large"
          onHoverPreview={onHoverPreview}
        />,
      );

      const smallButton = screen.getByText("Small").closest("button");
      fireEvent.mouseEnter(smallButton!);

      expect(onHoverPreview).toHaveBeenCalledWith({
        previewMin: "small",
        previewMax: "large",
      });
    });

    it("calls onHoverPreview with null when mouse leaves", () => {
      const onHoverPreview = vi.fn();
      render(
        <RangeThermometer {...defaultProps} onHoverPreview={onHoverPreview} />,
      );

      const smallButton = screen.getByText("Small").closest("button");
      fireEvent.mouseLeave(smallButton!);

      expect(onHoverPreview).toHaveBeenCalledWith(null);
    });

    it("moves nearest handle in preview calculation", () => {
      const onHoverPreview = vi.fn();
      render(
        <RangeThermometer
          {...defaultProps}
          minValue="small"
          maxValue="medium"
          onHoverPreview={onHoverPreview}
        />,
      );

      // Hover over 'Large' - should preview moving max handle
      const largeButton = screen.getByText("Large").closest("button");
      fireEvent.mouseEnter(largeButton!);

      expect(onHoverPreview).toHaveBeenCalledWith({
        previewMin: "small",
        previewMax: "large",
      });
    });
  });

  describe("selectedRegionNames popover", () => {
    it("renders region names in popover content", () => {
      const selectedRegionNames = ["France", "Germany", "Spain"];
      render(
        <RangeThermometer
          {...defaultProps}
          counts={{ small: 1, medium: 1, large: 1 }}
          showTotalCount={true}
          selectedRegionNames={selectedRegionNames}
        />,
      );

      // Popover should contain region names
      expect(screen.getByText("France")).toBeInTheDocument();
      expect(screen.getByText("Germany")).toBeInTheDocument();
      expect(screen.getByText("Spain")).toBeInTheDocument();
    });

    it("calls onRegionNameHover when hovering region name", () => {
      const onRegionNameHover = vi.fn();
      const selectedRegionNames = ["France", "Germany"];
      render(
        <RangeThermometer
          {...defaultProps}
          counts={{ small: 1, medium: 1, large: 0 }}
          showTotalCount={true}
          selectedRegionNames={selectedRegionNames}
          onRegionNameHover={onRegionNameHover}
        />,
      );

      fireEvent.mouseEnter(screen.getByText("France"));

      expect(onRegionNameHover).toHaveBeenCalledWith("France");
    });

    it("calls onRegionNameHover with null when mouse leaves", () => {
      const onRegionNameHover = vi.fn();
      const selectedRegionNames = ["France"];
      render(
        <RangeThermometer
          {...defaultProps}
          counts={{ small: 1, medium: 0, large: 0 }}
          showTotalCount={true}
          selectedRegionNames={selectedRegionNames}
          onRegionNameHover={onRegionNameHover}
        />,
      );

      fireEvent.mouseLeave(screen.getByText("France"));

      expect(onRegionNameHover).toHaveBeenCalledWith(null);
    });
  });

  describe("dark mode", () => {
    it("applies dark mode styles when isDark is true", () => {
      const { container } = render(
        <RangeThermometer {...defaultProps} isDark={true} />,
      );

      // Component should render (styles are mocked)
      expect(
        container.querySelector('[data-component="range-thermometer"]'),
      ).toBeInTheDocument();
    });
  });
});
