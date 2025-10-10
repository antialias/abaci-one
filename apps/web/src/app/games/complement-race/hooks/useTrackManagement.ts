import { useEffect, useRef, useState } from "react";
import type { Passenger, Station } from "../lib/gameTypes";
import { generateLandmarks, type Landmark } from "../lib/landmarks";
import type { RailroadTrackGenerator } from "../lib/RailroadTrackGenerator";

interface UseTrackManagementParams {
  currentRoute: number;
  trainPosition: number;
  trackGenerator: RailroadTrackGenerator;
  pathRef: React.RefObject<SVGPathElement>;
  stations: Station[];
  passengers: Passenger[];
  maxCars: number;
  carSpacing: number;
}

export function useTrackManagement({
  currentRoute,
  trainPosition,
  trackGenerator,
  pathRef,
  stations,
  passengers,
  maxCars: _maxCars,
  carSpacing: _carSpacing,
}: UseTrackManagementParams) {
  const [trackData, setTrackData] = useState<ReturnType<
    typeof trackGenerator.generateTrack
  > | null>(null);
  const [tiesAndRails, setTiesAndRails] = useState<{
    ties: Array<{ x1: number; y1: number; x2: number; y2: number }>;
    leftRailPath: string;
    rightRailPath: string;
  } | null>(null);
  const [stationPositions, setStationPositions] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [landmarkPositions, setLandmarkPositions] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [displayPassengers, setDisplayPassengers] =
    useState<Passenger[]>(passengers);

  // Track previous route data to maintain visuals during transition
  const previousRouteRef = useRef(currentRoute);
  const [pendingTrackData, setPendingTrackData] = useState<ReturnType<
    typeof trackGenerator.generateTrack
  > | null>(null);
  const displayRouteRef = useRef(currentRoute); // Track which route's passengers are being displayed

  // Generate landmarks when route changes
  useEffect(() => {
    const newLandmarks = generateLandmarks(currentRoute);
    setLandmarks(newLandmarks);
  }, [currentRoute]);

  // Generate track on mount and when route changes
  useEffect(() => {
    const track = trackGenerator.generateTrack(currentRoute);

    // If we're in the middle of a route (position > 0), store as pending
    // Only apply new track when position resets to beginning (< 0)
    if (trainPosition > 0 && previousRouteRef.current !== currentRoute) {
      setPendingTrackData(track);
    } else {
      setTrackData(track);
      previousRouteRef.current = currentRoute;
      setPendingTrackData(null);
    }
  }, [trackGenerator, currentRoute, trainPosition]);

  // Apply pending track when train resets to beginning
  useEffect(() => {
    if (pendingTrackData && trainPosition < 0) {
      setTrackData(pendingTrackData);
      previousRouteRef.current = currentRoute;
      setPendingTrackData(null);
    }
  }, [pendingTrackData, trainPosition, currentRoute]);

  // Manage passenger display during route transitions
  useEffect(() => {
    // Only switch to new passengers when:
    // 1. Train has reset to start position (< 0) - track has changed, OR
    // 2. Same route AND train is in middle of track (10-90%) - gameplay updates like boarding/delivering
    const trainReset = trainPosition < 0;
    const sameRoute = currentRoute === displayRouteRef.current;
    const inMiddleOfTrack = trainPosition >= 10 && trainPosition < 90; // Avoid start/end transition zones

    if (trainReset) {
      // Train reset - update to new route's passengers
      setDisplayPassengers(passengers);
      displayRouteRef.current = currentRoute;
    } else if (sameRoute && inMiddleOfTrack) {
      // Same route and train in middle of track - update passengers for gameplay changes (boarding/delivery)
      setDisplayPassengers(passengers);
    }
    // Otherwise, keep displaying old passengers until train resets
  }, [passengers, trainPosition, currentRoute]);

  // Generate ties and rails when path is ready
  useEffect(() => {
    if (pathRef.current && trackData) {
      const result = trackGenerator.generateTiesAndRails(pathRef.current);
      setTiesAndRails(result);
    }
  }, [trackData, trackGenerator, pathRef]);

  // Calculate station positions when path is ready
  useEffect(() => {
    if (pathRef.current) {
      const positions = stations.map((station) => {
        const pathLength = pathRef.current!.getTotalLength();
        const distance = (station.position / 100) * pathLength;
        const point = pathRef.current!.getPointAtLength(distance);
        return { x: point.x, y: point.y };
      });
      setStationPositions(positions);
    }
  }, [stations, pathRef]);

  // Calculate landmark positions when path is ready
  useEffect(() => {
    if (pathRef.current && landmarks.length > 0) {
      const positions = landmarks.map((landmark) => {
        const pathLength = pathRef.current!.getTotalLength();
        const distance = (landmark.position / 100) * pathLength;
        const point = pathRef.current!.getPointAtLength(distance);
        return {
          x: point.x + landmark.offset.x,
          y: point.y + landmark.offset.y,
        };
      });
      setLandmarkPositions(positions);
    }
  }, [landmarks, pathRef]);

  return {
    trackData,
    tiesAndRails,
    stationPositions,
    landmarks,
    landmarkPositions,
    displayPassengers,
  };
}
