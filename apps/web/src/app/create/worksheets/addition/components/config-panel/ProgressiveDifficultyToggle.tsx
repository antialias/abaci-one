import * as Switch from "@radix-ui/react-switch";
import { css } from "../../../../../../../styled-system/css";

export interface ProgressiveDifficultyToggleProps {
  interpolate: boolean | undefined;
  onChange: (interpolate: boolean) => void;
  isDark?: boolean;
}

export function ProgressiveDifficultyToggle({
  interpolate,
  onChange,
  isDark = false,
}: ProgressiveDifficultyToggleProps) {
  return (
    <div
      data-section="progressive-difficulty"
      className={css({
        bg: isDark ? "gray.700" : "gray.50",
        border: "1px solid",
        borderColor: isDark ? "gray.600" : "gray.200",
        rounded: "xl",
        p: "3",
      })}
    >
      <div
        className={css({
          display: "flex",
          gap: "3",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <label
          htmlFor="progressive-toggle"
          className={css({
            fontSize: "sm",
            fontWeight: "medium",
            color: isDark ? "gray.200" : "gray.700",
            cursor: "pointer",
          })}
        >
          Progressive difficulty
        </label>
        <Switch.Root
          id="progressive-toggle"
          checked={interpolate ?? true}
          onCheckedChange={(checked) => onChange(checked)}
          className={css({
            width: "11",
            height: "6",
            bg: isDark ? "gray.600" : "gray.300",
            rounded: "full",
            position: "relative",
            cursor: "pointer",
            '&[data-state="checked"]': {
              bg: "brand.500",
            },
          })}
        >
          <Switch.Thumb
            className={css({
              display: "block",
              width: "5",
              height: "5",
              bg: "white",
              rounded: "full",
              transition: "transform 0.1s",
              transform: "translateX(1px)",
              willChange: "transform",
              '&[data-state="checked"]': {
                transform: "translateX(23px)",
              },
            })}
          />
        </Switch.Root>
      </div>
      <div
        className={css({
          fontSize: "xs",
          color: isDark ? "gray.400" : "gray.500",
          mt: "1",
        })}
      >
        Start easier and gradually build up throughout the worksheet
      </div>
    </div>
  );
}
