import { useQuery } from "@tanstack/react-query";
import type { SessionRecordingResponse } from "@/app/api/curriculum/[playerId]/sessions/[sessionId]/recording/route";

/**
 * Query key factory for session recordings
 */
export const recordingKeys = {
  all: ["recordings"] as const,
  player: (playerId: string) =>
    [...recordingKeys.all, "player", playerId] as const,
  session: (playerId: string, sessionId: string) =>
    [...recordingKeys.all, "session", playerId, sessionId] as const,
};

/**
 * Fetch recording metadata for a session
 */
async function fetchSessionRecording(
  playerId: string,
  sessionId: string,
): Promise<SessionRecordingResponse> {
  const response = await fetch(
    `/api/curriculum/${playerId}/sessions/${sessionId}/recording`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recording");
  }

  return response.json();
}

/**
 * Hook for fetching session recording metadata
 */
export function useSessionRecording(playerId: string, sessionId: string) {
  return useQuery({
    queryKey: recordingKeys.session(playerId, sessionId),
    queryFn: () => fetchSessionRecording(playerId, sessionId),
    enabled: Boolean(playerId && sessionId),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch all recordings for a player
 */
interface PlayerRecordingsResponse {
  recordings: Array<{
    id: string;
    sessionId: string;
    status: string;
    durationMs: number | null;
    frameCount: number | null;
    fileSize: number | null;
    startedAt: string;
    endedAt: string | null;
    expiresAt: string;
    videoUrl: string | null;
  }>;
  totalCount: number;
}

async function fetchPlayerRecordings(
  playerId: string,
  limit?: number,
  offset?: number,
): Promise<PlayerRecordingsResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));

  const response = await fetch(
    `/api/curriculum/${playerId}/recordings?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recordings");
  }

  return response.json();
}

/**
 * Hook for fetching all recordings for a player
 */
export function usePlayerRecordings(
  playerId: string,
  options?: { limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: [...recordingKeys.player(playerId), options],
    queryFn: () =>
      fetchPlayerRecordings(playerId, options?.limit, options?.offset),
    enabled: Boolean(playerId),
    staleTime: 60 * 1000, // 1 minute
  });
}
