// Frame enclosure generator — OpenSCAD render worker (Gitea #285, PH2 #288).
//
// A real same-origin ES-module worker. (A blob-URL module worker cannot import
// the absolute engine module in Chrome — it fails opaquely; a hosted file
// works.) The engine is loaded as a runtime static asset, never bundled.
//
// Protocol: the main thread posts { id, files, defines, fn, entry } where
// `files` maps an absolute wasm-FS path → file content (the committed `.scad`
// library as strings; the diff path also injects binary STLs as Uint8Array) and
// `defines` is the `-D name=value` list from web/src/lib/frames/geometry.ts.
// `entry` is the FS path to render (default `/frame.scad`; the option-card ghost
// preview passes `/diff.scad` to subtract two STLs). The worker renders a binary
// STL and posts back its ArrayBuffer (transferred).
//
// A fresh OpenSCAD instance is needed per render: callMain() exits the
// emscripten runtime, so instances are not reusable. With the Manifold backend
// the solve is ~13 ms, so instantiation (~28 ms) is now the dominant cost — we
// keep the *next* instance warming during idle and hand it over the instant a
// render arrives, so the request itself pays only the solve (warm-instance
// pool, Gitea #285 perf pass). The browser caches the compiled module, so this
// is re-instantiation, never re-download.

import OpenSCAD from '/openscad/openscad.js';

/** Ensure every parent directory of an absolute FS path exists. */
function mkdirp(FS, filePath) {
  const parts = filePath.split('/').filter(Boolean);
  parts.pop(); // drop the filename
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    try {
      FS.mkdir(cur);
    } catch {
      // already exists
    }
  }
}

// Engine stdout/stderr is captured into the active render's log rather than
// sprayed to console.warn — kept quiet on success, surfaced on failure. The
// print handlers are bound once at instantiation, so they push to a mutable
// sink that each render swaps to its own array.
let logSink = [];
function createInstance() {
  return OpenSCAD({
    noInitialRun: true,
    print: (line) => logSink.push(line),
    printErr: (line) => logSink.push(line),
  });
}

// Start warming the first instance immediately, before any render request.
let warm = createInstance();

self.onmessage = async (e) => {
  const { id, files, defines, fn, entry } = e.data;
  const t0 = performance.now();
  const log = [];
  logSink = log;
  try {
    const inst = await warm;
    // Begin warming the next instance now; on a single thread its async
    // instantiation runs only once this handler yields (after the solve +
    // postMessage below), filling otherwise-idle time so the *next* render is
    // already warm.
    warm = createInstance();

    for (const [path, content] of Object.entries(files)) {
      mkdirp(inst.FS, path);
      inst.FS.writeFile(path, content);
    }
    const args = [
      entry || '/frame.scad',
      '-o',
      '/out.stl',
      '--export-format=binstl',
      // Manifold CSG backend (OpenSCAD 2025.03.25 build): ~20–38× faster than
      // the old CGAL default on this boolean-heavy solid (~270 ms → ~13 ms at
      // $fn=24), byte-identical geometry. The engine is single-threaded, so no
      // SharedArrayBuffer / COOP-COEP headers are required.
      '--backend=Manifold',
      // textmetrics()/fontmetrics() (experimental builtins) power the scad's
      // overflow-proof auto-fit text sizing — real glyph ink boxes, not guesses.
      '--enable=textmetrics',
      ...(defines || []),
    ];
    if (typeof fn === 'number') args.push(`-Dfn=${Math.max(8, Math.round(fn))}`);
    const rc = inst.callMain(args);
    if (rc !== 0) {
      throw new Error(`OpenSCAD exited with code ${rc}${log.length ? `: ${log.join(' ').slice(-200)}` : ''}`);
    }
    const out = inst.FS.readFile('/out.stl');
    self.postMessage(
      { id, ok: true, stl: out.buffer, ms: Math.round(performance.now() - t0) },
      [out.buffer],
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
