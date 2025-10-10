"use client";

import { AbacusReact } from "@soroban/abacus-react";

interface AbacusTargetProps {
  number: number; // The complement number to display
}

/**
 * Displays a small abacus showing a complement number inline in the equation
 * Used to help learners recognize the abacus representation of complement numbers
 */
export function AbacusTarget({ number }: AbacusTargetProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
      }}
    >
      <AbacusReact
        value={number}
        columns={1}
        interactive={false}
        showNumbers={false}
        hideInactiveBeads={true}
        scaleFactor={0.72}
        customStyles={{
          columnPosts: { opacity: 0 },
        }}
      />
    </div>
  );
}
