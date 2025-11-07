import type { Meta, StoryObj } from "@storybook/react";
import {
  AbacusDisplayProvider,
  useAbacusDisplay,
  useAbacusConfig,
} from "./AbacusContext";
import { AbacusReact } from "./AbacusReact";
import { StandaloneBead } from "./StandaloneBead";
import React from "react";

const meta: Meta<typeof AbacusDisplayProvider> = {
  title: "Soroban/Components/AbacusDisplayProvider",
  component: AbacusDisplayProvider,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Context provider for managing global abacus display configuration. Automatically persists settings to localStorage and provides SSR-safe hydration.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Provider Usage
export const BasicUsage: Story = {
  name: "Basic Provider Usage",
  render: () => (
    <AbacusDisplayProvider>
      <div style={{ textAlign: "center" }}>
        <AbacusReact value={123} columns={3} showNumbers />
        <p style={{ marginTop: "16px", fontSize: "14px", color: "#6b7280" }}>
          This abacus inherits all settings from the provider
        </p>
      </div>
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Wrap your components with AbacusDisplayProvider to provide consistent configuration",
      },
    },
  },
};

// With Initial Config
export const WithInitialConfig: Story = {
  name: "With Initial Config",
  render: () => (
    <AbacusDisplayProvider
      initialConfig={{
        beadShape: "circle",
        colorScheme: "heaven-earth",
        colorPalette: "colorblind",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <AbacusReact value={456} columns={3} showNumbers />
        <p style={{ marginTop: "16px", fontSize: "14px", color: "#6b7280" }}>
          Circle beads with heaven-earth coloring (colorblind palette)
        </p>
      </div>
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Provide initial configuration to override defaults",
      },
    },
  },
};

// Interactive Config Demo
const ConfigDemo: React.FC = () => {
  const { config, updateConfig, resetToDefaults } = useAbacusDisplay();

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: "20px" }}>
        <AbacusReact value={789} columns={3} showNumbers scaleFactor={1.2} />
      </div>

      <div
        style={{
          display: "inline-block",
          textAlign: "left",
          padding: "20px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#f9fafb",
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: "16px" }}>
          Configuration Controls
        </h3>

        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              marginBottom: "4px",
              fontWeight: "500",
            }}
          >
            Bead Shape:
          </label>
          <select
            value={config.beadShape}
            onChange={(e) => updateConfig({ beadShape: e.target.value as any })}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
            }}
          >
            <option value="diamond">Diamond</option>
            <option value="circle">Circle</option>
            <option value="square">Square</option>
          </select>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              marginBottom: "4px",
              fontWeight: "500",
            }}
          >
            Color Scheme:
          </label>
          <select
            value={config.colorScheme}
            onChange={(e) =>
              updateConfig({ colorScheme: e.target.value as any })
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
            }}
          >
            <option value="monochrome">Monochrome</option>
            <option value="place-value">Place Value</option>
            <option value="heaven-earth">Heaven-Earth</option>
            <option value="alternating">Alternating</option>
          </select>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              marginBottom: "4px",
              fontWeight: "500",
            }}
          >
            Color Palette:
          </label>
          <select
            value={config.colorPalette}
            onChange={(e) =>
              updateConfig({ colorPalette: e.target.value as any })
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
            }}
          >
            <option value="default">Default</option>
            <option value="colorblind">Colorblind</option>
            <option value="mnemonic">Mnemonic</option>
            <option value="grayscale">Grayscale</option>
            <option value="nature">Nature</option>
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={config.animated}
              onChange={(e) => updateConfig({ animated: e.target.checked })}
              style={{ marginRight: "6px" }}
            />
            Enable Animations
          </label>
        </div>

        <button
          onClick={resetToDefaults}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Reset to Defaults
        </button>

        <div
          style={{
            marginTop: "12px",
            padding: "8px",
            background: "#fef3c7",
            borderRadius: "4px",
            fontSize: "11px",
            color: "#92400e",
          }}
        >
          💾 Changes are automatically saved to localStorage
        </div>
      </div>
    </div>
  );
};

export const InteractiveConfiguration: Story = {
  name: "Interactive Configuration",
  render: () => (
    <AbacusDisplayProvider>
      <ConfigDemo />
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Use the useAbacusDisplay hook to access and modify configuration. Changes persist across sessions via localStorage.",
      },
    },
  },
};

// Consistent Styling Across Components
export const ConsistentStyling: Story = {
  name: "Consistent Styling",
  render: () => (
    <AbacusDisplayProvider
      initialConfig={{
        beadShape: "square",
        colorScheme: "place-value",
        colorPalette: "nature",
      }}
    >
      <div>
        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            Multiple Abacuses
          </h3>
          <div
            style={{ display: "flex", gap: "20px", justifyContent: "center" }}
          >
            <AbacusReact value={12} columns={2} showNumbers />
            <AbacusReact value={345} columns={3} showNumbers />
            <AbacusReact value={6789} columns={4} showNumbers />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            Standalone Beads
          </h3>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <StandaloneBead size={32} color="#ef4444" />
            <StandaloneBead size={32} color="#f97316" />
            <StandaloneBead size={32} color="#eab308" />
            <StandaloneBead size={32} color="#22c55e" />
            <StandaloneBead size={32} color="#3b82f6" />
          </div>
        </div>

        <p
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          All components share the same bead shape (square) from the provider
        </p>
      </div>
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Provider ensures consistent styling across all abacus components and standalone beads",
      },
    },
  },
};

// Using the Config Hook
const ConfigDisplay: React.FC = () => {
  const config = useAbacusConfig();

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        background: "white",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: "14px", fontFamily: "sans-serif" }}>
        Current Configuration
      </h3>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
};

export const UsingConfigHook: Story = {
  name: "Using useAbacusConfig Hook",
  render: () => (
    <AbacusDisplayProvider
      initialConfig={{
        beadShape: "diamond",
        colorScheme: "place-value",
        animated: true,
      }}
    >
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <AbacusReact value={234} columns={3} showNumbers />
        <ConfigDisplay />
      </div>
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Use useAbacusConfig() hook to read configuration values in your components",
      },
    },
  },
};

// localStorage Persistence Demo
const PersistenceDemo: React.FC = () => {
  const { config, updateConfig } = useAbacusDisplay();
  const [hasChanges, setHasChanges] = React.useState(false);

  const handleChange = (updates: any) => {
    updateConfig(updates);
    setHasChanges(true);
    setTimeout(() => setHasChanges(false), 2000);
  };

  return (
    <div style={{ textAlign: "center" }}>
      <AbacusReact value={555} columns={3} showNumbers scaleFactor={1.2} />

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#f9fafb",
          maxWidth: "300px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <h4 style={{ marginTop: 0, fontSize: "14px" }}>
          Try changing settings:
        </h4>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "12px",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => handleChange({ beadShape: "diamond" })}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border:
                config.beadShape === "diamond"
                  ? "2px solid #8b5cf6"
                  : "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Diamond
          </button>
          <button
            onClick={() => handleChange({ beadShape: "circle" })}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border:
                config.beadShape === "circle"
                  ? "2px solid #8b5cf6"
                  : "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Circle
          </button>
          <button
            onClick={() => handleChange({ beadShape: "square" })}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border:
                config.beadShape === "square"
                  ? "2px solid #8b5cf6"
                  : "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Square
          </button>
        </div>

        {hasChanges && (
          <div
            style={{
              padding: "8px",
              background: "#dcfce7",
              borderRadius: "4px",
              fontSize: "12px",
              color: "#166534",
              marginBottom: "12px",
            }}
          >
            ✓ Saved to localStorage!
          </div>
        )}

        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: "#6b7280",
            lineHeight: "1.5",
          }}
        >
          Reload this page and your settings will be preserved. Open DevTools →
          Application → Local Storage to see the saved data.
        </p>
      </div>
    </div>
  );
};

export const LocalStoragePersistence: Story = {
  name: "localStorage Persistence",
  render: () => (
    <AbacusDisplayProvider>
      <PersistenceDemo />
    </AbacusDisplayProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Configuration is automatically persisted to localStorage and restored on page reload. SSR-safe with proper hydration.",
      },
    },
  },
};

// Multiple Providers (Not Recommended)
export const MultipleProviders: Story = {
  name: "Multiple Providers (Advanced)",
  render: () => (
    <div style={{ display: "flex", gap: "40px" }}>
      <div style={{ textAlign: "center" }}>
        <h4 style={{ fontSize: "14px", marginBottom: "12px" }}>Provider A</h4>
        <AbacusDisplayProvider
          initialConfig={{ beadShape: "diamond", colorScheme: "heaven-earth" }}
        >
          <AbacusReact value={111} columns={3} showNumbers />
          <p style={{ fontSize: "12px", marginTop: "8px", color: "#6b7280" }}>
            Diamond beads
          </p>
        </AbacusDisplayProvider>
      </div>

      <div style={{ textAlign: "center" }}>
        <h4 style={{ fontSize: "14px", marginBottom: "12px" }}>Provider B</h4>
        <AbacusDisplayProvider
          initialConfig={{ beadShape: "circle", colorScheme: "place-value" }}
        >
          <AbacusReact value={222} columns={3} showNumbers />
          <p style={{ fontSize: "12px", marginTop: "8px", color: "#6b7280" }}>
            Circle beads
          </p>
        </AbacusDisplayProvider>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "You can use multiple providers with different configs, but typically one provider at the app root is sufficient. Note: Each provider maintains its own localStorage key.",
      },
    },
  },
};

// Without Provider (Fallback)
export const WithoutProvider: Story = {
  name: "Without Provider (Fallback)",
  render: () => (
    <div style={{ textAlign: "center" }}>
      <StandaloneBead size={40} shape="diamond" color="#8b5cf6" />
      <p style={{ marginTop: "12px", fontSize: "14px", color: "#6b7280" }}>
        Components work without a provider by using default configuration
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Components gracefully fall back to defaults when used outside a provider",
      },
    },
  },
};
