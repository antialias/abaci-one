import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PagePlaceholder } from "./PagePlaceholder";
import type { WorksheetFormState } from "../types";

const meta = {
  title: "Worksheets/Preview/WorksheetPreview",
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
        // Each page is about 1056px + 48px gap = 1104px
        const pageHeight = 1104;
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

// Wrapper component
function PreviewWrapper({
  formState,
  pages,
}: {
  formState: WorksheetFormState;
  pages?: number;
}) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <MockPreviewWithVirtualLoading formState={formState} pages={pages} />
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

export const SinglePage: Story = {
  render: () => (
    <PreviewWrapper formState={{ ...mockFormState, pages: 1 }} pages={1} />
  ),
};

export const FivePages: Story = {
  render: () => <PreviewWrapper formState={mockFormState} pages={5} />,
};

export const ManyPages: Story = {
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
            maxWidth: "700px",
          }}
        >
          <strong>⚡ Virtual Loading Demo:</strong> This worksheet has 20 pages
          (400 problems). Only visible pages are loaded. Scroll down to see
          pages load on-demand with a loading state (hourglass), then display
          content. Notice smooth scrolling even with hundreds of problems!
        </div>
        <PreviewWrapper
          formState={{ ...mockFormState, pages: 20 }}
          pages={20}
        />
      </div>
    );
  },
};

export const ExtremeScale: Story = {
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
            maxWidth: "700px",
          }}
        >
          <strong>🚀 Extreme Scale:</strong> 50 pages × 20 problems = 1,000
          problems! Virtual loading makes this performant. Only 3 pages load
          initially, rest load as you scroll. Try scrolling through - it stays
          smooth!
        </div>
        <PreviewWrapper
          formState={{ ...mockFormState, pages: 50 }}
          pages={50}
        />
      </div>
    );
  },
};

export const LandscapeOrientation: Story = {
  render: () => (
    <PreviewWrapper
      formState={{
        ...mockFormState,
        orientation: "landscape",
        cols: 5,
        pages: 5,
      }}
      pages={5}
    />
  ),
};

export const DenseLayout: Story = {
  render: () => (
    <PreviewWrapper
      formState={{ ...mockFormState, problemsPerPage: 30, cols: 5, pages: 3 }}
      pages={3}
    />
  ),
};

export const SparseLayout: Story = {
  render: () => (
    <PreviewWrapper
      formState={{ ...mockFormState, problemsPerPage: 10, cols: 2, pages: 5 }}
      pages={5}
    />
  ),
};

export const InitialLoadingState: Story = {
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
          }}
        >
          <strong>🔄 Loading Behavior:</strong> This demonstrates the initial
          loading state. The first page loads immediately, others show
          placeholders with a loading spinner until you scroll them into view.
        </div>
        <PreviewWrapper
          formState={{ ...mockFormState, pages: 10 }}
          pages={10}
        />
      </div>
    );
  },
};

export const VirtualizationExplained: Story = {
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
            padding: "20px",
            borderRadius: "12px",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <h2
            style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: 600 }}
          >
            Virtual Loading System
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "14px",
            }}
          >
            <div>
              <strong>📦 Batch Loading:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280" }}>
                Initial request loads first 3 pages. Additional pages load in
                batches as you scroll.
              </p>
            </div>
            <div>
              <strong>👁️ Intersection Observer:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280" }}>
                Tracks which pages are visible in the viewport. Triggers loading
                when pages come into view.
              </p>
            </div>
            <div>
              <strong>🎯 Smart Preloading:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280" }}>
                When a page becomes visible, adjacent pages (above and below)
                are also loaded for smooth scrolling.
              </p>
            </div>
            <div>
              <strong>⚡ Performance:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280" }}>
                Handles 50+ page worksheets (1,000+ problems) smoothly. Only
                renders what's needed.
              </p>
            </div>
            <div>
              <strong>💾 React Query Caching:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#6b7280" }}>
                Fetched pages are cached. Scrolling back doesn't re-fetch.
                Changes to settings invalidate cache.
              </p>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: "600px" }}>
          <PreviewWrapper
            formState={{ ...mockFormState, pages: 15 }}
            pages={15}
          />
        </div>
      </div>
    );
  },
};
