/// <reference lib="webworker" />

import { createOpenSCAD } from "openscad-wasm-prebuilt";

declare const self: DedicatedWorkerGlobalScope;

let openscad: Awaited<ReturnType<typeof createOpenSCAD>> | null = null;
let simplifiedStlData: ArrayBuffer | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

// Message types
interface RenderRequest {
  type: "render";
  columns: number;
  scaleFactor: number;
}

interface InitRequest {
  type: "init";
}

type WorkerRequest = RenderRequest | InitRequest;

// Initialize OpenSCAD instance and load base STL file
async function initialize() {
  if (openscad) return; // Already initialized
  if (isInitializing) return initPromise; // Already initializing, return existing promise

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log("[OpenSCAD Worker] Initializing...");

      // Create OpenSCAD instance
      openscad = await createOpenSCAD();
      console.log("[OpenSCAD Worker] OpenSCAD WASM loaded");

      // Fetch the simplified STL file once
      const stlResponse = await fetch("/3d-models/simplified.abacus.stl");
      if (!stlResponse.ok) {
        throw new Error(`Failed to fetch STL: ${stlResponse.statusText}`);
      }
      simplifiedStlData = await stlResponse.arrayBuffer();
      console.log(
        "[OpenSCAD Worker] Simplified STL loaded",
        simplifiedStlData.byteLength,
        "bytes",
      );

      self.postMessage({ type: "ready" });
    } catch (error) {
      console.error("[OpenSCAD Worker] Initialization failed:", error);
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Initialization failed",
      });
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

async function render(columns: number, scaleFactor: number) {
  // Wait for initialization if not ready
  if (!openscad || !simplifiedStlData) {
    await initialize();
  }

  if (!openscad || !simplifiedStlData) {
    throw new Error("Worker not initialized");
  }

  try {
    console.log(
      `[OpenSCAD Worker] Rendering with columns=${columns}, scaleFactor=${scaleFactor}`,
    );

    // Get low-level instance for filesystem access
    const instance = openscad.getInstance();

    // Create directory if it doesn't exist
    try {
      instance.FS.mkdir("/3d-models");
      console.log("[OpenSCAD Worker] Created /3d-models directory");
    } catch (e: any) {
      // Check if it's EEXIST (directory already exists) - errno 20
      if (e.errno === 20) {
        console.log("[OpenSCAD Worker] /3d-models directory already exists");
      } else {
        console.error("[OpenSCAD Worker] Failed to create directory:", e);
        throw new Error(
          `Failed to create /3d-models directory: ${e.message || e}`,
        );
      }
    }

    // Write STL file
    instance.FS.writeFile(
      "/3d-models/simplified.abacus.stl",
      new Uint8Array(simplifiedStlData),
    );
    console.log("[OpenSCAD Worker] Wrote simplified STL to filesystem");

    // Generate the SCAD code with parameters
    const scadCode = `
// Inline version of abacus.scad that doesn't require BOSL2
columns = ${columns};
scale_factor = ${scaleFactor};

stl_path = "/3d-models/simplified.abacus.stl";

// Known bounding box dimensions
bbox_size = [186, 60, 120];

// Calculate parameters
total_columns_in_stl = 13;
columns_per_side = columns / 2;
width_scale = columns_per_side / total_columns_in_stl;

units_per_column = bbox_size[0] / total_columns_in_stl;
column_spacing = columns_per_side * units_per_column;

// Model modules
module imported() {
    import(stl_path, convexity = 10);
}

module bounding_box_manual() {
    translate([-bbox_size[0]/2, -bbox_size[1]/2, -bbox_size[2]/2])
        cube(bbox_size);
}

module half_abacus() {
    intersection() {
        scale([width_scale, 1, 1]) bounding_box_manual();
        imported();
    }
}

scale([scale_factor, scale_factor, scale_factor]) {
    translate([column_spacing, 0, 0]) mirror([1,0,0]) half_abacus();
    half_abacus();
}
`;

    // Use high-level renderToStl API
    console.log("[OpenSCAD Worker] Calling renderToStl...");
    const stlBuffer = await openscad.renderToStl(scadCode);
    console.log(
      "[OpenSCAD Worker] Rendering complete:",
      stlBuffer.byteLength,
      "bytes",
    );

    // Send the result back
    self.postMessage(
      {
        type: "result",
        stl: stlBuffer,
      },
      [stlBuffer],
    ); // Transfer ownership of the buffer

    // Clean up STL file
    try {
      instance.FS.unlink("/3d-models/simplified.abacus.stl");
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.error("[OpenSCAD Worker] Rendering failed:", error);

    // Try to get more error details
    let errorMessage = "Rendering failed";
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("[OpenSCAD Worker] Error stack:", error.stack);
    }

    // Check if it's an Emscripten FS error
    if (error && typeof error === "object" && "errno" in error) {
      console.error("[OpenSCAD Worker] FS errno:", (error as any).errno);
      console.error("[OpenSCAD Worker] FS error details:", error);
    }

    self.postMessage({
      type: "error",
      error: errorMessage,
    });
  }
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { data } = event;

  try {
    switch (data.type) {
      case "init":
        await initialize();
        break;

      case "render":
        await render(data.columns, data.scaleFactor);
        break;

      default:
        console.error("[OpenSCAD Worker] Unknown message type:", data);
    }
  } catch (error) {
    console.error("[OpenSCAD Worker] Message handler error:", error);
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Auto-initialize on worker start
initialize();
