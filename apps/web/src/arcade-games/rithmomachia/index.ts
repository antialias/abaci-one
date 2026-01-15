import {
  defineGame,
  type GameManifest,
  getGameTheme,
} from "@/lib/arcade/game-sdk";
import { RithmomachiaGame } from "./components/RithmomachiaGame";
import { RithmomachiaProvider } from "./Provider";
import type {
  RithmomachiaConfig,
  RithmomachiaMove,
  RithmomachiaState,
} from "./types";
import { rithmomachiaValidator } from "./Validator";

/**
 * Game manifest for Rithmomachia.
 */
const manifest: GameManifest = {
  name: "rithmomachia",
  displayName: "Rithmomachia",
  icon: "🎲",
  description: "Medieval mathematical battle game",
  longDescription:
    "Rithmomachia (Battle of Numbers) is a medieval strategy game where pieces with numerical values capture each other through mathematical relations. Win by achieving harmony (a mathematical progression) in enemy territory, or by capturing enough pieces to exhaust your opponent.",
  maxPlayers: 2,
  difficulty: "Advanced",
  chips: ["⚔️ Strategy", "🔢 Mathematical", "🏛️ Historical", "🎯 Two-Player"],
  ...getGameTheme("purple"),
  available: true,
  practiceBreakReady: false,
};

/**
 * Default configuration for Rithmomachia.
 */
const defaultConfig: RithmomachiaConfig = {
  pointWinEnabled: false,
  pointWinThreshold: 30,
  repetitionRule: true,
  fiftyMoveRule: true,
  allowAnySetOnRecheck: true,
  timeControlMs: null,
};

/**
 * Config validation (type guard).
 * Validates all config fields and their constraints.
 */
function validateConfig(config: unknown): config is RithmomachiaConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const c = config as Record<string, unknown>;

  // Validate pointWinEnabled
  if (!("pointWinEnabled" in c) || typeof c.pointWinEnabled !== "boolean") {
    return false;
  }

  // Validate pointWinThreshold
  if (
    !("pointWinThreshold" in c) ||
    typeof c.pointWinThreshold !== "number" ||
    c.pointWinThreshold < 1
  ) {
    return false;
  }

  // Validate repetitionRule
  if (!("repetitionRule" in c) || typeof c.repetitionRule !== "boolean") {
    return false;
  }

  // Validate fiftyMoveRule
  if (!("fiftyMoveRule" in c) || typeof c.fiftyMoveRule !== "boolean") {
    return false;
  }

  // Validate allowAnySetOnRecheck
  if (
    !("allowAnySetOnRecheck" in c) ||
    typeof c.allowAnySetOnRecheck !== "boolean"
  ) {
    return false;
  }

  // Validate timeControlMs
  if ("timeControlMs" in c) {
    if (
      c.timeControlMs !== null &&
      (typeof c.timeControlMs !== "number" || c.timeControlMs < 0)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Rithmomachia game definition.
 */
export const rithmomachiaGame = defineGame<
  RithmomachiaConfig,
  RithmomachiaState,
  RithmomachiaMove
>({
  manifest,
  Provider: RithmomachiaProvider,
  GameComponent: RithmomachiaGame,
  validator: rithmomachiaValidator,
  defaultConfig,
  validateConfig,
});
