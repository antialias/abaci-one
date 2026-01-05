"use client";

import { useCallback, useState } from "react";

interface RemoteCameraSession {
  sessionId: string;
  expiresAt: string;
  phoneConnected?: boolean;
}

interface UseRemoteCameraSessionReturn {
  /** Current session data */
  session: RemoteCameraSession | null;
  /** Whether a session is being created */
  isCreating: boolean;
  /** Error message if session creation failed */
  error: string | null;
  /** Create a new remote camera session */
  createSession: () => Promise<RemoteCameraSession | null>;
  /** Set an existing session ID (for reconnection scenarios) */
  setExistingSession: (sessionId: string) => void;
  /** Clear the current session */
  clearSession: () => void;
  /** Get the URL for the phone to scan */
  getPhoneUrl: () => string | null;
}

/**
 * Hook for managing remote camera sessions
 *
 * Used by the desktop to create sessions and generate QR codes
 * for phones to scan.
 */
export function useRemoteCameraSession(): UseRemoteCameraSessionReturn {
  const [session, setSession] = useState<RemoteCameraSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession =
    useCallback(async (): Promise<RemoteCameraSession | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch("/api/remote-camera", {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create session");
        }

        const data = await response.json();
        const newSession: RemoteCameraSession = {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          phoneConnected: false,
        };

        setSession(newSession);
        return newSession;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create session";
        setError(message);
        console.error("Failed to create remote camera session:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    }, []);

  const setExistingSession = useCallback((sessionId: string) => {
    // Use existing session ID without creating a new one on the server
    // This is used for reconnection when the phone reloads
    setSession({
      sessionId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Assume 10 min remaining
      phoneConnected: false,
    });
    setError(null);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  const getPhoneUrl = useCallback((): string | null => {
    if (!session) return null;

    // Get the base URL - prefer LAN host for phone access
    if (typeof window === "undefined") return null;

    // Use NEXT_PUBLIC_LAN_HOST if set, otherwise construct from current location
    // This allows phones on the same network to reach the server
    let baseUrl: string;

    const lanHost = process.env.NEXT_PUBLIC_LAN_HOST;
    if (lanHost) {
      // If just hostname/IP provided, use current protocol and port
      if (lanHost.includes("://")) {
        baseUrl = lanHost;
      } else {
        const port = window.location.port ? `:${window.location.port}` : "";
        baseUrl = `${window.location.protocol}//${lanHost}${port}`;
      }
    } else {
      // Fallback: replace localhost with local IP if possible
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        // Try to use the page's own hostname as-is (might already be LAN address)
        // For true localhost, user needs to set NEXT_PUBLIC_LAN_HOST
        baseUrl = window.location.origin;
      } else {
        // Already using a non-localhost address (e.g., LAN IP, domain)
        baseUrl = window.location.origin;
      }
    }

    return `${baseUrl}/remote-camera/${session.sessionId}`;
  }, [session]);

  return {
    session,
    isCreating,
    error,
    createSession,
    setExistingSession,
    clearSession,
    getPhoneUrl,
  };
}
