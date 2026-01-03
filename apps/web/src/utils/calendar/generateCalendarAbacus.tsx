/**
 * Generate a simple abacus SVG element
 * Uses AbacusStatic for server-side rendering (no client hooks)
 */

import React from "react";
import { AbacusStatic } from "@soroban/abacus-react/static";

export function generateAbacusElement(value: number, columns: number) {
  return (
    <AbacusStatic
      value={value}
      columns={columns}
      scaleFactor={1}
      showNumbers={false}
      frameVisible={true}
    />
  );
}
