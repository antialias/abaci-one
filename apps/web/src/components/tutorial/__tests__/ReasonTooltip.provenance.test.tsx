import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PedagogicalSegment,
  TermProvenance,
} from "../../../utils/unifiedStepGenerator";
import { ReasonTooltip } from "../ReasonTooltip";

// Mock the Radix Tooltip to make testing easier
const MockTooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="tooltip-provider">{children}</div>
);

const MockTooltipRoot = ({
  children,
  open = true,
}: {
  children: React.ReactNode;
  open?: boolean;
}) => (
  <div data-testid="tooltip-root" data-open={open}>
    {children}
  </div>
);

const MockTooltipTrigger = ({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => <div data-testid="tooltip-trigger">{children}</div>;

const MockTooltipPortal = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="tooltip-portal">{children}</div>
);

const MockTooltipContent = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) => (
  <div data-testid="tooltip-content" {...props}>
    {children}
  </div>
);

const MockTooltipArrow = (props: any) => (
  <div data-testid="tooltip-arrow" {...props} />
);

// Mock Radix UI components
vi.mock("@radix-ui/react-tooltip", () => ({
  Provider: MockTooltipProvider,
  Root: MockTooltipRoot,
  Trigger: MockTooltipTrigger,
  Portal: MockTooltipPortal,
  Content: MockTooltipContent,
  Arrow: MockTooltipArrow,
}));

describe("ReasonTooltip with Provenance", () => {
  const mockProvenance: TermProvenance = {
    rhs: 25,
    rhsDigit: 2,
    rhsPlace: 1,
    rhsPlaceName: "tens",
    rhsDigitIndex: 0,
    rhsValue: 20,
  };

  const mockSegment: PedagogicalSegment = {
    id: "place-1-digit-2",
    place: 1,
    digit: 2,
    a: 7,
    L: 2,
    U: 0,
    goal: "Increase tens by 2 without carry",
    plan: [
      {
        rule: "Direct",
        conditions: ["a+d=7+2=9 ≤ 9"],
        explanation: ["Fits inside this place; add earth beads directly."],
      },
    ],
    expression: "20",
    stepIndices: [0],
    termIndices: [0],
    termRange: { startIndex: 10, endIndex: 12 },
    startValue: 3475,
    endValue: 3495,
    startState: {},
    endState: {},
    readable: {
      title: "Direct Add — tens",
      subtitle: "Simple bead movement",
      chips: [
        { label: "This rod shows", value: "7" },
        { label: "We're adding", value: "2" },
      ],
      why: ["We can add beads directly to this rod."],
      stepsFriendly: ["Add 2 earth beads in tens column"],
    },
  };

  const defaultProps = {
    termIndex: 0,
    segment: mockSegment,
    open: true,
    onOpenChange: vi.fn(),
    provenance: mockProvenance,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display enhanced title with provenance", () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should show the enhanced title format
    expect(
      screen.getByText("Add the tens digit — 2 tens (20)"),
    ).toBeInTheDocument();
  });

  it("should display enhanced subtitle with provenance", () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should show the enhanced subtitle
    expect(screen.getByText("From addend 25")).toBeInTheDocument();
  });

  it("should display enhanced breadcrumb chips", () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should show enhanced chips
    expect(
      screen.getByText(/Digit we're using: 2 \(tens\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/This rod shows: 7/)).toBeInTheDocument();
    expect(
      screen.getByText(/So we add here: \+2 tens → 20/),
    ).toBeInTheDocument();
  });

  it("should display provenance-based explanation for Direct rule", () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should show the enhanced explanation
    expect(
      screen.getByText(/We're adding the tens digit of 25 → 2 tens/),
    ).toBeInTheDocument();
  });

  it("should handle complement operations with group ID", () => {
    const complementProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 5,
      rhsPlace: 0,
      rhsPlaceName: "ones",
      rhsDigitIndex: 1,
      rhsValue: 5,
      groupId: "10comp-0-5",
    };

    const complementSegment: PedagogicalSegment = {
      ...mockSegment,
      id: "place-0-digit-5",
      place: 0,
      digit: 5,
      plan: [
        {
          rule: "TenComplement",
          conditions: ["a+d=5+5=10 ≥ 10"],
          explanation: ["Need a carry to the next higher place."],
        },
      ],
      readable: {
        ...mockSegment.readable,
        title: "Make 10 — ones",
        subtitle: "Using pairs that make 10",
      },
    };

    render(
      <ReasonTooltip
        {...defaultProps}
        segment={complementSegment}
        provenance={complementProvenance}
      >
        <span>100</span>
      </ReasonTooltip>,
    );

    // Should show the enhanced title for complement operations
    expect(
      screen.getByText("Add the ones digit — 5 ones (5)"),
    ).toBeInTheDocument();
    expect(screen.getByText("From addend 25")).toBeInTheDocument();
  });

  it("should fallback to readable content when provenance is not available", () => {
    render(
      <ReasonTooltip {...defaultProps} provenance={undefined}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should show the fallback title and content
    expect(screen.getByText("Direct Add — tens")).toBeInTheDocument();
    expect(screen.getByText("Simple bead movement")).toBeInTheDocument();
    expect(
      screen.getByText(/We can add beads directly to this rod/),
    ).toBeInTheDocument();
  });

  it("should not render enhanced content when no rule is provided", () => {
    const segmentWithoutRule = {
      ...mockSegment,
      plan: [],
    };

    render(
      <ReasonTooltip {...defaultProps} segment={segmentWithoutRule}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should just render the children without any tooltip
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("should log debug information when provenance is provided", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Should log debug information
    expect(consoleSpy).toHaveBeenCalledWith(
      "ReasonTooltip - provenance data:",
      mockProvenance,
    );
    expect(consoleSpy).toHaveBeenCalledWith("ReasonTooltip - rule:", "Direct");
    expect(consoleSpy).toHaveBeenCalledWith(
      "ReasonTooltip - enhancedContent:",
      expect.objectContaining({
        title: "Add the tens digit — 2 tens (20)",
        subtitle: "From addend 25",
        chips: expect.arrayContaining([
          expect.objectContaining({
            label: "Digit we're using",
            value: "2 (tens)",
          }),
        ]),
      }),
    );

    consoleSpy.mockRestore();
  });

  it("should handle the exact 3475 + 25 = 3500 example", () => {
    // Test with the exact provenance data from our example
    const exactProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 2,
      rhsPlace: 1,
      rhsPlaceName: "tens",
      rhsDigitIndex: 0, // '2' is the first digit in '25'
      rhsValue: 20,
    };

    render(
      <ReasonTooltip {...defaultProps} provenance={exactProvenance}>
        <span>20</span>
      </ReasonTooltip>,
    );

    // Verify all the expected enhanced content
    expect(
      screen.getByText("Add the tens digit — 2 tens (20)"),
    ).toBeInTheDocument();
    expect(screen.getByText("From addend 25")).toBeInTheDocument();
    expect(
      screen.getByText(/We're adding the tens digit of 25 → 2 tens/),
    ).toBeInTheDocument();

    // Verify the chips show the digit transformation clearly
    expect(
      screen.getByText(/Digit we're using: 2 \(tens\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/So we add here: \+2 tens → 20/),
    ).toBeInTheDocument();
  });
});
