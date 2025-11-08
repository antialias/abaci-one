import type { RelationKind } from "../types";

/**
 * Color scheme for each capture relation type
 */
export const RELATION_COLORS: Record<RelationKind, string> = {
  SUM: "#ef4444", // red
  DIFF: "#f97316", // orange
  PRODUCT: "#8b5cf6", // purple
  RATIO: "#3b82f6", // blue
  EQUAL: "#10b981", // green
  MULTIPLE: "#eab308", // yellow
  DIVISOR: "#06b6d4", // cyan
};

/**
 * Mathematical operator symbols for each relation
 */
export const RELATION_OPERATORS: Record<RelationKind, string> = {
  SUM: "+",
  DIFF: "−",
  PRODUCT: "×",
  RATIO: "÷",
  EQUAL: "=",
  MULTIPLE: "×",
  DIVISOR: "÷",
};

/**
 * Human-readable descriptions for relation tooltips
 */
export const RELATION_TOOLTIPS: Record<RelationKind, string> = {
  EQUAL: "Equality: a = b",
  MULTIPLE: "Multiple: b is a multiple of a",
  DIVISOR: "Divisor: a divides evenly into b",
  SUM: "Arithmetic Sum: a + c = b",
  DIFF: "Arithmetic Difference: b − a = c",
  PRODUCT: "Geometric Product: a × c = b",
  RATIO: "Geometric Ratio: b ÷ a = c",
};

/**
 * Get relation color with fallback
 */
export function getRelationColor(relation: RelationKind | null): string {
  if (!relation) return "#6b7280"; // gray fallback
  return RELATION_COLORS[relation] || "#6b7280";
}

/**
 * Get relation operator symbol with fallback
 */
export function getRelationOperator(relation: RelationKind | null): string {
  if (!relation) return "?";
  return RELATION_OPERATORS[relation] || "?";
}
