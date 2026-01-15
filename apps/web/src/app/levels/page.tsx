"use client";

import { PageWithNav } from "@/components/PageWithNav";
import { LevelSliderDisplay } from "@/components/LevelSliderDisplay";
import { css } from "../../../styled-system/css";
import { container, stack } from "../../../styled-system/patterns";

export default function LevelsPage() {
  return (
    <PageWithNav navTitle="Kyu & Dan Levels" navEmoji="📊">
      <div className={css({ bg: "gray.900", minHeight: "100vh", pb: "12" })}>
        {/* Hero Section */}
        <div
          className={css({
            background:
              "linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(124, 58, 237, 0.3) 50%, rgba(17, 24, 39, 1) 100%)",
            color: "white",
            py: { base: "12", md: "16" },
            position: "relative",
            overflow: "hidden",
          })}
        >
          <div
            className={css({
              position: "absolute",
              inset: 0,
              opacity: 0.1,
              backgroundImage:
                "radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)",
              backgroundSize: "40px 40px",
            })}
          />

          <div
            className={container({
              maxW: "6xl",
              px: "4",
              position: "relative",
            })}
          >
            <div
              className={css({ textAlign: "center", maxW: "5xl", mx: "auto" })}
            >
              <h1
                className={css({
                  fontSize: { base: "3xl", md: "5xl", lg: "6xl" },
                  fontWeight: "bold",
                  mb: "4",
                  lineHeight: "tight",
                  background:
                    "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)",
                  backgroundClip: "text",
                  color: "transparent",
                })}
              >
                Understanding Kyu & Dan Levels
              </h1>

              <p
                className={css({
                  fontSize: { base: "lg", md: "xl" },
                  color: "gray.300",
                  mb: "6",
                  maxW: "3xl",
                  mx: "auto",
                  lineHeight: "1.6",
                })}
              >
                Slide through the complete progression from beginner to master
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className={container({ maxW: "6xl", px: "4", py: "12" })}>
          <section className={stack({ gap: "8" })}>
            <LevelSliderDisplay />

            {/* Info Section */}
            <div
              className={css({
                bg: "rgba(0, 0, 0, 0.4)",
                border: "1px solid",
                borderColor: "gray.700",
                rounded: "xl",
                p: { base: "6", md: "8" },
              })}
            >
              <h3
                className={css({
                  fontSize: { base: "xl", md: "2xl" },
                  fontWeight: "bold",
                  color: "white",
                  mb: "4",
                })}
              >
                About This Ranking System
              </h3>
              <div className={stack({ gap: "4" })}>
                <p className={css({ color: "gray.300", lineHeight: "1.6" })}>
                  This ranking system is based on the official examination
                  structure used by the{" "}
                  <strong className={css({ color: "white" })}>
                    Japan Abacus Federation
                  </strong>
                  . It represents a standardized progression from beginner (10th
                  Kyu) to master level (10th Dan), used internationally for
                  soroban proficiency assessment.
                </p>
                <p className={css({ color: "gray.300", lineHeight: "1.6" })}>
                  The system is designed to gradually increase in difficulty.
                  Kyu levels progress from 2-digit calculations at 10th Kyu to
                  10-digit calculations at 1st Kyu. Dan levels all require
                  mastery of 30-digit calculations, with ranks awarded based on
                  exam scores.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  );
}
