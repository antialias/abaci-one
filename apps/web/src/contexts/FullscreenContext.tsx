"use client";

import type React from "react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface FullscreenContextType {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  setFullscreenElement: (element: HTMLElement | null) => void;
  fullscreenElementRef: React.MutableRefObject<HTMLElement | null>;
}

const FullscreenContext = createContext<FullscreenContextType | null>(null);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
    };
  }, []);

  const setFullscreenElement = useCallback((element: HTMLElement | null) => {
    console.log("🔧 FullscreenContext: Setting fullscreen element:", element);
    fullscreenElementRef.current = element;
  }, []);

  const enterFullscreen = async () => {
    try {
      // Use the registered fullscreen element, fallback to document.documentElement
      const element = fullscreenElementRef.current || document.documentElement;
      console.log(
        "🚀 FullscreenContext: Entering fullscreen with element:",
        element,
      );
      console.log(
        "🚀 FullscreenContext: Current fullscreen element ref:",
        fullscreenElementRef.current,
      );

      if (element.requestFullscreen) {
        await element.requestFullscreen();
        console.log("✅ FullscreenContext: requestFullscreen() succeeded");
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
        console.log(
          "✅ FullscreenContext: webkitRequestFullscreen() succeeded",
        );
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
        console.log("✅ FullscreenContext: mozRequestFullScreen() succeeded");
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
        console.log("✅ FullscreenContext: msRequestFullscreen() succeeded");
      }
    } catch (error) {
      console.error("❌ FullscreenContext: Failed to enter fullscreen:", error);
      throw error;
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error("Failed to exit fullscreen:", error);
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  return (
    <FullscreenContext.Provider
      value={{
        isFullscreen,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
        setFullscreenElement,
        fullscreenElementRef,
      }}
    >
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen(): FullscreenContextType {
  const context = useContext(FullscreenContext);
  if (!context) {
    throw new Error("useFullscreen must be used within a FullscreenProvider");
  }
  return context;
}
