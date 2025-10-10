"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { css } from "../../../styled-system/css";
import { PageWithNav } from "@/components/PageWithNav";

interface Room {
  id: string;
  code: string;
  name: string;
  gameName: string;
  status: "lobby" | "playing" | "finished";
  createdAt: Date;
  creatorName: string;
  isLocked: boolean;
  memberCount?: number;
  playerCount?: number;
  isMember?: boolean;
}

export default function RoomBrowserPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/arcade/rooms");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setRooms(data.rooms);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      setError("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (name: string, gameName: string) => {
    try {
      const response = await fetch("/api/arcade/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gameName,
          creatorName: "Player",
          gameConfig: { difficulty: 6 },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      router.push(`/arcade-rooms/${data.room.id}`);
    } catch (err) {
      console.error("Failed to create room:", err);
      alert("Failed to create room");
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      const response = await fetch(`/api/arcade/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Player" }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific room membership conflict
        if (errorData.code === "ROOM_MEMBERSHIP_CONFLICT") {
          alert(errorData.userMessage || errorData.message);
          // Refresh the page to update room list state
          await fetchRooms();
          return;
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Show notification if user was auto-removed from other rooms
      if (data.autoLeave) {
        console.log(`[Room Join] ${data.autoLeave.message}`);
        // Could show a toast notification here in the future
      }

      router.push(`/arcade-rooms/${roomId}`);
    } catch (err) {
      console.error("Failed to join room:", err);
      alert("Failed to join room");
    }
  };

  return (
    <PageWithNav>
      <div
        className={css({
          minH: "calc(100vh - 80px)",
          bg: "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)",
          p: "8",
        })}
      >
        <div className={css({ maxW: "1200px", mx: "auto" })}>
          {/* Header */}
          <div className={css({ mb: "8", textAlign: "center" })}>
            <h1
              className={css({
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
                mb: "4",
              })}
            >
              🎮 Multiplayer Rooms
            </h1>
            <p className={css({ color: "#a0a0ff", fontSize: "lg", mb: "6" })}>
              Join a room or create your own to play with friends
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={css({
                px: "6",
                py: "3",
                bg: "#10b981",
                color: "white",
                rounded: "lg",
                fontSize: "lg",
                fontWeight: "600",
                cursor: "pointer",
                _hover: { bg: "#059669" },
                transition: "all 0.2s",
              })}
            >
              + Create New Room
            </button>
          </div>

          {/* Room List */}
          {loading && (
            <div
              className={css({ textAlign: "center", color: "white", py: "12" })}
            >
              Loading rooms...
            </div>
          )}

          {error && (
            <div
              className={css({
                bg: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                p: "4",
                rounded: "lg",
                textAlign: "center",
              })}
            >
              {error}
            </div>
          )}

          {!loading && !error && rooms.length === 0 && (
            <div
              className={css({
                bg: "rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                rounded: "lg",
                p: "12",
                textAlign: "center",
                color: "white",
              })}
            >
              <p className={css({ fontSize: "xl", mb: "2" })}>
                No rooms available
              </p>
              <p className={css({ color: "#a0a0ff" })}>
                Be the first to create one!
              </p>
            </div>
          )}

          {!loading && !error && rooms.length > 0 && (
            <div className={css({ display: "grid", gap: "4" })}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={css({
                    bg: "rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    rounded: "lg",
                    p: "6",
                    transition: "all 0.2s",
                    _hover: {
                      bg: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    },
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    })}
                  >
                    <div
                      onClick={() => router.push(`/arcade-rooms/${room.id}`)}
                      className={css({ flex: 1, cursor: "pointer" })}
                    >
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "3",
                          mb: "2",
                        })}
                      >
                        <h3
                          className={css({
                            fontSize: "2xl",
                            fontWeight: "bold",
                            color: "white",
                          })}
                        >
                          {room.name}
                        </h3>
                        <span
                          className={css({
                            px: "3",
                            py: "1",
                            bg: "rgba(255, 255, 255, 0.1)",
                            color: "#fbbf24",
                            rounded: "full",
                            fontSize: "sm",
                            fontWeight: "600",
                            fontFamily: "monospace",
                          })}
                        >
                          {room.code}
                        </span>
                        {room.isLocked && (
                          <span
                            className={css({
                              color: "#f87171",
                              fontSize: "sm",
                            })}
                          >
                            🔒 Locked
                          </span>
                        )}
                      </div>
                      <div
                        className={css({
                          display: "flex",
                          gap: "4",
                          color: "#a0a0ff",
                          fontSize: "sm",
                          flexWrap: "wrap",
                        })}
                      >
                        <span>👤 Host: {room.creatorName}</span>
                        <span>🎮 {room.gameName}</span>
                        {room.memberCount !== undefined && (
                          <span>
                            👥 {room.memberCount} member
                            {room.memberCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {room.playerCount !== undefined &&
                          room.playerCount > 0 && (
                            <span>
                              🎯 {room.playerCount} player
                              {room.playerCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        <span
                          className={css({
                            color:
                              room.status === "lobby"
                                ? "#10b981"
                                : room.status === "playing"
                                  ? "#fbbf24"
                                  : "#6b7280",
                          })}
                        >
                          {room.status === "lobby"
                            ? "⏳ Waiting"
                            : room.status === "playing"
                              ? "🎮 Playing"
                              : "✓ Finished"}
                        </span>
                      </div>
                    </div>
                    {room.isMember ? (
                      <div
                        className={css({
                          px: "6",
                          py: "3",
                          bg: "#10b981",
                          color: "white",
                          rounded: "lg",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "2",
                        })}
                      >
                        ✓ Joined
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          joinRoom(room.id);
                        }}
                        disabled={room.isLocked}
                        className={css({
                          px: "6",
                          py: "3",
                          bg: room.isLocked ? "#6b7280" : "#3b82f6",
                          color: "white",
                          rounded: "lg",
                          fontWeight: "600",
                          cursor: room.isLocked ? "not-allowed" : "pointer",
                          opacity: room.isLocked ? 0.5 : 1,
                          _hover: room.isLocked ? {} : { bg: "#2563eb" },
                          transition: "all 0.2s",
                        })}
                      >
                        Join Room
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Room Modal */}
        {showCreateModal && (
          <div
            className={css({
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bg: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            })}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className={css({
                bg: "white",
                rounded: "xl",
                p: "8",
                maxW: "500px",
                w: "full",
                mx: "4",
              })}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className={css({
                  fontSize: "2xl",
                  fontWeight: "bold",
                  mb: "6",
                })}
              >
                Create New Room
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get("name") as string;
                  const gameName = formData.get("gameName") as string;
                  if (name && gameName) {
                    createRoom(name, gameName);
                  }
                }}
              >
                <div className={css({ mb: "4" })}>
                  <label
                    className={css({
                      display: "block",
                      mb: "2",
                      fontWeight: "600",
                    })}
                  >
                    Room Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="My Awesome Room"
                    className={css({
                      w: "full",
                      px: "4",
                      py: "3",
                      border: "1px solid #d1d5db",
                      rounded: "lg",
                      _focus: { outline: "none", borderColor: "#3b82f6" },
                    })}
                  />
                </div>
                <div className={css({ mb: "6" })}>
                  <label
                    className={css({
                      display: "block",
                      mb: "2",
                      fontWeight: "600",
                    })}
                  >
                    Game
                  </label>
                  <select
                    name="gameName"
                    required
                    className={css({
                      w: "full",
                      px: "4",
                      py: "3",
                      border: "1px solid #d1d5db",
                      rounded: "lg",
                      _focus: { outline: "none", borderColor: "#3b82f6" },
                    })}
                  >
                    <option value="matching">Memory Matching</option>
                    <option value="memory-quiz">Memory Quiz</option>
                    <option value="complement-race">Complement Race</option>
                  </select>
                </div>
                <div className={css({ display: "flex", gap: "3" })}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={css({
                      flex: 1,
                      px: "6",
                      py: "3",
                      bg: "#e5e7eb",
                      color: "#374151",
                      rounded: "lg",
                      fontWeight: "600",
                      cursor: "pointer",
                      _hover: { bg: "#d1d5db" },
                    })}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={css({
                      flex: 1,
                      px: "6",
                      py: "3",
                      bg: "#10b981",
                      color: "white",
                      rounded: "lg",
                      fontWeight: "600",
                      cursor: "pointer",
                      _hover: { bg: "#059669" },
                    })}
                  >
                    Create Room
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageWithNav>
  );
}
