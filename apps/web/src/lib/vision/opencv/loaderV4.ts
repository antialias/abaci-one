"use client";

/**
 * OpenCV.js Loader v4 - imports from working files.
 */

import { addOpenCVScript } from "./addScript";
import { waitForCv } from "./waitForCv";

export async function loadOpenCVv4(): Promise<unknown> {
  addOpenCVScript();
  await waitForCv();
  return (window as unknown as { cv: unknown }).cv;
}
