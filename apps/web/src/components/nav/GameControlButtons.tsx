import type React from "react";

interface GameControlButtonsProps {
  onSetup?: () => void;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export function GameControlButtons({
  onSetup,
  onNewGame,
  onQuit,
}: GameControlButtonsProps) {
  const buttonBaseStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #3498db, #2980b9)",
    border: "none",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "bold",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background =
      "linear-gradient(135deg, #2980b9, #1c6ca1)";
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.15)";
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background =
      "linear-gradient(135deg, #3498db, #2980b9)";
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "nowrap",
      }}
    >
      {onSetup && (
        <button
          onClick={onSetup}
          style={buttonBaseStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label="Setup game"
        >
          <span>⚙️</span>
          <span style={{ whiteSpace: "nowrap" }}>Setup</span>
        </button>
      )}

      {onNewGame && (
        <button
          onClick={onNewGame}
          style={buttonBaseStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label="Start new game"
        >
          <span>🎮</span>
          <span style={{ whiteSpace: "nowrap" }}>New Game</span>
        </button>
      )}

      {onQuit && (
        <button
          onClick={onQuit}
          style={buttonBaseStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label="Quit to arcade"
        >
          <span>🏟️</span>
          <span style={{ whiteSpace: "nowrap" }}>Quit</span>
        </button>
      )}
    </div>
  );
}
