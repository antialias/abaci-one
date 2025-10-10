"use client";

import { useState } from "react";
import { PageWithNav } from "@/components/PageWithNav";
import { css } from "../../../styled-system/css";
import { container, hstack } from "../../../styled-system/patterns";
import { ArithmeticOperationsGuide } from "./components/ArithmeticOperationsGuide";
import { ReadingNumbersGuide } from "./components/ReadingNumbersGuide";

type TabType = "reading" | "arithmetic";

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<TabType>("reading");

  return (
    <PageWithNav navTitle="Interactive Guide" navEmoji="📖">
      <div className={css({ minHeight: "100vh", bg: "gray.50" })}>
        {/* Hero Section */}
        <div
          className={css({
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            textAlign: "center",
            py: "20",
          })}
        >
          <div className={container({ maxW: "4xl", px: "4" })}>
            <h1
              className={css({
                fontSize: "4xl",
                fontWeight: "bold",
                mb: "4",
                textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              })}
            >
              📚 Complete Soroban Mastery Guide
            </h1>
            <p
              className={css({
                fontSize: "xl",
                opacity: "0.95",
                maxW: "2xl",
                mx: "auto",
                lineHeight: "relaxed",
              })}
            >
              From basic reading to advanced arithmetic - everything you need to
              master the Japanese abacus
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={css({
            bg: "white",
            borderBottom: "1px solid",
            borderColor: "gray.200",
          })}
        >
          <div className={container({ maxW: "7xl", px: "4" })}>
            <div className={hstack({ gap: "0" })}>
              <button
                onClick={() => setActiveTab("reading")}
                className={css({
                  px: "6",
                  py: "4",
                  fontWeight: "medium",
                  borderBottom: "2px solid",
                  borderColor:
                    activeTab === "reading" ? "brand.600" : "transparent",
                  color: activeTab === "reading" ? "brand.600" : "gray.600",
                  bg: activeTab === "reading" ? "brand.50" : "transparent",
                  transition: "all",
                  cursor: "pointer",
                  _hover: {
                    bg: activeTab === "reading" ? "brand.50" : "gray.50",
                    color: activeTab === "reading" ? "brand.600" : "gray.800",
                  },
                })}
              >
                📖 Reading Numbers
              </button>
              <button
                onClick={() => setActiveTab("arithmetic")}
                className={css({
                  px: "6",
                  py: "4",
                  fontWeight: "medium",
                  borderBottom: "2px solid",
                  borderColor:
                    activeTab === "arithmetic" ? "brand.600" : "transparent",
                  color: activeTab === "arithmetic" ? "brand.600" : "gray.600",
                  bg: activeTab === "arithmetic" ? "brand.50" : "transparent",
                  transition: "all",
                  cursor: "pointer",
                  _hover: {
                    bg: activeTab === "arithmetic" ? "brand.50" : "gray.50",
                    color:
                      activeTab === "arithmetic" ? "brand.600" : "gray.800",
                  },
                })}
              >
                🧮 Arithmetic Operations
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={container({ maxW: "6xl", px: "4", py: "12" })}>
          <div
            className={css({
              bg: "white",
              rounded: "2xl",
              shadow: "card",
              p: "10",
            })}
          >
            {activeTab === "reading" ? (
              <ReadingNumbersGuide />
            ) : (
              <ArithmeticOperationsGuide />
            )}
          </div>
        </div>
      </div>
    </PageWithNav>
  );
}
