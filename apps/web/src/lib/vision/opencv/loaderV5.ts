"use client";

/**
 * OpenCV.js Loader v5 - returns Promise without internal await.
 * The await happens in the consumer, not in this module.
 */

import { addOpenCVScript } from "./addScript";
import { waitForCv } from "./waitForCv";

// Returns the Promise directly - NO internal await
export function loadOpenCVv5(): Promise<unknown> {
  addOpenCVScript();

  // Return the promise chain - let consumer await it
  return waitForCv().then(() => {
    return (window as unknown as { cv: unknown }).cv;
  });
}
