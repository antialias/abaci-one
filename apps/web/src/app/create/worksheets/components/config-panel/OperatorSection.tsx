import { css } from "@styled/css";
import { OperatorIcon } from "./OperatorIcon";

export interface OperatorSectionProps {
  operator: "addition" | "subtraction" | "mixed" | undefined;
  onChange: (operator: "addition" | "subtraction" | "mixed") => void;
  isDark?: boolean;
}

export function OperatorSection({
  operator,
  onChange,
  isDark = false,
}: OperatorSectionProps) {
  // Derive checkbox states from operator value
  const additionChecked =
    operator === "addition" || operator === "mixed" || !operator;
  const subtractionChecked = operator === "subtraction" || operator === "mixed";

  const handleAdditionChange = (checked: boolean) => {
    if (!checked && !subtractionChecked) {
      // Can't uncheck if it's the only one checked
      return;
    }
    if (checked && subtractionChecked) {
      onChange("mixed");
    } else if (checked) {
      onChange("addition");
    } else {
      onChange("subtraction");
    }
  };

  const handleSubtractionChange = (checked: boolean) => {
    if (!checked && !additionChecked) {
      // Can't uncheck if it's the only one checked
      return;
    }
    if (checked && additionChecked) {
      onChange("mixed");
    } else if (checked) {
      onChange("subtraction");
    } else {
      onChange("addition");
    }
  };

  return (
    <div data-section="operator-selection">
      <label
        className={css({
          fontSize: "sm",
          fontWeight: "semibold",
          color: isDark ? "gray.200" : "gray.700",
          mb: "3",
          display: "block",
        })}
      >
        Operation Types
      </label>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "2.5",
          mb: "3",
        })}
      >
        {/* Addition Checkbox */}
        <label
          data-action="toggle-addition"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "3",
            cursor: "pointer",
            px: "3",
            py: "2.5",
            rounded: "lg",
            border: "2px solid",
            transition: "all 0.2s",
            bg: additionChecked
              ? isDark
                ? "brand.900"
                : "brand.50"
              : isDark
                ? "gray.700"
                : "white",
            borderColor: additionChecked
              ? "brand.500"
              : isDark
                ? "gray.600"
                : "gray.300",
            _hover: {
              borderColor: "brand.400",
            },
          })}
        >
          <input
            type="checkbox"
            checked={additionChecked}
            onChange={(e) => handleAdditionChange(e.target.checked)}
            className={css({
              width: "5",
              height: "5",
              cursor: "pointer",
              accentColor: "brand.600",
              flexShrink: 0,
            })}
          />
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
              flex: 1,
              minWidth: 0,
            })}
          >
            <OperatorIcon operator="addition" isDark={isDark} />
            <span
              className={css({
                fontSize: "sm",
                fontWeight: "semibold",
                color: isDark ? "gray.200" : "gray.700",
                "@media (max-width: 200px)": {
                  fontSize: "xs",
                },
              })}
            >
              Addition
            </span>
          </div>
        </label>

        {/* Subtraction Checkbox */}
        <label
          data-action="toggle-subtraction"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "3",
            cursor: "pointer",
            px: "3",
            py: "2.5",
            rounded: "lg",
            border: "2px solid",
            transition: "all 0.2s",
            bg: subtractionChecked
              ? isDark
                ? "brand.900"
                : "brand.50"
              : isDark
                ? "gray.700"
                : "white",
            borderColor: subtractionChecked
              ? "brand.500"
              : isDark
                ? "gray.600"
                : "gray.300",
            _hover: {
              borderColor: "brand.400",
            },
          })}
        >
          <input
            type="checkbox"
            checked={subtractionChecked}
            onChange={(e) => handleSubtractionChange(e.target.checked)}
            className={css({
              width: "5",
              height: "5",
              cursor: "pointer",
              accentColor: "brand.600",
              flexShrink: 0,
            })}
          />
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
              flex: 1,
              minWidth: 0,
            })}
          >
            <OperatorIcon operator="subtraction" isDark={isDark} />
            <span
              className={css({
                fontSize: "sm",
                fontWeight: "semibold",
                color: isDark ? "gray.200" : "gray.700",
                "@media (max-width: 200px)": {
                  fontSize: "xs",
                },
              })}
            >
              Subtraction
            </span>
          </div>
        </label>
      </div>

      <p
        className={css({
          fontSize: "sm",
          color: isDark ? "gray.400" : "gray.600",
          lineHeight: "1.5",
        })}
      >
        {additionChecked && subtractionChecked
          ? "Problems will randomly use addition or subtraction"
          : subtractionChecked
            ? "All problems will be subtraction"
            : "All problems will be addition"}
      </p>
    </div>
  );
}
