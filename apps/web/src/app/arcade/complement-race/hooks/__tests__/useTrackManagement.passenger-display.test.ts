import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Passenger, Station } from "../../lib/gameTypes";
import type { RailroadTrackGenerator } from "../../lib/RailroadTrackGenerator";
import { useTrackManagement } from "../useTrackManagement";

describe("useTrackManagement - Passenger Display", () => {
  let mockPathRef: React.RefObject<SVGPathElement>;
  let mockTrackGenerator: RailroadTrackGenerator;
  let mockStations: Station[];
  let mockPassengers: Passenger[];

  beforeEach(() => {
    // Create mock path element
    const mockPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    mockPath.getTotalLength = vi.fn(() => 1000);
    mockPath.getPointAtLength = vi.fn((distance: number) => ({
      x: distance,
      y: 300,
      w: 1,
      z: 0,
      matrixTransform: () => new DOMPoint(),
      toJSON: () => ({ x: distance, y: 300, w: 1, z: 0 }),
    })) as any;
    mockPathRef = { current: mockPath };

    // Mock track generator
    mockTrackGenerator = {
      generateTrack: vi.fn(() => ({
        ballastPath: "M 0 0",
        referencePath: "M 0 0",
        ties: [],
        leftRailPath: "M 0 0",
        rightRailPath: "M 0 0",
      })),
      generateTiesAndRails: vi.fn(() => ({
        ties: [],
        leftRailPath: "M 0 0",
        rightRailPath: "M 0 0",
      })),
    } as unknown as RailroadTrackGenerator;

    // Mock stations
    mockStations = [
      { id: "station1", name: "Station 1", icon: "🏠", position: 20 },
      { id: "station2", name: "Station 2", icon: "🏢", position: 50 },
      { id: "station3", name: "Station 3", icon: "🏪", position: 80 },
    ];

    // Mock passengers - initial set
    mockPassengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "station1",
        destinationStationId: "station2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "station2",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    vi.clearAllMocks();
  });

  test("initial passengers are displayed", () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 10,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
        maxCars: 3,
        carSpacing: 7,
      }),
    );

    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");
    expect(result.current.displayPassengers[1].id).toBe("p2");
  });

  test("passengers update when boarded (same route gameplay)", () => {
    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { passengers: mockPassengers, position: 25 } },
    );

    // Initially 2 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].isBoarded).toBe(false);

    // Board first passenger
    const boardedPassengers = mockPassengers.map((p) =>
      p.id === "p1" ? { ...p, isBoarded: true } : p,
    );

    rerender({ passengers: boardedPassengers, position: 25 });

    // Should show updated passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].isBoarded).toBe(true);
  });

  test("passengers do NOT update during route transition (train moving)", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 50 } },
    );

    // Initially route 1 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Generate new passengers for route 2
    const newPassengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Change route but train still moving
    rerender({ route: 2, passengers: newPassengers, position: 60 });

    // Should STILL show old passengers (route 1)
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");
    expect(result.current.displayPassengers[0].name).toBe("Alice");
  });

  test("passengers update when train resets to start (negative position)", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 50 } },
    );

    // Initially route 1 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Generate new passengers for route 2
    const newPassengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Change route and train resets
    rerender({ route: 2, passengers: newPassengers, position: -5 });

    // Should now show NEW passengers (route 2)
    expect(result.current.displayPassengers).toHaveLength(1);
    expect(result.current.displayPassengers[0].id).toBe("p3");
    expect(result.current.displayPassengers[0].name).toBe("Charlie");
  });

  test("passengers do NOT flash when transitioning through 100%", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 95 } },
    );

    // At 95% - show route 1 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Generate new passengers for route 2
    const newPassengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Train exits (105%) but route hasn't changed yet
    rerender({ route: 1, passengers: mockPassengers, position: 105 });

    // Should STILL show route 1 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Now route changes to 2, but train still at 105%
    rerender({ route: 2, passengers: newPassengers, position: 105 });

    // Should STILL show route 1 passengers (old ones)
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Train resets to start
    rerender({ route: 2, passengers: newPassengers, position: -5 });

    // NOW should show route 2 passengers
    expect(result.current.displayPassengers).toHaveLength(1);
    expect(result.current.displayPassengers[0].id).toBe("p3");
  });

  test("passengers do NOT update when array reference changes but same route", () => {
    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { passengers: mockPassengers, position: 50 } },
    );

    // Initially route 1 passengers
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Create new array with same content (different reference)
    const samePassengersNewRef = mockPassengers.map((p) => ({ ...p }));

    // Update with new reference but same content
    rerender({ passengers: samePassengersNewRef, position: 50 });

    // Display should update because it's the same route (gameplay update)
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].id).toBe("p1");
  });

  test("delivered passengers update immediately (same route)", () => {
    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { passengers: mockPassengers, position: 25 } },
    );

    // Initially 2 passengers, neither delivered
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].isDelivered).toBe(false);

    // Deliver first passenger
    const deliveredPassengers = mockPassengers.map((p) =>
      p.id === "p1" ? { ...p, isBoarded: true, isDelivered: true } : p,
    );

    rerender({ passengers: deliveredPassengers, position: 55 });

    // Should show updated passengers immediately
    expect(result.current.displayPassengers).toHaveLength(2);
    expect(result.current.displayPassengers[0].isDelivered).toBe(true);
  });

  test("multiple rapid passenger updates during same route", () => {
    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { passengers: mockPassengers, position: 25 } },
    );

    // Initially 2 passengers
    expect(result.current.displayPassengers).toHaveLength(2);

    // Board p1
    let updated = mockPassengers.map((p) =>
      p.id === "p1" ? { ...p, isBoarded: true } : p,
    );
    rerender({ passengers: updated, position: 26 });
    expect(result.current.displayPassengers[0].isBoarded).toBe(true);

    // Board p2
    updated = updated.map((p) =>
      p.id === "p2" ? { ...p, isBoarded: true } : p,
    );
    rerender({ passengers: updated, position: 52 });
    expect(result.current.displayPassengers[1].isBoarded).toBe(true);

    // Deliver p1
    updated = updated.map((p) =>
      p.id === "p1" ? { ...p, isDelivered: true } : p,
    );
    rerender({ passengers: updated, position: 53 });
    expect(result.current.displayPassengers[0].isDelivered).toBe(true);

    // All updates should have been reflected
    expect(result.current.displayPassengers[0].isBoarded).toBe(true);
    expect(result.current.displayPassengers[0].isDelivered).toBe(true);
    expect(result.current.displayPassengers[1].isBoarded).toBe(true);
    expect(result.current.displayPassengers[1].isDelivered).toBe(false);
  });

  test("EDGE CASE: new passengers at position 0 with old route", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 95 } },
    );

    // At 95% - route 1 passengers
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Train exits tunnel
    rerender({ route: 1, passengers: mockPassengers, position: 110 });
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // New passengers generated but route hasn't changed yet, position resets to 0
    const newPassengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // CRITICAL: New passengers, old route, position = 0
    // This could trigger the second useEffect if not handled carefully
    rerender({ route: 1, passengers: newPassengers, position: 0 });

    // Should NOT show new passengers yet (route hasn't changed)
    // But position is 0-100, so second effect might fire
    expect(result.current.displayPassengers[0].id).toBe("p1");
    expect(result.current.displayPassengers[0].name).toBe("Alice");
  });

  test("EDGE CASE: passengers regenerated at position 5%", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 95 } },
    );

    // At 95% - route 1 passengers
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // New passengers generated while train is at 5%
    const newPassengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // CRITICAL: New passengers array, same route, position within 0-100
    rerender({ route: 1, passengers: newPassengers, position: 5 });

    // Should NOT show new passengers (different array reference, route hasn't changed properly)
    expect(result.current.displayPassengers[0].id).toBe("p1");
  });

  test("EDGE CASE: rapid route increment with position oscillation", () => {
    const { result, rerender } = renderHook(
      ({ route, passengers, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 3,
          carSpacing: 7,
        }),
      { initialProps: { route: 1, passengers: mockPassengers, position: 50 } },
    );

    expect(result.current.displayPassengers[0].id).toBe("p1");

    const route2Passengers: Passenger[] = [
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "station1",
        destinationStationId: "station3",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Route changes, position goes positive briefly before negative
    rerender({ route: 2, passengers: route2Passengers, position: 2 });

    // Should still show old passengers
    expect(result.current.displayPassengers[0].id).toBe("p1");

    // Position goes negative
    rerender({ route: 2, passengers: route2Passengers, position: -3 });

    // NOW should show new passengers
    expect(result.current.displayPassengers[0].id).toBe("p3");
  });
});
