"use client";

import { AbacusReact, useAbacusConfig } from "@soroban/abacus-react";
import Link from "next/link";
import { TutorialPlayer } from "@/components/tutorial/TutorialPlayer";
import { getTutorialForEditor } from "@/utils/tutorialConverter";
import { css } from "../../../../styled-system/css";
import { grid } from "../../../../styled-system/patterns";

export function ArithmeticOperationsGuide() {
  const appConfig = useAbacusConfig();

  return (
    <div className={css({ maxW: "4xl", mx: "auto" })}>
      <div
        className={css({
          bg: "gradient-to-br",
          gradientFrom: "purple.600",
          gradientTo: "indigo.700",
          color: "white",
          rounded: "xl",
          p: { base: "6", md: "8" },
          mb: "8",
          textAlign: "center",
        })}
      >
        <h2
          className={css({
            fontSize: { base: "2xl", md: "3xl" },
            fontWeight: "bold",
            mb: "4",
          })}
        >
          🧮 Arithmetic Operations
        </h2>
        <p
          className={css({
            fontSize: "lg",
            opacity: "0.9",
          })}
        >
          Master addition, subtraction, multiplication, and division on the
          soroban
        </p>
      </div>

      {/* Addition Section */}
      <div
        className={css({
          bg: "white",
          rounded: "xl",
          p: "6",
          mb: "6",
          shadow: "sm",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            color: "green.700",
            mb: "4",
            display: "flex",
            alignItems: "center",
            gap: "2",
          })}
        >
          <span>➕</span> Addition
        </h3>

        <p className={css({ mb: "6", color: "gray.700" })}>
          Addition on the soroban follows the principle of moving beads toward
          the bar to increase values.
        </p>

        <div className={css({ mb: "6" })}>
          <h4
            className={css({
              fontSize: "lg",
              fontWeight: "semibold",
              mb: "3",
              color: "green.600",
            })}
          >
            Basic Steps:
          </h4>
          <ol
            className={css({
              pl: "6",
              gap: "2",
              color: "gray.700",
            })}
          >
            <li className={css({ mb: "2" })}>
              1. Set the first number on the soroban
            </li>
            <li className={css({ mb: "2" })}>
              2. Add the second number by moving beads toward the bar
            </li>
            <li className={css({ mb: "2" })}>
              3. Handle carries when a column exceeds 9
            </li>
            <li>4. Read the final result</li>
          </ol>
        </div>

        <div
          className={css({
            bg: "green.50",
            border: "1px solid",
            borderColor: "green.200",
            rounded: "lg",
            p: "4",
            mb: "4",
          })}
        >
          <h5
            className={css({
              fontWeight: "semibold",
              color: "green.800",
              mb: "2",
            })}
          >
            Example: 3 + 4 = 7
          </h5>
          <div className={grid({ columns: 3, gap: "4", alignItems: "center" })}>
            <div className={css({ textAlign: "center" })}>
              <p
                className={css({ fontSize: "sm", mb: "2", color: "green.700" })}
              >
                Start: 3
              </p>
              <div
                className={css({
                  width: "160px",
                  height: "240px",
                  bg: "white",
                  border: "1px solid",
                  borderColor: "gray.300",
                  rounded: "md",
                  mb: "3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  mx: "auto",
                })}
              >
                <AbacusReact
                  value={3}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
            <div className={css({ textAlign: "center", fontSize: "2xl" })}>
              +
            </div>
            <div className={css({ textAlign: "center" })}>
              <p
                className={css({ fontSize: "sm", mb: "2", color: "green.700" })}
              >
                Result: 7
              </p>
              <div
                className={css({
                  width: "160px",
                  height: "240px",
                  bg: "white",
                  border: "1px solid",
                  borderColor: "gray.300",
                  rounded: "md",
                  mb: "3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  mx: "auto",
                })}
              >
                <AbacusReact
                  value={7}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Addition Tutorial */}
      <div
        className={css({
          bg: "white",
          rounded: "xl",
          p: "6",
          mb: "6",
          shadow: "sm",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            color: "blue.700",
            mb: "4",
            display: "flex",
            alignItems: "center",
            gap: "2",
          })}
        >
          <span>🎯</span> Guided Addition Tutorial
        </h3>

        <p className={css({ mb: "6", color: "gray.700" })}>
          Learn addition step-by-step with interactive guidance, tooltips, and
          error correction.
        </p>

        <div
          className={css({
            bg: "blue.50",
            border: "1px solid",
            borderColor: "blue.200",
            rounded: "lg",
            p: 4,
            mb: 4,
          })}
        >
          <p
            className={css({
              fontSize: "sm",
              color: "blue.700",
              mb: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
            })}
          >
            <span>✏️</span>
            <strong>This tutorial is now editable!</strong>
          </p>
          <p className={css({ fontSize: "xs", color: "blue.600" })}>
            You can customize this tutorial using our new tutorial editor
            system.{" "}
            <a
              href="/tutorial-editor"
              className={css({
                color: "blue.700",
                textDecoration: "underline",
                _hover: { color: "blue.800" },
              })}
            >
              Open in Editor →
            </a>
          </p>
        </div>

        <TutorialPlayer
          tutorial={getTutorialForEditor()}
          isDebugMode={false}
          showDebugPanel={false}
        />
      </div>

      {/* Subtraction Section */}
      <div
        className={css({
          bg: "white",
          rounded: "xl",
          p: "6",
          mb: "6",
          shadow: "sm",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            color: "red.700",
            mb: "4",
            display: "flex",
            alignItems: "center",
            gap: "2",
          })}
        >
          <span>➖</span> Subtraction
        </h3>

        <p className={css({ mb: "6", color: "gray.700" })}>
          Subtraction involves moving beads away from the bar to decrease
          values.
        </p>

        <div className={css({ mb: "6" })}>
          <h4
            className={css({
              fontSize: "lg",
              fontWeight: "semibold",
              mb: "3",
              color: "red.600",
            })}
          >
            Basic Steps:
          </h4>
          <ol
            className={css({
              pl: "6",
              gap: "2",
              color: "gray.700",
            })}
          >
            <li className={css({ mb: "2" })}>
              1. Set the minuend (first number) on the soroban
            </li>
            <li className={css({ mb: "2" })}>
              2. Subtract by moving beads away from the bar
            </li>
            <li className={css({ mb: "2" })}>
              3. Handle borrowing when needed
            </li>
            <li>4. Read the final result</li>
          </ol>
        </div>

        <div
          className={css({
            bg: "red.50",
            border: "1px solid",
            borderColor: "red.200",
            rounded: "lg",
            p: "4",
            mb: "4",
          })}
        >
          <h5
            className={css({
              fontWeight: "semibold",
              color: "red.800",
              mb: "2",
            })}
          >
            Example: 8 - 3 = 5
          </h5>
          <div className={grid({ columns: 3, gap: "4", alignItems: "center" })}>
            <div className={css({ textAlign: "center" })}>
              <p className={css({ fontSize: "sm", mb: "2", color: "red.700" })}>
                Start: 8
              </p>
              <div
                className={css({
                  width: "160px",
                  height: "240px",
                  bg: "white",
                  border: "1px solid",
                  borderColor: "gray.300",
                  rounded: "md",
                  mb: "3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  mx: "auto",
                })}
              >
                <AbacusReact
                  value={8}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
            <div className={css({ textAlign: "center", fontSize: "2xl" })}>
              -
            </div>
            <div className={css({ textAlign: "center" })}>
              <p className={css({ fontSize: "sm", mb: "2", color: "red.700" })}>
                Result: 5
              </p>
              <div
                className={css({
                  width: "160px",
                  height: "240px",
                  bg: "white",
                  border: "1px solid",
                  borderColor: "gray.300",
                  rounded: "md",
                  mb: "3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  mx: "auto",
                })}
              >
                <AbacusReact
                  value={5}
                  columns={1}
                  beadShape={appConfig.beadShape}
                  colorScheme={appConfig.colorScheme}
                  hideInactiveBeads={appConfig.hideInactiveBeads}
                  scaleFactor={1.2}
                  interactive={false}
                  showNumbers={true}
                  animated={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multiplication & Division Section */}
      <div
        className={css({
          bg: "white",
          rounded: "xl",
          p: "6",
          mb: "6",
          shadow: "sm",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            color: "purple.700",
            mb: "4",
            display: "flex",
            alignItems: "center",
            gap: "2",
          })}
        >
          <span>✖️➗</span> Multiplication & Division
        </h3>

        <p className={css({ mb: "6", color: "gray.700" })}>
          Advanced operations that combine addition/subtraction with position
          shifting.
        </p>

        <div className={grid({ columns: { base: 1, md: 2 }, gap: "6" })}>
          <div
            className={css({
              bg: "purple.50",
              border: "1px solid",
              borderColor: "purple.200",
              rounded: "lg",
              p: "4",
            })}
          >
            <h4
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "purple.800",
                mb: "3",
              })}
            >
              Multiplication
            </h4>
            <ul
              className={css({
                fontSize: "sm",
                color: "purple.700",
                pl: "4",
              })}
            >
              <li className={css({ mb: "2" })}>
                • Break down into repeated addition
              </li>
              <li className={css({ mb: "2" })}>
                • Use position shifts for place values
              </li>
              <li className={css({ mb: "2" })}>
                • Master multiplication tables
              </li>
              <li>• Practice with single digits first</li>
            </ul>
          </div>

          <div
            className={css({
              bg: "indigo.50",
              border: "1px solid",
              borderColor: "indigo.200",
              rounded: "lg",
              p: "4",
            })}
          >
            <h4
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "indigo.800",
                mb: "3",
              })}
            >
              Division
            </h4>
            <ul
              className={css({
                fontSize: "sm",
                color: "indigo.700",
                pl: "4",
              })}
            >
              <li className={css({ mb: "2" })}>
                • Use repeated subtraction method
              </li>
              <li className={css({ mb: "2" })}>
                • Estimate quotients carefully
              </li>
              <li className={css({ mb: "2" })}>• Handle remainders properly</li>
              <li>• Check results by multiplication</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Practice Tips */}
      <div
        className={css({
          bg: "gradient-to-r",
          gradientFrom: "purple.600",
          gradientTo: "indigo.600",
          color: "white",
          rounded: "xl",
          p: "6",
          textAlign: "center",
        })}
      >
        <h4
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            mb: "3",
          })}
        >
          💡 Master the Fundamentals
        </h4>
        <p
          className={css({
            mb: "4",
            opacity: "0.9",
          })}
        >
          Start with simple problems and gradually increase complexity
        </p>
        <Link
          href="/create"
          className={css({
            display: "inline-block",
            px: "6",
            py: "3",
            bg: "white",
            color: "purple.600",
            fontWeight: "semibold",
            rounded: "lg",
            textDecoration: "none",
            transition: "all",
            _hover: { transform: "translateY(-1px)", shadow: "lg" },
          })}
        >
          Practice Arithmetic Operations →
        </Link>
      </div>
    </div>
  );
}
