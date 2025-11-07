import type { Meta, StoryObj } from "@storybook/react";
import { AbacusStatic } from "./AbacusStatic";
import { ABACUS_THEMES } from "./AbacusThemes";

/**
 * AbacusStatic - Server Component compatible static abacus
 *
 * ## Key Features:
 * - ✅ Works in React Server Components (no "use client")
 * - ✅ **Identical layout to AbacusReact** - same props = same exact SVG output
 * - ✅ No animations, hooks, or client-side JavaScript
 * - ✅ Lightweight rendering for static displays
 *
 * ## Shared Architecture (Zero Duplication!):
 * Both AbacusStatic and AbacusReact use the **exact same rendering pipeline**:
 *
 * ```
 * calculateStandardDimensions() → AbacusSVGRenderer → calculateBeadPosition()
 *                                        ↓
 *                    ┌───────────────────┴───────────────────┐
 *                    ↓                                       ↓
 *             AbacusStaticBead                    AbacusAnimatedBead
 *             (Simple SVG)                        (react-spring)
 * ```
 *
 * - `calculateStandardDimensions()` - Single source of truth for layout (beadSize, gaps, bar position, etc.)
 * - `AbacusSVGRenderer` - Shared SVG structure with dependency injection for bead components
 * - `calculateBeadPosition()` - Exact positioning formulas used by both variants
 * - `AbacusStaticBead` - RSC-compatible simple SVG shapes (this component)
 * - `AbacusAnimatedBead` - Client component with animations (AbacusReact)
 *
 * ## Visual Consistency Guarantee:
 * Both AbacusStatic and AbacusReact produce **pixel-perfect identical output** for the same props.
 * This ensures previews match interactive versions, PDFs match web displays, etc.
 *
 * **Architecture benefit:** ~560 lines of duplicate code eliminated. Same props = same dimensions = same positions = same layout.
 *
 * ## When to Use:
 * - React Server Components (Next.js App Router)
 * - Static site generation
 * - Non-interactive previews
 * - PDF generation
 * - Server-side rendering without hydration
 */
const meta = {
  title: "AbacusStatic/Server Component Ready",
  component: AbacusStatic,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AbacusStatic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 123,
    columns: "auto",
  },
};

export const DifferentValues: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
      {[1, 5, 10, 25, 50, 100, 456, 789].map((value) => (
        <div key={value} style={{ textAlign: "center" }}>
          <AbacusStatic value={value} columns="auto" />
          <p style={{ marginTop: "10px", color: "#64748b" }}>{value}</p>
        </div>
      ))}
    </div>
  ),
};

export const ColorSchemes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={456} colorScheme="place-value" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Place Value</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={456} colorScheme="monochrome" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Monochrome</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={456} colorScheme="heaven-earth" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Heaven-Earth</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={456} colorScheme="alternating" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Alternating</p>
      </div>
    </div>
  ),
};

export const BeadShapes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={42} beadShape="circle" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Circle</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={42} beadShape="diamond" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Diamond</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={42} beadShape="square" />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Square</p>
      </div>
    </div>
  ),
};

export const CompactMode: Story = {
  render: () => (
    <div
      style={{
        fontSize: "24px",
        display: "flex",
        alignItems: "center",
        gap: "15px",
      }}
    >
      <span>The equation:</span>
      <AbacusStatic
        value={5}
        columns={1}
        compact
        hideInactiveBeads
        scaleFactor={0.7}
      />
      <span>+</span>
      <AbacusStatic
        value={3}
        columns={1}
        compact
        hideInactiveBeads
        scaleFactor={0.7}
      />
      <span>=</span>
      <AbacusStatic
        value={8}
        columns={1}
        compact
        hideInactiveBeads
        scaleFactor={0.7}
      />
    </div>
  ),
};

export const HideInactiveBeads: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={25} hideInactiveBeads={false} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Show All</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={25} hideInactiveBeads />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Hide Inactive</p>
      </div>
    </div>
  ),
};

export const WithThemes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={123} customStyles={ABACUS_THEMES.light} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Light</p>
      </div>
      <div
        style={{
          textAlign: "center",
          padding: "20px",
          background: "#1e293b",
          borderRadius: "8px",
        }}
      >
        <AbacusStatic value={123} customStyles={ABACUS_THEMES.dark} />
        <p style={{ marginTop: "10px", color: "#cbd5e1" }}>Dark</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={123} customStyles={ABACUS_THEMES.trophy} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>Trophy</p>
      </div>
    </div>
  ),
};

export const ColumnHighlightingAndLabels: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic
          value={456}
          highlightColumns={[1]}
          columnLabels={["ones", "tens", "hundreds"]}
        />
        <p style={{ marginTop: "10px", color: "#64748b" }}>
          Highlighting tens place
        </p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic
          value={789}
          highlightColumns={[0, 2]}
          columnLabels={["ones", "tens", "hundreds"]}
        />
        <p style={{ marginTop: "10px", color: "#64748b" }}>
          Multiple highlights
        </p>
      </div>
    </div>
  ),
};

export const Scaling: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "40px", alignItems: "flex-end" }}>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={9} scaleFactor={0.5} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>0.5x</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={9} scaleFactor={1} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>1x</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <AbacusStatic value={9} scaleFactor={1.5} />
        <p style={{ marginTop: "10px", color: "#64748b" }}>1.5x</p>
      </div>
    </div>
  ),
};

export const ServerComponentExample: Story = {
  render: () => (
    <div
      style={{
        maxWidth: "700px",
        padding: "20px",
        background: "#f8fafc",
        borderRadius: "8px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>React Server Component Usage</h3>
      <pre
        style={{
          background: "#1e293b",
          color: "#e2e8f0",
          padding: "15px",
          borderRadius: "6px",
          overflow: "auto",
          fontSize: "13px",
        }}
      >
        {`// app/flashcards/page.tsx (Server Component)
import { AbacusStatic } from '@soroban/abacus-react'

export default function FlashcardsPage() {
  const numbers = [1, 5, 10, 25, 50, 100]

  return (
    <div className="grid grid-cols-3 gap-4">
      {numbers.map(num => (
        <div key={num} className="card">
          <AbacusStatic
            value={num}
            columns="auto"
            hideInactiveBeads
            compact
          />
          <p>{num}</p>
        </div>
      ))}
    </div>
  )
}

// ✅ No "use client" needed!
// ✅ Rendered on server
// ✅ Zero client JavaScript`}
      </pre>
    </div>
  ),
};

export const PreviewCards: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "20px",
        maxWidth: "900px",
      }}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50].map((value) => (
        <div
          key={value}
          style={{
            padding: "15px",
            background: "white",
            border: "2px solid #e2e8f0",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AbacusStatic
            value={value}
            columns="auto"
            scaleFactor={0.8}
            hideInactiveBeads
          />
          <span
            style={{ fontSize: "18px", fontWeight: "bold", color: "#475569" }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  ),
};
