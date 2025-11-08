/**
 * Automatic Theme Detection
 * Features: useSystemTheme hook, automatic numeral color adjustment, manual overrides
 */

import type { Meta, StoryObj } from "@storybook/react";
import React, { useState, useEffect } from "react";
import AbacusReact from "./AbacusReact";
import { useSystemTheme, ABACUS_THEMES } from "./index";

const meta = {
  title: "AbacusReact/Theme Detection",
  component: AbacusReact,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AbacusReact>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// AUTOMATIC THEME DETECTION
// ============================================================================

function AutomaticThemeDemo() {
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");

  // Apply theme to document root (simulating parent app's theme system)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pageTheme);
  }, [pageTheme]);

  return (
    <div
      style={{
        padding: "40px",
        minWidth: "600px",
        background: pageTheme === "dark" ? "#1a1a1a" : "#f5f5f5",
        borderRadius: "8px",
        transition: "background 0.3s ease",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
          color: pageTheme === "dark" ? "white" : "black",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Automatic Theme Detection</h3>
        <p>Numerals automatically adjust for optimal visibility</p>

        <div style={{ marginTop: "20px" }}>
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "light"}
              onChange={() => setPageTheme("light")}
            />{" "}
            Light Mode
          </label>
          {"  "}
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "dark"}
              onChange={() => setPageTheme("dark")}
            />{" "}
            Dark Mode
          </label>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <AbacusReact
          value={12345}
          columns={5}
          showNumbers={true}
          customStyles={
            pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
          }
        />
      </div>

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          background: pageTheme === "dark" ? "#2a2a2a" : "#e5e5e5",
          borderRadius: "6px",
          color: pageTheme === "dark" ? "#ccc" : "#666",
          fontSize: "14px",
        }}
      >
        <strong>What's happening:</strong>
        <ul style={{ marginTop: "10px", marginBottom: 0 }}>
          <li>
            Page background changes with theme (dark = black, light = white)
          </li>
          <li>
            Abacus frame adapts (translucent white in dark, solid white in
            light)
          </li>
          <li>
            ✨ Numerals stay dark (readable) regardless of page theme
          </li>
        </ul>
      </div>
    </div>
  );
}

export const AutomaticThemeDetection: Story = {
  render: () => <AutomaticThemeDemo />,
};

// ============================================================================
// useSystemTheme HOOK DEMO
// ============================================================================

function SystemThemeHookDemo() {
  const systemTheme = useSystemTheme(); // Use the hook directly
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pageTheme);
  }, [pageTheme]);

  return (
    <div
      style={{
        padding: "40px",
        minWidth: "600px",
        background: pageTheme === "dark" ? "#1a1a1a" : "#f5f5f5",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
          color: pageTheme === "dark" ? "white" : "black",
        }}
      >
        <h3 style={{ marginTop: 0 }}>useSystemTheme Hook</h3>
        <p>Detect and respond to page theme changes</p>

        <div style={{ marginTop: "20px" }}>
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "light"}
              onChange={() => setPageTheme("light")}
            />{" "}
            Light Mode
          </label>
          {"  "}
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "dark"}
              onChange={() => setPageTheme("dark")}
            />{" "}
            Dark Mode
          </label>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: pageTheme === "dark" ? "#2a2a2a" : "#e5e5e5",
            borderRadius: "6px",
          }}
        >
          <code>
            const systemTheme = useSystemTheme(); // "{systemTheme}"
          </code>
        </div>
      </div>

      <AbacusReact
        value={789}
        columns={3}
        showNumbers={true}
        customStyles={
          systemTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
        }
      />

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          background: pageTheme === "dark" ? "#2a2a2a" : "#e5e5e5",
          borderRadius: "6px",
          color: pageTheme === "dark" ? "#ccc" : "#666",
          fontSize: "14px",
        }}
      >
        <strong>Hook detects:</strong>
        <ul style={{ marginTop: "10px", marginBottom: 0 }}>
          <li>
            <code>data-theme="light"</code> or <code>data-theme="dark"</code>{" "}
            attribute on <code>&lt;html&gt;</code>
          </li>
          <li>
            <code>.light</code> or <code>.dark</code> class on{" "}
            <code>&lt;html&gt;</code>
          </li>
          <li>Updates automatically using MutationObserver</li>
          <li>SSR-safe with default fallback</li>
        </ul>
      </div>
    </div>
  );
}

export const UseSystemThemeHook: Story = {
  render: () => <SystemThemeHookDemo />,
};

// ============================================================================
// MANUAL OVERRIDE
// ============================================================================

function ManualOverrideDemo() {
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pageTheme);
  }, [pageTheme]);

  return (
    <div
      style={{
        padding: "40px",
        minWidth: "600px",
        background: pageTheme === "dark" ? "#1a1a1a" : "#f5f5f5",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
          color: pageTheme === "dark" ? "white" : "black",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Manual Color Override</h3>
        <p>Custom numeral colors override automatic detection</p>

        <div style={{ marginTop: "20px" }}>
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "light"}
              onChange={() => setPageTheme("light")}
            />{" "}
            Light Mode
          </label>
          {"  "}
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "dark"}
              onChange={() => setPageTheme("dark")}
            />{" "}
            Dark Mode
          </label>
        </div>
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h4
          style={{
            color: pageTheme === "dark" ? "white" : "black",
            marginTop: 0,
          }}
        >
          Default (automatic):
        </h4>
        <AbacusReact
          value={456}
          columns={3}
          showNumbers={true}
          customStyles={
            pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
          }
        />
        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            color: pageTheme === "dark" ? "#ccc" : "#666",
          }}
        >
          Numerals use automatic color (dark text on light frame)
        </p>
      </div>

      <div style={{ marginBottom: "40px" }}>
        <h4
          style={{
            color: pageTheme === "dark" ? "white" : "black",
            marginTop: 0,
          }}
        >
          Custom red numerals:
        </h4>
        <AbacusReact
          value={456}
          columns={3}
          showNumbers={true}
          customStyles={{
            ...(pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light),
            numerals: {
              color: "#ef4444", // Red
              fontWeight: "700",
            },
          }}
        />
        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            color: pageTheme === "dark" ? "#ccc" : "#666",
          }}
        >
          Custom color overrides automatic detection
        </p>
      </div>

      <div>
        <h4
          style={{
            color: pageTheme === "dark" ? "white" : "black",
            marginTop: 0,
          }}
        >
          Custom blue numerals:
        </h4>
        <AbacusReact
          value={456}
          columns={3}
          showNumbers={true}
          customStyles={{
            ...(pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light),
            numerals: {
              color: "#3b82f6", // Blue
              fontWeight: "600",
            },
          }}
        />
        <p
          style={{
            marginTop: "10px",
            fontSize: "14px",
            color: pageTheme === "dark" ? "#ccc" : "#666",
          }}
        >
          Any color can be used for special effects
        </p>
      </div>
    </div>
  );
}

export const ManualColorOverride: Story = {
  render: () => <ManualOverrideDemo />,
};

// ============================================================================
// COMPARISON: WITH vs WITHOUT NUMERALS
// ============================================================================

function NumeralsComparisonDemo() {
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pageTheme);
  }, [pageTheme]);

  return (
    <div
      style={{
        padding: "40px",
        minWidth: "700px",
        background: pageTheme === "dark" ? "#1a1a1a" : "#f5f5f5",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
          color: pageTheme === "dark" ? "white" : "black",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Numerals On vs Off</h3>
        <p>Compare visibility with and without numeral labels</p>

        <div style={{ marginTop: "20px" }}>
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "light"}
              onChange={() => setPageTheme("light")}
            />{" "}
            Light Mode
          </label>
          {"  "}
          <label>
            <input
              type="radio"
              name="theme"
              checked={pageTheme === "dark"}
              onChange={() => setPageTheme("dark")}
            />{" "}
            Dark Mode
          </label>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "30px",
        }}
      >
        <div>
          <h4
            style={{
              color: pageTheme === "dark" ? "white" : "black",
              marginTop: 0,
            }}
          >
            Without numerals:
          </h4>
          <AbacusReact
            value={8765}
            columns={4}
            showNumbers={false}
            customStyles={
              pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
            }
          />
        </div>

        <div>
          <h4
            style={{
              color: pageTheme === "dark" ? "white" : "black",
              marginTop: 0,
            }}
          >
            With numerals:
          </h4>
          <AbacusReact
            value={8765}
            columns={4}
            showNumbers={true}
            customStyles={
              pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
            }
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          background: pageTheme === "dark" ? "#2a2a2a" : "#e5e5e5",
          borderRadius: "6px",
          color: pageTheme === "dark" ? "#ccc" : "#666",
          fontSize: "14px",
        }}
      >
        <strong>Note:</strong> Numerals remain visible in both light and dark
        modes thanks to automatic theme detection. They always use dark color
        since the abacus frame is light/translucent.
      </div>
    </div>
  );
}

export const NumeralsComparison: Story = {
  render: () => <NumeralsComparisonDemo />,
};

// ============================================================================
// REAL-WORLD EXAMPLE: EDUCATIONAL APP
// ============================================================================

function EducationalAppDemo() {
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");
  const [currentValue, setCurrentValue] = useState(234);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pageTheme);
  }, [pageTheme]);

  return (
    <div
      style={{
        padding: "40px",
        minWidth: "700px",
        background: pageTheme === "dark" ? "#0f172a" : "#ffffff",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      }}
    >
      {/* App Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          paddingBottom: "20px",
          borderBottom: `2px solid ${pageTheme === "dark" ? "#334155" : "#e5e7eb"}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: pageTheme === "dark" ? "white" : "black",
          }}
        >
          Math Learning App
        </h2>
        <button
          onClick={() => setPageTheme(pageTheme === "dark" ? "light" : "dark")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: pageTheme === "dark" ? "#475569" : "#e5e7eb",
            color: pageTheme === "dark" ? "white" : "black",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          {pageTheme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* Lesson Content */}
      <div style={{ color: pageTheme === "dark" ? "#e2e8f0" : "#374151" }}>
        <h3 style={{ marginTop: 0 }}>Today's Lesson: Place Value</h3>
        <p>Learn to represent numbers on a soroban abacus!</p>
      </div>

      {/* Interactive Abacus */}
      <div
        style={{
          marginTop: "30px",
          padding: "30px",
          background: pageTheme === "dark" ? "#1e293b" : "#f9fafb",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
            color: pageTheme === "dark" ? "white" : "black",
          }}
        >
          <label>
            Current Number: {currentValue}
            <input
              type="range"
              min="0"
              max="999"
              value={currentValue}
              onChange={(e) => setCurrentValue(Number(e.target.value))}
              style={{ marginLeft: "15px", width: "200px" }}
            />
          </label>
        </div>

        <AbacusReact
          value={currentValue}
          columns={3}
          showNumbers={true}
          columnLabels={["ones", "tens", "hundreds"]}
          customStyles={
            pageTheme === "dark" ? ABACUS_THEMES.dark : ABACUS_THEMES.light
          }
          interactive={true}
          onValueChange={setCurrentValue}
        />
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          background: pageTheme === "dark" ? "#064e3b" : "#d1fae5",
          borderRadius: "8px",
          color: pageTheme === "dark" ? "#6ee7b7" : "#065f46",
        }}
      >
        <strong>✨ Theme-Aware Design:</strong>
        <ul style={{ marginTop: "10px", marginBottom: 0 }}>
          <li>Entire app responds to light/dark mode toggle</li>
          <li>Abacus frame adapts to page background</li>
          <li>Numerals always remain readable</li>
          <li>No manual color configuration needed!</li>
        </ul>
      </div>
    </div>
  );
}

export const EducationalAppExample: Story = {
  render: () => <EducationalAppDemo />,
};
