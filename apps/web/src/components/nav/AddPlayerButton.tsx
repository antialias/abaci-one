import React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastContext";
import { InvitePlayersTab } from "./InvitePlayersTab";
import { PlayOnlineTab } from "./PlayOnlineTab";
import { addToRecentRooms } from "./RecentRoomsList";
import {
  useCreateRoom,
  useGetRoomByCode,
  useJoinRoom,
} from "@/hooks/useRoomData";

interface Player {
  id: string;
  name: string;
  emoji: string;
}

export type TabType = "add" | "invite";

interface AddPlayerButtonProps {
  inactivePlayers: Player[];
  shouldEmphasize: boolean;
  onAddPlayer: (playerId: string) => void;
  // Lifted state from PageWithNav
  showPopover?: boolean;
  setShowPopover?: (show: boolean) => void;
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
  // Context-aware: show different content based on room state
  isInRoom?: boolean;
  // Game info for room creation
  gameName?: string | null;
}

export function AddPlayerButton({
  inactivePlayers,
  shouldEmphasize,
  onAddPlayer,
  showPopover: showPopoverProp,
  setShowPopover: setShowPopoverProp,
  activeTab: activeTabProp,
  setActiveTab: setActiveTabProp,
  isInRoom = false,
  gameName = null,
}: AddPlayerButtonProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showError } = useToast();

  // Use lifted state if provided, otherwise fallback to internal state
  const [internalShowPopover, setInternalShowPopover] = React.useState(false);
  const [internalActiveTab, setInternalActiveTab] =
    React.useState<TabType>("add");

  const showPopover = showPopoverProp ?? internalShowPopover;
  const setShowPopover = setShowPopoverProp ?? setInternalShowPopover;
  const activeTab = activeTabProp ?? internalActiveTab;
  const setActiveTab = setActiveTabProp ?? setInternalActiveTab;

  // Context-aware tab label
  const secondTabLabel = isInRoom ? "📨 Invite More" : "🌐 Play Online";
  const secondTabColor = isInRoom ? "#8b5cf6" : "#3b82f6";

  // Room creation and joining hooks
  const { mutate: createRoom } = useCreateRoom();
  const { mutate: joinRoom } = useJoinRoom();
  const { mutateAsync: getRoomByCode } = useGetRoomByCode();

  // Handler for creating a new room (without a game - game will be selected in room)
  const handleCreateRoom = () => {
    createRoom(
      {
        name: null, // Auto-generated from code
        gameName: null, // No game selected yet - will be chosen in room
        creatorName: "Player",
      },
      {
        onSuccess: (data) => {
          // Add to recent rooms
          addToRecentRooms({
            code: data.code,
            name: data.name,
            gameName: data.gameName,
          });
          // Close popover and navigate to room to choose game
          setShowPopover(false);
          router.push("/arcade");
        },
        onError: (error) => {
          console.error("Failed to create room:", error);
          showError("Failed to create room", error.message);
        },
      },
    );
  };

  // Handler for joining a room
  const handleJoinRoom = async (code: string) => {
    try {
      // First, get the room by code to get the roomId
      const room = await getRoomByCode(code);

      // Then join the room by ID
      joinRoom(
        { roomId: room.id, displayName: "Player" },
        {
          onSuccess: (data) => {
            // Add to recent rooms
            if (data.room) {
              addToRecentRooms({
                code: data.room.code,
                name: data.room.name,
                gameName: data.room.gameName,
              });
            }
            // Close popover and navigate to room
            setShowPopover(false);
            router.push("/arcade");
          },
        },
      );
    } catch (error) {
      console.error("Failed to join room:", error);
      // Error will be shown by JoinRoomInput validation
    }
  };

  // Close popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPopover, setShowPopover]);

  const handleAddPlayerClick = (playerId: string) => {
    onAddPlayer(playerId);
    setShowPopover(false);
  };

  if (!shouldEmphasize || inactivePlayers.length === 0) {
    return null;
  }

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        style={{
          fontSize: "36px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "3px solid #10b981",
          background: showPopover
            ? "linear-gradient(135deg, #10b981, #059669)"
            : "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1))",
          color: showPopover ? "white" : "#10b981",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.3s ease",
          padding: 0,
          lineHeight: 1,
          fontWeight: "bold",
          boxShadow: showPopover
            ? "0 6px 16px rgba(16, 185, 129, 0.5)"
            : "0 6px 12px rgba(0,0,0,0.3)",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!showPopover) {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #10b981, #059669)";
            e.currentTarget.style.color = "white";
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.boxShadow =
              "0 6px 16px rgba(16, 185, 129, 0.5)";
          }
        }}
        onMouseLeave={(e) => {
          if (!showPopover) {
            e.currentTarget.style.background =
              "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1))";
            e.currentTarget.style.color = "#10b981";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.3)";
          }
        }}
        title="Add player"
      >
        +
      </button>

      {/* Add Player / Invite Players Popover */}
      {showPopover && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            right: 0,
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
            border: "2px solid #e5e7eb",
            minWidth: "240px",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease",
            overflow: "hidden",
          }}
        >
          {/* Tab Headers */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("add")}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: activeTab === "add" ? "white" : "transparent",
                border: "none",
                borderBottom:
                  activeTab === "add"
                    ? "2px solid #10b981"
                    : "2px solid transparent",
                color: activeTab === "add" ? "#10b981" : "#6b7280",
                fontSize: "13px",
                fontWeight: activeTab === "add" ? "700" : "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginBottom: "-2px",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "add") {
                  e.currentTarget.style.color = "#374151";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "add") {
                  e.currentTarget.style.color = "#6b7280";
                }
              }}
            >
              Add Player
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("invite")}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: activeTab === "invite" ? "white" : "transparent",
                border: "none",
                borderBottom:
                  activeTab === "invite"
                    ? `2px solid ${secondTabColor}`
                    : "2px solid transparent",
                color: activeTab === "invite" ? secondTabColor : "#6b7280",
                fontSize: "13px",
                fontWeight: activeTab === "invite" ? "700" : "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginBottom: "-2px",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "invite") {
                  e.currentTarget.style.color = "#374151";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "invite") {
                  e.currentTarget.style.color = "#6b7280";
                }
              }}
            >
              {secondTabLabel}
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: "12px" }}>
            {activeTab === "add" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {inactivePlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleAddPlayerClick(player.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: "24px", lineHeight: 1 }}>
                      {player.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      {player.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === "invite" &&
              (isInRoom ? (
                <InvitePlayersTab />
              ) : (
                <PlayOnlineTab
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
