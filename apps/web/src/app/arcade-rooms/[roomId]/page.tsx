"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { css } from "../../../../styled-system/css";
import { PageWithNav } from "@/components/PageWithNav";
import { useViewerId } from "@/hooks/useViewerId";

interface Room {
  id: string;
  code: string;
  name: string;
  gameName: string;
  status: "lobby" | "playing" | "finished";
  createdBy: string;
  creatorName: string;
  isLocked: boolean;
}

interface Member {
  id: string;
  userId: string;
  displayName: string;
  isCreator: boolean;
  isOnline: boolean;
  joinedAt: Date;
}

interface Player {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  color: string;
  isActive: boolean;
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { data: guestId } = useViewerId();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberPlayers, setMemberPlayers] = useState<Record<string, Player[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchRoom();
  }, [roomId]);

  useEffect(() => {
    if (!guestId || !roomId) return;

    // Connect to socket
    const sock = io({ path: "/api/socket" });
    setSocket(sock);

    sock.on("connect", () => {
      setIsConnected(true);
      // Join the room
      sock.emit("join-room", { roomId, userId: guestId });
    });

    sock.on("disconnect", () => {
      setIsConnected(false);
    });

    sock.on("room-joined", (data) => {
      console.log("Joined room:", data);
      if (data.members) {
        setMembers(data.members);
      }
      if (data.memberPlayers) {
        setMemberPlayers(data.memberPlayers);
      }
    });

    sock.on("member-joined", (data) => {
      console.log("Member joined:", data);
      if (data.members) {
        setMembers(data.members);
      }
      if (data.memberPlayers) {
        setMemberPlayers(data.memberPlayers);
      }
    });

    sock.on("member-left", (data) => {
      console.log("Member left:", data);
      if (data.members) {
        setMembers(data.members);
      }
      if (data.memberPlayers) {
        setMemberPlayers(data.memberPlayers);
      }
    });

    sock.on("room-error", (error) => {
      console.error("Room error:", error);
      setError(error.error);
    });

    sock.on("room-players-updated", (data) => {
      console.log("Room players updated:", data);
      if (data.memberPlayers) {
        setMemberPlayers(data.memberPlayers);
      }
    });

    return () => {
      sock.emit("leave-room", { roomId, userId: guestId });
      sock.disconnect();
    };
  }, [roomId, guestId]);

  // Notify room when window regains focus (user might have changed players in another tab)
  useEffect(() => {
    if (!socket || !guestId || !roomId) return;

    const handleFocus = () => {
      console.log("Window focused, notifying room of potential player changes");
      socket.emit("players-updated", { roomId, userId: guestId });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [socket, roomId, guestId]);

  const fetchRoom = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/arcade/rooms/${roomId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setRoom(data.room);
      setMembers(data.members || []);
      setMemberPlayers(data.memberPlayers || {});
      setError(null);
    } catch (err) {
      console.error("Failed to fetch room:", err);
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  };

  const startGame = () => {
    if (!room) return;
    // Navigate to the room game page
    router.push("/arcade/room");
  };

  const joinRoom = async () => {
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
          // Refresh the page to update room state
          await fetchRoom();
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

      // Refresh room data to update membership UI
      await fetchRoom();
    } catch (err) {
      console.error("Failed to join room:", err);
      alert("Failed to join room");
    }
  };

  const leaveRoom = async () => {
    try {
      const response = await fetch(`/api/arcade/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Navigate to arcade home after successfully leaving
      router.push("/arcade");
    } catch (err) {
      console.error("Failed to leave room:", err);
      alert("Failed to leave room");
    }
  };

  if (loading) {
    return (
      <PageWithNav>
        <div
          className={css({
            minH: "calc(100vh - 80px)",
            bg: "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "xl",
          })}
        >
          Loading room...
        </div>
      </PageWithNav>
    );
  }

  if (error || !room) {
    return (
      <PageWithNav>
        <div
          className={css({
            minH: "calc(100vh - 80px)",
            bg: "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: "8",
          })}
        >
          <div
            className={css({
              bg: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              rounded: "lg",
              p: "12",
              textAlign: "center",
              maxW: "500px",
            })}
          >
            <p className={css({ fontSize: "xl", color: "white", mb: "4" })}>
              {error || "Room not found"}
            </p>
            <button
              onClick={() => router.push("/arcade-rooms")}
              className={css({
                px: "6",
                py: "3",
                bg: "#3b82f6",
                color: "white",
                rounded: "lg",
                fontWeight: "600",
                cursor: "pointer",
                _hover: { bg: "#2563eb" },
              })}
            >
              Back to Rooms
            </button>
          </div>
        </div>
      </PageWithNav>
    );
  }

  const onlineMembers = members.filter((m) => m.isOnline);

  // Check if current user is a member
  const isMember = members.some((m) => m.userId === guestId);

  // Calculate union of all active players in the room
  const allPlayers: Player[] = [];
  const playerIds = new Set<string>();

  for (const userId in memberPlayers) {
    for (const player of memberPlayers[userId]) {
      if (!playerIds.has(player.id)) {
        playerIds.add(player.id);
        allPlayers.push(player);
      }
    }
  }

  return (
    <PageWithNav>
      <div
        className={css({
          minH: "calc(100vh - 80px)",
          bg: "linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)",
          p: "8",
        })}
      >
        <div className={css({ maxW: "1000px", mx: "auto" })}>
          {/* Header */}
          <div
            className={css({
              bg: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              rounded: "lg",
              p: "8",
              mb: "6",
            })}
          >
            <div className={css({ mb: "4" })}>
              <button
                onClick={() => router.push("/arcade-rooms")}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2",
                  color: "#a0a0ff",
                  fontSize: "sm",
                  cursor: "pointer",
                  _hover: { color: "#60a5fa" },
                  mb: "3",
                })}
              >
                ← Back to Rooms
              </button>
            </div>
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: "4",
              })}
            >
              <div>
                <h1
                  className={css({
                    fontSize: "3xl",
                    fontWeight: "bold",
                    color: "white",
                    mb: "2",
                  })}
                >
                  {room.name}
                </h1>
                <div
                  className={css({
                    display: "flex",
                    gap: "4",
                    color: "#a0a0ff",
                    fontSize: "sm",
                  })}
                >
                  <span>🎮 {room.gameName}</span>
                  <span>👤 Host: {room.creatorName}</span>
                  <span
                    className={css({
                      px: "3",
                      py: "1",
                      bg: "rgba(255, 255, 255, 0.1)",
                      color: "#fbbf24",
                      rounded: "full",
                      fontWeight: "600",
                      fontFamily: "monospace",
                    })}
                  >
                    Code: {room.code}
                  </span>
                </div>
              </div>
              <div
                className={css({
                  display: "flex",
                  gap: "3",
                  alignItems: "center",
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                    px: "3",
                    py: "2",
                    bg: isConnected
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(239, 68, 68, 0.2)",
                    border: `1px solid ${isConnected ? "#10b981" : "#ef4444"}`,
                    rounded: "full",
                  })}
                >
                  <div
                    className={css({
                      w: "2",
                      h: "2",
                      bg: isConnected ? "#10b981" : "#ef4444",
                      rounded: "full",
                    })}
                  />
                  <span
                    className={css({
                      color: isConnected ? "#10b981" : "#ef4444",
                      fontSize: "sm",
                    })}
                  >
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Game Players - Union of all active players */}
          <div
            className={css({
              bg: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              rounded: "lg",
              p: "8",
              mb: "6",
            })}
          >
            <h2
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "white",
                mb: "2",
              })}
            >
              🎯 Game Players ({allPlayers.length})
            </h2>
            <p className={css({ color: "#a0a0ff", fontSize: "sm", mb: "4" })}>
              These players will participate when the game starts
            </p>
            {allPlayers.length > 0 ? (
              <div
                className={css({ display: "flex", gap: "2", flexWrap: "wrap" })}
              >
                {allPlayers.map((player) => (
                  <div
                    key={player.id}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "2",
                      px: "3",
                      py: "2",
                      bg: "rgba(59, 130, 246, 0.15)",
                      border: "2px solid rgba(59, 130, 246, 0.4)",
                      rounded: "lg",
                      color: "#60a5fa",
                      fontWeight: "600",
                    })}
                  >
                    <span className={css({ fontSize: "xl" })}>
                      {player.emoji}
                    </span>
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={css({
                  color: "#6b7280",
                  fontStyle: "italic",
                  textAlign: "center",
                  py: "4",
                })}
              >
                No active players yet. Members need to set up their players.
              </div>
            )}
          </div>

          {/* Members List */}
          <div
            className={css({
              bg: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              rounded: "lg",
              p: "8",
              mb: "6",
            })}
          >
            <h2
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "white",
                mb: "2",
              })}
            >
              👥 Room Members ({onlineMembers.length}/{members.length})
            </h2>
            <p className={css({ color: "#a0a0ff", fontSize: "sm", mb: "4" })}>
              Users in this room and their active players
            </p>
            <div className={css({ display: "grid", gap: "3" })}>
              {members.map((member) => {
                const players = memberPlayers[member.userId] || [];
                return (
                  <div
                    key={member.id}
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "2",
                      p: "4",
                      bg: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      rounded: "lg",
                      opacity: member.isOnline ? 1 : 0.5,
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
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "3",
                        })}
                      >
                        <div
                          className={css({
                            w: "3",
                            h: "3",
                            bg: member.isOnline ? "#10b981" : "#6b7280",
                            rounded: "full",
                          })}
                        />
                        <span
                          className={css({ color: "white", fontWeight: "600" })}
                        >
                          {member.displayName}
                        </span>
                        {member.isCreator && (
                          <span
                            className={css({
                              px: "2",
                              py: "1",
                              bg: "rgba(251, 191, 36, 0.2)",
                              color: "#fbbf24",
                              rounded: "full",
                              fontSize: "xs",
                              fontWeight: "600",
                            })}
                          >
                            HOST
                          </span>
                        )}
                      </div>
                      <span
                        className={css({ color: "#a0a0ff", fontSize: "sm" })}
                      >
                        {member.isOnline ? "🟢 Online" : "⚫ Offline"}
                      </span>
                    </div>
                    {players.length > 0 && (
                      <div
                        className={css({
                          display: "flex",
                          gap: "2",
                          flexWrap: "wrap",
                          ml: "6",
                        })}
                      >
                        <span
                          className={css({
                            color: "#a0a0ff",
                            fontSize: "xs",
                            mr: "1",
                          })}
                        >
                          Players:
                        </span>
                        {players.map((player) => (
                          <span
                            key={player.id}
                            className={css({
                              px: "2",
                              py: "1",
                              bg: "rgba(59, 130, 246, 0.2)",
                              color: "#60a5fa",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              rounded: "full",
                              fontSize: "xs",
                              fontWeight: "600",
                            })}
                          >
                            {player.emoji} {player.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {players.length === 0 && (
                      <div
                        className={css({
                          ml: "6",
                          color: "#6b7280",
                          fontSize: "xs",
                          fontStyle: "italic",
                        })}
                      >
                        No active players
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className={css({ display: "flex", gap: "4" })}>
            {isMember ? (
              <>
                <button
                  onClick={leaveRoom}
                  className={css({
                    flex: 1,
                    px: "6",
                    py: "4",
                    bg: "rgba(255, 255, 255, 0.1)",
                    color: "white",
                    rounded: "lg",
                    fontWeight: "600",
                    cursor: "pointer",
                    _hover: { bg: "rgba(255, 255, 255, 0.15)" },
                  })}
                >
                  Leave Room
                </button>
                <button
                  onClick={startGame}
                  disabled={allPlayers.length < 1}
                  className={css({
                    flex: 2,
                    px: "6",
                    py: "4",
                    bg: allPlayers.length < 1 ? "#6b7280" : "#10b981",
                    color: "white",
                    rounded: "lg",
                    fontSize: "xl",
                    fontWeight: "600",
                    cursor: allPlayers.length < 1 ? "not-allowed" : "pointer",
                    opacity: allPlayers.length < 1 ? 0.5 : 1,
                    _hover: allPlayers.length < 1 ? {} : { bg: "#059669" },
                  })}
                >
                  {allPlayers.length < 1
                    ? "Waiting for players..."
                    : `🎮 Start Game (${allPlayers.length} players)`}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/arcade-rooms")}
                  className={css({
                    flex: 1,
                    px: "6",
                    py: "4",
                    bg: "rgba(255, 255, 255, 0.1)",
                    color: "white",
                    rounded: "lg",
                    fontWeight: "600",
                    cursor: "pointer",
                    _hover: { bg: "rgba(255, 255, 255, 0.15)" },
                  })}
                >
                  Back to Rooms
                </button>
                <button
                  onClick={joinRoom}
                  disabled={room.isLocked}
                  className={css({
                    flex: 2,
                    px: "6",
                    py: "4",
                    bg: room.isLocked ? "#6b7280" : "#3b82f6",
                    color: "white",
                    rounded: "lg",
                    fontSize: "xl",
                    fontWeight: "600",
                    cursor: room.isLocked ? "not-allowed" : "pointer",
                    opacity: room.isLocked ? 0.5 : 1,
                    _hover: room.isLocked ? {} : { bg: "#2563eb" },
                  })}
                >
                  {room.isLocked ? "🔒 Room Locked" : "Join Room"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWithNav>
  );
}
