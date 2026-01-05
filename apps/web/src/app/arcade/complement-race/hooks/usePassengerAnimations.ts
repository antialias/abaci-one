import { useEffect, useRef, useState } from "react";
import type { Passenger, Station } from "../lib/gameTypes";
import type { RailroadTrackGenerator } from "../lib/RailroadTrackGenerator";

export interface BoardingAnimation {
  passenger: Passenger;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  carIndex: number;
  startTime: number;
}

export interface DisembarkingAnimation {
  passenger: Passenger;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
}

interface UsePassengerAnimationsParams {
  passengers: Passenger[];
  stations: Station[];
  stationPositions: Array<{ x: number; y: number }>;
  trainPosition: number;
  trackGenerator: RailroadTrackGenerator;
  pathRef: React.RefObject<SVGPathElement>;
}

export function usePassengerAnimations({
  passengers,
  stations,
  stationPositions,
  trainPosition,
  trackGenerator,
  pathRef,
}: UsePassengerAnimationsParams) {
  const [boardingAnimations, setBoardingAnimations] = useState<
    Map<string, BoardingAnimation>
  >(new Map());
  const [disembarkingAnimations, setDisembarkingAnimations] = useState<
    Map<string, DisembarkingAnimation>
  >(new Map());
  const previousPassengersRef = useRef<Passenger[]>(passengers);

  // Detect passengers boarding/disembarking and start animations
  useEffect(() => {
    if (!pathRef.current || stationPositions.length === 0) return;

    const previousPassengers = previousPassengersRef.current;
    const currentPassengers = passengers;

    // Find newly boarded passengers
    const newlyBoarded = currentPassengers.filter((curr) => {
      const prev = previousPassengers.find((p) => p.id === curr.id);
      return curr.isBoarded && prev && !prev.isBoarded;
    });

    // Find newly delivered passengers
    const newlyDelivered = currentPassengers.filter((curr) => {
      const prev = previousPassengers.find((p) => p.id === curr.id);
      return curr.isDelivered && prev && !prev.isDelivered;
    });

    // Start animation for each newly boarded passenger
    newlyBoarded.forEach((passenger) => {
      // Find origin station
      const originStation = stations.find(
        (s) => s.id === passenger.originStationId,
      );
      if (!originStation) return;

      const stationIndex = stations.indexOf(originStation);
      const stationPos = stationPositions[stationIndex];
      if (!stationPos) return;

      // Find which car this passenger will be in
      const boardedPassengers = currentPassengers.filter(
        (p) => p.isBoarded && !p.isDelivered,
      );
      const carIndex = boardedPassengers.indexOf(passenger);

      // Calculate train car position
      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * 7); // 7% spacing
      const carTransform = trackGenerator.getTrainTransform(
        pathRef.current!,
        carPosition,
      );

      // Create boarding animation
      const animation: BoardingAnimation = {
        passenger,
        fromX: stationPos.x,
        fromY: stationPos.y - 30,
        toX: carTransform.x,
        toY: carTransform.y,
        carIndex,
        startTime: Date.now(),
      };

      setBoardingAnimations((prev) => {
        const next = new Map(prev);
        next.set(passenger.id, animation);
        return next;
      });

      // Remove animation after 800ms
      setTimeout(() => {
        setBoardingAnimations((prev) => {
          const next = new Map(prev);
          next.delete(passenger.id);
          return next;
        });
      }, 800);
    });

    // Start animation for each newly delivered passenger
    newlyDelivered.forEach((passenger) => {
      // Find destination station
      const destinationStation = stations.find(
        (s) => s.id === passenger.destinationStationId,
      );
      if (!destinationStation) return;

      const stationIndex = stations.indexOf(destinationStation);
      const stationPos = stationPositions[stationIndex];
      if (!stationPos) return;

      // Find which car this passenger was in (before delivery)
      const prevBoardedPassengers = previousPassengers.filter(
        (p) => p.isBoarded && !p.isDelivered,
      );
      const carIndex = prevBoardedPassengers.findIndex(
        (p) => p.id === passenger.id,
      );
      if (carIndex === -1) return;

      // Calculate train car position at time of disembarking
      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * 7); // 7% spacing
      const carTransform = trackGenerator.getTrainTransform(
        pathRef.current!,
        carPosition,
      );

      // Create disembarking animation (from car to station)
      const animation: DisembarkingAnimation = {
        passenger,
        fromX: carTransform.x,
        fromY: carTransform.y,
        toX: stationPos.x,
        toY: stationPos.y - 30,
        startTime: Date.now(),
      };

      setDisembarkingAnimations((prev) => {
        const next = new Map(prev);
        next.set(passenger.id, animation);
        return next;
      });

      // Remove animation after 800ms
      setTimeout(() => {
        setDisembarkingAnimations((prev) => {
          const next = new Map(prev);
          next.delete(passenger.id);
          return next;
        });
      }, 800);
    });

    // Update ref
    previousPassengersRef.current = currentPassengers;
  }, [
    passengers,
    stations,
    stationPositions,
    trainPosition,
    trackGenerator,
    pathRef,
  ]);

  return {
    boardingAnimations,
    disembarkingAnimations,
  };
}
