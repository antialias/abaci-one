"use client";

import * as Select from "@radix-ui/react-select";
import { css } from "@styled/css";
import type { RuleMode } from "../../displayRules";

export interface RuleDropdownProps {
  label: string;
  description: string;
  value: RuleMode;
  onChange: (value: RuleMode) => void;
  isDark?: boolean;
}

const RULE_OPTIONS: Array<{
  value: RuleMode;
  label: string;
  description: string;
}> = [
  { value: "always", label: "Always", description: "Show for all problems" },
  { value: "never", label: "Never", description: "Hide for all problems" },
  {
    value: "whenRegrouping",
    label: "When Regrouping",
    description: "Show only when problem requires regrouping",
  },
  {
    value: "whenMultipleRegroups",
    label: "Multiple Regroups",
    description: "Show when 2+ place values regroup",
  },
  {
    value: "when3PlusDigits",
    label: "3+ Digits",
    description: "Show when problem has 3+ digits",
  },
];

export function RuleDropdown({
  label,
  description,
  value,
  onChange,
  isDark = false,
}: RuleDropdownProps) {
  const selectedOption = RULE_OPTIONS.find((opt) => opt.value === value);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5",
      })}
    >
      <div>
        <div
          className={css({
            fontSize: "xs",
            fontWeight: "semibold",
            color: isDark ? "gray.300" : "gray.700",
            mb: "0.5",
          })}
        >
          {label}
        </div>
        <div
          className={css({
            fontSize: "2xs",
            color: isDark ? "gray.400" : "gray.500",
            lineHeight: "1.3",
          })}
        >
          {description}
        </div>
      </div>

      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            w: "full",
            px: "2.5",
            py: "1.5",
            bg: isDark ? "gray.700" : "white",
            border: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            rounded: "md",
            fontSize: "xs",
            color: isDark ? "gray.200" : "gray.700",
            cursor: "pointer",
            _hover: {
              borderColor: isDark ? "gray.500" : "brand.400",
            },
            _focus: {
              outline: "none",
              borderColor: "brand.500",
              boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
            },
          })}
        >
          <Select.Value>{selectedOption?.label || "Select..."}</Select.Value>
          <Select.Icon
            className={css({
              ml: "2",
              color: isDark ? "gray.400" : "gray.500",
            })}
          >
            ▼
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={css({
              bg: isDark ? "gray.800" : "white",
              border: "1px solid",
              borderColor: isDark ? "gray.600" : "gray.200",
              rounded: "md",
              shadow: "lg",
              overflow: "hidden",
              zIndex: 1000,
            })}
            position="popper"
            sideOffset={5}
          >
            <Select.Viewport>
              {RULE_OPTIONS.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={css({
                    px: "3",
                    py: "2",
                    fontSize: "xs",
                    color: isDark ? "gray.200" : "gray.700",
                    cursor: "pointer",
                    outline: "none",
                    _hover: {
                      bg: isDark ? "gray.700" : "brand.50",
                    },
                    '&[data-state="checked"]': {
                      bg: isDark ? "gray.700" : "brand.50",
                      color: isDark ? "brand.300" : "brand.700",
                      fontWeight: "semibold",
                    },
                  })}
                >
                  <div>
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <div
                      className={css({
                        fontSize: "2xs",
                        color: isDark ? "gray.400" : "gray.500",
                        mt: "0.5",
                      })}
                    >
                      {option.description}
                    </div>
                  </div>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
