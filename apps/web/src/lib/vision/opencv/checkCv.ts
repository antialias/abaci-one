"use client";

/**
 * Simple function that just checks window.cv - no loading.
 */
export function checkWindowCv(): { exists: boolean; hasImread: boolean } {
  console.log("[checkCv] checkWindowCv called");

  if (typeof window === "undefined") {
    console.log("[checkCv] window is undefined");
    return { exists: false, hasImread: false };
  }

  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
  console.log("[checkCv] window.cv:", cv);

  const exists = !!cv;
  const hasImread = !!(cv && typeof cv.imread === "function");

  console.log("[checkCv] result:", { exists, hasImread });
  return { exists, hasImread };
}
