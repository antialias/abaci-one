import React from "react";
import { JoinRoomInput } from "./JoinRoomInput";
import { RecentRoomsList } from "./RecentRoomsList";

interface PlayOnlineTabProps {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

export function PlayOnlineTab({
  onCreateRoom,
  onJoinRoom,
}: PlayOnlineTabProps) {
  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      await onCreateRoom();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Quick Create Section */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          🆕 Start Playing
        </div>
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={isCreating}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: isCreating
              ? "#d1d5db"
              : "linear-gradient(135deg, #10b981, #059669)",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            cursor: isCreating ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            if (!isCreating) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 8px rgba(16, 185, 129, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
          }}
        >
          {isCreating ? "⏳ Creating..." : "🚀 Create New Room"}
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
        }}
      />

      {/* Join Room Section */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          🚪 Join Room
        </div>
        <JoinRoomInput onJoin={onJoinRoom} />
      </div>

      {/* Recent Rooms Section */}
      <RecentRoomsList onSelectRoom={onJoinRoom} />
    </div>
  );
}
