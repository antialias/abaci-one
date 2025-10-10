import type { Meta, StoryObj } from "@storybook/react";
import { AbacusReact } from "./AbacusReact";
import React, { useState, useMemo } from "react";

const meta: Meta<typeof AbacusReact> = {
  title: "Soroban/Column Customization",
  component: AbacusReact,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
# Column Customization Guide

The AbacusReact component provides comprehensive column-level customization through the \`customStyles.columns\` API. This allows you to style specific columns individually for educational highlights, visual emphasis, and interactive feedback.

## Column Styling Structure

\`\`\`typescript
customStyles: {
  columns: {
    [columnIndex: number]: {
      heavenBeads?: BeadStyle;     // Style heaven beads in this column
      earthBeads?: BeadStyle;      // Style earth beads in this column
      activeBeads?: BeadStyle;     // Style active beads in this column
      inactiveBeads?: BeadStyle;   // Style inactive beads in this column
      columnPost?: ColumnPostStyle; // Style the rod/post of this column
      numerals?: NumeralStyle;     // Style the numbers below this column
      numeralContainer?: NumeralStyle; // Style the number container
    }
  }
}
\`\`\`

## Use Cases

- **Educational highlighting** - Emphasize specific place values during lessons
- **Interactive feedback** - Show which columns are being manipulated
- **Visual hierarchy** - Make important columns stand out
- **Assessment tools** - Highlight correct/incorrect answers
- **Progressive disclosure** - Reveal columns step by step
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Column Highlighting
export const BasicColumnHighlighting: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Basic Column Highlighting
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "400px",
          margin: "0 auto 20px",
        }}
      >
        Individual columns can be highlighted with background colors and
        enhanced rod styling.
      </p>

      <AbacusReact
        value={1234}
        columns={4}
        scaleFactor={1.3}
        showNumbers={true}
        customStyles={{
          columns: {
            // Highlight the tens column (index 2)
            2: {
              columnPost: {
                stroke: "#3b82f6", // Blue stroke
                strokeWidth: 4, // Thicker rod
                opacity: 1,
              },
            },
          },
        }}
      />

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        The tens column (3rd from left) is highlighted with a blue rod
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
The most basic form of column highlighting uses \`columnPost\` styling to make the column rod (vertical bar) more prominent. This creates a subtle but clear visual emphasis without interfering with bead colors.

\`\`\`typescript
customStyles: {
  columns: {
    2: { // Tens column
      columnPost: {
        stroke: '#3b82f6',  // Blue color
        strokeWidth: 4,      // Thicker than default
        opacity: 1
      }
    }
  }
}
\`\`\`
        `,
      },
    },
  },
};

// Multiple Column Highlights
export const MultipleColumnHighlights: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Multiple Column Highlights
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "400px",
          margin: "0 auto 20px",
        }}
      >
        Different columns can have different highlight styles for complex
        educational scenarios.
      </p>

      <AbacusReact
        value={56789}
        columns={5}
        scaleFactor={1.2}
        showNumbers={true}
        customStyles={{
          columns: {
            // Thousands column - Red highlight
            0: {
              columnPost: {
                stroke: "#ef4444",
                strokeWidth: 4,
                opacity: 1,
              },
            },
            // Hundreds column - Orange highlight
            1: {
              columnPost: {
                stroke: "#f97316",
                strokeWidth: 4,
                opacity: 1,
              },
            },
            // Ones column - Green highlight
            4: {
              columnPost: {
                stroke: "#22c55e",
                strokeWidth: 4,
                opacity: 1,
              },
            },
          },
        }}
      />

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        Thousands (red), hundreds (orange), and ones (green) columns highlighted
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Multiple columns can be highlighted simultaneously with different colors and styles. This is useful for:

- **Place value lessons** - Highlighting specific place values being taught
- **Math operations** - Showing which columns are involved in addition/subtraction
- **Interactive feedback** - Different colors for different states (correct/incorrect/active)

\`\`\`typescript
customStyles: {
  columns: {
    0: { columnPost: { stroke: '#ef4444', strokeWidth: 4 } }, // Red
    1: { columnPost: { stroke: '#f97316', strokeWidth: 4 } }, // Orange
    4: { columnPost: { stroke: '#22c55e', strokeWidth: 4 } }  // Green
  }
}
\`\`\`
        `,
      },
    },
  },
};

// Column Bead Styling
export const ColumnBeadStyling: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Column-Level Bead Styling
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "400px",
          margin: "0 auto 20px",
        }}
      >
        All beads within a column can be styled together while maintaining the
        column's visual coherence.
      </p>

      <AbacusReact
        value={3579}
        columns={4}
        scaleFactor={1.3}
        showNumbers={true}
        customStyles={{
          columns: {
            // Thousands column - Purple theme
            0: {
              heavenBeads: {
                fill: "#a855f7",
                stroke: "#7c3aed",
                strokeWidth: 2,
              },
              earthBeads: {
                fill: "#c084fc",
                stroke: "#7c3aed",
                strokeWidth: 2,
              },
              columnPost: { stroke: "#7c3aed", strokeWidth: 3 },
            },
            // Tens column - Teal theme
            2: {
              heavenBeads: {
                fill: "#14b8a6",
                stroke: "#0d9488",
                strokeWidth: 2,
              },
              earthBeads: {
                fill: "#5eead4",
                stroke: "#0d9488",
                strokeWidth: 2,
              },
              columnPost: { stroke: "#0d9488", strokeWidth: 3 },
            },
            // Ones column - Pink theme
            3: {
              heavenBeads: {
                fill: "#ec4899",
                stroke: "#be185d",
                strokeWidth: 2,
              },
              earthBeads: {
                fill: "#f9a8d4",
                stroke: "#be185d",
                strokeWidth: 2,
              },
              columnPost: { stroke: "#be185d", strokeWidth: 3 },
            },
          },
        }}
      />

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        Thousands (purple), tens (teal), and ones (pink) columns with
        coordinated bead colors
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Column-level bead styling allows you to create cohesive visual themes for specific columns. This approach styles all beads within a column while maintaining visual harmony.

**Benefits:**
- Creates clear visual groupings by place value
- Maintains color coordination within each column
- Easier than styling individual beads
- Perfect for educational emphasis

\`\`\`typescript
customStyles: {
  columns: {
    0: { // Thousands column
      heavenBeads: { fill: '#a855f7', stroke: '#7c3aed', strokeWidth: 2 },
      earthBeads: { fill: '#c084fc', stroke: '#7c3aed', strokeWidth: 2 },
      columnPost: { stroke: '#7c3aed', strokeWidth: 3 }
    }
  }
}
\`\`\`
        `,
      },
    },
  },
};

// Active/Inactive Column States
export const ActiveInactiveColumnStates: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Active vs Inactive Column States
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "400px",
          margin: "0 auto 20px",
        }}
      >
        Different styling for active and inactive beads within specific columns
        for enhanced visual feedback.
      </p>

      <AbacusReact
        value={4062}
        columns={4}
        scaleFactor={1.3}
        showNumbers={true}
        customStyles={{
          columns: {
            // Hundreds column - Enhanced active/inactive distinction
            1: {
              activeBeads: {
                fill: "#10b981",
                stroke: "#047857",
                strokeWidth: 3,
                opacity: 1.0,
              },
              inactiveBeads: {
                fill: "#d1fae5",
                stroke: "#6ee7b7",
                strokeWidth: 1,
                opacity: 0.6,
              },
              columnPost: { stroke: "#047857", strokeWidth: 4 },
            },
            // Ones column - Different active/inactive styling
            3: {
              activeBeads: {
                fill: "#f59e0b",
                stroke: "#d97706",
                strokeWidth: 3,
                opacity: 1.0,
              },
              inactiveBeads: {
                fill: "#fef3c7",
                stroke: "#fbbf24",
                strokeWidth: 1,
                opacity: 0.4,
              },
              columnPost: { stroke: "#d97706", strokeWidth: 4 },
            },
          },
        }}
      />

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        Hundreds (green) and ones (amber) columns with enhanced active/inactive
        bead distinction
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Column-level active/inactive styling provides enhanced visual feedback for specific columns. This is particularly useful for:

- **Interactive tutorials** - Showing which columns can be manipulated
- **Step-by-step lessons** - Highlighting the active column in multi-step problems
- **Assessment feedback** - Different states for correct/incorrect columns

\`\`\`typescript
customStyles: {
  columns: {
    1: { // Hundreds column
      activeBeads: {
        fill: '#10b981',
        stroke: '#047857',
        strokeWidth: 3,
        opacity: 1.0
      },
      inactiveBeads: {
        fill: '#d1fae5',
        stroke: '#6ee7b7',
        strokeWidth: 1,
        opacity: 0.6
      }
    }
  }
}
\`\`\`
        `,
      },
    },
  },
};

// Column Number Styling
export const ColumnNumberStyling: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Column Number Customization
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "400px",
          margin: "0 auto 20px",
        }}
      >
        Customize the appearance of place value numbers below specific columns.
      </p>

      <AbacusReact
        value={8147}
        columns={4}
        scaleFactor={1.3}
        showNumbers={true}
        customStyles={{
          columns: {
            // Thousands column - Red numbers
            0: {
              numerals: {
                color: "#dc2626",
                fontWeight: "bold",
                fontSize: "16px",
                backgroundColor: "#fee2e2",
                borderRadius: 4,
                borderColor: "#fca5a5",
                borderWidth: 2,
              },
              columnPost: { stroke: "#dc2626", strokeWidth: 3 },
            },
            // Hundreds column - Blue numbers
            1: {
              numerals: {
                color: "#2563eb",
                fontWeight: "bold",
                fontSize: "16px",
                backgroundColor: "#dbeafe",
                borderRadius: 4,
                borderColor: "#93c5fd",
                borderWidth: 2,
              },
              columnPost: { stroke: "#2563eb", strokeWidth: 3 },
            },
            // Tens column - Green numbers
            2: {
              numerals: {
                color: "#16a34a",
                fontWeight: "bold",
                fontSize: "16px",
                backgroundColor: "#dcfce7",
                borderRadius: 4,
                borderColor: "#86efac",
                borderWidth: 2,
              },
              columnPost: { stroke: "#16a34a", strokeWidth: 3 },
            },
            // Ones column - Purple numbers
            3: {
              numerals: {
                color: "#9333ea",
                fontWeight: "bold",
                fontSize: "16px",
                backgroundColor: "#f3e8ff",
                borderRadius: 4,
                borderColor: "#c4b5fd",
                borderWidth: 2,
              },
              columnPost: { stroke: "#9333ea", strokeWidth: 3 },
            },
          },
        }}
      />

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
        Each column has coordinated number styling with colored backgrounds and
        borders
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Column-specific number styling helps reinforce place value concepts through coordinated visual design. Numbers can have:

- **Custom colors** that match column themes
- **Background colors** for enhanced visibility
- **Borders and shapes** to create containers
- **Typography** adjustments for emphasis

\`\`\`typescript
customStyles: {
  columns: {
    0: { // Thousands
      numerals: {
        color: '#dc2626',
        fontWeight: 'bold',
        fontSize: '16px',
        backgroundColor: '#fee2e2',
        borderRadius: 4,
        borderColor: '#fca5a5',
        borderWidth: 2
      }
    }
  }
}
\`\`\`
        `,
      },
    },
  },
};

// Interactive Column Highlighting
export const InteractiveColumnHighlighting: Story = {
  render: () => {
    const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
    const [clickedColumns, setClickedColumns] = useState<Set<number>>(
      new Set(),
    );

    const handleColumnClick = (
      columnIndex: number,
      event: React.MouseEvent,
    ) => {
      event.preventDefault();
      setClickedColumns((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(columnIndex)) {
          newSet.delete(columnIndex);
        } else {
          newSet.add(columnIndex);
        }
        return newSet;
      });
    };

    const handleColumnHover = (
      columnIndex: number,
      event: React.MouseEvent,
    ) => {
      setHoveredColumn(columnIndex);
    };

    const handleColumnLeave = (
      columnIndex: number,
      event: React.MouseEvent,
    ) => {
      setHoveredColumn(null);
    };

    // Generate dynamic styles based on interaction state
    const customStyles = {
      columns: Object.fromEntries(
        [0, 1, 2, 3].map((colIndex) => {
          const isClicked = clickedColumns.has(colIndex);
          const isHovered = hoveredColumn === colIndex;

          if (isClicked) {
            return [
              colIndex,
              {
                columnPost: { stroke: "#ef4444", strokeWidth: 5, opacity: 1 },
                heavenBeads: { stroke: "#ef4444", strokeWidth: 3 },
                earthBeads: { stroke: "#ef4444", strokeWidth: 3 },
              },
            ];
          } else if (isHovered) {
            return [
              colIndex,
              {
                columnPost: { stroke: "#3b82f6", strokeWidth: 4, opacity: 1 },
                heavenBeads: { stroke: "#3b82f6", strokeWidth: 2 },
                earthBeads: { stroke: "#3b82f6", strokeWidth: 2 },
              },
            ];
          }

          // Always provide some styling to make columns interactive
          return [
            colIndex,
            {
              columnPost: { stroke: "transparent", strokeWidth: 3, opacity: 1 },
            },
          ];
        }),
      ),
    };

    return (
      <div style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
          Interactive Column Highlighting
        </h3>
        <p
          style={{
            marginBottom: "20px",
            color: "#666",
            maxWidth: "400px",
            margin: "0 auto 20px",
          }}
        >
          Hover over columns to see highlights. Click to toggle persistent
          selection.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <AbacusReact
            value={9876}
            columns={4}
            scaleFactor={1.3}
            showNumbers={true}
            interactive={false} // Disable bead interaction to focus on column interaction
            customStyles={customStyles}
            callbacks={{
              onColumnClick: handleColumnClick,
              onColumnHover: handleColumnHover,
              onColumnLeave: handleColumnLeave,
            }}
          />
        </div>

        <div style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
          <strong>Interaction States:</strong>
          <br />• <span style={{ color: "#3b82f6" }}>Blue</span> = Hovered
          <br />• <span style={{ color: "#ef4444" }}>Red</span> =
          Clicked/Selected
          <br />• Gray = Default
        </div>

        <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
          Hovered column: {hoveredColumn !== null ? hoveredColumn : "None"}
        </div>

        <div style={{ fontSize: "12px", color: "#888" }}>
          Selected columns:{" "}
          {Array.from(clickedColumns).length > 0
            ? Array.from(clickedColumns).join(", ")
            : "None"}
        </div>

        <button
          onClick={() => setClickedColumns(new Set())}
          style={{
            marginTop: "15px",
            padding: "8px 16px",
            background: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Clear Selection
        </button>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f0f9ff",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#0c4a6e",
            textAlign: "left",
          }}
        >
          <strong>SVG Hover Support:</strong> Now includes proper hover events
          via <code>onColumnHover</code> and <code>onColumnLeave</code>{" "}
          callbacks. Each column has an invisible interaction area that responds
          to mouse events.
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
Interactive column highlighting demonstrates dynamic styling based on user interaction. This pattern is essential for:

- **Educational interfaces** - Showing which columns are being manipulated
- **Interactive tutorials** - Providing visual feedback during lessons
- **Assessment tools** - Highlighting correct/incorrect responses
- **Multi-step problems** - Showing progression through place values

**SVG-Based Implementation:**

Since AbacusReact renders as SVG, column interactions work through invisible SVG rect elements:

1. Each column has a transparent interaction area (rect element)
2. Click events are handled via the \`onColumnClick\` callback
3. Styles are applied through \`customStyles.columns\` API
4. Columns need at least minimal styling to render interaction areas

\`\`\`typescript
const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

const customStyles = {
  columns: Object.fromEntries([0, 1, 2, 3].map(colIndex => {
    const isSelected = selectedColumns.has(colIndex);
    return [colIndex, {
      // Always provide columnPost styling to enable interaction area
      columnPost: {
        stroke: isSelected ? '#ef4444' : 'transparent',
        strokeWidth: 4
      }
    }];
  }))
};

<AbacusReact
  customStyles={customStyles}
  callbacks={{
    onColumnClick: (columnIndex, event) => {
      // Handle SVG-based column click
      setSelectedColumns(prev => {
        const newSet = new Set(prev);
        newSet.has(columnIndex) ? newSet.delete(columnIndex) : newSet.add(columnIndex);
        return newSet;
      });
    }
  }}
/>
\`\`\`

**Key Points:**
- Columns must have \`columnPost\` styling to render interaction areas
- Use \`stroke: 'transparent'\` for invisible but interactive columns
- \`onColumnClick\`, \`onColumnHover\`, and \`onColumnLeave\` provide columnIndex and React.MouseEvent
- Hover events work seamlessly with SVG elements
- Works independently of bead interactions
        `,
      },
    },
  },
};

// Educational Use Case
export const EducationalUseCase: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
      {
        title: "Step 1: Identify the Hundreds",
        description: "Find the hundreds column (3rd from right)",
        highlightColumn: 1,
        styles: {
          1: {
            columnPost: { stroke: "#10b981", strokeWidth: 5, opacity: 1 },
            heavenBeads: { stroke: "#10b981", strokeWidth: 3 },
            earthBeads: { stroke: "#10b981", strokeWidth: 3 },
            numerals: {
              color: "#065f46",
              fontWeight: "bold",
              backgroundColor: "#d1fae5",
              borderRadius: 4,
            },
          },
        },
      },
      {
        title: "Step 2: Identify the Tens",
        description: "Find the tens column (2nd from right)",
        highlightColumn: 2,
        styles: {
          2: {
            columnPost: { stroke: "#3b82f6", strokeWidth: 5, opacity: 1 },
            heavenBeads: { stroke: "#3b82f6", strokeWidth: 3 },
            earthBeads: { stroke: "#3b82f6", strokeWidth: 3 },
            numerals: {
              color: "#1d4ed8",
              fontWeight: "bold",
              backgroundColor: "#dbeafe",
              borderRadius: 4,
            },
          },
        },
      },
      {
        title: "Step 3: Identify the Ones",
        description: "Find the ones column (rightmost)",
        highlightColumn: 3,
        styles: {
          3: {
            columnPost: { stroke: "#dc2626", strokeWidth: 5, opacity: 1 },
            heavenBeads: { stroke: "#dc2626", strokeWidth: 3 },
            earthBeads: { stroke: "#dc2626", strokeWidth: 3 },
            numerals: {
              color: "#991b1b",
              fontWeight: "bold",
              backgroundColor: "#fee2e2",
              borderRadius: 4,
            },
          },
        },
      },
      {
        title: "Step 4: All Place Values",
        description: "See all place values highlighted together",
        highlightColumn: null,
        styles: {
          1: {
            columnPost: { stroke: "#10b981", strokeWidth: 3 },
            numerals: { color: "#065f46", fontWeight: "bold" },
          },
          2: {
            columnPost: { stroke: "#3b82f6", strokeWidth: 3 },
            numerals: { color: "#1d4ed8", fontWeight: "bold" },
          },
          3: {
            columnPost: { stroke: "#dc2626", strokeWidth: 3 },
            numerals: { color: "#991b1b", fontWeight: "bold" },
          },
        },
      },
    ];

    const currentStepData = steps[currentStep];

    return (
      <div style={{ textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
          Educational Tutorial: Place Values
        </h3>

        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #e9ecef",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", color: "#495057" }}>
            {currentStepData.title}
          </h4>
          <p style={{ margin: 0, color: "#6c757d", fontSize: "14px" }}>
            {currentStepData.description}
          </p>
        </div>

        <AbacusReact
          value={6247}
          columns={4}
          scaleFactor={1.4}
          showNumbers={true}
          customStyles={{ columns: currentStepData.styles }}
        />

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            gap: "10px",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            style={{
              padding: "8px 16px",
              background: currentStep === 0 ? "#e5e7eb" : "#6b7280",
              color: currentStep === 0 ? "#9ca3af" : "white",
              border: "none",
              borderRadius: "4px",
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
            }}
          >
            Previous
          </button>
          <span
            style={{
              padding: "8px 16px",
              background: "#f3f4f6",
              borderRadius: "4px",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={() =>
              setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
            }
            disabled={currentStep === steps.length - 1}
            style={{
              padding: "8px 16px",
              background:
                currentStep === steps.length - 1 ? "#e5e7eb" : "#3b82f6",
              color: currentStep === steps.length - 1 ? "#9ca3af" : "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                currentStep === steps.length - 1 ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>

        <div
          style={{
            marginTop: "20px",
            fontSize: "12px",
            color: "#6c757d",
            textAlign: "left",
          }}
        >
          <strong>Teaching Benefits:</strong>
          <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>Progressive disclosure of concepts</li>
            <li>Clear visual focus on current topic</li>
            <li>Coordinated colors for place value memory</li>
            <li>Interactive step-by-step learning</li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
This educational example demonstrates how column customization can create effective learning experiences:

**Educational Design Patterns:**
- **Progressive Disclosure** - Reveal one concept at a time
- **Visual Hierarchy** - Use color and emphasis to guide attention
- **Consistent Associations** - Same colors for same concepts
- **Interactive Pacing** - User controls lesson progression

**Implementation Strategy:**
1. Define learning steps with associated column styles
2. Use state management to track current step
3. Apply conditional styling based on learning objective
4. Provide navigation controls for student pacing

This pattern works for many educational scenarios:
- Place value identification
- Addition/subtraction algorithms
- Carrying and borrowing concepts
- Assessment and practice exercises
        `,
      },
    },
  },
};

// Performance and Best Practices
export const PerformanceAndBestPractices: Story = {
  render: () => (
    <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Performance & Best Practices
      </h3>

      <div style={{ textAlign: "left", fontSize: "14px", lineHeight: "1.6" }}>
        <div
          style={{
            backgroundColor: "#f0f9ff",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            borderLeft: "4px solid #0ea5e9",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#0c4a6e" }}>
            ✅ Best Practices
          </h4>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>
              <strong>Memoize styles:</strong> Use \`useMemo\` for dynamic style
              generation
            </li>
            <li>
              <strong>Minimize re-renders:</strong> Only update styles when
              interaction state changes
            </li>
            <li>
              <strong>Use column post highlighting:</strong> Less visually
              intrusive than bead colors
            </li>
            <li>
              <strong>Coordinate colors:</strong> Maintain visual harmony across
              columns
            </li>
            <li>
              <strong>Progressive disclosure:</strong> Show one concept at a
              time
            </li>
          </ul>
        </div>

        <div
          style={{
            backgroundColor: "#fef2f2",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            borderLeft: "4px solid #ef4444",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#991b1b" }}>
            ❌ Common Pitfalls
          </h4>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>
              <strong>Overusing bead colors:</strong> Can conflict with existing
              decorations
            </li>
            <li>
              <strong>Too many highlights:</strong> Overwhelming and confusing
            </li>
            <li>
              <strong>Inconsistent styling:</strong> Different patterns for
              similar concepts
            </li>
            <li>
              <strong>Heavy re-rendering:</strong> Not memoizing expensive style
              calculations
            </li>
            <li>
              <strong>Poor contrast:</strong> Highlights that don't stand out
            </li>
          </ul>
        </div>

        <div
          style={{
            backgroundColor: "#f0fdf4",
            padding: "15px",
            borderRadius: "8px",
            borderLeft: "4px solid #22c55e",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#166534" }}>
            💡 Pro Tips
          </h4>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>
              <strong>Layer styling:</strong> Combine column posts, backgrounds,
              and numbers
            </li>
            <li>
              <strong>Use semantic colors:</strong> Green for correct, red for
              errors, blue for active
            </li>
            <li>
              <strong>Add transitions:</strong> Smooth changes between states
            </li>
            <li>
              <strong>Consider accessibility:</strong> Ensure sufficient color
              contrast
            </li>
            <li>
              <strong>Test interactions:</strong> Verify hover and click
              behaviors work correctly
            </li>
          </ul>
        </div>
      </div>

      <AbacusReact
        value={1337}
        columns={4}
        scaleFactor={1.2}
        showNumbers={true}
        customStyles={{
          columns: {
            // Example of well-coordinated column styling
            1: {
              columnPost: { stroke: "#059669", strokeWidth: 3, opacity: 1 },
              numerals: { color: "#065f46", fontWeight: "bold" },
            },
          },
        }}
      />

      <p
        style={{
          marginTop: "15px",
          fontSize: "12px",
          color: "#666",
          fontStyle: "italic",
        }}
      >
        Example of clean, accessible column highlighting following best
        practices
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
## Performance Optimization

\`\`\`typescript
// ✅ Good: Memoized style generation
const customStyles = useMemo(() => ({
  columns: {
    [activeColumn]: {
      columnPost: { stroke: '#3b82f6', strokeWidth: 4 }
    }
  }
}), [activeColumn]);

// ❌ Avoid: Recreating styles on every render
const customStyles = {
  columns: {
    [activeColumn]: {
      columnPost: { stroke: '#3b82f6', strokeWidth: 4 }
    }
  }
};
\`\`\`

## Styling Hierarchy

Column styles follow CSS-like specificity:
1. **Individual bead overrides** (highest priority)
2. **Column-specific styles**
3. **Global bead type styles**
4. **Default styles** (lowest priority)

## Accessibility Considerations

- Ensure color contrast ratios meet WCAG guidelines
- Don't rely solely on color for important information
- Provide alternative indicators (thickness, patterns)
- Test with colorblind simulation tools
        `,
      },
    },
  },
};

// Interactive Debug Story
export const InteractiveWithHighlighting: Story = {
  render: () => {
    const [value, setValue] = useState(1234);
    const [highlightedColumn, setHighlightedColumn] = useState<number | null>(
      null,
    );

    const customStyles = useMemo(() => {
      if (highlightedColumn === null) return undefined;

      return {
        columns: {
          [highlightedColumn]: {
            // Clean background glow effect
            backgroundGlow: {
              fill: "rgba(59, 130, 246, 0.25)",
              blur: 4,
              spread: 16,
            },
            // Subtle numeral highlighting
            numerals: {
              color: "#1e40af",
              backgroundColor: "rgba(219, 234, 254, 0.9)",
              fontWeight: "bold",
              borderRadius: 6,
              borderWidth: 2,
              borderColor: "#3b82f6",
            },
          },
        },
      };
    }, [highlightedColumn]);

    return (
      <div style={{ padding: "20px" }}>
        <h3>Interactive Abacus with Column Highlighting</h3>
        <p>Test both bead interaction AND column highlighting</p>

        <div style={{ marginBottom: "20px" }}>
          <strong>Current Value: {value}</strong>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label>Highlight Column: </label>
          <select
            value={highlightedColumn ?? ""}
            onChange={(e) =>
              setHighlightedColumn(
                e.target.value ? parseInt(e.target.value) : null,
              )
            }
          >
            <option value="">None</option>
            <option value="0">Column 0 (Ten Thousands)</option>
            <option value="1">Column 1 (Thousands)</option>
            <option value="2">Column 2 (Hundreds)</option>
            <option value="3">Column 3 (Tens)</option>
            <option value="4">Column 4 (Ones)</option>
          </select>
        </div>

        <AbacusReact
          value={value}
          columns={5}
          interactive={true}
          animated={true}
          scaleFactor={2}
          customStyles={customStyles}
          onValueChange={setValue}
          callbacks={{
            onBeadClick: (event) => {
              console.log("Bead clicked:", event);
            },
          }}
        />

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <h4>Test Instructions:</h4>
          <ol>
            <li>Try clicking beads to change the value</li>
            <li>Try selecting different columns to highlight</li>
            <li>Verify both interactions work simultaneously</li>
          </ol>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
This story tests the combination of:
- Interactive bead manipulation
- Column highlighting effects
- Value changes and callbacks

Use this to debug any conflicts between styling and interaction.
        `,
      },
    },
  },
};

// Two-Level Highlighting Demo
export const TwoLevelHighlighting: Story = {
  render: () => {
    const [groupColumns, setGroupColumns] = useState<Set<number>>(
      new Set([1, 2]),
    );
    const [individualColumn, setIndividualColumn] = useState<number | null>(2);

    const customStyles = useMemo(() => {
      const highlights: Record<number, any> = {};

      // Level 1: Group highlights (blue glow)
      groupColumns.forEach((columnIndex) => {
        highlights[columnIndex] = {
          backgroundGlow: {
            fill: "rgba(59, 130, 246, 0.2)",
            blur: 4,
            spread: 16,
          },
          numerals: {
            color: "#1e40af",
            backgroundColor: "rgba(219, 234, 254, 0.8)",
            fontWeight: "bold",
            borderRadius: 4,
            borderWidth: 1,
            borderColor: "#3b82f6",
          },
        };
      });

      // Level 2: Individual highlight (orange glow, overrides group)
      if (individualColumn !== null) {
        highlights[individualColumn] = {
          backgroundGlow: {
            fill: "rgba(249, 115, 22, 0.3)",
            blur: 6,
            spread: 20,
          },
          numerals: {
            color: "#c2410c",
            backgroundColor: "rgba(254, 215, 170, 0.9)",
            fontWeight: "bold",
            borderRadius: 6,
            borderWidth: 2,
            borderColor: "#ea580c",
          },
        };
      }

      return Object.keys(highlights).length > 0
        ? { columns: highlights }
        : undefined;
    }, [groupColumns, individualColumn]);

    return (
      <div style={{ padding: "20px" }}>
        <h3>Two-Level Column Highlighting</h3>
        <p>
          Demonstrates group highlighting (blue) with individual term override
          (orange)
        </p>

        <div style={{ marginBottom: "20px" }}>
          <h4>Controls:</h4>
          <div style={{ marginBottom: "10px" }}>
            <label>
              <strong>Group Columns (blue):</strong>
              {[0, 1, 2, 3, 4].map((col) => (
                <label key={col} style={{ marginLeft: "10px" }}>
                  <input
                    type="checkbox"
                    checked={groupColumns.has(col)}
                    onChange={(e) => {
                      const newGroup = new Set(groupColumns);
                      if (e.target.checked) {
                        newGroup.add(col);
                      } else {
                        newGroup.delete(col);
                      }
                      setGroupColumns(newGroup);
                    }}
                  />
                  {col}
                </label>
              ))}
            </label>
          </div>
          <div>
            <label>
              <strong>Individual Column (orange):</strong>
              <select
                value={individualColumn ?? ""}
                onChange={(e) =>
                  setIndividualColumn(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                style={{ marginLeft: "10px" }}
              >
                <option value="">None</option>
                {[0, 1, 2, 3, 4].map((col) => (
                  <option key={col} value={col}>
                    Column {col}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <AbacusReact
          value={12340}
          columns={5}
          interactive={true}
          animated={true}
          scaleFactor={2}
          customStyles={customStyles}
        />

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <h4>Two-Level Highlighting System:</h4>
          <ul>
            <li>
              <strong>Blue glow:</strong> Group-level highlighting (e.g.,
              complement group like "100 - 90 - 9")
            </li>
            <li>
              <strong>Orange glow:</strong> Individual term highlighting
              (overrides group styling)
            </li>
            <li>
              <strong>Use case:</strong> When hovering over "90" in "100 - 90 -
              9", show orange for tens column and blue for hundreds column
            </li>
          </ul>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
This demonstrates the two-level highlighting system for term groups:

**Group Level (Blue):** All terms in a complement group (e.g., "100 - 90 - 9")
**Individual Level (Orange):** The specific term being hovered (overrides group styling)

The system allows users to see both the overall group context and the specific term effect simultaneously.
        `,
      },
    },
  },
};

// Invisible Column Posts
export const InvisibleColumnPosts: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Invisible Column Posts
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "500px",
          margin: "0 auto 20px",
        }}
      >
        Column posts can be made completely invisible using{" "}
        <code>opacity: 0</code>, creating a floating bead effect ideal for
        inline displays.
      </p>

      <div
        style={{
          display: "flex",
          gap: "40px",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Default visible posts */}
        <div>
          <div
            style={{
              marginBottom: "10px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#6b7280",
            }}
          >
            Default (Visible Posts)
          </div>
          <AbacusReact
            value={7}
            columns={1}
            scaleFactor={1.5}
            showNumbers={true}
          />
        </div>

        {/* Invisible posts */}
        <div>
          <div
            style={{
              marginBottom: "10px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#6b7280",
            }}
          >
            Invisible Posts
          </div>
          <AbacusReact
            value={7}
            columns={1}
            scaleFactor={1.5}
            showNumbers={true}
            customStyles={{
              columnPosts: { opacity: 0 },
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        Notice how the beads appear to float when the column post is invisible
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Makes column posts completely invisible using the \`columnPosts\` customStyles property. This creates a clean, minimal display where only the beads are visible.

**Use Cases:**
- Inline equation displays (like complement race game)
- Minimalist UI designs
- Focus on bead patterns without structural elements
- Embedded abacus representations

\`\`\`typescript
customStyles={{
  columnPosts: { opacity: 0 }
}}
\`\`\`
        `,
      },
    },
  },
};

// Single Column Inline
export const SingleColumnInline: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Single Column for Inline Equations
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "600px",
          margin: "0 auto 20px",
        }}
      >
        Demonstrates single-column abacus with invisible posts and no numbers,
        perfect for embedding in complement equations.
      </p>

      {/* Example equation like in complement race */}
      <div
        style={{
          fontSize: "72px",
          fontWeight: "bold",
          color: "#1f2937",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          justifyContent: "center",
          marginBottom: "30px",
        }}
      >
        <span
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "white",
            padding: "8px 24px",
            borderRadius: "12px",
            minWidth: "100px",
            display: "inline-block",
            textShadow: "0 3px 10px rgba(0, 0, 0, 0.3)",
          }}
        >
          ?
        </span>
        <span style={{ color: "#6b7280" }}>+</span>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
          }}
        >
          <AbacusReact
            value={3}
            columns={1}
            interactive={false}
            showNumbers={false}
            scaleFactor={0.72}
            customStyles={{
              columnPosts: { opacity: 0 },
            }}
          />
        </div>
        <span style={{ color: "#6b7280" }}>=</span>
        <span style={{ color: "#10b981" }}>10</span>
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        The abacus integrates seamlessly into the equation with no visible
        structure
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
This pattern is used in the complement race game to display abacus representations inline with equations. Key features:

- **Single column** for individual digit display
- **Invisible posts** (\`opacity: 0\`)
- **No numbers** (\`showNumbers: false\`)
- **Small scale** (\`scaleFactor: 0.72\`)
- **Inline-flex container** for proper vertical alignment

\`\`\`typescript
<div style={{
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0
}}>
  <AbacusReact
    value={3}
    columns={1}
    interactive={false}
    showNumbers={false}
    scaleFactor={0.72}
    customStyles={{
      columnPosts: { opacity: 0 }
    }}
  />
</div>
\`\`\`
        `,
      },
    },
  },
};

// Multi-Column Invisible
export const MultiColumnInvisible: Story = {
  render: () => (
    <div style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>
        Multi-Column Invisible Posts
      </h3>
      <p
        style={{
          marginBottom: "20px",
          color: "#666",
          maxWidth: "600px",
          margin: "0 auto 20px",
        }}
      >
        Multi-column abacus with invisible posts creates a floating bead pattern
        that emphasizes the bead positions.
      </p>

      <div
        style={{
          display: "flex",
          gap: "60px",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        {/* With visible posts */}
        <div>
          <div
            style={{
              marginBottom: "15px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#6b7280",
            }}
          >
            Standard Display
          </div>
          <AbacusReact
            value={1234}
            columns={4}
            scaleFactor={1.3}
            showNumbers={true}
          />
        </div>

        {/* With invisible posts */}
        <div>
          <div
            style={{
              marginBottom: "15px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#6b7280",
            }}
          >
            Invisible Posts
          </div>
          <AbacusReact
            value={1234}
            columns={4}
            scaleFactor={1.3}
            showNumbers={true}
            customStyles={{
              columnPosts: { opacity: 0 },
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          fontSize: "14px",
          color: "#666",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        The invisible posts create a unique visual effect where beads appear to
        float in organized columns
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
Multi-column abacus with invisible posts demonstrates the floating bead effect across multiple place values.

**Visual Effects:**
- Beads appear to float in precise vertical alignment
- Column structure is implied by bead positioning
- Creates a more abstract, pattern-focused display
- Useful for minimalist or artistic presentations

**Global Column Post Styling:**

The \`columnPosts\` property in \`customStyles\` applies to all columns globally:

\`\`\`typescript
customStyles={{
  columnPosts: { opacity: 0 }  // Applies to ALL columns
}}
\`\`\`

To hide specific columns only, use the column-specific approach:

\`\`\`typescript
customStyles={{
  columns: {
    0: { columnPost: { opacity: 0 } },  // Hide first column only
    2: { columnPost: { opacity: 0 } }   // Hide third column only
  }
}}
\`\`\`
        `,
      },
    },
  },
};
