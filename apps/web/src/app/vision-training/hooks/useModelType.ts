"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import type { ModelType } from "../train/components/wizard/types";

const VALID_MODELS: ModelType[] = ["boundary-detector", "column-classifier"];

/**
 * Hook to get the current model type from the URL path.
 * Must be used within a route that has a [model] segment.
 *
 * @returns The validated ModelType from the URL
 * @throws notFound() if the model is invalid
 */
export function useModelType(): ModelType {
  const params = useParams();
  const model = params.model as string;

  if (!model || !VALID_MODELS.includes(model as ModelType)) {
    notFound();
  }

  return model as ModelType;
}

/**
 * Type guard to check if a string is a valid ModelType
 */
export function isValidModelType(value: string): value is ModelType {
  return VALID_MODELS.includes(value as ModelType);
}

/**
 * Get all valid model types
 */
export function getValidModelTypes(): ModelType[] {
  return [...VALID_MODELS];
}
