import { css } from "../../../../../styled-system/css";

export interface StartButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function StartButton({ onClick, disabled }: StartButtonProps) {
  return (
    <button
      type="button"
      data-action="start-game"
      onClick={onClick}
      disabled={disabled}
      className={css({
        width: "100%",
        py: "2vh",
        bg: disabled
          ? "rgba(100, 100, 100, 0.5)"
          : "linear-gradient(135deg, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)",
        color: disabled ? "rgba(200, 200, 200, 0.7)" : "#7c2d12",
        borderRadius: "1.5vh",
        fontSize: "2.5vh",
        fontWeight: "bold",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        boxShadow: disabled
          ? "0 0.5vh 1.5vh rgba(0,0,0,0.2)"
          : "0 1vh 3vh rgba(251, 191, 36, 0.6), inset 0 -0.3vh 0.5vh rgba(124, 45, 18, 0.3)",
        border: "0.3vh solid",
        borderColor: disabled
          ? "rgba(100, 100, 100, 0.3)"
          : "rgba(245, 158, 11, 0.8)",
        textTransform: "uppercase",
        letterSpacing: "0.3vh",
        textShadow: disabled
          ? "none"
          : "0.1vh 0.1vh 0.3vh rgba(124, 45, 18, 0.5), 0 0 1vh rgba(255, 255, 255, 0.3)",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        _hover: disabled
          ? undefined
          : {
              transform: "translateY(-0.5vh) scale(1.02)",
              boxShadow:
                "0 1.5vh 4vh rgba(251, 191, 36, 0.8), inset 0 -0.3vh 0.5vh rgba(124, 45, 18, 0.4)",
              borderColor: "rgba(251, 191, 36, 1)",
            },
        _active: disabled
          ? undefined
          : {
              transform: "translateY(-0.2vh) scale(0.98)",
            },
        _before: disabled
          ? undefined
          : {
              content: '""',
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)",
              animation: "shimmer 3s infinite",
            },
      })}
    >
      ⚔️ BEGIN BATTLE ⚔️
    </button>
  );
}
