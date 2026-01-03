"use client";

import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@styled/css";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MobileDrawer } from "@/app/create/worksheets/components/MobileDrawer";
import { SharedSettingsButton } from "./SharedSettingsButton";
import type { WorksheetFormState } from "@/app/create/worksheets/types";

interface ResponsiveSharedLayoutProps {
  config: WorksheetFormState;
  sidebarContent: React.ReactNode;
  previewContent: React.ReactNode;
  isDark: boolean;
}

export function ResponsiveSharedLayout({
  config,
  sidebarContent,
  previewContent,
  isDark,
}: ResponsiveSharedLayoutProps) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // eslint-disable-next-line react-hooks/rules-of-hooks -- All hooks are called before this conditional return
  if (isMobile) {
    return (
      <>
        {/* Full-screen preview on mobile */}
        <div className={css({ h: "full", overflow: "hidden" })}>
          {previewContent}
        </div>

        {/* Floating settings button */}
        <SharedSettingsButton
          config={config}
          onClick={() => setIsDrawerOpen(true)}
        />

        {/* Settings drawer */}
        <MobileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        >
          {sidebarContent}
        </MobileDrawer>
      </>
    );
  }

  // Desktop: Resizable panels
  const resizeHandleStyles = css({
    width: "8px",
    bg: isDark ? "gray.700" : "gray.200",
    position: "relative",
    cursor: "col-resize",
    transition: "background 0.2s",
    _hover: {
      bg: isDark ? "brand.600" : "brand.400",
    },
    _active: {
      bg: "brand.500",
    },
    _before: {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "3px",
      height: "20px",
      bg: isDark ? "gray.600" : "gray.300",
      rounded: "full",
    },
  });

  return (
    <PanelGroup
      direction="horizontal"
      className={css({ flex: "1", minHeight: "0" })}
    >
      {/* Left sidebar - Config controls (read-only) */}
      <Panel
        defaultSize={25}
        minSize={20}
        maxSize={35}
        className={css({
          overflow: "auto",
          p: "4",
          bg: isDark ? "gray.800" : "white",
          borderRight: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        {sidebarContent}
      </Panel>

      <PanelResizeHandle className={resizeHandleStyles} />

      {/* Center - Preview */}
      <Panel
        defaultSize={75}
        minSize={50}
        className={css({ overflow: "hidden" })}
      >
        {previewContent}
      </Panel>
    </PanelGroup>
  );
}
