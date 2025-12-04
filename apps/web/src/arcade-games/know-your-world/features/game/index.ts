/**
 * Game Feature Module
 *
 * Provides game-specific context and utilities for the Know Your World game.
 * This module handles game state that needs to be shared across components
 * without prop drilling.
 */

export type {
  CelebrationState,
  GiveUpRevealState,
  MagnifierBorderStyle,
  MapGameContextValue,
  MapGameProviderProps,
} from './MapGameContext'

export { MapGameProvider, useMapGameContext, useMapGameContextSafe } from './MapGameContext'
