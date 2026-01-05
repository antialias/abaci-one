"use client";

interface DecompositionData {
  before: string;
  highlighted: string;
  after: string;
}

interface PedagogicalDecompositionDisplayProps {
  variant: "tooltip" | "guidance";
  showLabel?: boolean;
  decomposition: DecompositionData | null;
}

export function PedagogicalDecompositionDisplay({
  variant = "guidance",
  showLabel = false,
  decomposition,
}: PedagogicalDecompositionDisplayProps) {
  if (
    !decomposition ||
    (!decomposition.before &&
      !decomposition.highlighted &&
      !decomposition.after)
  ) {
    return null;
  }

  if (variant === "tooltip") {
    return (
      <>
        {showLabel && (
          <div
            style={{
              fontSize: "10px",
              opacity: 0.7,
              marginBottom: "2px",
              textAlign: "center",
            }}
          >
            Working on:
          </div>
        )}
        <div
          style={{
            fontSize: "10px",
            marginBottom: "6px",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span style={{ opacity: 0.4, color: "white" }}>
            {decomposition.before}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#fbbf24",
              backgroundColor: "rgba(251, 191, 36, 0.2)",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid rgba(251, 191, 36, 0.4)",
            }}
          >
            {decomposition.highlighted}
          </span>
          <span style={{ opacity: 0.4, color: "white" }}>
            {decomposition.after}
          </span>
        </div>
      </>
    );
  }

  // Guidance variant (existing styles)
  return (
    <span>
      {decomposition.before}
      <span
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(147,51,234,0.1) 100%)",
          color: "#1e3a8a",
          padding: "4px 8px",
          borderRadius: "6px",
          border: "1px solid rgba(59,130,246,0.3)",
          fontWeight: 600,
          boxShadow:
            "0 1px 3px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.6)",
          backdropFilter: "blur(2px)",
          display: "inline-block",
        }}
      >
        {decomposition.highlighted}
      </span>
      {decomposition.after}
    </span>
  );
}
