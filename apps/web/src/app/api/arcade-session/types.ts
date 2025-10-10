/**
 * API response types for /api/arcade-session
 */

export interface ArcadeSessionResponse {
  session: {
    currentGame: string;
    gameUrl: string;
    gameState: unknown;
    activePlayers: number[];
    version: number;
    expiresAt: Date | string;
  };
}

export interface ArcadeSessionErrorResponse {
  error: string;
}
