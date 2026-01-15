/**
 * Model Registry for Vision Training
 *
 * This registry defines model types and their metadata.
 * Pages use the path-based architecture and render components directly.
 */

import type { ModelType } from "./train/components/wizard/types";

// Registry entry for a model type
export interface ModelRegistryEntry {
  label: string;
  description: string;
  icon: string;
}

// Helper to get model registry entry
export function getModelEntry(modelType: ModelType): ModelRegistryEntry {
  switch (modelType) {
    case "boundary-detector":
      return {
        label: "Boundary Detector",
        description: "Detects abacus boundaries in camera frames",
        icon: "🎯",
      };
    case "column-classifier":
      return {
        label: "Column Classifier",
        description: "Classifies abacus column values (0-9)",
        icon: "🔢",
      };
    default: {
      const exhaustiveCheck: never = modelType;
      throw new Error(`Unknown model type: ${exhaustiveCheck}`);
    }
  }
}

// Get all model types for iteration
export function getAllModelTypes(): ModelType[] {
  return ["boundary-detector", "column-classifier"];
}

// Get label for a model type
export function getModelLabel(modelType: ModelType): string {
  return getModelEntry(modelType).label;
}

// Tab definitions
export type TabId = "data" | "train" | "test" | "sessions";

export interface TabDefinition {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: TabDefinition[] = [
  { id: "data", label: "Data", icon: "📊" },
  { id: "train", label: "Train", icon: "🏋️" },
  { id: "test", label: "Test", icon: "🧪" },
  { id: "sessions", label: "Sessions", icon: "📁" },
];
