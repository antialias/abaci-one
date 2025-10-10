import { useEffect } from "react";
import {
  type CommentaryContext,
  getAICommentary,
} from "../components/AISystem/aiCommentary";
import { useComplementRace } from "../context/ComplementRaceContext";
import { useSoundEffects } from "./useSoundEffects";

export function useAIRacers() {
  const { state, dispatch } = useComplementRace();
  const { playSound } = useSoundEffects();

  useEffect(() => {
    if (!state.isGameActive) return;

    // Update AI positions every 200ms (line 11690)
    const aiUpdateInterval = setInterval(() => {
      const newPositions = state.aiRacers.map((racer) => {
        // Base speed with random variance (0.6-1.4 range via Math.random() * 0.8 + 0.6)
        const variance = Math.random() * 0.8 + 0.6;
        let speed = racer.speed * variance * state.speedMultiplier;

        // Rubber-banding: AI speeds up 2x when >10 units behind player (line 11697-11699)
        const distanceBehind = state.correctAnswers - racer.position;
        if (distanceBehind > 10) {
          speed *= 2;
        }

        // Update position
        const newPosition = racer.position + speed;

        return {
          id: racer.id,
          position: newPosition,
        };
      });

      dispatch({ type: "UPDATE_AI_POSITIONS", positions: newPositions });

      // Check for AI win in practice mode (line 14151)
      if (state.style === "practice" && state.isGameActive) {
        const winningAI = state.aiRacers.find((racer, index) => {
          const updatedPosition =
            newPositions[index]?.position || racer.position;
          return updatedPosition >= state.raceGoal;
        });

        if (winningAI) {
          // Play game over sound (line 14193)
          playSound("gameOver");
          // End the game
          dispatch({ type: "END_RACE" });
          // Show results after a short delay
          setTimeout(() => {
            dispatch({ type: "SHOW_RESULTS" });
          }, 1500);
          return; // Exit early to prevent further updates
        }
      }

      // Check for commentary triggers after position updates
      state.aiRacers.forEach((racer) => {
        const updatedPosition =
          newPositions.find((p) => p.id === racer.id)?.position ||
          racer.position;
        const distanceBehind = state.correctAnswers - updatedPosition;
        const distanceAhead = updatedPosition - state.correctAnswers;

        // Detect passing events
        const playerJustPassed =
          racer.previousPosition > state.correctAnswers &&
          updatedPosition < state.correctAnswers;
        const aiJustPassed =
          racer.previousPosition < state.correctAnswers &&
          updatedPosition > state.correctAnswers;

        // Determine commentary context
        let context: CommentaryContext | null = null;

        if (playerJustPassed) {
          context = "player_passed";
        } else if (aiJustPassed) {
          context = "ai_passed";
        } else if (distanceBehind > 20) {
          // Player has lapped the AI (more than 20 units behind)
          context = "lapped";
        } else if (distanceBehind > 10) {
          // AI is desperate to catch up (rubber-banding active)
          context = "desperate_catchup";
        } else if (distanceAhead > 5) {
          // AI is significantly ahead
          context = "ahead";
        } else if (distanceBehind > 3) {
          // AI is behind
          context = "behind";
        }

        // Trigger commentary if context is valid
        if (context) {
          const message = getAICommentary(
            racer,
            context,
            state.correctAnswers,
            updatedPosition,
          );
          if (message) {
            dispatch({
              type: "TRIGGER_AI_COMMENTARY",
              racerId: racer.id,
              message,
              context,
            });

            // Play special turbo sound when AI goes desperate (line 11941)
            if (context === "desperate_catchup") {
              playSound("ai_turbo", 0.12);
            }
          }
        }
      });
    }, 200);

    return () => clearInterval(aiUpdateInterval);
  }, [
    state.isGameActive,
    state.aiRacers,
    state.correctAnswers,
    state.speedMultiplier,
    dispatch, // Play game over sound (line 14193)
    playSound,
    state.raceGoal,
    state.style,
  ]);

  return {
    aiRacers: state.aiRacers,
  };
}
