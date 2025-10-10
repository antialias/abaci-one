import { useEffect, useRef, useState } from "react";
import { EmojiPicker } from "../../app/games/matching/components/EmojiPicker";
import { useGameMode } from "../../contexts/GameModeContext";

interface PlayerConfigDialogProps {
  playerId: string;
  onClose: () => void;
}

export function PlayerConfigDialog({
  playerId,
  onClose,
}: PlayerConfigDialogProps) {
  // All hooks must be called before early return
  const { getPlayer, updatePlayer, players } = useGameMode();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [localName, setLocalName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const player = getPlayer(playerId);

  // Initialize local name from player
  useEffect(() => {
    if (player) {
      setLocalName(player.name);
    }
  }, [player]);

  if (!player) {
    return null;
  }

  const handleNameChange = (newName: string) => {
    setLocalName(newName);

    // Debounce the update to avoid too many API calls
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSaving(true);
    debounceTimerRef.current = setTimeout(() => {
      updatePlayer(playerId, { name: newName });
      setIsSaving(false);
    }, 500); // Wait 500ms after user stops typing
  };

  const handleEmojiSelect = (emoji: string) => {
    updatePlayer(playerId, { emoji });
    setShowEmojiPicker(false);
  };

  // Get player number for UI theming (first 4 players get special colors)
  const allPlayers = Array.from(players.values()).sort((a, b) => {
    const aTime =
      typeof a.createdAt === "number"
        ? a.createdAt
        : a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : 0;
    const bTime =
      typeof b.createdAt === "number"
        ? b.createdAt
        : b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : 0;
    return aTime - bTime;
  });
  const playerIndex = allPlayers.findIndex((p) => p.id === playerId);
  const displayNumber = playerIndex + 1;

  // Color based on player's actual color
  const gradientColor = player.color;

  if (showEmojiPicker) {
    return (
      <EmojiPicker
        currentEmoji={player.emoji}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setShowEmojiPicker(false)}
        playerNumber={displayNumber}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "20px",
          padding: "32px",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                background: `linear-gradient(135deg, ${gradientColor}, ${gradientColor}dd)`,
                backgroundClip: "text",
                color: "transparent",
                margin: 0,
                marginBottom: "4px",
              }}
            >
              Player Settings
            </h2>
            <div
              style={{
                fontSize: "12px",
                color: isSaving ? "#f59e0b" : "#10b981",
                fontWeight: "500",
                opacity: 0.8,
              }}
            >
              {isSaving ? "💾 Saving..." : "✓ Changes saved automatically"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#6b7280",
              padding: "4px",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1f2937")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            ✕
          </button>
        </div>

        {/* Emoji Selection */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Character
          </label>
          <button
            onClick={() => setShowEmojiPicker(true)}
            style={{
              width: "100%",
              padding: "16px",
              background: "linear-gradient(135deg, #f9fafb, #f3f4f6)",
              border: "2px solid #e5e7eb",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = gradientColor;
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontSize: "48px",
                lineHeight: 1,
              }}
            >
              {player.emoji}
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "4px",
                }}
              >
                Click to change character
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Choose from hundreds of emojis
              </div>
            </div>
            <div
              style={{
                fontSize: "20px",
                color: "#9ca3af",
              }}
            >
              →
            </div>
          </button>
        </div>

        {/* Name Input */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Name
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Player Name"
            maxLength={20}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "16px",
              border: "2px solid #e5e7eb",
              borderRadius: "12px",
              outline: "none",
              transition: "all 0.2s ease",
              fontWeight: "500",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = gradientColor;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${gradientColor}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "4px",
              textAlign: "right",
            }}
          >
            {localName.length}/20 characters
          </div>
        </div>
      </div>
    </div>
  );
}
