"use client";

import { useState } from "react";
import { PlayingGuideModal } from "@/arcade-games/rithmomachia/components/PlayingGuideModal";

export default function RithmomachiaGuidePage() {
  // Guide is always open in this standalone page
  const [isOpen] = useState(true);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#f3f4f6",
      }}
    >
      <PlayingGuideModal
        isOpen={isOpen}
        onClose={() => window.close()}
        standalone={true}
      />
    </div>
  );
}
