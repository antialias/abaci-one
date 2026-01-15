"use client";

/**
 * OpenCV.js Loader v2 - using the proven working pattern.
 */

import type { CV } from "./types";

let cvInstance: CV | null = null;
let loadPromise: Promise<CV> | null = null;

function isReady(): boolean {
  if (typeof window === "undefined") return false;
  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
  return !!(cv && typeof cv.imread === "function");
}

function addScript(): void {
  if (typeof window === "undefined") return;
  const existingScript = document.querySelector('script[src="/opencv.js"]');
  if (existingScript) return;
  const script = document.createElement("script");
  script.src = "/opencv.js";
  script.async = true;
  document.head.appendChild(script);
}

function waitForReady(timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isReady()) {
      resolve();
      return;
    }
    const startTime = Date.now();
    const check = () => {
      if (isReady()) {
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error("OpenCV.js initialization timed out"));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

export async function loadOpenCVv2(): Promise<CV> {
  if (cvInstance) return cvInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    addScript();
    await waitForReady();
    cvInstance = (window as unknown as { cv: CV }).cv;
    return cvInstance;
  })();

  return loadPromise;
}

export function isOpenCVReadyV2(): boolean {
  return isReady();
}

export function getOpenCVv2(): CV | null {
  return cvInstance;
}
