"use client";

import { useMemo } from "react";
import { css } from "../../../../styled-system/css";
import { useYjsDemo } from "../Provider";
import { useViewerId } from "@/hooks/useViewerId";

export function PlayingPhase() {
  const { state, yjsState, addCell, endGame } = useYjsDemo();
  const { data: viewerId } = useViewerId();
  const { gridSize } = state;

  // Convert Yjs array to regular array for rendering
  const cells = useMemo(() => {
    if (!yjsState.cells) return [];
    return yjsState.cells.toArray();
  }, [yjsState.cells]);

  // Create a map of occupied cells
  const occupiedCells = useMemo(() => {
    const map = new Map<string, { color: string; playerId: string }>();
    for (const cell of cells) {
      const key = `${cell.x}-${cell.y}`;
      map.set(key, { color: cell.color, playerId: cell.playerId });
    }
    return map;
  }, [cells]);

  // Calculate scores
  const scores = useMemo(() => {
    const scoreMap: Record<string, number> = {};
    for (const cell of cells) {
      scoreMap[cell.playerId] = (scoreMap[cell.playerId] || 0) + 1;
    }
    return scoreMap;
  }, [cells]);

  const handleCellClick = (x: number, y: number) => {
    const key = `${x}-${y}`;
    if (occupiedCells.has(key)) return; // Already occupied
    addCell(x, y);
  };

  return (
    <div className={containerStyle}>
      <div className={headerStyle}>
        <div className={titleStyle}>Click cells to claim them!</div>
        <div className={statsStyle}>
          Total cells claimed: {cells.length} / {gridSize * gridSize}
        </div>
      </div>

      <div
        className={gridStyle}
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, index) => {
          const x = Math.floor(index / gridSize);
          const y = index % gridSize;
          const key = `${x}-${y}`;
          const cellData = occupiedCells.get(key);
          const isOwn = cellData?.playerId === viewerId;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleCellClick(x, y)}
              disabled={!!cellData}
              className={cellStyle}
              style={{
                backgroundColor: cellData ? cellData.color : "#f0f0f0",
                cursor: cellData ? "default" : "pointer",
                border: isOwn ? "3px solid #333" : "1px solid #ccc",
              }}
              title={
                cellData ? `Claimed by ${cellData.playerId}` : "Click to claim"
              }
            />
          );
        })}
      </div>

      <div className={scoresContainerStyle}>
        <div className={scoresTitleStyle}>Current Scores:</div>
        <div className={scoresListStyle}>
          {Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([playerId, score]) => (
              <div key={playerId} className={scoreItemStyle}>
                <span className={scorePlayerStyle}>
                  {playerId === viewerId ? "You" : playerId.slice(0, 8)}
                </span>
                <span className={scoreValueStyle}>{score} cells</span>
              </div>
            ))}
        </div>
      </div>

      <button type="button" onClick={endGame} className={endButtonStyle}>
        End Game
      </button>
    </div>
  );
}

const containerStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: { base: "12px", md: "24px" },
  gap: "20px",
  minHeight: "70vh",
});

const headerStyle = css({
  textAlign: "center",
});

const titleStyle = css({
  fontSize: { base: "20px", md: "24px" },
  fontWeight: "bold",
  color: "blue.600",
  marginBottom: "8px",
});

const statsStyle = css({
  fontSize: { base: "14px", md: "16px" },
  color: "gray.600",
});

const gridStyle = css({
  display: "grid",
  gap: "4px",
  padding: "12px",
  backgroundColor: "gray.100",
  borderRadius: "8px",
  maxWidth: { base: "320px", sm: "400px", md: "500px" },
  width: "100%",
  aspectRatio: "1",
});

const cellStyle = css({
  border: "1px solid",
  borderColor: "gray.300",
  borderRadius: "4px",
  transition: "all 0.2s",
  "&:not(:disabled):hover": {
    transform: "scale(1.1)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  "&:disabled": {
    cursor: "default",
  },
});

const scoresContainerStyle = css({
  backgroundColor: "white",
  borderRadius: "8px",
  padding: "16px",
  border: "1px solid",
  borderColor: "gray.200",
  minWidth: "250px",
});

const scoresTitleStyle = css({
  fontSize: "16px",
  fontWeight: "bold",
  color: "gray.700",
  marginBottom: "12px",
});

const scoresListStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const scoreItemStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px",
  backgroundColor: "gray.50",
  borderRadius: "4px",
});

const scorePlayerStyle = css({
  fontSize: "14px",
  fontWeight: 500,
  color: "gray.700",
});

const scoreValueStyle = css({
  fontSize: "14px",
  fontWeight: "bold",
  color: "blue.600",
});

const endButtonStyle = css({
  padding: "12px 24px",
  fontSize: "16px",
  fontWeight: "bold",
  backgroundColor: "red.500",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    backgroundColor: "red.600",
    transform: "scale(1.05)",
  },
});
