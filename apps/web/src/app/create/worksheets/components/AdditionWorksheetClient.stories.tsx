import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ConfigSidebar } from "./ConfigSidebar";
import { ResponsivePanelLayout } from "./ResponsivePanelLayout";
import { WorksheetConfigProvider } from "./WorksheetConfigContext";
import { PagePlaceholder } from "./PagePlaceholder";
import type { WorksheetFormState } from "../types";

const meta = {
  title: "Worksheets/Complete/Full Worksheet Generator",
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock preview component that simulates virtual loading without API calls
function MockPreviewWithVirtualLoading({
  pages = 5,
  formState,
}: {
  pages?: number;
  formState: WorksheetFormState;
}) {
  const [loadedPages, setLoadedPages] = useState(new Set([0]));

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        background: "#e5e7eb",
        padding: "20px",
      }}
      onScroll={(e) => {
        const container = e.currentTarget;
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;

        // Simulate loading pages as they come into view
        const pageHeight = 1104; // 1056px + 48px gap
        const visiblePageStart = Math.floor(scrollTop / pageHeight);
        const visiblePageEnd = Math.ceil(
          (scrollTop + clientHeight) / pageHeight,
        );

        const newLoadedPages = new Set(loadedPages);
        for (
          let i = visiblePageStart;
          i <= Math.min(visiblePageEnd, pages - 1);
          i++
        ) {
          if (!newLoadedPages.has(i)) {
            newLoadedPages.add(i);
            // Simulate async loading delay
            setTimeout(() => {
              setLoadedPages((prev) => new Set([...prev, i]));
            }, 500);
          }
        }
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "48px",
          alignItems: "center",
        }}
      >
        {Array.from({ length: pages }).map((_, index) => {
          const orientation = formState.orientation || "portrait";
          const maxWidth = orientation === "portrait" ? "816px" : "1056px";

          return (
            <div key={index} style={{ width: "100%", maxWidth }}>
              <PagePlaceholder
                pageNumber={index + 1}
                orientation={orientation}
                rows={Math.ceil(
                  (formState.problemsPerPage || 20) / (formState.cols || 4),
                )}
                cols={formState.cols || 4}
                loading={!loadedPages.has(index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const mockFormState: WorksheetFormState = {
  operator: "addition",
  mode: "manual",
  digitRange: { min: 2, max: 3 },
  problemsPerPage: 20,
  pages: 5,
  cols: 4,
  orientation: "portrait",
  name: "Student Name",
  displayRules: {
    tenFrames: "sometimes",
    carryBoxes: "sometimes",
    placeValueColors: "sometimes",
    answerBoxes: "always",
    problemNumbers: "always",
    cellBorders: "always",
    borrowNotation: "never",
    borrowingHints: "never",
  },
  pAnyStart: 0.3,
  pAllStart: 0.1,
  interpolate: false,
  seed: 12345,
};

function FullWorksheetGenerator({
  initialState,
}: {
  initialState?: Partial<WorksheetFormState>;
}) {
  const [formState, setFormState] = useState<WorksheetFormState>({
    ...mockFormState,
    ...initialState,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const updateFormState = (updates: Partial<WorksheetFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));

    // Simulate auto-save
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 1000);
  };

  return (
    <WorksheetConfigProvider
      formState={formState}
      updateFormState={updateFormState}
    >
      <div style={{ height: "100vh", width: "100vw" }}>
        <ResponsivePanelLayout
          config={formState}
          sidebarContent={
            <ConfigSidebar isSaving={isSaving} lastSaved={lastSaved} />
          }
          previewContent={
            <MockPreviewWithVirtualLoading
              formState={formState}
              pages={formState.pages}
            />
          }
        />
      </div>
    </WorksheetConfigProvider>
  );
}

export const CompleteGenerator: Story = {
  render: () => {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#eff6ff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "800px",
          }}
        >
          <strong>🎨 Complete Worksheet Studio:</strong> This is the full
          worksheet generator interface with all features. Try adjusting
          settings in the sidebar and watch the preview update. Resize the
          panels by dragging the divider. Scroll through pages to see virtual
          loading in action.
        </div>
        <FullWorksheetGenerator />
      </div>
    );
  },
};

export const VirtualLoadingDemo: Story = {
  render: () => {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#fef3c7",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "800px",
          }}
        >
          <strong>⚡ Virtual Loading:</strong> This worksheet has 20 pages (400
          problems). Notice how only the first 3 pages load initially. As you
          scroll down in the preview panel, pages load on-demand with a loading
          spinner, then display content. This keeps the app fast even with
          hundreds of problems!
        </div>
        <FullWorksheetGenerator initialState={{ pages: 20 }} />
      </div>
    );
  },
};

export const ExtremeScaleTest: Story = {
  render: () => {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#fee2e2",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "800px",
          }}
        >
          <strong>🚀 Extreme Scale:</strong> 50 pages × 20 problems = 1,000
          problems! Virtual loading + React Query caching make this performant.
          Only visible pages are loaded and rendered. Scrolling remains smooth
          throughout.
        </div>
        <FullWorksheetGenerator initialState={{ pages: 50 }} />
      </div>
    );
  },
};

export const AdditionWorksheet: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        operator: "addition",
        mode: "manual",
        digitRange: { min: 2, max: 3 },
      }}
    />
  ),
};

export const SubtractionWorksheet: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        operator: "subtraction",
        mode: "manual",
        digitRange: { min: 2, max: 3 },
      }}
    />
  ),
};

export const MixedOperations: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        operator: "mixed",
        mode: "manual",
        digitRange: { min: 2, max: 3 },
      }}
    />
  ),
};

export const SmartModeEarlyLearner: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        mode: "custom",
        difficultyProfile: "earlyLearner",
        pages: 3,
      }}
    />
  ),
};

export const SmartModeAdvanced: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        mode: "custom",
        difficultyProfile: "advanced",
        pages: 5,
      }}
    />
  ),
};

export const LandscapeLayout: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        orientation: "landscape",
        cols: 5,
        problemsPerPage: 25,
        pages: 4,
      }}
    />
  ),
};

export const DenseLayout: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        problemsPerPage: 40,
        cols: 5,
        orientation: "landscape",
        pages: 3,
      }}
    />
  ),
};

export const SparseLayout: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        problemsPerPage: 10,
        cols: 2,
        pages: 3,
      }}
    />
  ),
};

export const SinglePageWorksheet: Story = {
  render: () => (
    <FullWorksheetGenerator
      initialState={{
        pages: 1,
        problemsPerPage: 20,
      }}
    />
  ),
};

export const ResponsiveDemo: Story = {
  render: () => {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#eff6ff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "800px",
          }}
        >
          <strong>📱 Responsive Layout:</strong> On desktop, you see resizable
          panels (drag the divider!). On mobile, the config panel becomes a
          drawer accessible via a floating button. Try resizing your browser
          window to see the layout adapt.
        </div>
        <FullWorksheetGenerator />
      </div>
    );
  },
};

export const AutoSaveDemo: Story = {
  render: () => {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#d1fae5",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "800px",
          }}
        >
          <strong>💾 Auto-Save:</strong> Watch the top-right corner of the
          sidebar as you change settings. You'll see "Saving..." appear briefly,
          then "✓ Saved" when complete. Settings are automatically saved to
          localStorage so you can return to your work later.
        </div>
        <FullWorksheetGenerator />
      </div>
    );
  },
};

export const ArchitectureOverview: Story = {
  render: () => {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          gap: "20px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            background: "#f3f4f6",
            padding: "24px",
            borderRadius: "12px",
            maxWidth: "1000px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <h2
            style={{ margin: "0 0 20px 0", fontSize: "24px", fontWeight: 600 }}
          >
            Worksheet Generator Architecture
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              fontSize: "14px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                🏗️ Component Hierarchy
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#6b7280" }}>
                <li>AdditionWorksheetClient (top-level)</li>
                <li style={{ marginLeft: "20px" }}>ResponsivePanelLayout</li>
                <li style={{ marginLeft: "40px" }}>ConfigSidebar</li>
                <li style={{ marginLeft: "60px" }}>TabNavigation</li>
                <li style={{ marginLeft: "60px" }}>
                  ContentTab / LayoutTab / etc.
                </li>
                <li style={{ marginLeft: "40px" }}>PreviewCenter</li>
                <li style={{ marginLeft: "60px" }}>WorksheetPreview</li>
                <li style={{ marginLeft: "80px" }}>
                  PagePlaceholder (virtual)
                </li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                ⚡ Key Technologies
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#6b7280" }}>
                <li>React Query (caching, pagination)</li>
                <li>Intersection Observer (virtualization)</li>
                <li>react-resizable-panels (desktop layout)</li>
                <li>Context API (form state management)</li>
                <li>localStorage (auto-save persistence)</li>
                <li>sessionStorage (tab selection)</li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                📦 Virtual Loading System
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#6b7280" }}>
                <li>Initial batch: 3 pages</li>
                <li>Triggers at 50% viewport distance</li>
                <li>Preloads adjacent pages (±1)</li>
                <li>Groups consecutive pages into batch requests</li>
                <li>React Query deduplication</li>
                <li>Handles 50+ pages smoothly</li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                💾 State Management
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#6b7280" }}>
                <li>formState (immediate updates)</li>
                <li>debouncedFormState (preview updates)</li>
                <li>Auto-save to localStorage (2s debounce)</li>
                <li>Query cache invalidation on config change</li>
                <li>Optimistic UI updates</li>
              </ul>
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              background: "#eff6ff",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
            <strong>🎯 Performance Optimization:</strong>
            <p style={{ margin: "8px 0 0 0", color: "#3b82f6" }}>
              Virtual loading + React Query caching + debounced updates +
              Intersection Observer = Smooth UX even with 1,000+ problems. Only
              visible pages are rendered, adjacent pages are preloaded, and
              fetched data is cached for instant scrolling back.
            </p>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: "600px",
            maxWidth: "1000px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          <FullWorksheetGenerator initialState={{ pages: 15 }} />
        </div>
      </div>
    );
  },
};
