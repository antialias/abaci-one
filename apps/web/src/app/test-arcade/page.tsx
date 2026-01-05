"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

export default function TestArcadePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [userId] = useState("evybhb5o0v4t76e7qnrx3x1t"); // Use real user ID from DB
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      path: "/api/socket",
    });

    socketInstance.on("connect", () => {
      setConnected(true);
      addLog("✅ Connected to Socket.IO");
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
      addLog("❌ Disconnected from Socket.IO");
    });

    socketInstance.on("session-state", (data) => {
      addLog(`📦 Received session state: ${JSON.stringify(data, null, 2)}`);
    });

    socketInstance.on("no-active-session", () => {
      addLog("ℹ️ No active session found");
    });

    socketInstance.on("move-accepted", (data) => {
      addLog(`✅ Move accepted: ${JSON.stringify(data, null, 2)}`);
    });

    socketInstance.on("move-rejected", (data) => {
      addLog(`❌ Move rejected: ${JSON.stringify(data, null, 2)}`);
    });

    socketInstance.on("session-ended", () => {
      addLog("🚪 Session ended");
    });

    socketInstance.on("session-error", (data) => {
      addLog(`⚠️ Session error: ${data.error}`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [addLog]);

  const joinSession = () => {
    if (!socket) return;
    addLog(`Joining session as user: ${userId}`);
    socket.emit("join-arcade-session", { userId });
  };

  const startGame = () => {
    if (!socket) return;
    const move = {
      type: "START_GAME",
      playerId: userId,
      timestamp: Date.now(),
      data: {
        activePlayers: [1],
      },
    };
    addLog(`Sending START_GAME move: ${JSON.stringify(move)}`);
    socket.emit("game-move", { userId, move });
  };

  const testFlipCard = () => {
    if (!socket) return;
    const move = {
      type: "FLIP_CARD",
      playerId: userId,
      timestamp: Date.now(),
      data: {
        cardId: "test-card-1",
      },
    };
    addLog(`Sending move: ${JSON.stringify(move)}`);
    socket.emit("game-move", { userId, move });
  };

  const createSession = async () => {
    addLog("Creating test session via API...");

    // First, delete any existing session
    addLog("Deleting any existing session first...");
    try {
      await fetch(`/api/arcade-session?userId=${userId}`, {
        method: "DELETE",
      });
      addLog("✅ Old session deleted (if existed)");
    } catch (error) {
      addLog(`⚠️ Could not delete old session: ${error}`);
    }

    // Now create new session
    try {
      const response = await fetch("/api/arcade-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          gameName: "matching",
          gameUrl: "/arcade/matching",
          initialState: {
            cards: [],
            gameCards: [],
            flippedCards: [],
            gameType: "abacus-numeral",
            difficulty: 6,
            turnTimer: 30,
            gamePhase: "setup",
            currentPlayer: 1,
            matchedPairs: 0,
            totalPairs: 6,
            moves: 0,
            scores: {},
            activePlayers: [1],
            consecutiveMatches: {},
            gameStartTime: null,
            gameEndTime: null,
            currentMoveStartTime: null,
            timerInterval: null,
            celebrationAnimations: [],
            isProcessingMove: false,
            showMismatchFeedback: false,
            lastMatchedPair: null,
          },
          activePlayers: [1],
        }),
      });
      const data = await response.json();
      if (response.ok) {
        addLog(`✅ Session created successfully`);
      } else {
        addLog(`❌ Failed to create session: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error creating session: ${error}`);
    }
  };

  const exitSession = () => {
    if (!socket) return;
    addLog(`Exiting session for user: ${userId}`);
    socket.emit("exit-arcade-session", { userId });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Arcade Session Test</h1>

      <div
        style={{
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#fff3cd",
          borderRadius: "4px",
        }}
      >
        <strong>Test Cross-Tab Sync:</strong>
        <ol style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>Open this page in TWO browser tabs</li>
          <li>In Tab 1: Click buttons 1 → 2</li>
          <li>In Tab 2: Click button 2 only (session already exists)</li>
          <li>In Tab 1: Click button 3 (Start Game)</li>
          <li>
            Watch Tab 2's event log - it should show "✅ Move accepted"
            instantly!
          </li>
        </ol>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <strong>Connection Status:</strong>{" "}
        <span style={{ color: connected ? "green" : "red" }}>
          {connected ? "🟢 Connected" : "🔴 Disconnected"}
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <strong>User ID:</strong> {userId}
      </div>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={createSession}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6f42c1",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          1. Create Session
        </button>

        <button
          onClick={joinSession}
          disabled={!connected}
          style={{
            padding: "10px 20px",
            backgroundColor: connected ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          2. Join Session
        </button>

        <button
          onClick={startGame}
          disabled={!connected}
          style={{
            padding: "10px 20px",
            backgroundColor: connected ? "#17a2b8" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          3. Start Game (broadcasts!)
        </button>

        <button
          onClick={testFlipCard}
          disabled={!connected}
          style={{
            padding: "10px 20px",
            backgroundColor: connected ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          4. Test Flip Card
        </button>

        <button
          onClick={exitSession}
          disabled={!connected}
          style={{
            padding: "10px 20px",
            backgroundColor: connected ? "#dc3545" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          5. Exit Session
        </button>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderRadius: "4px",
          maxHeight: "400px",
          overflow: "auto",
        }}
      >
        <h3>Event Log:</h3>
        {logs.length === 0 ? (
          <p style={{ color: "#666" }}>No events yet...</p>
        ) : (
          <div>
            {logs.map((log, i) => (
              <div
                key={i}
                style={{
                  padding: "5px",
                  borderBottom: "1px solid #ddd",
                  fontSize: "12px",
                }}
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
