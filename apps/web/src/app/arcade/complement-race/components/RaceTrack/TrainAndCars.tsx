"use client";

import { memo } from "react";
import type {
  BoardingAnimation,
  DisembarkingAnimation,
} from "../../hooks/usePassengerAnimations";
import type { Passenger } from "@/arcade-games/complement-race/types";

interface TrainCarTransform {
  x: number;
  y: number;
  rotation: number;
  position: number;
  opacity: number;
}

interface TrainTransform {
  x: number;
  y: number;
  rotation: number;
}

interface TrainAndCarsProps {
  boardingAnimations: Map<string, BoardingAnimation>;
  disembarkingAnimations: Map<string, DisembarkingAnimation>;
  BoardingPassengerAnimation: React.ComponentType<{
    animation: BoardingAnimation;
  }>;
  DisembarkingPassengerAnimation: React.ComponentType<{
    animation: DisembarkingAnimation;
  }>;
  trainCars: TrainCarTransform[];
  boardedPassengers: Passenger[];
  trainTransform: TrainTransform;
  locomotiveOpacity: number;
  playerEmoji: string;
  momentum: number;
}

export const TrainAndCars = memo(
  ({
    boardingAnimations,
    disembarkingAnimations,
    BoardingPassengerAnimation,
    DisembarkingPassengerAnimation,
    trainCars,
    boardedPassengers,
    trainTransform,
    locomotiveOpacity,
    playerEmoji,
    momentum,
  }: TrainAndCarsProps) => {
    return (
      <>
        {/* Boarding animations - passengers moving from station to train car */}
        {Array.from(boardingAnimations.values()).map((animation) => (
          <BoardingPassengerAnimation
            key={`boarding-${animation.passenger.id}`}
            animation={animation}
          />
        ))}

        {/* Disembarking animations - passengers moving from train car to station */}
        {Array.from(disembarkingAnimations.values()).map((animation) => (
          <DisembarkingPassengerAnimation
            key={`disembarking-${animation.passenger.id}`}
            animation={animation}
          />
        ))}

        {/* Train cars - render in reverse order so locomotive appears on top */}
        {trainCars.map((carTransform, carIndex) => {
          // Assign passenger to this car (if one exists for this car index)
          const passenger = boardedPassengers[carIndex];

          return (
            <g
              key={`train-car-${carIndex}`}
              data-component="train-car"
              transform={`translate(${carTransform.x}, ${carTransform.y}) rotate(${carTransform.rotation}) scale(-1, 1)`}
              opacity={carTransform.opacity}
              style={{
                transition: "opacity 0.5s ease-in",
              }}
            >
              {/* Train car */}
              <text
                data-element="train-car-body"
                x={0}
                y={0}
                textAnchor="middle"
                style={{
                  fontSize: "65px",
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                  pointerEvents: "none",
                }}
              >
                🚃
              </text>

              {/* Passenger inside this car (hide if currently boarding) */}
              {passenger && !boardingAnimations.has(passenger.id) && (
                <text
                  data-element="car-passenger"
                  x={0}
                  y={0}
                  textAnchor="middle"
                  style={{
                    fontSize: "42px",
                    filter: passenger.isUrgent
                      ? "drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))"
                      : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                    pointerEvents: "none",
                  }}
                >
                  {passenger.avatar}
                </text>
              )}
            </g>
          );
        })}

        {/* Locomotive - rendered last so it appears on top */}
        <g
          data-component="locomotive-group"
          transform={`translate(${trainTransform.x}, ${trainTransform.y}) rotate(${trainTransform.rotation}) scale(-1, 1)`}
          opacity={locomotiveOpacity}
          style={{
            transition: "opacity 0.5s ease-in",
          }}
        >
          {/* Train locomotive */}
          <text
            data-element="train-locomotive"
            x={0}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: "100px",
              filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
              pointerEvents: "none",
            }}
          >
            🚂
          </text>

          {/* Player engineer - layered over the train */}
          <text
            data-element="player-engineer"
            x={45}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: "70px",
              filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
              pointerEvents: "none",
            }}
          >
            {playerEmoji}
          </text>

          {/* Steam puffs - positioned at smokestack, layered over train */}
          {momentum > 10 &&
            [0, 0.6, 1.2].map((delay, i) => (
              <circle
                key={`steam-${i}`}
                cx={-35}
                cy={-35}
                r="10"
                fill="rgba(255, 255, 255, 0.6)"
                style={{
                  filter: "blur(4px)",
                  animation: `steamPuffSVG 2s ease-out infinite`,
                  animationDelay: `${delay}s`,
                  pointerEvents: "none",
                }}
              />
            ))}

          {/* Coal particles - animated when shoveling */}
          {momentum > 60 &&
            [0, 0.3, 0.6].map((delay, i) => (
              <circle
                key={`coal-${i}`}
                cx={25}
                cy={0}
                r="3"
                fill="#2c2c2c"
                style={{
                  animation: "coalFallingSVG 1.2s ease-out infinite",
                  animationDelay: `${delay}s`,
                  pointerEvents: "none",
                }}
              />
            ))}
        </g>
      </>
    );
  },
);

TrainAndCars.displayName = "TrainAndCars";
