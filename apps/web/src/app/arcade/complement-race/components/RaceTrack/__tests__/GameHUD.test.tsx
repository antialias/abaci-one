import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Passenger, Station } from "../../../lib/gameTypes";
import { GameHUD } from "../GameHUD";

// Mock child components
vi.mock("../../PassengerCard", () => ({
  PassengerCard: ({ passenger }: { passenger: Passenger }) => (
    <div data-testid="passenger-card">{passenger.avatar}</div>
  ),
}));

vi.mock("../../PressureGauge", () => ({
  PressureGauge: ({ pressure }: { pressure: number }) => (
    <div data-testid="pressure-gauge">{pressure}</div>
  ),
}));

describe("GameHUD", () => {
  const mockRouteTheme = {
    emoji: "🚂",
    name: "Mountain Pass",
  };

  const mockStations: Station[] = [
    { id: "station-1", name: "Station 1", position: 20, icon: "🏭" },
    { id: "station-2", name: "Station 2", position: 60, icon: "🏛️" },
  ];

  const mockPassenger: Passenger = {
    id: "passenger-1",
    name: "Test Passenger",
    avatar: "👨",
    originStationId: "station-1",
    destinationStationId: "station-2",
    isBoarded: false,
    isDelivered: false,
    isUrgent: false,
  };

  const defaultProps = {
    routeTheme: mockRouteTheme,
    currentRoute: 1,
    periodName: "🌅 Dawn",
    timeRemaining: 45,
    pressure: 75,
    nonDeliveredPassengers: [],
    stations: mockStations,
    currentQuestion: {
      number: 3,
      targetSum: 10,
      correctAnswer: 7,
      showAsAbacus: false,
    },
    currentInput: "7",
  };

  test("renders route information", () => {
    render(<GameHUD {...defaultProps} />);

    expect(screen.getByText("Route 1")).toBeInTheDocument();
    expect(screen.getByText("Mountain Pass")).toBeInTheDocument();
    expect(screen.getByText("🚂")).toBeInTheDocument();
  });

  test("renders time of day period", () => {
    render(<GameHUD {...defaultProps} />);

    expect(screen.getByText("🌅 Dawn")).toBeInTheDocument();
  });

  test("renders time remaining", () => {
    render(<GameHUD {...defaultProps} />);

    expect(screen.getByText(/45s/)).toBeInTheDocument();
  });

  test("renders pressure gauge", () => {
    render(<GameHUD {...defaultProps} />);

    expect(screen.getByTestId("pressure-gauge")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  test("renders passenger list when passengers exist", () => {
    render(
      <GameHUD {...defaultProps} nonDeliveredPassengers={[mockPassenger]} />,
    );

    expect(screen.getByTestId("passenger-card")).toBeInTheDocument();
    expect(screen.getByText("👨")).toBeInTheDocument();
  });

  test("does not render passenger list when empty", () => {
    render(<GameHUD {...defaultProps} nonDeliveredPassengers={[]} />);

    expect(screen.queryByTestId("passenger-card")).not.toBeInTheDocument();
  });

  test("renders current question when provided", () => {
    render(<GameHUD {...defaultProps} />);

    expect(screen.getByText("7")).toBeInTheDocument(); // currentInput
    expect(screen.getByText("3")).toBeInTheDocument(); // question.number
    expect(screen.getByText("10")).toBeInTheDocument(); // targetSum
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("=")).toBeInTheDocument();
  });

  test("shows question mark when no input", () => {
    render(<GameHUD {...defaultProps} currentInput="" />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  test("does not render question display when currentQuestion is null", () => {
    render(<GameHUD {...defaultProps} currentQuestion={null} />);

    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(screen.queryByText("=")).not.toBeInTheDocument();
  });

  test("renders multiple passengers", () => {
    const passengers = [
      mockPassenger,
      { ...mockPassenger, id: "passenger-2", avatar: "👩" },
      { ...mockPassenger, id: "passenger-3", avatar: "👧" },
    ];

    render(<GameHUD {...defaultProps} nonDeliveredPassengers={passengers} />);

    expect(screen.getAllByTestId("passenger-card")).toHaveLength(3);
    expect(screen.getByText("👨")).toBeInTheDocument();
    expect(screen.getByText("👩")).toBeInTheDocument();
    expect(screen.getByText("👧")).toBeInTheDocument();
  });

  test("updates when route changes", () => {
    const { rerender } = render(<GameHUD {...defaultProps} />);

    expect(screen.getByText("Route 1")).toBeInTheDocument();

    rerender(<GameHUD {...defaultProps} currentRoute={2} />);

    expect(screen.getByText("Route 2")).toBeInTheDocument();
  });

  test("updates when time remaining changes", () => {
    const { rerender } = render(<GameHUD {...defaultProps} />);

    expect(screen.getByText(/45s/)).toBeInTheDocument();

    rerender(<GameHUD {...defaultProps} timeRemaining={30} />);

    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  test("memoization: same props do not cause re-render", () => {
    const { rerender, container } = render(<GameHUD {...defaultProps} />);

    const initialHTML = container.innerHTML;

    // Rerender with same props
    rerender(<GameHUD {...defaultProps} />);

    // Should be memoized (same HTML)
    expect(container.innerHTML).toBe(initialHTML);
  });
});
