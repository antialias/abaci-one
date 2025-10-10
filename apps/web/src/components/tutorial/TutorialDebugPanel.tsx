import { css } from "../../../styled-system/css";
import { stack } from "../../../styled-system/patterns";
import type { TutorialEvent } from "../../types/tutorial";

interface TutorialDebugPanelProps {
  currentStepIndex: number;
  totalSteps: number;
  currentValue: number;
  targetValue: number;
  isStepCompleted: boolean;
  stepStartTime: number;
  events: TutorialEvent[];
}

export function TutorialDebugPanel({
  currentStepIndex,
  totalSteps,
  currentValue,
  targetValue,
  isStepCompleted,
  stepStartTime,
  events,
}: TutorialDebugPanelProps) {
  return (
    <div
      className={css({
        w: "400px",
        borderLeft: "1px solid",
        borderColor: "gray.200",
        bg: "gray.50",
        p: 4,
      })}
    >
      <div className={stack({ gap: 4 })}>
        <div>
          <h3>Step Debug Info</h3>
          <div
            className={css({
              fontSize: "sm",
              fontFamily: "mono",
              bg: "white",
              p: 2,
              borderRadius: "md",
            })}
          >
            <div>
              Step: {currentStepIndex + 1}/{totalSteps}
            </div>
            <div>Value: {currentValue}</div>
            <div>Target: {targetValue}</div>
            <div>Completed: {isStepCompleted ? "Yes" : "No"}</div>
            <div>Time: {Math.round((Date.now() - stepStartTime) / 1000)}s</div>
          </div>
        </div>

        <div>
          <h3>Event Log</h3>
          <div
            className={css({
              bg: "white",
              borderRadius: "md",
              maxH: "200px",
              overflowY: "auto",
            })}
          >
            {events.slice(-10).map((event, index) => (
              <div
                key={index}
                className={css({
                  p: 2,
                  borderBottom: "1px solid",
                  borderColor: "gray.100",
                })}
              >
                <div className={css({ fontWeight: "bold", color: "blue.600" })}>
                  {event.type}
                </div>
                <div className={css({ color: "gray.600" })}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
                {event.type === "VALUE_CHANGED" && (
                  <div>
                    {event.oldValue} → {event.newValue}
                  </div>
                )}
                {event.type === "ERROR_OCCURRED" && (
                  <div className={css({ color: "red.600" })}>{event.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
