/**
 * Type declarations for Yjs CJS builds
 * These packages provide ESM types but we need to import CJS builds for Node.js server compatibility
 */

declare module "y-protocols/dist/sync.cjs" {
  import type * as syncProtocol from "y-protocols/sync";
  export = syncProtocol;
}

declare module "y-protocols/dist/awareness.cjs" {
  import type * as awarenessProtocol from "y-protocols/awareness";
  export = awarenessProtocol;
}

declare module "lib0/dist/encoding.cjs" {
  import type * as encoding from "lib0/encoding";
  export = encoding;
}

declare module "lib0/dist/decoding.cjs" {
  import type * as decoding from "lib0/decoding";
  export = decoding;
}
