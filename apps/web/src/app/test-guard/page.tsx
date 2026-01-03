"use client";

import { useState } from "react";
import { useViewerId } from "@/hooks/useViewerId";

export default function TestGuardPage() {
  const { data: viewerId, isLoading } = useViewerId();
  const [sessionCreated, setSessionCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    if (!viewerId) return;

    try {
      const response = await fetch("/api/arcade-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewerId,
          gameName: "matching",
          gameUrl: "/arcade/matching",
          initialState: {
            gamePhase: "playing",
            cards: [],
            gameCards: [],
            flippedCards: [],
            matchedPairs: 0,
            totalPairs: 6,
          },
          activePlayers: [1],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      setSessionCreated(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const deleteSession = async () => {
    if (!viewerId) return;

    try {
      const response = await fetch(`/api/arcade-session?userId=${viewerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      setSessionCreated(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (isLoading) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        🧪 Arcade Guard Test Page
      </h1>

      <div
        style={{
          background: "#f3f4f6",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px",
          border: "1px solid #e5e7eb",
        }}
      >
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>Your Viewer ID:</strong>
        </p>
        <code
          style={{
            background: "#1f2937",
            color: "#10b981",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          {viewerId}
        </code>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#dc2626",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #fecaca",
          }}
        >
          ❌ {error}
        </div>
      )}

      {sessionCreated && (
        <div
          style={{
            background: "#d1fae5",
            color: "#065f46",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #a7f3d0",
          }}
        >
          ✅ Session created for matching game!
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
          Step 1: Create a Session
        </h2>
        <button
          onClick={createSession}
          disabled={sessionCreated}
          style={{
            background: sessionCreated ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: sessionCreated ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {sessionCreated ? "✓ Session Created" : "Create Matching Session"}
        </button>
      </div>

      {sessionCreated && (
        <>
          <div
            style={{
              background: "#dbeafe",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #93c5fd",
            }}
          >
            <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
              Step 2: Test the Guard
            </h2>
            <ol style={{ marginLeft: "20px", lineHeight: "1.8" }}>
              <li>
                <a
                  href="/arcade/matching"
                  target="_blank"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                  rel="noopener"
                >
                  Open /arcade/matching
                </a>{" "}
                (should load normally)
              </li>
              <li>
                <a
                  href="/arcade/memory-quiz"
                  target="_blank"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                  rel="noopener"
                >
                  Open /arcade/memory-quiz
                </a>{" "}
                (should redirect to /arcade/matching)
              </li>
              <li>
                <a
                  href="/arcade/complement-race"
                  target="_blank"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                  rel="noopener"
                >
                  Open /arcade/complement-race
                </a>{" "}
                (should redirect to /arcade/matching)
              </li>
            </ol>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
              Step 3: Clean Up
            </h2>
            <button
              onClick={deleteSession}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Delete Session
            </button>
          </div>
        </>
      )}

      <div
        style={{
          background: "#fef3c7",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #fde68a",
          marginTop: "30px",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
          ⚠️ Why This Works
        </h3>
        <p style={{ margin: 0, lineHeight: "1.6", fontSize: "14px" }}>
          This test page creates a session using{" "}
          <strong>your browser's viewer ID</strong>, so the guard can find it.
          The curl test didn't work because curl and your browser have different
          viewer IDs.
        </p>
      </div>
    </div>
  );
}
