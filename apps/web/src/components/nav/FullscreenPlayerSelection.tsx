interface Player {
  id: string;
  name: string;
  emoji: string;
}

interface FullscreenPlayerSelectionProps {
  inactivePlayers: Player[];
  onSelectPlayer: (playerId: string) => void;
  onConfigurePlayer: (playerId: string) => void;
  isVisible: boolean;
}

export function FullscreenPlayerSelection({
  inactivePlayers,
  onSelectPlayer,
  onConfigurePlayer,
  isVisible,
}: FullscreenPlayerSelectionProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "32px",
        width: isVisible ? "100%" : "0",
        padding: isVisible ? "40px 20px" : "0",
        maxHeight: isVisible ? "800px" : "0",
        opacity: isVisible ? 1 : 0,
        overflow: "hidden",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "600px",
        }}
      >
        <h2
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: "white",
            marginBottom: "12px",
            textShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          👥 Select Your Champions
        </h2>
        <p
          style={{
            fontSize: "16px",
            color: "rgba(255, 255, 255, 0.9)",
            marginBottom: "8px",
          }}
        >
          Choose one or more players to begin
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          💡 Select 2+ players for multiplayer battles
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          maxWidth: "800px",
          width: "100%",
        }}
      >
        {inactivePlayers.map((player) => (
          <div
            key={player.id}
            style={{
              position: "relative",
            }}
          >
            <button
              onClick={() => onSelectPlayer(player.id)}
              style={{
                width: "100%",
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "translateY(-6px) scale(1.03)";
                e.currentTarget.style.boxShadow =
                  "0 15px 50px rgba(0, 0, 0, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 8px 30px rgba(0, 0, 0, 0.15)";
              }}
            >
              <div
                style={{
                  fontSize: "64px",
                  marginBottom: "12px",
                  lineHeight: 1,
                }}
              >
                {player.emoji}
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                {player.name}
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                + Select
              </div>
            </button>

            {/* Subtle gear icon for configuration */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfigurePlayer(player.id);
              }}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "2px solid #e5e7eb",
                background: "rgba(255, 255, 255, 0.95)",
                color: "#6b7280",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                padding: 0,
                lineHeight: 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.color = "#3b82f6";
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(59, 130, 246, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.color = "#6b7280";
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
              title={`Configure ${player.name}`}
            >
              ⚙️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
