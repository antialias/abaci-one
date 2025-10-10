import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import InteractiveGallery from "./InteractiveGallery";
import React, { useState } from "react";

const meta: Meta<typeof InteractiveGallery> = {
  title: "Soroban/Interactive Gallery",
  component: InteractiveGallery,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
# Interactive Soroban Gallery

A complete gallery showcasing all the interactive abacus components with identical structure to the original Typst-generated gallery, but with full React interactivity.

## Features

- 📚 **Complete Example Set**: All 13 examples from the original gallery
- 🎯 **Fully Interactive**: Every abacus responds to clicks and drags
- 📊 **Live Statistics**: Real-time tracking of interactions and value changes
- 🗂️ **Organized Tabs**: Basic Examples, Advanced Features, Debug & Edge Cases
- 🔄 **Reset Functionality**: Each card has a reset button to restore original values
- 📱 **Responsive Design**: Adapts to different screen sizes

## Gallery Examples

### Basic Examples
- **Basic Number 5**: Simple single-column representation
- **Colorful 123**: Multi-column with place-value colors
- **Circle Beads 42**: Different bead shape demonstration
- **Large Scale 7**: Enlarged for better visibility

### Advanced Features
- **Compact 999**: Square beads with alternating colors
- **Educational 1234**: Four-digit educational example
- **Hidden Inactive 555**: Clean look with hidden inactive beads
- **Mixed Geometry 321**: Various configuration demonstration

### Debug & Edge Cases
- **Single Digit**: Minimal single column design
- **Four 9s**: Maximum value demonstration (9999)
- **Large Zero**: Empty abacus representation
- **Debug Examples**: Two and three-digit debugging cases

## Interaction Guide

- **Click** beads to toggle their positions
- **Drag** beads for tactile feedback (they snap back)
- **Reset** button restores original values
- **Statistics** track total interactions across all examples
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGallery: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Complete interactive gallery with all examples. Try clicking and dragging beads in any of the abacus components!",
      },
    },
  },
};

export const GalleryOverview: Story = {
  render: () => {
    return (
      <div
        style={{
          padding: "40px",
          maxWidth: "1200px",
          margin: "0 auto",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              color: "#2c3e50",
              marginBottom: "10px",
            }}
          >
            🧮 Interactive Soroban Gallery
          </h1>
          <p
            style={{ fontSize: "1.1rem", color: "#666", marginBottom: "30px" }}
          >
            Explore the complete collection of interactive Japanese abacus
            components
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "30px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ color: "#3498db", marginBottom: "15px" }}>
              📚 Basic Examples
            </h3>
            <ul style={{ color: "#666", lineHeight: 1.8, paddingLeft: "20px" }}>
              <li>Basic Number 5 - Simple single column</li>
              <li>Colorful 123 - Place-value colors</li>
              <li>Circle Beads 42 - Alternative bead shapes</li>
              <li>Large Scale 7 - Enhanced visibility</li>
            </ul>
          </div>

          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ color: "#e74c3c", marginBottom: "15px" }}>
              🎨 Advanced Features
            </h3>
            <ul style={{ color: "#666", lineHeight: 1.8, paddingLeft: "20px" }}>
              <li>Compact 999 - Square beads</li>
              <li>Educational 1234 - Four-digit example</li>
              <li>Hidden Inactive 555 - Clean design</li>
              <li>Mixed Geometry 321 - Various configs</li>
            </ul>
          </div>

          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ color: "#f39c12", marginBottom: "15px" }}>
              🔧 Debug & Edge Cases
            </h3>
            <ul style={{ color: "#666", lineHeight: 1.8, paddingLeft: "20px" }}>
              <li>Single Digit - Minimal design</li>
              <li>Four 9s - Maximum value (9999)</li>
              <li>Large Zero - Empty state</li>
              <li>Debug Examples - Testing cases</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            background: "#e8f4fd",
            border: "1px solid #bee5eb",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <h3 style={{ color: "#0c5460", marginBottom: "10px" }}>
            🎯 Interactive Features
          </h3>
          <p style={{ color: "#0c5460", margin: 0, lineHeight: 1.6 }}>
            <strong>Click</strong> beads to toggle positions •
            <strong>Drag</strong> beads for tactile feedback •
            <strong>Reset</strong> buttons restore original values •
            <strong>Live statistics</strong> track all interactions
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#3498db",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px 24px",
              fontSize: "1rem",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(52, 152, 219, 0.3)",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2980b9";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#3498db";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🧮 Launch Full Interactive Gallery
          </button>
        </div>

        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
          }}
        >
          <h4 style={{ color: "#495057", marginBottom: "15px" }}>
            🚀 Implementation Details
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "15px",
              fontSize: "0.9rem",
              color: "#6c757d",
            }}
          >
            <div>
              <strong>Framework:</strong> React + TypeScript
              <br />
              <strong>Animations:</strong> React Spring
              <br />
              <strong>Interactions:</strong> @use-gesture/react
            </div>
            <div>
              <strong>Rendering:</strong> Pure SVG (no external libs)
              <br />
              <strong>State:</strong> Custom hooks
              <br />
              <strong>Accessibility:</strong> Colorblind-friendly palettes
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Overview of all gallery features and organization. This gives you a preview of what's available in the full gallery.",
      },
    },
  },
};

export const TabFunctionality: Story = {
  render: () => {
    const [selectedTab, setSelectedTab] = useState("basic");

    const tabs = {
      basic: {
        title: "📚 Basic Examples",
        description: "Simple demonstrations of core functionality",
        examples: [
          "Basic Number 5",
          "Colorful 123",
          "Circle Beads 42",
          "Large Scale 7",
        ],
      },
      advanced: {
        title: "🎨 Advanced Features",
        description: "Complex configurations and styling options",
        examples: [
          "Compact 999",
          "Educational 1234",
          "Hidden Inactive 555",
          "Mixed Geometry 321",
        ],
      },
      debug: {
        title: "🔧 Debug & Edge Cases",
        description: "Testing scenarios and boundary conditions",
        examples: [
          "Single Digit",
          "Four 9s (9999)",
          "Large Zero",
          "Debug Examples",
        ],
      },
    };

    return (
      <div
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "#2c3e50",
            marginBottom: "30px",
          }}
        >
          Gallery Tab System Demo
        </h2>

        <div
          style={{
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
            {Object.entries(tabs).map(([key, tab]) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key)}
                style={{
                  flex: 1,
                  padding: "20px",
                  background: selectedTab === key ? "#f8f9fa" : "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  color: selectedTab === key ? "#2c3e50" : "#666",
                  transition: "all 0.3s",
                  position: "relative",
                }}
              >
                {tab.title}
                {selectedTab === key && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "3px",
                      background: "#3498db",
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: "30px" }}>
            <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>
              {tabs[selectedTab as keyof typeof tabs].title}
            </h3>
            <p style={{ color: "#666", marginBottom: "20px", lineHeight: 1.6 }}>
              {tabs[selectedTab as keyof typeof tabs].description}
            </p>

            <div
              style={{
                background: "#f8f9fa",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #e9ecef",
              }}
            >
              <h4 style={{ color: "#495057", marginBottom: "15px" }}>
                Examples in this section:
              </h4>
              <ul
                style={{
                  color: "#6c757d",
                  lineHeight: 1.8,
                  paddingLeft: "20px",
                }}
              >
                {tabs[selectedTab as keyof typeof tabs].examples.map(
                  (example, index) => (
                    <li key={index}>{example}</li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#e8f4fd",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#0c5460", margin: 0 }}>
            💡 <strong>Tip:</strong> In the full gallery, each tab contains
            interactive abacus components that you can click and drag to explore
            different values and configurations.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstration of the tab system used to organize gallery examples into logical groups.",
      },
    },
  },
};

export const StatisticsTracking: Story = {
  render: () => {
    const [stats, setStats] = useState({
      totalClicks: 0,
      valueChanges: 0,
      activeInteractions: 0,
    });

    const simulateInteraction = (type: "click" | "value" | "active") => {
      setStats((prev) => ({
        ...prev,
        totalClicks: type === "click" ? prev.totalClicks + 1 : prev.totalClicks,
        valueChanges:
          type === "value" ? prev.valueChanges + 1 : prev.valueChanges,
        activeInteractions:
          type === "active"
            ? prev.activeInteractions + 1
            : prev.activeInteractions,
      }));
    };

    const resetStats = () => {
      setStats({ totalClicks: 0, valueChanges: 0, activeInteractions: 0 });
    };

    return (
      <div
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxWidth: "600px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "#2c3e50",
            marginBottom: "30px",
          }}
        >
          Statistics Tracking Demo
        </h2>

        <div
          style={{
            background: "white",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ color: "#2c3e50", marginBottom: "20px" }}>
            Live Gallery Statistics
          </h3>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "30px",
              marginBottom: "30px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#3498db",
                }}
              >
                {stats.totalClicks}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>
                Total Bead Clicks
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#e74c3c",
                }}
              >
                {stats.valueChanges}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>
                Value Changes
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#f39c12",
                }}
              >
                {stats.activeInteractions}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>
                Active Sessions
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => simulateInteraction("click")}
              style={{
                background: "#3498db",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Simulate Click
            </button>
            <button
              onClick={() => simulateInteraction("value")}
              style={{
                background: "#e74c3c",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Simulate Value Change
            </button>
            <button
              onClick={() => simulateInteraction("active")}
              style={{
                background: "#f39c12",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Simulate Interaction
            </button>
            <button
              onClick={resetStats}
              style={{
                background: "#95a5a6",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#e8f4fd",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #bee5eb",
          }}
        >
          <h4 style={{ color: "#0c5460", marginBottom: "15px" }}>
            📊 What Gets Tracked
          </h4>
          <ul
            style={{ color: "#0c5460", lineHeight: 1.8, paddingLeft: "20px" }}
          >
            <li>
              <strong>Bead Clicks:</strong> Every time a user clicks on any bead
            </li>
            <li>
              <strong>Value Changes:</strong> When the numeric value of an
              abacus changes
            </li>
            <li>
              <strong>Active Sessions:</strong> Ongoing interactions across all
              examples
            </li>
            <li>
              <strong>Per-Card Stats:</strong> Individual reset counters and
              click counts
            </li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstration of the real-time statistics tracking system that monitors user interactions across the entire gallery.",
      },
    },
  },
};
