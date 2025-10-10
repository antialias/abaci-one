import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock sound effects
vi.mock("../useSoundEffects", () => ({
  useSoundEffects: () => ({
    playSound: vi.fn(),
  }),
}));

/**
 * Boarding Logic Tests
 *
 * These tests simulate the game loop's boarding logic to find edge cases
 * where passengers get left behind at stations.
 */

interface Passenger {
  id: string;
  name: string;
  avatar: string;
  originStationId: string;
  destinationStationId: string;
  isBoarded: boolean;
  isDelivered: boolean;
  isUrgent: boolean;
}

interface Station {
  id: string;
  name: string;
  icon: string;
  position: number;
}

describe("useSteamJourney - Boarding Logic", () => {
  const CAR_SPACING = 7;
  let stations: Station[];
  let passengers: Passenger[];

  beforeEach(() => {
    stations = [
      { id: "s1", name: "Station 1", icon: "🏠", position: 20 },
      { id: "s2", name: "Station 2", icon: "🏢", position: 50 },
      { id: "s3", name: "Station 3", icon: "🏪", position: 80 },
    ];

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Simulate the boarding logic from useSteamJourney (with fix)
   */
  function simulateBoardingAtPosition(
    trainPosition: number,
    passengers: Passenger[],
    stations: Station[],
    maxCars: number,
  ): Passenger[] {
    const updatedPassengers = [...passengers];
    const currentBoardedPassengers = updatedPassengers.filter(
      (p) => p.isBoarded && !p.isDelivered,
    );

    // Track which cars are assigned in THIS frame to prevent double-boarding
    const carsAssignedThisFrame = new Set<number>();

    // Simulate the boarding logic
    updatedPassengers.forEach((passenger, passengerIndex) => {
      if (passenger.isBoarded || passenger.isDelivered) return;

      const station = stations.find((s) => s.id === passenger.originStationId);
      if (!station) return;

      // Check if any empty car is at this station
      for (let carIndex = 0; carIndex < maxCars; carIndex++) {
        // Skip if this car already has a passenger OR was assigned this frame
        if (
          currentBoardedPassengers[carIndex] ||
          carsAssignedThisFrame.has(carIndex)
        )
          continue;

        const carPosition = Math.max(
          0,
          trainPosition - (carIndex + 1) * CAR_SPACING,
        );
        const distance = Math.abs(carPosition - station.position);

        // If car is at station (within 3% tolerance), board this passenger
        if (distance < 3) {
          updatedPassengers[passengerIndex] = { ...passenger, isBoarded: true };
          // Mark this car as assigned in this frame
          carsAssignedThisFrame.add(carIndex);
          return; // Board this passenger and move on
        }
      }
    });

    return updatedPassengers;
  }

  test("single passenger at station boards when car arrives", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Train at position 27%, first car at position 20% (station 1)
    const result = simulateBoardingAtPosition(27, passengers, stations, 1);

    expect(result[0].isBoarded).toBe(true);
  });

  test("EDGE CASE: multiple passengers at same station with enough cars", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Train at position 34%, cars at: 27%, 20%, 13%
    // Car 1 (27%): 7% away from station (too far)
    // Car 2 (20%): 0% away from station (at station!)
    // Car 3 (13%): 7% away from station (too far)
    let result = simulateBoardingAtPosition(34, passengers, stations, 3);

    // First iteration: car 2 is at station, should board first passenger
    expect(result[0].isBoarded).toBe(true);

    // But what about the other passengers? They should board on subsequent frames
    // Let's simulate the train advancing slightly
    result = simulateBoardingAtPosition(35, result, stations, 3);

    // Now car 1 is at 28% (still too far), car 2 at 21% (still close), car 3 at 14% (too far)
    // Passenger 2 should still not board yet

    // Advance more - when does car 1 reach the station?
    result = simulateBoardingAtPosition(27, result, stations, 3);
    // Car 1 at 20% (at station!)
    expect(result[1].isBoarded).toBe(true);

    // What about passenger 3? Need car 3 to reach station
    // Car 3 position = trainPosition - (3 * 7) = trainPosition - 21
    // For car 3 to be at 20%, need trainPosition = 41
    result = simulateBoardingAtPosition(41, result, stations, 3);
    // Car 3 at 20% (at station!)
    expect(result[2].isBoarded).toBe(true);
  });

  test("EDGE CASE: passengers left behind when train moves too fast", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Simulate train speeding through station
    // Only 2 cars, but 2 passengers at same station

    // Frame 1: Train at 27%, car 1 at 20%, car 2 at 13%
    let result = simulateBoardingAtPosition(27, passengers, stations, 2);
    expect(result[0].isBoarded).toBe(true);
    expect(result[1].isBoarded).toBe(false);

    // Frame 2: Train jumps to 35% (high momentum)
    // Car 1 at 28%, car 2 at 21%
    result = simulateBoardingAtPosition(35, result, stations, 2);
    // Car 2 is at 21%, within 1% of station at 20%
    expect(result[1].isBoarded).toBe(true);

    // Frame 3: Train at 45% - both cars past station
    result = simulateBoardingAtPosition(45, result, stations, 2);
    // Car 1 at 38%, car 2 at 31% - both way past 20%

    // All passengers should have boarded
    expect(result.every((p) => p.isBoarded)).toBe(true);
  });

  test("EDGE CASE: passenger left behind when boarding window is missed", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Only 1 car, 2 passengers
    // Frame 1: Train at 27%, car at 20%
    let result = simulateBoardingAtPosition(27, passengers, stations, 1);
    expect(result[0].isBoarded).toBe(true);
    expect(result[1].isBoarded).toBe(false); // Second passenger waiting

    // Frame 2: Train jumps way past (very high momentum)
    result = simulateBoardingAtPosition(50, result, stations, 1);
    // Car at 43% - way past station at 20%

    // Second passenger SHOULD BE LEFT BEHIND!
    expect(result[1].isBoarded).toBe(false);
  });

  test("EDGE CASE: only one passenger boards per car per frame", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // Only 1 car, both passengers at same station
    // With the fix, only first passenger should board in this frame
    const result = simulateBoardingAtPosition(27, passengers, stations, 1);

    // First passenger boards
    expect(result[0].isBoarded).toBe(true);
    // Second passenger does NOT board (car already assigned this frame)
    expect(result[1].isBoarded).toBe(false);
  });

  test("all passengers board before train completely passes station", () => {
    passengers = [
      {
        id: "p1",
        name: "Alice",
        avatar: "👩",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p2",
        name: "Bob",
        avatar: "👨",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
      {
        id: "p3",
        name: "Charlie",
        avatar: "👴",
        originStationId: "s1",
        destinationStationId: "s2",
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ];

    // 3 passengers, 3 cars
    // Simulate train moving through station frame by frame
    let result = passengers;

    // Train approaching station
    for (let pos = 13; pos <= 40; pos += 1) {
      result = simulateBoardingAtPosition(pos, result, stations, 3);
    }

    // All passengers should have boarded by the time last car passes
    const allBoarded = result.every((p) => p.isBoarded);
    const leftBehind = result.filter((p) => !p.isBoarded);

    expect(allBoarded).toBe(true);
    if (!allBoarded) {
      console.log(
        "Passengers left behind:",
        leftBehind.map((p) => p.name),
      );
    }
  });
});
