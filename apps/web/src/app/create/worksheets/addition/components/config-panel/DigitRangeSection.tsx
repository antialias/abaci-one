import * as Slider from "@radix-ui/react-slider";
import { css } from "../../../../../../../styled-system/css";

export interface DigitRangeSectionProps {
  digitRange: { min: number; max: number } | undefined;
  onChange: (digitRange: { min: number; max: number }) => void;
  isDark?: boolean;
}

export function DigitRangeSection({
  digitRange,
  onChange,
  isDark = false,
}: DigitRangeSectionProps) {
  const min = digitRange?.min ?? 2;
  const max = digitRange?.max ?? 2;

  return (
    <div
      data-section="digit-range"
      className={css({
        bg: isDark ? "gray.700" : "gray.50",
        border: "1px solid",
        borderColor: isDark ? "gray.600" : "gray.200",
        rounded: "xl",
        p: "4",
      })}
    >
      <div className={css({ mb: "3" })}>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <label
            className={css({
              fontSize: "sm",
              fontWeight: "semibold",
              color: isDark ? "gray.200" : "gray.700",
            })}
          >
            Problem Size (Digits per Number)
          </label>
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "bold",
              color: "brand.600",
            })}
          >
            {min === max ? `${min}` : `${min}-${max}`}
          </span>
        </div>
        <p
          className={css({
            fontSize: "xs",
            color: isDark ? "gray.400" : "gray.500",
            mt: "1",
          })}
        >
          {min === max
            ? `All problems: exactly ${min} digit${min > 1 ? "s" : ""}`
            : `Mixed problem sizes from ${min} to ${max} digits`}
        </p>
      </div>

      {/* Range Slider with Tick Marks */}
      <div className={css({ position: "relative", px: "3", py: "4" })}>
        {/* Tick marks */}
        <div
          className={css({
            position: "absolute",
            width: "full",
            top: "0",
            left: "0",
            px: "3",
            display: "flex",
            justifyContent: "space-between",
          })}
        >
          {[1, 2, 3, 4, 5].map((digit) => (
            <div
              key={`tick-${digit}`}
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "0",
              })}
            >
              <div
                className={css({
                  fontSize: "2xs",
                  fontWeight: "medium",
                  color: "gray.600",
                  mb: "1",
                })}
              >
                {digit}
              </div>
              <div
                className={css({
                  width: "1px",
                  height: "2",
                  bg: "gray.300",
                })}
              />
            </div>
          ))}
        </div>

        {/* Double-thumbed range slider */}
        <Slider.Root
          className={css({
            position: "relative",
            display: "flex",
            alignItems: "center",
            userSelect: "none",
            touchAction: "none",
            width: "full",
            height: "6",
            mt: "8",
          })}
          value={[min, max]}
          onValueChange={(values) => {
            onChange({
              min: values[0],
              max: values[1],
            });
          }}
          min={1}
          max={5}
          step={1}
          minStepsBetweenThumbs={0}
        >
          <Slider.Track
            className={css({
              position: "relative",
              flexGrow: 1,
              bg: "gray.200",
              rounded: "full",
              height: "2",
            })}
          >
            <Slider.Range
              className={css({
                position: "absolute",
                bg: "brand.500",
                rounded: "full",
                height: "full",
              })}
            />
          </Slider.Track>
          <Slider.Thumb
            className={css({
              display: "block",
              width: "4",
              height: "4",
              bg: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              rounded: "full",
              border: "2px solid",
              borderColor: "brand.500",
              cursor: "grab",
              transition: "transform 0.15s",
              _hover: { transform: "scale(1.15)" },
              _focus: {
                outline: "none",
                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.3)",
              },
              _active: { cursor: "grabbing" },
            })}
          />
          <Slider.Thumb
            className={css({
              display: "block",
              width: "4",
              height: "4",
              bg: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              rounded: "full",
              border: "2px solid",
              borderColor: "brand.600",
              cursor: "grab",
              transition: "transform 0.15s",
              _hover: { transform: "scale(1.15)" },
              _focus: {
                outline: "none",
                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.3)",
              },
              _active: { cursor: "grabbing" },
            })}
          />
        </Slider.Root>
      </div>
    </div>
  );
}
