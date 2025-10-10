"use client";

import { animated, useSpring } from "@react-spring/web";
import { memo, useMemo, useRef, useState } from "react";
import { useGameMode } from "@/contexts/GameModeContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useComplementRace } from "../../context/ComplementRaceContext";
import {
  type BoardingAnimation,
  type DisembarkingAnimation,
  usePassengerAnimations,
} from "../../hooks/usePassengerAnimations";
import type { ComplementQuestion } from "../../lib/gameTypes";
import { useSteamJourney } from "../../hooks/useSteamJourney";
import { useTrackManagement } from "../../hooks/useTrackManagement";
import { useTrainTransforms } from "../../hooks/useTrainTransforms";
import { calculateMaxConcurrentPassengers } from "../../lib/passengerGenerator";
import { RailroadTrackGenerator } from "../../lib/RailroadTrackGenerator";
import { getRouteTheme } from "../../lib/routeThemes";
import { GameHUD } from "./GameHUD";
import { RailroadTrackPath } from "./RailroadTrackPath";
import { TrainAndCars } from "./TrainAndCars";
import { TrainTerrainBackground } from "./TrainTerrainBackground";

const BoardingPassengerAnimation = memo(
  ({ animation }: { animation: BoardingAnimation }) => {
    const spring = useSpring({
      from: { x: animation.fromX, y: animation.fromY, opacity: 1 },
      to: { x: animation.toX, y: animation.toY, opacity: 1 },
      config: { tension: 120, friction: 14 },
    });

    return (
      <animated.text
        x={spring.x}
        y={spring.y}
        textAnchor="middle"
        opacity={spring.opacity}
        style={{
          fontSize: "55px",
          pointerEvents: "none",
          filter: animation.passenger.isUrgent
            ? "drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))"
            : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
        }}
      >
        {animation.passenger.avatar}
      </animated.text>
    );
  },
);
BoardingPassengerAnimation.displayName = "BoardingPassengerAnimation";

const DisembarkingPassengerAnimation = memo(
  ({ animation }: { animation: DisembarkingAnimation }) => {
    const spring = useSpring({
      from: { x: animation.fromX, y: animation.fromY, opacity: 1 },
      to: { x: animation.toX, y: animation.toY, opacity: 1 },
      config: { tension: 120, friction: 14 },
    });

    return (
      <animated.text
        x={spring.x}
        y={spring.y}
        textAnchor="middle"
        opacity={spring.opacity}
        style={{
          fontSize: "55px",
          pointerEvents: "none",
          filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))",
        }}
      >
        {animation.passenger.avatar}
      </animated.text>
    );
  },
);
DisembarkingPassengerAnimation.displayName = "DisembarkingPassengerAnimation";

interface SteamTrainJourneyProps {
  momentum: number;
  trainPosition: number;
  pressure: number;
  elapsedTime: number;
  currentQuestion: ComplementQuestion | null;
  currentInput: string;
}

export function SteamTrainJourney({
  momentum,
  trainPosition,
  pressure,
  elapsedTime,
  currentQuestion,
  currentInput,
}: SteamTrainJourneyProps) {
  const { state } = useComplementRace();
  const { getSkyGradient, getTimeOfDayPeriod } = useSteamJourney();
  const _skyGradient = getSkyGradient();
  const period = getTimeOfDayPeriod();
  const { players } = useGameMode();
  const { profile: _profile } = useUserProfile();

  // Get the first active player's emoji
  const activePlayers = Array.from(players.values()).filter((p) => p.id);
  const firstActivePlayer = activePlayers[0];
  const playerEmoji = firstActivePlayer?.emoji ?? "👤";

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [trackGenerator] = useState(() => new RailroadTrackGenerator(800, 600));

  // Calculate the number of train cars dynamically based on max concurrent passengers
  const maxCars = useMemo(() => {
    const maxPassengers = calculateMaxConcurrentPassengers(
      state.passengers,
      state.stations,
    );
    // Ensure at least 1 car, even if no passengers
    return Math.max(1, maxPassengers);
  }, [state.passengers, state.stations]);

  const carSpacing = 7; // Distance between cars (in % of track)

  // Train transforms (extracted to hook)
  const { trainTransform, trainCars, locomotiveOpacity } = useTrainTransforms({
    trainPosition,
    trackGenerator,
    pathRef,
    maxCars,
    carSpacing,
  });

  // Track management (extracted to hook)
  const {
    trackData,
    tiesAndRails,
    stationPositions,
    landmarks,
    landmarkPositions,
    displayPassengers,
  } = useTrackManagement({
    currentRoute: state.currentRoute,
    trainPosition,
    trackGenerator,
    pathRef,
    stations: state.stations,
    passengers: state.passengers,
    maxCars,
    carSpacing,
  });

  // Passenger animations (extracted to hook)
  const { boardingAnimations, disembarkingAnimations } = usePassengerAnimations(
    {
      passengers: state.passengers,
      stations: state.stations,
      stationPositions,
      trainPosition,
      trackGenerator,
      pathRef,
    },
  );

  // Time remaining (60 seconds total)
  const timeRemaining = Math.max(0, 60 - Math.floor(elapsedTime / 1000));

  // Period names for display
  const periodNames = [
    "Dawn",
    "Morning",
    "Midday",
    "Afternoon",
    "Dusk",
    "Night",
  ];

  // Get current route theme
  const routeTheme = getRouteTheme(state.currentRoute);

  // Memoize filtered passenger lists to avoid recalculating on every render
  const boardedPassengers = useMemo(
    () => displayPassengers.filter((p) => p.isBoarded && !p.isDelivered),
    [displayPassengers],
  );

  const nonDeliveredPassengers = useMemo(
    () => displayPassengers.filter((p) => !p.isDelivered),
    [displayPassengers],
  );

  // Memoize ground texture circles to avoid recreating on every render
  const groundTextureCircles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        key: `ground-texture-${i}`,
        cx: -30 + i * 28 + (i % 3) * 10,
        cy: 140 + (i % 5) * 60,
        r: 2 + (i % 3),
      })),
    [],
  );

  if (!trackData) return null;

  return (
    <div
      data-component="steam-train-journey"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        justifyContent: "stretch",
      }}
    >
      {/* Game HUD - overlays and UI elements */}
      <GameHUD
        routeTheme={routeTheme}
        currentRoute={state.currentRoute}
        periodName={periodNames[period]}
        timeRemaining={timeRemaining}
        pressure={pressure}
        nonDeliveredPassengers={nonDeliveredPassengers}
        stations={state.stations}
        currentQuestion={currentQuestion}
        currentInput={currentInput}
      />

      {/* Railroad track SVG */}
      <svg
        data-component="railroad-track"
        ref={svgRef}
        viewBox="-50 -50 900 700"
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: "800 / 600",
          overflow: "visible",
        }}
      >
        {/* Terrain background - ground, mountains, and tunnels */}
        <TrainTerrainBackground
          ballastPath={trackData.ballastPath}
          groundTextureCircles={groundTextureCircles}
        />

        {/* Railroad track, landmarks, and stations */}
        <RailroadTrackPath
          tiesAndRails={tiesAndRails}
          referencePath={trackData.referencePath}
          pathRef={pathRef}
          landmarkPositions={landmarkPositions}
          landmarks={landmarks}
          stationPositions={stationPositions}
          stations={state.stations}
          passengers={displayPassengers}
          boardingAnimations={boardingAnimations}
          disembarkingAnimations={disembarkingAnimations}
        />

        {/* Train, cars, and passenger animations */}
        <TrainAndCars
          boardingAnimations={boardingAnimations}
          disembarkingAnimations={disembarkingAnimations}
          BoardingPassengerAnimation={BoardingPassengerAnimation}
          DisembarkingPassengerAnimation={DisembarkingPassengerAnimation}
          trainCars={trainCars}
          boardedPassengers={boardedPassengers}
          trainTransform={trainTransform}
          locomotiveOpacity={locomotiveOpacity}
          playerEmoji={playerEmoji}
          momentum={momentum}
        />
      </svg>

      {/* CSS animations */}
      <style>{`
        @keyframes steamPuffSVG {
          0% {
            opacity: 0.8;
            transform: scale(0.5) translate(0, 0);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.5) translate(15px, -30px);
          }
          100% {
            opacity: 0;
            transform: scale(2) translate(25px, -60px);
          }
        }

        @keyframes coalFallingSVG {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: translate(5px, 15px) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translate(8px, 30px) scale(0.5);
          }
        }

        @keyframes celebrateDelivery {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          20% {
            transform: scale(1.3) translateY(-10px);
          }
          40% {
            transform: scale(1.2) translateY(-5px);
          }
          100% {
            opacity: 0;
            transform: scale(0.8) translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}
