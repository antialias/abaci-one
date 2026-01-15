import { useEffect, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { animated } from "@react-spring/web";
import { Modal } from "@/components/common/Modal";
import { useCreateRoom, useRoomData } from "@/hooks/useRoomData";
import { RoomShareButtons } from "./RoomShareButtons";
import type { GameDefinition } from "@/lib/arcade/game-sdk/types";

export interface CreateRoomModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Optional callback when room is successfully created
   */
  onSuccess?: () => void;
}

type ModalState = "creating" | "created";

/**
 * Modal for creating a new multiplayer room
 */
export function CreateRoomModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateRoomModalProps) {
  const { mutateAsync: createRoom, isPending } = useCreateRoom();
  const { getRoomShareUrl } = useRoomData();
  const [availableGames, setAvailableGames] = useState<
    GameDefinition<any, any, any>[]
  >([]);
  const [error, setError] = useState("");

  // Lazy load game registry only when modal opens
  useEffect(() => {
    if (isOpen && availableGames.length === 0) {
      import("@/lib/arcade/game-registry").then(({ getAvailableGames }) => {
        setAvailableGames(getAvailableGames());
      });
    }
  }, [isOpen, availableGames.length]);
  const [gameName, setGameName] = useState<string>("__choose_later__"); // Special value = user will choose later
  const [accessMode, setAccessMode] = useState<
    "open" | "password" | "approval-only" | "restricted"
  >("open");
  const [password, setPassword] = useState("");
  const [modalState, setModalState] = useState<ModalState>("creating");
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);

  const handleClose = () => {
    setError("");
    setGameName("__choose_later__");
    setAccessMode("open");
    setPassword("");
    setModalState("creating");
    setCreatedRoomCode(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get("name") as string;

    // Treat empty name as null
    const name = nameValue?.trim() || null;

    // Validate password for password-protected rooms
    if (accessMode === "password" && !password) {
      setError("Password is required for password-protected rooms");
      return;
    }

    try {
      // Create the room (creator is auto-added as first member)
      // If no game selected (choose later), use first available game as default
      const selectedGame =
        gameName === "__choose_later__"
          ? availableGames[0]?.manifest.name || "matching"
          : gameName;

      const result = await createRoom({
        name,
        gameName: selectedGame,
        creatorName: "Player",
        gameConfig: { difficulty: 6 },
        accessMode,
        password: accessMode === "password" ? password : undefined,
      });

      // Success! Transition to success view
      setCreatedRoomCode(result.room.code);
      setModalState("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  const handleStartPlaying = () => {
    handleClose();
    onSuccess?.();
  };

  const shareUrl = createdRoomCode ? getRoomShareUrl(createdRoomCode) : "";

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        style={{
          border: "2px solid rgba(34, 197, 94, 0.3)",
          borderRadius: "16px",
          padding: "24px",
          transition: "all 0.3s ease",
        }}
      >
        {modalState === "creating" ? (
          <>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "8px",
                color: "rgba(134, 239, 172, 1)",
              }}
            >
              Create New Room
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "rgba(209, 213, 219, 0.8)",
                marginBottom: "24px",
              }}
            >
              You'll leave the current room and create a new one
            </p>

            <form onSubmit={handleSubmit}>
              {/* Room Name */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                    color: "rgba(209, 213, 219, 1)",
                    fontSize: "13px",
                  }}
                >
                  Room Name{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "rgba(156, 163, 175, 1)",
                      fontSize: "12px",
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder="e.g., Friday Night Games (defaults to: 🎮 CODE)"
                  disabled={isPending}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "2px solid rgba(75, 85, 99, 0.5)",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(209, 213, 219, 1)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(34, 197, 94, 0.6)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(75, 85, 99, 0.5)";
                  }}
                />
              </div>

              {/* Game Selection */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                    color: "rgba(209, 213, 219, 1)",
                    fontSize: "13px",
                  }}
                >
                  🎮 Choose Your Game{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "rgba(156, 163, 175, 1)",
                      fontSize: "12px",
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <Select.Root
                  value={gameName}
                  onValueChange={setGameName}
                  disabled={isPending}
                >
                  <Select.Trigger
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "2px solid rgba(75, 85, 99, 0.5)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: gameName
                        ? "rgba(209, 213, 219, 1)"
                        : "rgba(156, 163, 175, 1)",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: isPending ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s ease",
                      outline: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isPending) {
                        e.currentTarget.style.background =
                          "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.borderColor =
                          "rgba(34, 197, 94, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.borderColor =
                        "rgba(75, 85, 99, 0.5)";
                    }}
                  >
                    <Select.Value placeholder="Select a game..." />
                    <Select.Icon>
                      <span style={{ fontSize: "12px" }}>▼</span>
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content
                      position="popper"
                      side="bottom"
                      align="start"
                      sideOffset={5}
                      collisionPadding={30}
                      avoidCollisions={true}
                      style={{
                        background:
                          "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
                        borderRadius: "12px",
                        border: "2px solid rgba(34, 197, 94, 0.3)",
                        padding: "6px",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
                        zIndex: 1000,
                        minWidth: "300px",
                        maxWidth: "min(400px, 90vw)",
                        maxHeight: "min(300px, 50vh)",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Select.ScrollUpButton asChild>
                        <animated.div
                          style={{
                            position: "absolute",
                            top: "6px",
                            left: "6px",
                            right: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "30px",
                            background:
                              "linear-gradient(180deg, rgba(31, 41, 55, 0.98) 0%, rgba(31, 41, 55, 0.7) 70%, transparent 100%)",
                            cursor: "default",
                            color: "rgba(34, 197, 94, 1)",
                            fontSize: "14px",
                            transition: "opacity 0.2s ease",
                            zIndex: 10,
                            pointerEvents: "auto",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                        >
                          ▲
                        </animated.div>
                      </Select.ScrollUpButton>
                      <Select.Viewport
                        style={{
                          maxHeight: "inherit",
                          scrollBehavior: "smooth",
                          overflowY: "auto",
                        }}
                      >
                        <Select.Item
                          value="__choose_later__"
                          style={{
                            padding: "12px 14px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            outline: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            transition: "all 0.15s ease",
                            background:
                              gameName === "__choose_later__"
                                ? "rgba(34, 197, 94, 0.15)"
                                : "transparent",
                            color: "rgba(209, 213, 219, 0.9)",
                            fontSize: "14px",
                            marginBottom: "4px",
                          }}
                          onMouseEnter={(e) => {
                            if (gameName !== "__choose_later__") {
                              e.currentTarget.style.background =
                                "rgba(255, 255, 255, 0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (gameName !== "__choose_later__") {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          <Select.ItemText>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              <span style={{ fontSize: "20px" }}>✨</span>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    fontSize: "14px",
                                  }}
                                >
                                  Choose later
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    opacity: 0.7,
                                    color: "rgba(156, 163, 175, 1)",
                                  }}
                                >
                                  Pick on the game selection page
                                </div>
                              </div>
                            </div>
                          </Select.ItemText>
                        </Select.Item>

                        <div
                          style={{
                            height: "1px",
                            background: "rgba(75, 85, 99, 0.5)",
                            margin: "6px 0",
                          }}
                        />

                        {availableGames.map((game) => {
                          const gameId = game.manifest.name;
                          // Map game gradients to colors
                          const gradientColors: Record<string, string> = {
                            pink: "rgba(236, 72, 153, 0.2)",
                            purple: "rgba(168, 85, 247, 0.2)",
                            blue: "rgba(59, 130, 246, 0.2)",
                            green: "rgba(34, 197, 94, 0.2)",
                            orange: "rgba(249, 115, 22, 0.2)",
                            red: "rgba(239, 68, 68, 0.2)",
                          };
                          const bgColor =
                            gradientColors[game.manifest.gradient || "blue"] ||
                            gradientColors.blue;

                          return (
                            <Select.Item
                              key={gameId}
                              value={gameId}
                              style={{
                                padding: "12px 14px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                outline: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                transition: "all 0.15s ease",
                                background:
                                  gameName === gameId ? bgColor : "transparent",
                                marginBottom: "4px",
                              }}
                              onMouseEnter={(e) => {
                                if (gameName !== gameId) {
                                  e.currentTarget.style.background =
                                    "rgba(255, 255, 255, 0.05)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (gameName !== gameId) {
                                  e.currentTarget.style.background =
                                    "transparent";
                                }
                              }}
                            >
                              <Select.ItemText>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                  }}
                                >
                                  <span style={{ fontSize: "28px" }}>
                                    {game.manifest.icon}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: "15px",
                                        color: "rgba(209, 213, 219, 1)",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      {game.manifest.displayName}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: "rgba(156, 163, 175, 1)",
                                        lineHeight: "1.3",
                                      }}
                                    >
                                      {game.manifest.description}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        marginTop: "4px",
                                        display: "flex",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          background: "rgba(59, 130, 246, 0.2)",
                                          padding: "2px 8px",
                                          borderRadius: "4px",
                                          color: "rgba(147, 197, 253, 1)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {game.manifest.maxPlayers === 1
                                          ? "👤 Solo"
                                          : `👥 ${game.manifest.maxPlayers}p`}
                                      </span>
                                      <span
                                        style={{
                                          background: "rgba(168, 85, 247, 0.2)",
                                          padding: "2px 8px",
                                          borderRadius: "4px",
                                          color: "rgba(196, 181, 253, 1)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {game.manifest.difficulty}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Select.ItemText>
                            </Select.Item>
                          );
                        })}
                      </Select.Viewport>
                      <Select.ScrollDownButton asChild>
                        <animated.div
                          style={{
                            position: "absolute",
                            bottom: "6px",
                            left: "6px",
                            right: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "30px",
                            background:
                              "linear-gradient(0deg, rgba(31, 41, 55, 0.98) 0%, rgba(31, 41, 55, 0.7) 70%, transparent 100%)",
                            cursor: "default",
                            color: "rgba(34, 197, 94, 1)",
                            fontSize: "14px",
                            transition: "opacity 0.2s ease",
                            zIndex: 10,
                            pointerEvents: "auto",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                        >
                          ▼
                        </animated.div>
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              {/* Access Mode Selection */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 600,
                    color: "rgba(209, 213, 219, 1)",
                    fontSize: "13px",
                  }}
                >
                  Who Can Join
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  {[
                    {
                      value: "open",
                      emoji: "🌐",
                      label: "Open",
                      desc: "Anyone",
                    },
                    {
                      value: "password",
                      emoji: "🔑",
                      label: "Password",
                      desc: "With key",
                    },
                    {
                      value: "approval-only",
                      emoji: "✋",
                      label: "Approval",
                      desc: "Request",
                    },
                    {
                      value: "restricted",
                      emoji: "🚫",
                      label: "Restricted",
                      desc: "Invite only",
                    },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setAccessMode(mode.value as typeof accessMode);
                        if (mode.value !== "password") setPassword("");
                      }}
                      style={{
                        padding: "10px 12px",
                        background:
                          accessMode === mode.value
                            ? "rgba(34, 197, 94, 0.15)"
                            : "rgba(255, 255, 255, 0.05)",
                        border:
                          accessMode === mode.value
                            ? "2px solid rgba(34, 197, 94, 0.6)"
                            : "2px solid rgba(75, 85, 99, 0.5)",
                        borderRadius: "8px",
                        color:
                          accessMode === mode.value
                            ? "rgba(134, 239, 172, 1)"
                            : "rgba(209, 213, 219, 0.8)",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.5 : 1,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) => {
                        if (!isPending && accessMode !== mode.value) {
                          e.currentTarget.style.background =
                            "rgba(255, 255, 255, 0.08)";
                          e.currentTarget.style.borderColor =
                            "rgba(34, 197, 94, 0.4)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (accessMode !== mode.value) {
                          e.currentTarget.style.background =
                            "rgba(255, 255, 255, 0.05)";
                          e.currentTarget.style.borderColor =
                            "rgba(75, 85, 99, 0.5)";
                        }
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>{mode.emoji}</span>
                      <div
                        style={{
                          textAlign: "left",
                          flex: 1,
                          lineHeight: "1.2",
                        }}
                      >
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>
                          {mode.label}
                        </div>
                        <div style={{ fontSize: "11px", opacity: 0.7 }}>
                          {mode.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {accessMode === "password" && (
                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: 600,
                      color: "rgba(209, 213, 219, 1)",
                      fontSize: "14px",
                    }}
                  >
                    Room Password
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a password"
                    disabled={isPending}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "2px solid rgba(75, 85, 99, 0.5)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "rgba(209, 213, 219, 1)",
                      fontSize: "15px",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(34, 197, 94, 0.6)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(75, 85, 99, 0.5)";
                    }}
                  />
                </div>
              )}

              {error && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "rgba(248, 113, 113, 1)",
                    marginBottom: "16px",
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "rgba(75, 85, 99, 0.3)",
                    color: "rgba(209, 213, 219, 1)",
                    border: "2px solid rgba(75, 85, 99, 0.5)",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.background =
                        "rgba(75, 85, 99, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.background =
                        "rgba(75, 85, 99, 0.3)";
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: isPending
                      ? "rgba(75, 85, 99, 0.3)"
                      : "linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))",
                    color: "rgba(255, 255, 255, 1)",
                    border: isPending
                      ? "2px solid rgba(75, 85, 99, 0.5)"
                      : "2px solid rgba(34, 197, 94, 0.6)",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))";
                    }
                  }}
                >
                  {isPending ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Success View */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  lineHeight: 1,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                    color: "rgba(134, 239, 172, 1)",
                  }}
                >
                  Room Created!
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "rgba(209, 213, 219, 0.8)",
                  }}
                >
                  Ready to play
                </p>
              </div>

              {/* Share buttons */}
              {createdRoomCode && (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(156, 163, 175, 1)",
                      textAlign: "center",
                      marginBottom: "4px",
                    }}
                  >
                    Invite friends (optional)
                  </div>
                  <RoomShareButtons
                    joinCode={createdRoomCode}
                    shareUrl={shareUrl}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  width: "100%",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "rgba(75, 85, 99, 0.3)",
                    color: "rgba(209, 213, 219, 1)",
                    border: "2px solid rgba(75, 85, 99, 0.5)",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(75, 85, 99, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(75, 85, 99, 0.3)";
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleStartPlaying}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background:
                      "linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))",
                    color: "rgba(255, 255, 255, 1)",
                    border: "2px solid rgba(34, 197, 94, 0.6)",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))";
                  }}
                >
                  Start Playing
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
